import { useEffect, useRef, useState } from "react";
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
import { AlertTriangle, CheckCircle2, Download, Loader2, Lock, Trash2 } from "lucide-react";

export function DangerZoneSection() {
  const { event, reloadEvent } = useAdminContext();
  const isOrg = useIsOrganisateur();
  const navigate = useNavigate();

  const [open, setOpen] = useState(false);
  const [confirmTitre, setConfirmTitre] = useState("");
  const [pending, setPending] = useState(false);

  const [freezeOpen, setFreezeOpen] = useState(false);
  const [freezing, setFreezing] = useState(false);
  const [zipGaveUp, setZipGaveUp] = useState(false);
  const pollStartedRef = useRef(false);

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
      if (confirmTitre.trim() !== event.titre.trim()) {
        throw new Error("Le titre de confirmation ne correspond pas.");
      }
      const { error } = await supabase
        .from("events")
        .update({ status: "archived" })
        .eq("id", event.id);
      if (error) throw error;
      toast.success("Événement supprimé.");
      await supabase.auth.signOut();
      window.location.href = "https://kapsul.events";
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Échec de la suppression";
      toast.error(msg);
      setPending(false);
    }
  };

  const titreMatches = confirmTitre.trim() === event.titre.trim();

  const isFrozen = !!event.frozen_at;

  useEffect(() => {
    if (!isFrozen) {
      pollStartedRef.current = false;
      setZipGaveUp(false);
      return;
    }
    if (event.zip_download_url) {
      setZipGaveUp(false);
      return;
    }
    if (pollStartedRef.current) return;
    pollStartedRef.current = true;
    setZipGaveUp(false);
    let cancelled = false;
    let attempts = 0;
    const tick = async () => {
      if (cancelled) return;
      attempts += 1;
      const { data } = await supabase
        .from("events")
        .select("zip_download_url")
        .eq("id", event.id)
        .single();
      if (cancelled) return;
      if (data?.zip_download_url) {
        await reloadEvent();
        return;
      }
      if (attempts >= 10) {
        setZipGaveUp(true);
        return;
      }
      setTimeout(() => void tick(), 3000);
    };
    setTimeout(() => void tick(), 3000);
    return () => {
      cancelled = true;
    };
  }, [isFrozen, event.id, event.zip_download_url, reloadEvent]);

  const handleFreeze = async () => {
    setFreezing(true);
    try {
      const { error } = await supabase
        .from("events")
        .update({
          status: "frozen",
          frozen_at: new Date().toISOString(),
          uploads_actifs: false,
          commentaires_actifs: false,
          likes_actifs: false,
        })
        .eq("id", event.id);
      if (error) {
        toast.error("Erreur lors de la clôture. Réessayez.");
        return;
      }

      await reloadEvent();

      try {
        const { data: userData } = await supabase.auth.getUser();
        const currentUser = userData.user;
        const eventId = event.id;
        const { data: adminsData } = await supabase
          .from("event_admins")
          .select("email")
          .eq("event_id", eventId);
        const adminsEmails = (adminsData ?? [])
          .map((a) => a.email)
          .filter((e): e is string => !!e);
        void fetch('https://kapsul.app.n8n.cloud/webhook/freeze-event', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            event_id: eventId,
            titre: event.titre,
            owner_email: currentUser?.email,
            owner_prenom:
              (currentUser as { prenom?: string } | null)?.prenom ??
              currentUser?.user_metadata?.prenom ??
              '',
            admins_emails: adminsEmails,
          }),
        }).catch((e) => {
          console.error("freeze webhook failed", e);
        });
      } catch (e) {
        console.error("freeze webhook failed", e);
      }

      setFreezeOpen(false);
      toast.success(
        "Événement clôturé. Vous recevrez le lien de téléchargement par email.",
      );
    } finally {
      setFreezing(false);
    }
  };

  const formattedFrozen = event.frozen_at
    ? new Date(event.frozen_at).toLocaleDateString("fr-FR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      })
    : "";

  const downloadDaysLeft = event.expire_at
    ? Math.floor(
        (new Date(event.expire_at).getTime() + 7 * 86400000 - Date.now()) /
          86400000,
      )
    : null;

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

      {isFrozen ? (
        <div className="mb-4 rounded-lg border border-emerald-300 bg-emerald-50 p-3 text-sm text-emerald-800">
          {event.zip_download_url ? (
            <>
              <div className="flex items-center gap-2 font-medium">
                <CheckCircle2 className="h-4 w-4" />
                <span>Événement clôturé le {formattedFrozen}</span>
              </div>
              <a
                href={event.zip_download_url}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-3 inline-flex w-full items-center justify-center gap-2 text-sm font-medium text-white"
                style={{
                  backgroundColor: "#00AB55",
                  borderRadius: 8,
                  padding: 12,
                }}
              >
                <Download className="h-4 w-4" />
                Télécharger toutes les photos
              </a>
              {downloadDaysLeft !== null && downloadDaysLeft > 0 && (
                <p className="mt-2 text-xs text-emerald-800/80">
                  Il reste encore {downloadDaysLeft} jours pour télécharger vos photos.
                </p>
              )}
            </>
          ) : zipGaveUp ? (
            <div className="flex items-center gap-2 font-medium">
              <CheckCircle2 className="h-4 w-4" />
              <span>✓ Événement clôturé — aucune photo à télécharger</span>
            </div>
          ) : (
            <div className="flex items-center gap-2 font-medium">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Préparation de votre ZIP…</span>
            </div>
          )}
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setFreezeOpen(true)}
          className="mb-4 inline-flex w-full items-center justify-center gap-2 rounded-lg border border-[#FF4842] bg-white px-3 py-3 text-sm font-medium text-[#FF4842] hover:bg-[#FF4842]/5"
        >
          <Lock className="h-4 w-4" />
          Clôturer l'événement
        </button>
      )}

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
        open={freezeOpen}
        onOpenChange={(o) => {
          if (!freezing) setFreezeOpen(o);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Clôturer l'événement ?</AlertDialogTitle>
            <AlertDialogDescription>
              Les invités ne pourront plus ajouter de photos ni de commentaires.
              La galerie reste consultable. Vous recevrez le lien de
              téléchargement de toutes les photos par email dans quelques
              minutes.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={freezing}>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                void handleFreeze();
              }}
              disabled={freezing}
              className="border border-[#FF4842] bg-white text-[#FF4842] hover:bg-[#FF4842]/5"
            >
              {freezing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Clôture en cours…
                </>
              ) : (
                "Oui, clôturer"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

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