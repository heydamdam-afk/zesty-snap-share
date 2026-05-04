import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ZestLogo } from "@/components/zest/Logo";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: "Espace admin — Zest" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminLogin,
});

function AdminLogin() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sessionEmail, setSessionEmail] = useState<string | null>(null);

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      setSessionEmail(session?.user.email ?? null);
    });
    supabase.auth.getSession().then(({ data }) => {
      setSessionEmail(data.session?.user.email ?? null);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      if (mode === "signin") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      } else {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: window.location.origin + "/admin" },
        });
        if (error) throw error;
      }
      navigate({ to: "/" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur de connexion");
    } finally {
      setLoading(false);
    }
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setSessionEmail(null);
  };

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

          {sessionEmail ? (
            <>
              <h1 className="font-display text-2xl text-foreground">Connecté</h1>
              <p className="mt-1 text-sm text-muted-foreground">{sessionEmail}</p>
              <div className="mt-6 flex flex-col gap-2">
                <Link
                  to="/"
                  className="w-full rounded-xl bg-primary px-5 py-3 text-center text-sm font-semibold text-primary-foreground"
                >
                  Aller à la galerie
                </Link>
                <button
                  type="button"
                  onClick={signOut}
                  className="w-full rounded-xl border border-border px-5 py-3 text-sm font-medium text-foreground hover:bg-secondary"
                >
                  Se déconnecter
                </button>
              </div>
            </>
          ) : (
            <>
              <h1 className="font-display text-2xl text-foreground">
                {mode === "signin" ? "Connexion admin" : "Créer un compte admin"}
              </h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Accès réservé aux organisateurs d'événement.
              </p>

              <form onSubmit={submit} className="mt-6 space-y-4" noValidate>
                {error && (
                  <div className="rounded-xl bg-destructive/10 px-4 py-3 text-sm font-medium text-destructive" role="alert">
                    {error}
                  </div>
                )}
                <div>
                  <label htmlFor="email" className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-muted-foreground">
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
                  <label htmlFor="password" className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Mot de passe
                  </label>
                  <input
                    id="password"
                    type="password"
                    autoComplete={mode === "signin" ? "current-password" : "new-password"}
                    required
                    minLength={6}
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
                  {loading ? "…" : mode === "signin" ? "Se connecter" : "Créer mon compte"}
                </button>
                <button
                  type="button"
                  onClick={() => { setMode(mode === "signin" ? "signup" : "signin"); setError(null); }}
                  className="w-full text-center text-xs font-medium text-primary hover:underline"
                >
                  {mode === "signin" ? "Pas encore de compte ? Créer un compte admin" : "J'ai déjà un compte"}
                </button>
              </form>
            </>
          )}

          <div className="mt-6 border-t border-border pt-4">
            <Link to="/" className="text-xs text-muted-foreground hover:text-foreground">
              ← Retour à la galerie
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}