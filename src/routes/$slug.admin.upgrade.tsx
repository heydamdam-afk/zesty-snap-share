import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, Check, Loader2, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { PLANS, getPlan, formatPrice, type Plan } from "@/lib/plans";
import { toast } from "sonner";

export const Route = createFileRoute("/$slug/admin/upgrade")({
  head: () => ({
    meta: [
      { title: "Changer d'offre — Kapsul" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: UpgradePage,
});

type EventLite = {
  id: string;
  titre: string;
  slug: string;
  plan_code: string | null;
};

function UpgradePage() {
  const { slug } = Route.useParams();
  const navigate = useNavigate();
  const [event, setEvent] = useState<EventLite | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancel = false;
    void (async () => {
      const { data: sess } = await supabase.auth.getSession();
      if (!sess.session?.user.email) {
        navigate({
          to: "/login",
          search: { redirect: `/${slug}/admin/upgrade` } as never,
        });
        return;
      }
      const { data, error } = await supabase
        .from("events")
        .select("id, titre, slug, plan_code")
        .or(`slug.eq.${slug},code_acces.eq.${slug}`)
        .maybeSingle();
      if (cancel) return;
      if (error || !data) {
        toast.error("Événement introuvable");
        navigate({ to: "/" });
        return;
      }
      setEvent(data as EventLite);
      setLoading(false);
    })();
    return () => {
      cancel = true;
    };
  }, [slug, navigate]);

  if (loading || !event) {
    return (
      <div className="grid min-h-screen place-items-center bg-secondary">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const currentPlan = event.plan_code ? getPlan(event.plan_code) : undefined;
  const currentPrice = currentPlan?.prix_cents ?? 0;
  // Plan découverte (free) → show all paid plans
  // Otherwise → show plans strictly more expensive than current
  const upgrades: Plan[] = PLANS.filter((p) => {
    if (p.code === currentPlan?.code) return false;
    if (p.prix_cents === 0) return false;
    return p.prix_cents > currentPrice;
  });

  return (
    <div className="min-h-screen bg-secondary pb-16">
      <header className="sticky top-0 z-30 border-b border-border bg-card/95 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-3">
          <Link
            to="/$slug/admin/dashboard"
            params={{ slug: event.slug }}
            className="inline-flex h-9 w-9 items-center justify-center rounded-full hover:bg-muted"
            aria-label="Retour"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-foreground">
              Changer d'offre
            </p>
            <p className="truncate text-xs text-muted-foreground">
              {event.titre}
            </p>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-6">
        <div className="mb-6 rounded-2xl bg-card p-5 shadow-card">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Sparkles className="h-4 w-4 text-primary" />
            <span>Offre actuelle</span>
          </div>
          <h1 className="mt-1 font-display text-2xl text-foreground">
            {currentPlan?.nom ?? "—"}
          </h1>
          <p className="text-sm text-muted-foreground">
            {currentPlan?.description_courte}
          </p>
        </div>

        {upgrades.length === 0 ? (
          <div className="rounded-2xl bg-card p-6 text-center shadow-card">
            <p className="text-sm text-muted-foreground">
              Vous êtes déjà sur notre offre la plus complète. Merci&nbsp;!
            </p>
          </div>
        ) : (
          <>
            <h2 className="mb-3 font-display text-lg text-foreground">
              Passez à une offre supérieure
            </h2>
            <div className="grid gap-4 sm:grid-cols-2">
              {upgrades.map((p) => (
                <PlanCard key={p.code} plan={p} />
              ))}
            </div>
          </>
        )}
      </main>
    </div>
  );
}

function PlanCard({ plan }: { plan: Plan }) {
  return (
    <article
      className={`relative flex flex-col rounded-2xl border bg-card p-5 shadow-card ${
        plan.is_top ? "border-primary" : "border-border"
      }`}
    >
      {plan.is_top && (
        <span className="absolute -top-3 left-5 rounded-full bg-primary px-3 py-1 text-[10px] font-semibold uppercase tracking-wide text-primary-foreground">
          Le plus choisi
        </span>
      )}
      <h3 className="font-display text-xl text-foreground">{plan.nom}</h3>
      <p className="mt-1 text-sm text-muted-foreground">
        {plan.description_usage}
      </p>
      <p className="mt-4 font-display text-3xl text-foreground">
        {formatPrice(plan.prix_cents)}
      </p>
      <ul className="mt-4 space-y-2 text-sm text-foreground">
        <li className="flex items-center gap-2">
          <Check className="h-4 w-4 text-primary" />
          {plan.max_photos.toLocaleString("fr-FR")} photos
        </li>
        <li className="flex items-center gap-2">
          <Check className="h-4 w-4 text-primary" />
          {plan.max_invites
            ? `${plan.max_invites} invités`
            : "Invités illimités"}
        </li>
        <li className="flex items-center gap-2">
          <Check className="h-4 w-4 text-primary" />
          {plan.duree_jours} jours d'accès
        </li>
      </ul>
      <Button
        type="button"
        className="mt-5"
        onClick={() =>
          toast.info(
            "Le changement d'offre arrive bientôt. Contactez-nous pour mettre à niveau dès maintenant.",
          )
        }
      >
        Choisir cette offre
      </Button>
    </article>
  );
}