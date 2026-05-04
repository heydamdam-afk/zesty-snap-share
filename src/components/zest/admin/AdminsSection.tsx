import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAdminContext, useIsOrganisateur } from "./AdminContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
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
import { Crown, Loader2, Trash2, UserPlus, ArrowUpRight } from "lucide-react";
import { z } from "zod";

type AdminRow = {
  id: string;
  email: string;
  prenom: string | null;
  role: "organisateur" | "secondaire";
  user_id: string | null;
  created_at: string;
};

const inviteSchema = z.object({
  email: z.string().trim().email("Email invalide").max(255),
  prenom: z.string().trim().max(80).optional().or(z.literal("")),
});

export function AdminsSection() {
  const { event, adminId } = useAdminContext();
  const isOrg = useIsOrganisateur();

  const [admins, setAdmins] = useState<AdminRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState("");
  const [prenom, setPrenom] = useState("");
  const [adding, setAdding] = useState(false);

  const [confirmDelete, setConfirmDelete] = useState<AdminRow | null>(null);
  const [confirmTransfer, setConfirmTransfer] = useState<AdminRow | null>(null);
  const [actionPending, setActionPending] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("event_admins")
      .select("id, email, prenom, role, user_id, created_at")
      .eq("event_id", event.id)
      .order("role", { ascending: true })
      .order("created_at", { ascending: true });
    setLoading(false);
    if (error) {
      toast.error("Impossible de charger les admins");
      return;
    }
    setAdmins((data ?? []) as AdminRow[]);
  }, [event.id]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleAdd = async () => {
    const parsed = inviteSchema.safeParse({ email, prenom });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Champs invalides");
      return;
    }
    const normalized = parsed.data.email.toLowerCase();
    if (admins.some((a) => a.email.toLowerCase() === normalized)) {
      toast.error("Cet email est déjà admin de l'événement");
      return;
    }
    setAdding(true);
    const { error } = await supabase.from("event_admins").insert({
      event_id: event.id,
      email: normalized,
      prenom: parsed.data.prenom ? parsed.data.prenom : null,
      role: "secondaire",
    });
    setAdding(false);
    if (error) {
      toast.error("Échec de l'ajout");
      return;
    }
    toast.success("Admin secondaire ajouté");
    setEmail("");
    setPrenom("");
    await load();
  };

  const handleDelete = async () => {
    if (!confirmDelete) return;
    setActionPending(true);
    const { error } = await supabase
      .from("event_admins")
      .delete()
      .eq("id", confirmDelete.id);
    setActionPending(false);
    if (error) {
      toast.error("Échec de la suppression");
      return;
    }
    toast.success("Admin retiré");
    setConfirmDelete(null);
    await load();
  };

  const handleTransfer = async () => {
    if (!confirmTransfer) return;
    setActionPending(true);
    const { error } = await supabase.rpc("transfer_organisateur", {
      p_event_id: event.id,
      p_current_org_id: adminId,
      p_new_org_id: confirmTransfer.id,
    });
    setActionPending(false);
    if (error) {
      toast.error("Échec du transfert");
      return;
    }
    toast.success("Rôle organisateur transféré. Vous êtes désormais admin secondaire.");
    setConfirmTransfer(null);
    await load();
  };

  return (
    <section className="rounded-2xl bg-card p-6 shadow-card">
      <header className="mb-5">
        <h2 className="font-display text-xl text-foreground">
          Gestion des admins
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {isOrg
            ? "Vous pouvez ajouter ou retirer des admins secondaires, et transférer votre rôle d'organisateur."
            : "Liste des admins de l'événement. Seul l'organisateur peut en ajouter ou en retirer."}
        </p>
      </header>

      {loading ? (
        <div className="flex justify-center py-6">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <ul className="space-y-2">
          {admins.map((a) => {
            const isMe = a.id === adminId;
            const isOrganisateur = a.role === "organisateur";
            return (
              <li
                key={a.id}
                className="flex items-center justify-between gap-3 rounded-xl border border-border bg-secondary/40 px-4 py-3"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-sm font-medium text-foreground">
                      {a.prenom ?? a.email.split("@")[0]}
                    </p>
                    {isMe && (
                      <Badge variant="outline" className="text-[10px]">
                        Vous
                      </Badge>
                    )}
                    <Badge
                      variant={isOrganisateur ? "default" : "secondary"}
                      className="text-[10px]"
                    >
                      {isOrganisateur ? (
                        <>
                          <Crown className="mr-1 h-3 w-3" />
                          Organisateur
                        </>
                      ) : (
                        "Secondaire"
                      )}
                    </Badge>
                  </div>
                  <p className="truncate text-xs text-muted-foreground">
                    {a.email}
                  </p>
                </div>
                {isOrg && !isOrganisateur && (
                  <div className="flex shrink-0 items-center gap-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setConfirmTransfer(a)}
                      title="Transférer le rôle d'organisateur"
                    >
                      <ArrowUpRight className="h-4 w-4" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setConfirmDelete(a)}
                      title="Retirer cet admin"
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {isOrg && (
        <div className="mt-5 space-y-3 rounded-xl border border-dashed border-border p-4">
          <p className="text-sm font-medium text-foreground">
            Ajouter un admin secondaire
          </p>
          <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
            <div>
              <Label htmlFor="new-admin-email" className="sr-only">
                Email
              </Label>
              <Input
                id="new-admin-email"
                type="email"
                placeholder="email@exemple.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                maxLength={255}
              />
            </div>
            <div>
              <Label htmlFor="new-admin-prenom" className="sr-only">
                Prénom
              </Label>
              <Input
                id="new-admin-prenom"
                placeholder="Prénom (optionnel)"
                value={prenom}
                onChange={(e) => setPrenom(e.target.value)}
                maxLength={80}
              />
            </div>
            <Button onClick={handleAdd} disabled={adding || !email}>
              {adding ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <UserPlus className="mr-2 h-4 w-4" />
                  Ajouter
                </>
              )}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            La personne pourra se connecter avec cet email via le lien
            « Organisateur ? » dans la galerie.
          </p>
        </div>
      )}

      {/* Confirm delete */}
      <AlertDialog
        open={!!confirmDelete}
        onOpenChange={(o) => !o && setConfirmDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Retirer cet admin ?</AlertDialogTitle>
            <AlertDialogDescription>
              {confirmDelete?.email} n'aura plus accès au tableau de bord
              de l'événement.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={actionPending}>
              Annuler
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                void handleDelete();
              }}
              disabled={actionPending}
            >
              {actionPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                "Retirer"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Confirm transfer */}
      <AlertDialog
        open={!!confirmTransfer}
        onOpenChange={(o) => !o && setConfirmTransfer(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Transférer le rôle d'organisateur ?</AlertDialogTitle>
            <AlertDialogDescription>
              {confirmTransfer?.email} deviendra l'organisateur principal de
              l'événement. Vous serez rétrogradé(e) en admin secondaire et
              ne pourrez plus gérer les admins ni supprimer l'événement.
              Cette action est réversible uniquement par le nouveau
              organisateur.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={actionPending}>
              Annuler
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                void handleTransfer();
              }}
              disabled={actionPending}
            >
              {actionPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                "Transférer"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}