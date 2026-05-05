import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ZestLogo } from "@/components/zest/Logo";
import { toast } from "sonner";

export const Route = createFileRoute("/$slug/admin")({
  head: () => ({
    meta: [
      { title: "Espace admin — Zest" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminEventLogin,
});

type EventLite = {
  id: string;
  titre: string;
  slug: string;
};

type AdminSession = {
  id: string;
  role: "organisateur" | "secondaire";
  prenom: string | null;
};

type AdminCheckResult =
  | { kind: "ok"; admin: AdminSession }
  | { kind: "not_admin" }
  | { kind: "error"; message: string };

// Anti brute-force : 5 tentatives / 15 min, par email + slug, stocké en localStorage.
const MAX_ATTEMPTS = 5;
const LOCKOUT_MS = 15 * 60 * 1000;

type AttemptState = { count: number; lockedUntil: number | null };

function attemptsKey(slug: string, email: string) {
  return `zest_admin_attempts:${slug}:${email.toLowerCase()}`;
}

function readAttempts(slug: string, email: string): AttemptState {
  if (typeof window === "undefined") return { count: 0, lockedUntil: null };
  try {
    const raw = window.localStorage.getItem(attemptsKey(slug, email));
    if (!raw) return { count: 0, lockedUntil: null };
    const parsed = JSON.parse(raw) as AttemptState;
    if (parsed.lockedUntil && parsed.lockedUntil < Date.now()) {
      return { count: 0, lockedUntil: null };
    }
    return parsed;
  } catch {
    return { count: 0, lockedUntil: null };
  }
}

function writeAttempts(slug: string, email: string, state: AttemptState) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(attemptsKey(slug, email), JSON.stringify(state));
}

function clearAttempts(slug: string, email: string) {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(attemptsKey(slug, email));
}

async function checkAdminMembership(
  eventId: string,
  email: string,
): Promise<AdminCheckResult> {
  // Materialise user_id si l'admin a été invité par email avant son inscription.
  await supabase.rpc("link_admin_user_id");

  const { data, error } = await supabase
    .from("event_admins")
    .select("id, role, prenom")
    .eq("event_id", eventId)
    .ilike("email", email)
    .maybeSingle();

  if (error) return { kind: "error", message: error.message };
  if (!data) return { kind: "not_admin" };
  return {
    kind: "ok",
    admin: {
      id: data.id,
      role: data.role as "organisateur" | "secondaire",
      prenom: data.prenom,
    },
  };
}

function AdminEventLogin() {
  const { slug } = Route.useParams();
  const navigate = useNavigate();

  const [event, setEvent] = useState<EventLite | null>(null);
  const [eventLoading, setEventLoading] = useState(true);
  const [eventError, setEventError] = useState<string | null>(null);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"signin" | "reset">("signin");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [sessionLoading, setSessionLoading] = useState(true);
  const [showLoginForm, setShowLoginForm] = useState(false);
  const [, setAdminSession] = useState<AdminSession | null>(null);

  // Charger l'event par slug (= code_acces côté DB).
  useEffect(() => {
    let cancel = false;
    setEventLoading(true);
    void supabase
      .from("events")
      .select("id, titre, slug, code_acces")
      .or(`slug.eq.${slug},code_acces.eq.${slug}`)
      .maybeSingle()
      .then(({ data, error }) => {
        if (cancel) return;
        if (error) {
          setEventError(error.message);
        } else if (!data) {
          setEventError("Événement introuvable.");
        } else {
          setEvent({ id: data.id, titre: data.titre, slug: data.slug });
        }
        setEventLoading(false);
      });
    return () => {
      cancel = true;
    };
  }, [slug]);

  // Si déjà connecté, on vérifie d'abord l'accès admin avant d'afficher le login.
  useEffect(() => {
    if (!event) return;
    let cancelled = false;
    const checkSession = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (cancelled) return;

        if (session?.user?.email) {
          const res = await checkAdminMembership(event.id, session.user.email);
          if (cancelled) return;
          if (res.kind === "ok") {
            setAdminSession(res.admin);
            setShowLoginForm(false);
            navigate({ to: "/$slug/admin/dashboard", params: { slug } });
          } else {
            setAdminSession(null);
            setShowLoginForm(true);
          }
        } else {
          setAdminSession(null);
          setShowLoginForm(true);
        }
      } catch (err) {
        console.error("[slug admin] session check failed", err);
        if (!cancelled) {
          setAdminSession(null);
          setShowLoginForm(true);
        }
      } finally {
        if (!cancelled) setSessionLoading(false);
      }
    };
    void checkSession();
    return () => {
      cancelled = true;
    };
  }, [event, navigate, slug]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfo(null);
    if (!event) return;

    if (mode === "reset") {
      setLoading(true);
      try {
        const { error: rpErr } = await supabase.auth.resetPasswordForEmail(
          email,
          {
            redirectTo: `${window.location.origin}/${slug}/admin`,
          },
        );
        if (rpErr) throw rpErr;
        setInfo(
          "Si un compte existe avec cet email, un lien de réinitialisation vient d'être envoyé.",
        );
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erreur d'envoi.");
      } finally {
        setLoading(false);
      }
      return;
    }

    // Vérif lockout
    const attempts = readAttempts(slug, email);
    if (attempts.lockedUntil && attempts.lockedUntil > Date.now()) {
      const minLeft = Math.ceil((attempts.lockedUntil - Date.now()) / 60000);
      setError(
        `Trop de tentatives. Réessayez dans ${minLeft} minute${minLeft > 1 ? "s" : ""}.`,
      );
      return;
    }

    setLoading(true);
    try {
      const { error: authErr } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (authErr) throw authErr;

      const res = await checkAdminMembership(event.id, email);
      if (res.kind === "error") {
        throw new Error(res.message);
      }
      if (res.kind === "not_admin") {
        await supabase.auth.signOut();
        throw new Error(
          "Vous n'êtes pas admin de cet événement.",
        );
      }

      clearAttempts(slug, email);
      toast.success(`Bienvenue ! Rôle : ${res.admin.role}`);
      navigate({ to: "/$slug/admin/dashboard", params: { slug } });
    } catch (err) {
      const next: AttemptState = {
        count: attempts.count + 1,
        lockedUntil:
          attempts.count + 1 >= MAX_ATTEMPTS ? Date.now() + LOCKOUT_MS : null,
      };
      writeAttempts(slug, email, next);
      setError(err instanceof Error ? err.message : "Échec de connexion.");
    } finally {
      setLoading(false);
    }
  };

  if (eventLoading || sessionLoading || !showLoginForm) {
    return (
      <div className="grid min-h-screen place-items-center bg-secondary">
        <p className="text-sm text-muted-foreground">Chargement…</p>
      </div>
    );
  }

  if (eventError || !event) {
    return (
      <div className="grid min-h-screen place-items-center bg-secondary px-6">
        <div className="w-full max-w-md rounded-2xl bg-card p-7 text-center shadow-card">
          <ZestLogo className="mx-auto" />
          <h1 className="mt-5 font-display text-xl text-foreground">
            Événement introuvable
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {eventError ?? "Aucun événement ne correspond à cette URL."}
          </p>
          <Link
            to="/"
            className="mt-6 inline-block text-xs font-medium text-primary hover:underline"
          >
            ← Accueil
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[image:var(--gradient-warm)]">
      <div className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center px-6 py-10">
        <div className="w-full rounded-3xl bg-card/95 p-7 shadow-card backdrop-blur">
          <div className="mb-6 flex items-center justify-between">
            <ZestLogo />
            <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
              Admin
            </span>
          </div>

          <h1 className="font-display text-2xl text-foreground">
            {event.titre}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {mode === "signin"
              ? "Connectez-vous à votre espace organisateur."
              : "Recevez un lien pour réinitialiser votre mot de passe."}
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

            {mode === "signin" && (
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
                  autoComplete="current-password"
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-xl border border-border bg-background px-4 py-3 text-base focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl bg-primary px-5 py-3.5 text-base font-semibold text-primary-foreground shadow-soft transition disabled:opacity-50"
            >
              {loading
                ? "…"
                : mode === "signin"
                  ? "Accéder à mon espace admin"
                  : "Envoyer le lien"}
            </button>

            <button
              type="button"
              onClick={() => {
                setMode(mode === "signin" ? "reset" : "signin");
                setError(null);
                setInfo(null);
              }}
              className="w-full text-center text-xs font-medium text-primary hover:underline"
            >
              {mode === "signin"
                ? "Mot de passe oublié ?"
                : "← Retour à la connexion"}
            </button>
          </form>

          <div className="mt-6 border-t border-border pt-4">
            <Link
              to="/"
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              ← Retour à la galerie
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}