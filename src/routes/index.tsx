import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
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
  // Guest code entry removed from login screen.
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

  if (!hydrated) return null;

  return (
    <div className="ka-shell">
      {/* ── Brand panel ── */}
      <aside className="ka-brand">
        <div className="ka-brand-top">
          <span className="ka-logo">
            <span className="ka-logo-dot" />
            Kapsul
          </span>
        </div>

        <div className="ka-hero">
          <span className="ka-eyebrow">
            <span className="ka-eyebrow-dot" />
            {mode === "signin" ? "Espace organisateur" : "Créer un compte"}
          </span>
          <h1 className="ka-h1-brand">
            {mode === "signin"
              ? "Vos galeries vous attendent."
              : "Votre première galerie en 3 minutes."}
          </h1>
          <p className="ka-lead">
            {mode === "signin"
              ? "Retrouvez vos événements, suivez les photos en direct, et téléchargez l'album complet en un clic."
              : "Créez votre compte organisateur, lancez votre premier événement, partagez le QR code à vos invités — c'est tout."}
          </p>
        </div>

        <div className="ka-polaroid-stack" aria-hidden>
          <div className="ka-polaroid ka-poly-1">
            <div className="ka-poly-img" />
            <div className="ka-poly-cap">
              {mode === "signin" ? "Mariage · Julie & Thomas" : "Mariage · J&T 09/26"}
            </div>
          </div>
          <div className="ka-polaroid ka-poly-2">
            <div className="ka-poly-img" />
            <div className="ka-poly-cap">
              {mode === "signin" ? "Anniversaire · Léa 30 ans" : "Soirée · Studio 14"}
            </div>
          </div>
          <div className="ka-polaroid ka-poly-3">
            <div className="ka-poly-img" />
            <div className="ka-poly-cap">
              {mode === "signin" ? "Séminaire · Acme 2026" : "Voyage · Bali 2026"}
            </div>
          </div>
        </div>

        <div className="ka-brand-footer">
          <div>
            <div className="ka-stat-num">+500</div>
            <div className="ka-stat-lbl">Événements</div>
          </div>
          <div>
            <div className="ka-stat-num">120k</div>
            <div className="ka-stat-lbl">Photos partagées</div>
          </div>
          <div>
            <div className="ka-stat-num">4.9/5</div>
            <div className="ka-stat-lbl">Satisfaction</div>
          </div>
        </div>
      </aside>

      {/* ── Form panel ── */}
      <main className="ka-form-panel">
        <div className="ka-form-inner">
          <form onSubmit={submit} className="ka-screen" noValidate>
            <h2 className="ka-h1">
              {mode === "signin" ? "Bon retour !" : "Créez votre compte organisateur"}
            </h2>
            <p className="ka-sub">
              {mode === "signin"
                ? "Connectez-vous pour créer ou gérer vos événements. Espace réservé aux organisateurs."
                : "Quelques infos et vous démarrez votre première galerie. Réservé aux organisateurs et administrateurs."}
            </p>

            {error && (
              <div className="ka-error-banner" role="alert">
                <span className="ka-error-dot">!</span>
                {error}
              </div>
            )}
            {info && (
              <div
                role="status"
                style={{
                  marginBottom: 16,
                  padding: "12px 14px",
                  background: "rgba(0,171,85,0.08)",
                  border: "1px solid rgba(0,171,85,0.2)",
                  borderRadius: 12,
                  color: "#00AB55",
                  fontSize: 13.5,
                  fontWeight: 500,
                  fontFamily: '"Public Sans", sans-serif',
                  lineHeight: 1.5,
                }}
              >
                {info}
              </div>
            )}

            {mode === "signup" && (
              <>
                <div className="ka-field">
                  <div className="ka-label-row">
                    <span className="ka-label">Prénom</span>
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
                    className="ka-input"
                    autoFocus
                  />
                </div>

                <div className="ka-field">
                  <div className="ka-label-row">
                    <span className="ka-label">Photo de profil</span>
                    <span style={{ fontSize: 12, color: "#919EAB", fontFamily: '"Public Sans", sans-serif' }}>
                      · optionnel
                    </span>
                  </div>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 16,
                      padding: "12px 14px",
                      border: "1.5px solid #E7E3DE",
                      borderRadius: 12,
                      background: "#fff",
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => fileRef.current?.click()}
                      style={{
                        width: 56,
                        height: 56,
                        borderRadius: "50%",
                        flexShrink: 0,
                        overflow: "hidden",
                        background: avatarPreview ? "transparent" : pickAvatarColor(prenom || email || "?"),
                        cursor: "pointer",
                        border: "none",
                        padding: 0,
                      }}
                    >
                      {avatarPreview ? (
                        <img src={avatarPreview} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                      ) : (
                        <span
                          style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            height: "100%",
                            fontFamily: '"Josefin Sans", sans-serif',
                            fontSize: 22,
                            fontWeight: 700,
                            color: "#fff",
                          }}
                        >
                          {(prenom.trim()[0] ?? email.trim()[0] ?? "?").toUpperCase()}
                        </span>
                      )}
                    </button>
                    <div style={{ minWidth: 0 }}>
                      <p style={{ fontSize: 12, color: "#919EAB", fontFamily: '"Public Sans", sans-serif', margin: 0 }}>
                        JPG, PNG ou WebP · 5 Mo max
                      </p>
                      <button
                        type="button"
                        onClick={() => fileRef.current?.click()}
                        style={{
                          fontSize: 12,
                          fontWeight: 600,
                          color: "#FF4842",
                          background: "none",
                          border: "none",
                          cursor: "pointer",
                          padding: 0,
                          marginTop: 4,
                          fontFamily: '"Public Sans", sans-serif',
                        }}
                      >
                        {avatarPreview ? "Changer" : "Choisir une photo"}
                      </button>
                      <input
                        ref={fileRef}
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        style={{ display: "none" }}
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

            <div className="ka-field">
              <div className="ka-label-row">
                <span className="ka-label">Email</span>
              </div>
              <input
                id="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="vous@exemple.com"
                className="ka-input"
              />
            </div>

            <div className="ka-field">
              <div className="ka-label-row">
                <span className="ka-label">Mot de passe</span>
                {mode === "signin" && (
                  <button
                    type="button"
                    disabled={resetting}
                    className="ka-forgot"
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
                  >
                    {resetting ? "Envoi…" : "Mot de passe oublié ?"}
                  </button>
                )}
              </div>
              <input
                id="password"
                type="password"
                autoComplete={mode === "signin" ? "current-password" : "new-password"}
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="ka-input"
              />
            </div>

            <button type="submit" disabled={loading} className="ka-cta">
              {loading ? "…" : mode === "signin" ? "Se connecter →" : "Créer mon compte →"}
            </button>

            <p className="ka-switch">
              {mode === "signin" ? "Pas encore de compte ?" : "Déjà un compte ?"}
              <button
                type="button"
                onClick={() => {
                  setMode(mode === "signin" ? "signup" : "signin");
                  setError(null);
                  setInfo(null);
                }}
                style={{
                  background: "none",
                  border: "none",
                  color: "#FF4842",
                  fontWeight: 600,
                  fontSize: 14,
                  cursor: "pointer",
                  paddingLeft: 4,
                  fontFamily: '"Public Sans", sans-serif',
                }}
              >
                {mode === "signin" ? "Créer un compte organisateur" : "J'ai déjà un compte"}
              </button>
            </p>
          </form>

          {/* ── Guest code entry ── */}
        </div>
      </main>
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