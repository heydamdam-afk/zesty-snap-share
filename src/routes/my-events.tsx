import { createFileRoute, Link, useNavigate, redirect } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { LogOut, Plus, MapPin, Calendar } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { ZestLogo } from "@/components/zest/Logo";
import { FrozenBadge } from "@/components/zest/FrozenBadge";
import { toast } from "sonner";

export const Route = createFileRoute("/my-events")({
  head: () => ({
    meta: [
      { title: "Mes événements — Kapsul" },
      { name: "robots", content: "noindex" },
    ],
  }),
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) {
      throw redirect({ to: "/login" });
    }
  },
  component: MyEvents,
});

type EventRow = {
  id: string;
  slug: string;
  titre: string;
  lieu: string | null;
  cover_url: string | null;
  event_date: string | null;
  role: "organisateur" | "secondaire";
  frozen_at: string | null;
  expire_at: string | null;
};

function formatDate(iso: string | null): string | null {
  if (!iso) return null;
  try {
    return new Intl.DateTimeFormat("fr-FR", {
      day: "numeric",
      month: "long",
      year: "numeric",
    }).format(new Date(iso));
  } catch {
    return null;
  }
}

function MyEvents() {
  const navigate = useNavigate();
  const [events, setEvents] = useState<EventRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    setEvents(null);
    try {
      await supabase.rpc("link_admin_user_id");
      const { data: rpcData, error: rpcErr } = await supabase.rpc("my_admin_events");
      if (rpcErr) throw rpcErr;
      const list = (rpcData as Array<{ event_id: string; slug: string; titre: string; role: "organisateur" | "secondaire" }> | null) ?? [];
      if (list.length === 0) {
        setEvents([]);
        return;
      }
      const ids = list.map((e) => e.event_id);
      const { data: detailsData, error: detErr } = await supabase
        .from("events")
        .select("id, slug, titre, lieu, cover_url, event_date, frozen_at, expire_at")
        .in("id", ids);
      if (detErr) throw detErr;
      const byId = new Map((detailsData ?? []).map((d) => [d.id, d]));
      const merged: EventRow[] = list.map((e) => {
        const d = byId.get(e.event_id);
        return {
          id: e.event_id,
          slug: d?.slug ?? e.slug,
          titre: d?.titre ?? e.titre,
          lieu: d?.lieu ?? null,
          cover_url: d?.cover_url ?? null,
          event_date: d?.event_date ?? null,
          role: e.role,
          frozen_at: (d as { frozen_at?: string | null } | undefined)?.frozen_at ?? null,
          expire_at: (d as { expire_at?: string | null } | undefined)?.expire_at ?? null,
        };
      });
      setEvents(merged);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erreur lors du chargement";
      setError(msg);
      toast.error(msg);
    }
  }, [navigate]);

  useEffect(() => {
    void load();
  }, [load]);

  const signOut = async () => {
    try {
      await supabase.auth.signOut();
    } catch {
      /* noop */
    }
    navigate({ to: "/", replace: true });
  };

  return (
    <div className="min-h-screen bg-[image:var(--gradient-warm)]">
      <header className="sticky top-0 z-30 border-b border-border/40 bg-card/80 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center gap-3 px-5 py-3">
          <ZestLogo />
          <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary">
            kapsul.events
          </span>
          <div className="ml-auto flex items-center gap-2">
            <Link
              to="/create-event"
              className="hidden items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-soft hover:opacity-95 sm:inline-flex"
            >
              <Plus className="h-4 w-4" />
              Créer un autre événement
            </Link>
            <button
              type="button"
              onClick={signOut}
              title="Se déconnecter"
              aria-label="Se déconnecter"
              className="grid h-9 w-9 place-items-center rounded-lg border border-border bg-card text-muted-foreground hover:bg-secondary"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-5 py-8">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="font-display text-3xl text-foreground">Mes événements</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Sélectionnez un événement pour accéder à son feed et à ses réglages.
            </p>
          </div>
          <Link
            to="/create-event"
            className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-soft hover:opacity-95 sm:hidden"
          >
            <Plus className="h-4 w-4" />
            Créer
          </Link>
        </div>

        {error && (
          <div className="mb-6 rounded-xl bg-destructive/10 px-4 py-3 text-sm font-medium text-destructive" role="alert">
            <p>{error}</p>
            <button
              type="button"
              onClick={load}
              className="mt-2 rounded-lg border border-destructive/40 px-3 py-1 text-xs font-semibold hover:bg-destructive/10"
            >
              Réessayer
            </button>
          </div>
        )}

        {!events && !error && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {[0, 1].map((i) => (
              <div key={i} className="overflow-hidden rounded-2xl bg-card/95 shadow-card">
                <div className="aspect-[16/9] animate-pulse bg-muted" />
                <div className="space-y-2 p-5">
                  <div className="h-5 w-2/3 animate-pulse rounded bg-muted" />
                  <div className="h-4 w-1/2 animate-pulse rounded bg-muted" />
                </div>
              </div>
            ))}
          </div>
        )}

        {events && events.length > 0 && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {events.map((ev) => {
              const initial = (ev.titre[0] ?? "?").toUpperCase();
              const date = formatDate(ev.event_date);
              const linkProps = ev.role === "organisateur"
                ? { to: "/$slug/admin/dashboard" as const, params: { slug: ev.slug } }
                : { to: "/e/$slug" as const, params: { slug: ev.slug } };
              return (
                <Link
                  key={ev.id}
                  {...linkProps}
                  className="group relative overflow-hidden rounded-2xl bg-card/95 shadow-card backdrop-blur transition hover:-translate-y-0.5 hover:shadow-lg"
                >
                  <span
                    className={`absolute right-3 top-3 z-10 rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                      ev.role === "organisateur"
                        ? "bg-primary text-primary-foreground"
                        : "bg-secondary text-foreground"
                    }`}
                  >
                    {ev.role === "organisateur" ? "Organisateur" : "Admin secondaire"}
                  </span>

                  <div className="relative aspect-[16/9] overflow-hidden">
                    {ev.cover_url ? (
                      <img
                        src={ev.cover_url}
                        alt=""
                        className="h-full w-full object-cover transition group-hover:scale-[1.02]"
                        loading="lazy"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center bg-[image:var(--gradient-warm)]">
                        <span className="font-display text-5xl text-primary/60">{initial}</span>
                      </div>
                    )}
                  </div>

                  <div className="space-y-1.5 p-5">
                    <h2 className="font-display text-xl text-foreground">
                      {ev.titre}
                      {ev.frozen_at ? (
                        <span className="ml-2 align-middle">
                          <FrozenBadge expireAt={ev.expire_at} />
                        </span>
                      ) : null}
                    </h2>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                      {date && (
                        <span className="inline-flex items-center gap-1.5">
                          <Calendar className="h-3.5 w-3.5" />
                          {date}
                        </span>
                      )}
                      {ev.lieu && (
                        <span className="inline-flex items-center gap-1.5">
                          <MapPin className="h-3.5 w-3.5" />
                          {ev.lieu}
                        </span>
                      )}
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}

        {events && events.length === 0 && (
          <div className="rounded-2xl bg-card/95 p-8 text-center shadow-card">
            <h2 className="font-display text-xl text-foreground">
              Vous n'avez pas encore d'événement
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Créez votre première galerie photo collaborative en quelques minutes.
            </p>
            <Link
              to="/create-event"
              className="mt-5 inline-flex items-center gap-1.5 rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground shadow-soft hover:opacity-95"
            >
              <Plus className="h-4 w-4" />
              Créer mon premier événement
            </Link>
          </div>
        )}
      </main>
    </div>
  );
}
