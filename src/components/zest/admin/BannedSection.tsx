import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAdminContext } from "./AdminContext";
import { Button } from "@/components/ui/button";
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
import { Ban, Loader2, RotateCcw } from "lucide-react";

type BannedRow = {
  id: string;
  device_id: string;
  created_at: string;
  prenom: string | null;
};

export function BannedSection() {
  const { event } = useAdminContext();
  const [rows, setRows] = useState<BannedRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [confirm, setConfirm] = useState<BannedRow | null>(null);
  const [pending, setPending] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const { data: bans, error } = await supabase
      .from("banned_invites")
      .select("id, device_id, created_at")
      .eq("event_id", event.id)
      .order("created_at", { ascending: false });
    if (error) {
      setLoading(false);
      toast.error("Impossible de charger les bannis");
      return;
    }
    const list = (bans ?? []) as Array<{
      id: string;
      device_id: string;
      created_at: string;
    }>;
    if (list.length === 0) {
      setRows([]);
      setLoading(false);
      return;
    }
    // Fetch invite prenoms
    const deviceIds = Array.from(new Set(list.map((b) => b.device_id)));
    const { data: invs } = await supabase
      .from("invites")
      .select("device_id, prenom")
      .eq("event_id", event.id)
      .in("device_id", deviceIds);
    const prenomByDevice = new Map<string, string>();
    for (const i of invs ?? []) {
      if (!prenomByDevice.has(i.device_id)) {
        prenomByDevice.set(i.device_id, i.prenom);
      }
    }
    setRows(
      list.map((b) => ({
        ...b,
        prenom: prenomByDevice.get(b.device_id) ?? null,
      })),
    );
    setLoading(false);
  }, [event.id]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleUnban = async () => {
    if (!confirm) return;
    setPending(true);
    const { error } = await supabase
      .from("banned_invites")
      .delete()
      .eq("id", confirm.id);
    setPending(false);
    if (error) {
      toast.error("Échec du débannissement");
      return;
    }
    toast.success("Invité débanni");
    setConfirm(null);
    await load();
  };

  return (
    <section className="rounded-2xl bg-card p-6 shadow-card">
      <header className="mb-5 flex items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-xl text-foreground">
            Invités bannis
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Les bannis ne peuvent plus publier ni commenter dans cet événement.
          </p>
        </div>
      </header>

      {loading ? (
        <div className="flex justify-center py-6">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : rows.length === 0 ? (
        <div className="grid place-items-center rounded-xl border border-dashed border-border bg-secondary/30 py-8 text-center">
          <Ban className="mb-2 h-6 w-6 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Aucun invité banni.</p>
        </div>
      ) : (
        <ul className="space-y-2">
          {rows.map((b) => (
            <li
              key={b.id}
              className="flex items-center justify-between gap-3 rounded-xl border border-border bg-secondary/40 px-4 py-3"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-foreground">
                  {b.prenom ?? "Invité inconnu"}
                </p>
                <p className="truncate font-mono text-xs text-muted-foreground">
                  {b.device_id.slice(0, 16)}…
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Banni le{" "}
                  {new Date(b.created_at).toLocaleDateString("fr-FR", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })}
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setConfirm(b)}
              >
                <RotateCcw className="mr-2 h-4 w-4" />
                Débannir
              </Button>
            </li>
          ))}
        </ul>
      )}

      <AlertDialog
        open={!!confirm}
        onOpenChange={(o) => !o && setConfirm(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Débannir cet invité ?</AlertDialogTitle>
            <AlertDialogDescription>
              {confirm?.prenom ?? "Cet invité"} pourra de nouveau publier
              et commenter dans la galerie. Ses anciennes contributions
              restent supprimées.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                void handleUnban();
              }}
              disabled={pending}
            >
              {pending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                "Débannir"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}