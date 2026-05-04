import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAdminContext } from "./AdminContext";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { HardDrive, RefreshCw, Loader2 } from "lucide-react";
import { toast } from "sonner";

function formatSize(mo: number): string {
  if (mo >= 1024) return `${(mo / 1024).toFixed(2)} Go`;
  return `${mo.toFixed(0)} Mo`;
}

export function StorageQuotaSection() {
  const { event, reloadEvent } = useAdminContext();
  const [photoCount, setPhotoCount] = useState<number | null>(null);
  const [recomputing, setRecomputing] = useState(false);

  const usedMo = event.used_mo ?? 0;
  const quotaMo = event.quota_mo ?? 0;
  const percent = quotaMo > 0 ? Math.min(100, (usedMo / quotaMo) * 100) : 0;
  const warning = percent >= 80 && percent < 100;
  const full = percent >= 100;

  useEffect(() => {
    let cancel = false;
    void (async () => {
      const { count } = await supabase
        .from("posts")
        .select("id", { count: "exact", head: true })
        .eq("event_id", event.id);
      if (!cancel) setPhotoCount(count ?? 0);
    })();
    return () => {
      cancel = true;
    };
  }, [event.id]);

  const handleRecompute = async () => {
    setRecomputing(true);
    // Re-fetch fresh values from DB (used_mo is updated server-side ailleurs).
    await reloadEvent();
    setRecomputing(false);
    toast.success("Données actualisées");
  };

  return (
    <section className="rounded-2xl bg-card p-6 shadow-card">
      <header className="mb-5 flex items-start justify-between gap-4">
        <div>
          <h2 className="font-display text-xl text-foreground">
            Stockage & quota
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Espace utilisé par les photos de cet événement.
          </p>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={handleRecompute}
          disabled={recomputing}
        >
          {recomputing ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4" />
          )}
        </Button>
      </header>

      <div className="space-y-4">
        <div>
          <div className="mb-2 flex items-end justify-between">
            <div className="flex items-center gap-2">
              <HardDrive className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-foreground">
                <span className="font-medium">{formatSize(usedMo)}</span>
                <span className="text-muted-foreground"> / {formatSize(quotaMo)}</span>
              </span>
            </div>
            <span
              className={`text-xs font-medium ${
                full
                  ? "text-destructive"
                  : warning
                    ? "text-amber-600"
                    : "text-muted-foreground"
              }`}
            >
              {percent.toFixed(0)} %
            </span>
          </div>
          <Progress value={percent} className="h-2" />
        </div>

        {full && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
            Quota atteint. Les invités ne pourront plus uploader de photos
            tant que vous n'aurez pas augmenté votre offre.
          </div>
        )}
        {warning && (
          <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-700">
            Vous avez utilisé plus de 80 % de votre stockage.
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <Stat label="Photos publiées" value={photoCount?.toString() ?? "…"} />
          <Stat
            label="Espace restant"
            value={formatSize(Math.max(0, quotaMo - usedMo))}
          />
        </div>
      </div>
    </section>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-secondary/40 p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 font-display text-lg text-foreground">{value}</p>
    </div>
  );
}