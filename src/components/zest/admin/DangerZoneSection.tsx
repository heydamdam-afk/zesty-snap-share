import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useAdminContext, useIsOrganisateur } from "./AdminContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { AlertTriangle, Loader2, Trash2 } from "lucide-react";
import { deleteEventCascade } from "@/server/event-admin.functions";

export function DangerZoneSection() {
  const { event } = useAdminContext();
  const isOrg = useIsOrganisateur();
  const navigate = useNavigate();

  const [open, setOpen] = useState(false);
  const [confirmTitre, setConfirmTitre] = useState("");
  const [pending, setPending] = useState(false);

  if (!isOrg) {
    return (
      <section className="rounded-2xl border border-dashed border-border bg-card p-6 shadow-card">
        <h2 className="font-display text-xl text-foreground">Zone dangereuse</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Seul l'organisateur peut supprimer définitivement l'événement.
        </p>
      </section>
    );
  }

  const handleDelete = async () => {
    setPending(true);
    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) throw new Error("Session expirée");
      await deleteEventCascade({
        data: {
          eventId: event.id,
          adminToken: token,
          confirmTitre,
        },
      });
      toast.success("Événement supprimé.");
      await supabase.auth.signOut();
      navigate({ to: "/" });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Échec de la suppression";
      toast.error(msg);
      setPending(false);
    }
  };

  const titreMatches = confirmTitre.trim() === event.titre.trim();

  return (
    <section className="rounded-2xl border border-destructive/30 bg-destructive/5 p-6 shadow-card">
      <header className="mb-4 flex items-start gap-3">
        <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-destructive/15 text-destructive">
          <AlertTriangle className="h-5 w-5" />
        </div>
        <div>
          <h2 className="font-display text-xl text-foreground">
            Zone dangereuse
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Supprimer définitivement cet événement. Toutes les photos,
            commentaires, likes et invités seront perdus. Cette action
            est irréversible.
          </p>
        </div>
      </header>

      <Button
        variant="destructive"
        onClick={() => {
          setConfirmTitre("");
          setOpen(true);
        }}
      >
        <Trash2 className="mr-2 h-4 w-4" />
        Supprimer l'événement
      </Button>

      <AlertDialog
        open={open}
        onOpenChange={(o) => {
          if (!pending) setOpen(o);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer définitivement ?</AlertDialogTitle>
            <AlertDialogDescription>
              Cette action supprime l'événement <strong>{event.titre}</strong>,
              toutes ses photos (sur le stockage et en base), tous les
              commentaires, likes, invités et admins. Aucune restauration
              n'est possible.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-2">
            <Label htmlFor="confirm-titre" className="text-sm">
              Pour confirmer, retapez le titre exact de l'événement :
            </Label>
            <Input
              id="confirm-titre"
              value={confirmTitre}
              onChange={(e) => setConfirmTitre(e.target.value)}
              placeholder={event.titre}
              disabled={pending}
              autoFocus
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                if (!titreMatches) return;
                void handleDelete();
              }}
              disabled={!titreMatches || pending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {pending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Suppression…
                </>
              ) : (
                "Supprimer définitivement"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}