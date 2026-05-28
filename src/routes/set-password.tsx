import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ZestLogo } from "@/components/zest/Logo";
import {
  prepareSetPassword,
  setInitialPassword,
} from "@/lib/create-event.functions";

type Search = { session_id?: string };

export const Route = createFileRoute("/set-password")({
  validateSearch: (s: Record<string, unknown>): Search => ({
    session_id: typeof s.session_id === "string" ? s.session_id : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Kapsul — Définir votre mot de passe" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: SetPasswordPage,
});

function SetPasswordPage() {
  const search = Route.useSearch();
  const navigate = useNavigate();
  const prepare = useServerFn(prepareSetPassword);
  const setPwd = useServerFn(setInitialPassword);

  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState<string | null>(null);
  const [slug, setSlug] = useState<string | null>(null);
  const [alreadyOnboarded, setAlreadyOnboarded] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancel = false;
    (async () => {
      if (!search.session_id) {
        setError("Lien invalide.");
        setLoading(false);
        return;
      }
      try {
        const res = await prepare({ data: { sessionId: search.session_id } });
        if (cancel) return;
        if (!res.ready) {
          setError("Votre événement n'est pas encore prêt. Réessayez dans quelques instants.");
          setLoading(false);
          return;
        }
        setEmail(res.email);
        setSlug(res.slug);
        setAlreadyOnboarded(res.alreadyOnboarded);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Erreur");
      } finally {
        if (!cancel) setLoading(false);
      }
    })();
    return () => {
      cancel = true;
    };
  }, [search.session_id, prepare]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!search.session_id || !email || !slug) return;
    if (password.length < 8) {
      setError("Le mot de passe doit faire au moins 8 caractères.");
      return;
    }
    if (password !== confirm) {
      setError("Les deux mots de passe ne correspondent pas.");
      return;
    }
    setSubmitting(true);
    try {
      await setPwd({ data: { sessionId: search.session_id, password } });
      const { error: signErr } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (signErr) throw signErr;
      try {
        await supabase.rpc("link_admin_user_id");
      } catch {
        /* noop */
      }
      navigate({
        to: "/$slug/admin/dashboard",
        params: { slug },
        replace: true,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur");
      setSubmitting(false);
    }
  };

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
            {alreadyOnboarded ? "Connexion requise" : "Définissez votre mot de passe"}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {alreadyOnboarded
              ? "Un compte existe déjà avec cet email. Connectez-vous pour accéder à votre tableau de bord."
              : "Choisissez un mot de passe pour finaliser la création de votre compte organisateur."}
          </p>

          {email && (
            <p className="mt-3 truncate rounded-xl bg-secondary px-3 py-2 text-xs text-muted-foreground">
              {email}
            </p>
          )}

          {loading ? (
            <p className="mt-6 text-sm text-muted-foreground">Chargement…</p>
          ) : alreadyOnboarded && slug ? (
            <div className="mt-6 space-y-3">
              <Link
                to="/login"
                search={{ redirect: `/${slug}/admin/dashboard` } as never}
                className="block w-full rounded-xl bg-primary px-5 py-3.5 text-center text-base font-semibold text-primary-foreground shadow-soft"
              >
                Se connecter →
              </Link>
            </div>
          ) : (
            <form onSubmit={submit} className="mt-6 space-y-4" noValidate>
              {error && (
                <div
                  className="rounded-xl bg-destructive/10 px-4 py-3 text-sm font-medium text-destructive"
                  role="alert"
                >
                  {error}
                </div>
              )}
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
                  autoComplete="new-password"
                  required
                  minLength={8}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-xl border border-border bg-background px-4 py-3 text-base focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>
              <div>
                <label
                  htmlFor="confirm"
                  className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-muted-foreground"
                >
                  Confirmer
                </label>
                <input
                  id="confirm"
                  type="password"
                  autoComplete="new-password"
                  required
                  minLength={8}
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  className="w-full rounded-xl border border-border bg-background px-4 py-3 text-base focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>
              <button
                type="submit"
                disabled={submitting || !email}
                className="w-full rounded-xl bg-primary px-5 py-3.5 text-base font-semibold text-primary-foreground shadow-soft transition disabled:opacity-50"
              >
                {submitting ? "…" : "Activer mon compte →"}
              </button>
            </form>
          )}

          <p className="mt-6 text-center text-xs text-muted-foreground">
            <Link to="/" className="hover:text-foreground">
              ← Retour à l'accueil
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}