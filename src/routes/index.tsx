import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ZestLogo } from "@/components/zest/Logo";
import { findEventByCode } from "@/lib/zest-actions";
import { toast } from "sonner";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Kapsul — Créez votre galerie photo d'événement" },
      {
        name: "description",
        content:
          "Kapsul.events — créez en 1 minute la galerie photo collaborative de votre mariage, anniversaire ou événement pro.",
      },
    ],
  }),
  component: Landing,
});

function Landing() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [showGuestEntry, setShowGuestEntry] = useState(false);
  const [guestCode, setGuestCode] = useState("");
  const [hydrated, setHydrated] = useState(false);
  const [resetting, setResetting] = useState(false);

  // Rétro-compat : ancien QR `/?code=XXXX` → redirige vers /e/{slug}?code=XXXX
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");
    if (!code) {
      setHydrated(true);
      return;
    }
    (async () => {
      try {
        const event = await findEventByCode(code);
        if (event) {
          navigate({
            to: "/e/$slug",
            params: { slug: event.slug },
            search: { code } as never,
          });
          return;
        }
      } catch {
        /* noop */
      }
      setHydrated(true);
    })();
  }, [navigate]);

  // Si user déjà loggé → on redirige vers son dashboard ou /create-event
  useEffect(() => {
    if (!hydrated) return;
    let cancel = false;
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (cancel || !data.session?.user) return;
      await routeAfterAuth(navigate);
    })();
    return () => {
      cancel = true;
    };
  }, [hydrated, navigate]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfo(null);
    setLoading(true);
    try {
      if (mode === "signin") {
        const { error: err } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (err) throw err;
        await routeAfterAuth(navigate);
      } else {
        const { error: err } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/create-event`,
          },
        });
        if (err) throw err;
        setInfo(
          "Vérifiez votre boîte mail pour confirmer votre compte. Une fois confirmé, vous pourrez créer votre premier événement.",
        );
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur");
    } finally {
      setLoading(false);
    }
  };

  const submitGuest = async (e: React.FormEvent) => {
    e.preventDefault();
    const code = guestCode.trim();
    if (!code) return;
    try {
      const event = await findEventByCode(code);
      if (!event) {
        toast.error("Code d'accès invalide");
        return;
      }
      navigate({
        to: "/e/$slug",
        params: { slug: event.slug },
        search: { code } as never,
      });
    } catch {
      toast.error("Erreur lors de la recherche");
    }
  };

  if (!hydrated) return null;

  return (
    <div className="min-h-screen bg-[image:var(--gradient-warm)]">
      <div className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center px-6 py-10">
        <div className="mb-6 flex items-center gap-2">
          <ZestLogo />
          <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary">
            kapsul.events
          </span>
        </div>

        <div className="w-full rounded-3xl bg-card/95 p-7 shadow-card backdrop-blur">
          <h1 className="font-display text-2xl text-foreground">
            {mode === "signin"
              ? "Espace organisateur"
              : "Créer un compte organisateur"}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {mode === "signin"
              ? "Connectez-vous pour créer ou gérer vos événements."
              : "Quelques secondes pour lancer votre galerie photo collaborative."}
          </p>

          <form onSubmit={submit} className="mt-6 space-y-4" noValidate>
            {error && (
              <div
                className="rounded-xl bg-destructive/10 px-4 py-3 text-sm font-medium text-destructive"
                role="alert"
              >
                {error}
              </div>
            )}
            {info && (
              <div
                className="rounded-xl bg-primary/10 px-4 py-3 text-sm font-medium text-primary"
                role="status"
              >
                {info}
              </div>
            )}
            <div>
              <label
                htmlFor="email"
                className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-muted-foreground"
              >
                Email
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-xl border border-border bg-background px-4 py-3 text-base focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>
            <div>
              <label
                htmlFor="password"
                className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-muted-foreground"
              >
                Mot de passe
              </label>
              <input
                id="password"
                type="password"
                autoComplete={mode === "signin" ? "current-password" : "new-password"}
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-xl border border-border bg-background px-4 py-3 text-base focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl bg-primary px-5 py-3.5 text-base font-semibold text-primary-foreground shadow-soft transition disabled:opacity-50"
            >
              {loading
                ? "…"
                : mode === "signin"
                  ? "Se connecter"
                  : "Créer mon compte"}
            </button>
            {mode === "signin" && (
              <button
                type="button"
                disabled={resetting}
                onClick={async () => {
                  setError(null);
                  setInfo(null);
                  const target = email.trim();
                  if (!target) {
                    setError("Saisissez votre email puis cliquez à nouveau sur « Mot de passe oublié ».");
                    return;
                  }
                  setResetting(true);
                  try {
                    const { error: err } = await supabase.auth.resetPasswordForEmail(target, {
                      redirectTo: `${window.location.origin}/reset-password`,
                    });
                    if (err) throw err;
                    setInfo("Si un compte existe pour cet email, un lien de réinitialisation vient d'être envoyé.");
                  } catch (err) {
                    setError(err instanceof Error ? err.message : "Erreur lors de l'envoi");
                  } finally {
                    setResetting(false);
                  }
                }}
                className="w-full text-center text-xs text-muted-foreground hover:text-foreground hover:underline disabled:opacity-50"
              >
                {resetting ? "Envoi…" : "Mot de passe oublié ?"}
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                setMode(mode === "signin" ? "signup" : "signin");
                setError(null);
                setInfo(null);
              }}
              className="w-full text-center text-xs font-medium text-primary hover:underline"
            >
              {mode === "signin"
                ? "Pas encore de compte ? Créer un compte organisateur"
                : "J'ai déjà un compte"}
            </button>
          </form>

          <div className="mt-6 border-t border-border pt-4 text-center">
            {!showGuestEntry ? (
              <button
                type="button"
                onClick={() => setShowGuestEntry(true)}
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                J'ai un code d'accès invité →
              </button>
            ) : (
              <form onSubmit={submitGuest} className="flex gap-2">
                <input
                  type="text"
                  placeholder="CODE"
                  value={guestCode}
                  onChange={(e) => setGuestCode(e.target.value.toUpperCase())}
                  className="flex-1 rounded-xl border border-border bg-background px-3 py-2 text-center text-sm font-bold uppercase tracking-widest focus:border-primary focus:outline-none"
                  maxLength={20}
                />
                <button
                  type="submit"
                  className="rounded-xl bg-secondary px-4 py-2 text-sm font-semibold text-foreground"
                >
                  Entrer
                </button>
              </form>
            )}
          </div>
        </div>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          <Link to="/admin" className="hover:text-foreground">
            Admin d'un event existant ?
          </Link>
        </p>
      </div>
    </div>
  );
}

async function routeAfterAuth(
  navigate: ReturnType<typeof useNavigate>,
): Promise<void> {
  // Lier les éventuels event_admins invités par email
  await supabase.rpc("link_admin_user_id");
  const { data } = await supabase.rpc("my_admin_events");
  const events = (data as Array<{ slug: string }> | null) ?? [];
  if (events.length > 0) {
    navigate({ to: "/$slug/admin/dashboard", params: { slug: events[0].slug } });
  } else {
    navigate({ to: "/create-event" });
  }
}