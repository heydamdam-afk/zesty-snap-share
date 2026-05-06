import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ZestLogo } from "@/components/zest/Logo";
import { findEventByCode } from "@/lib/zest-actions";
import { pickAvatarColor } from "@/lib/zest-session";
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
  const [prenom, setPrenom] = useState("");
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [showGuestEntry, setShowGuestEntry] = useState(false);
  const [guestCode, setGuestCode] = useState("");
  const [hydrated, setHydrated] = useState(false);
  const [resetting, setResetting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

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
        const { error: err } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (err) throw err;
        await routeAfterAuth(navigate);
      } else {
        const cleanPrenom = prenom.trim();
        const { error: err } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/create-event`,
            data: { prenom: cleanPrenom },
          },
        });
        if (err) throw err;

        // Si la session existe déjà (auto-confirm), on peut uploader l'avatar
        // et propager prenom + avatar_url dans event_admins. Sinon ce sera
        // fait au prochain login (link_admin_user_id côté /admin ou my-events).
        const { data: postSignup } = await supabase.auth.getSession();
        const userId = postSignup.session?.user.id ?? null;
        if (userId) {
          let avatarUrl: string | null = null;
          if (avatarFile) {
            const ext = (avatarFile.name.split(".").pop() || "jpg").toLowerCase();
            const path = `admin-avatars/${userId}.${ext}`;
            const { error: upErr } = await supabase.storage
              .from("event-photos")
              .upload(path, avatarFile, { upsert: true, contentType: avatarFile.type });
            if (!upErr) {
              const { data: pub } = supabase.storage
                .from("event-photos")
                .getPublicUrl(path);
              avatarUrl = pub.publicUrl;
            } else {
              console.warn("[landing] avatar upload failed", upErr);
            }
          }
          try {
            await supabase.rpc("link_admin_user_id");
            const updates: { prenom?: string; avatar_url?: string } = { prenom: cleanPrenom };
            if (avatarUrl) updates.avatar_url = avatarUrl;
            await supabase
              .from("event_admins")
              .update(updates)
              .ilike("email", email.trim());
          } catch (e) {
            console.warn("[landing] propagate profile to event_admins failed", e);
          }
        }

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
            {mode === "signup" && (
              <>
                <div>
                  <div className="mb-1.5 flex items-center justify-between">
                    <label
                      htmlFor="prenom"
                      className="block text-xs font-medium uppercase tracking-wide text-muted-foreground"
                    >
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
                      style={{
                        backgroundColor: avatarPreview
                          ? "transparent"
                          : pickAvatarColor(prenom || email || "?"),
                      }}
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
    navigate({ to: "/my-events" });
  } else {
    navigate({ to: "/create-event" });
  }
}