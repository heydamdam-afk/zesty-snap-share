import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ZestLogo } from "@/components/zest/Logo";
import { AdminBookmark, ADMIN_ONBOARDED_KEY } from "@/components/zest/AdminBookmark";
import { pickAvatarColor } from "@/lib/zest-session";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: "Espace admin — Kapsul" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminLogin,
});

function AdminLogin() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [prenom, setPrenom] = useState("");
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sessionEmail, setSessionEmail] = useState<string | null>(null);
  const [showBookmark, setShowBookmark] = useState(false);
  const [adminSlug, setAdminSlug] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const fetchAdminSlug = async (email: string): Promise<string | null> => {
    try {
      // Lier user_id si admin invité par email avant inscription
      await supabase.rpc("link_admin_user_id");
      const { data, error } = await supabase
        .from("event_admins")
        .select("events!inner(slug)")
        .ilike("email", email)
        .limit(1)
        .maybeSingle();
      if (error) {
        console.error("[admin] fetchAdminSlug error", error);
        return null;
      }
      const events = (data as { events?: { slug?: string } | null } | null)?.events;
      return events?.slug ?? null;
    } catch (e) {
      console.error("[admin] fetchAdminSlug failed", e);
      return null;
    }
  };

  useEffect(() => {
    let cancelled = false;
    const { data: sub } = supabase.auth.onAuthStateChange(async (_e, session) => {
      if (cancelled) return;
      const email = session?.user.email ?? null;
      setSessionEmail(email);
      if (email) {
        const slug = await fetchAdminSlug(email);
        if (cancelled) return;
        setAdminSlug(slug);
      } else {
        setAdminSlug(null);
      }
    });
    void (async () => {
      try {
        const { data } = await supabase.auth.getSession();
        if (cancelled) return;
        const email = data.session?.user.email ?? null;
        setSessionEmail(email);
        if (!email) return; // guard : pas de session, on n'interroge pas la DB
        const slug = await fetchAdminSlug(email);
        if (cancelled) return;
        setAdminSlug(slug);
      } catch (e) {
        console.error("[admin] init session failed", e);
      }
    })();
    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (mode === "signup") {
      const p = prenom.trim();
      if (p.length < 2 || p.length > 40) {
        setError("Prénom requis (2 à 40 caractères).");
        return;
      }
    }
    setLoading(true);
    try {
      if (mode === "signin") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      } else {
        const cleanPrenom = prenom.trim();
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: window.location.origin + "/admin",
            data: { prenom: cleanPrenom },
          },
        });
        if (error) throw error;

        // Upload avatar si fourni (nécessite session active)
        let avatarUrl: string | null = null;
        const { data: postSignup } = await supabase.auth.getSession();
        const userId = postSignup.session?.user.id ?? null;
        if (userId && avatarFile) {
          const ext = (avatarFile.name.split(".").pop() || "jpg").toLowerCase();
          const path = `admin-avatars/${userId}.${ext}`;
          const { error: upErr } = await supabase.storage
            .from("event-photos")
            .upload(path, avatarFile, { upsert: true, contentType: avatarFile.type });
          if (!upErr) {
            const { data: pub } = supabase.storage.from("event-photos").getPublicUrl(path);
            avatarUrl = pub.publicUrl;
          } else {
            console.warn("[admin] avatar upload failed", upErr);
          }
        }

        // Lier user_id et propager prenom/avatar dans event_admins (si invité par email)
        try {
          await supabase.rpc("link_admin_user_id");
          const updates: { prenom?: string; avatar_url?: string } = { prenom: cleanPrenom };
          if (avatarUrl) updates.avatar_url = avatarUrl;
          await supabase
            .from("event_admins")
            .update(updates)
            .ilike("email", email);
        } catch (e) {
          console.warn("[admin] propagate profile to event_admins failed", e);
        }
      }
      const { data: sessionData } = await supabase.auth.getSession();
      const sessionEmailLocal = sessionData.session?.user.email ?? email;
      const slug = sessionEmailLocal ? await fetchAdminSlug(sessionEmailLocal) : null;
      setAdminSlug(slug);
      const seen = localStorage.getItem(ADMIN_ONBOARDED_KEY);
      if (!seen) {
        setShowBookmark(true);
      } else if (slug) {
        navigate({ to: "/$slug/admin/dashboard", params: { slug } });
      } else {
        navigate({ to: "/" });
      }
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

  if (showBookmark) {
    return (
      <AdminBookmark
        onContinue={() => {
          localStorage.setItem(ADMIN_ONBOARDED_KEY, "true");
          if (adminSlug) {
            navigate({ to: "/$slug/admin/dashboard", params: { slug: adminSlug } });
          } else {
            navigate({ to: "/" });
          }
        }}
      />
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

          {sessionEmail ? (
            <>
              <h1 className="font-display text-2xl text-foreground">Connecté</h1>
              <p className="mt-1 text-sm text-muted-foreground">{sessionEmail}</p>
              <div className="mt-6 flex flex-col gap-2">
                {adminSlug ? (
                  <Link
                    to="/$slug/admin/dashboard"
                    params={{ slug: adminSlug }}
                    className="w-full rounded-xl bg-primary px-5 py-3 text-center text-sm font-semibold text-primary-foreground"
                  >
                    Accéder au tableau de bord
                  </Link>
                ) : (
                  <Link
                    to="/"
                    className="w-full rounded-xl bg-primary px-5 py-3 text-center text-sm font-semibold text-primary-foreground"
                  >
                    Aller à la galerie
                  </Link>
                )}
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
                {mode === "signup" && (
                  <>
                    <div>
                      <div className="mb-1.5 flex items-center justify-between">
                        <label htmlFor="prenom" className="block text-xs font-medium uppercase tracking-wide text-muted-foreground">
                          Prénom
                        </label>
                        <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary">
                          Obligatoire
                        </span>
                      </div>
                      <input
                        id="prenom"
                        type="text"
                        autoComplete="given-name"
                        required
                        minLength={2}
                        maxLength={40}
                        value={prenom}
                        onChange={(e) => setPrenom(e.target.value)}
                        placeholder="Votre prénom"
                        className="w-full rounded-xl border border-border bg-background px-4 py-3 text-base focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                      />
                    </div>
                    <div>
                      <div className="mb-2 flex items-center justify-between">
                        <span className="block text-xs font-medium uppercase tracking-wide text-muted-foreground">
                          Photo de profil
                        </span>
                        <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                          Optionnelle
                        </span>
                      </div>
                      <div className="flex items-center gap-4 rounded-xl border border-border bg-background/60 p-3">
                        <button
                          type="button"
                          onClick={() => fileRef.current?.click()}
                          className="relative h-16 w-16 shrink-0 overflow-hidden rounded-full ring-2 ring-card"
                          style={{ backgroundColor: avatarPreview ? "transparent" : pickAvatarColor(prenom || email || "?") }}
                        >
                          {avatarPreview ? (
                            <img src={avatarPreview} alt="" className="h-full w-full object-cover" />
                          ) : (
                            <span className="flex h-full w-full items-center justify-center font-display text-2xl font-bold text-white">
                              {(prenom.trim()[0] ?? email.trim()[0] ?? "?").toUpperCase()}
                            </span>
                          )}
                        </button>
                        <div className="min-w-0 flex-1 text-sm">
                          <p className="text-xs text-muted-foreground">JPG, PNG ou WebP · 5 Mo max</p>
                          <button
                            type="button"
                            onClick={() => fileRef.current?.click()}
                            className="mt-1 text-xs font-medium text-primary hover:underline"
                          >
                            {avatarPreview ? "Changer" : "Choisir une photo"}
                          </button>
                          <input
                            ref={fileRef}
                            type="file"
                            accept="image/jpeg,image/png,image/webp"
                            className="hidden"
                            onChange={(e) => {
                              const f = e.target.files?.[0];
                              if (!f) return;
                              if (!f.type.startsWith("image/") || f.size > 5 * 1024 * 1024) {
                                setError("Image invalide (5 Mo max).");
                                return;
                              }
                              setAvatarFile(f);
                              const reader = new FileReader();
                              reader.onload = () => setAvatarPreview(reader.result as string);
                              reader.readAsDataURL(f);
                            }}
                          />
                        </div>
                      </div>
                    </div>
                  </>
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