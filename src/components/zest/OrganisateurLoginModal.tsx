import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { X } from "lucide-react";
import { syncMarketingContact } from "@/lib/zest-actions";

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

export function OrganisateurLoginModal({
  open,
  onClose,
  eventId,
  eventTitle,
  slug,
}: {
  open: boolean;
  onClose: () => void;
  eventId: string;
  eventTitle: string;
  slug: string;
}) {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"signin" | "reset">("signin");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  // Reset à l'ouverture/fermeture
  useEffect(() => {
    if (!open) {
      setError(null);
      setInfo(null);
      setPassword("");
      setMode("signin");
    }
  }, [open]);

  // ESC pour fermer
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfo(null);

    if (mode === "reset") {
      setLoading(true);
      try {
        const { error: rpErr } = await supabase.auth.resetPasswordForEmail(
          email,
          { redirectTo: `${window.location.origin}/${slug}/admin` },
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

      await supabase.rpc("link_admin_user_id");
      const { data: adm, error: admErr } = await supabase
        .from("event_admins")
        .select("id, role")
        .eq("event_id", eventId)
        .ilike("email", email)
        .maybeSingle();
      if (admErr) throw admErr;
      if (!adm) {
        await supabase.auth.signOut();
        throw new Error("Vous n'êtes pas admin de cet événement.");
      }

      // Sync marketing contact (role=admin) — fire-and-forget, ne bloque pas le login.
      void syncMarketingContact(eventId, email, null, "admin", true);

      clearAttempts(slug, email);
      toast.success(`Bienvenue ! Rôle : ${adm.role}`);
      onClose();
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

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-foreground/40 px-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="org-login-title"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-md rounded-3xl bg-card p-6 shadow-card"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Fermer"
          className="absolute right-4 top-4 grid h-8 w-8 place-items-center rounded-full text-muted-foreground hover:bg-secondary"
        >
          <X className="h-4 w-4" />
        </button>

        <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
          Espace organisateur
        </span>
        <h2
          id="org-login-title"
          className="mt-3 font-display text-xl text-foreground"
        >
          {eventTitle}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {mode === "signin"
            ? "Connectez-vous à votre espace de gestion."
            : "Recevez un lien pour réinitialiser votre mot de passe."}
        </p>

        <form onSubmit={submit} className="mt-5 space-y-3" noValidate>
          {error && (
            <div
              className="rounded-xl bg-destructive/10 px-3 py-2 text-sm font-medium text-destructive"
              role="alert"
            >
              {error}
            </div>
          )}
          {info && (
            <div
              className="rounded-xl bg-primary/10 px-3 py-2 text-sm font-medium text-primary"
              role="status"
            >
              {info}
            </div>
          )}

          <div>
            <label
              htmlFor="org-email"
              className="mb-1 block text-xs font-medium uppercase tracking-wide text-muted-foreground"
            >
              Email
            </label>
            <input
              id="org-email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-base focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>

          {mode === "signin" && (
            <div>
              <label
                htmlFor="org-password"
                className="mb-1 block text-xs font-medium uppercase tracking-wide text-muted-foreground"
              >
                Mot de passe
              </label>
              <input
                id="org-password"
                type="password"
                autoComplete="current-password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-base focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-primary px-5 py-3 text-base font-semibold text-primary-foreground shadow-soft transition disabled:opacity-50"
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
      </div>
    </div>
  );
}