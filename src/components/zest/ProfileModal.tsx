import { useCallback, useEffect, useRef, useState } from "react";
import { X, Camera, Eye, EyeOff } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const COLORS = {
  primary: "#FF4842",
  textPrimary: "#212B36",
  textSecondary: "#637381",
  textDisabled: "#919EAB",
  inputBg: "#F4F6F8",
  border: "#E0E0E0",
  success: "#00AB55",
  warning: "#FFA000",
  danger: "#FF4842",
};

const MAX_AVATAR_BYTES = Math.floor(3.1 * 1024 * 1024);
const ALLOWED_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/gif"];
const SIGNED_URL_EXPIRY = 60 * 60 * 24 * 365; // 1 year

type Profile = {
  avatar_url: string | null;
  avatar_name: string | null;
  prenom: string | null;
  nom: string | null;
  email: string | null;
  telephone: string | null;
  date_naissance: string | null;
};

export interface ProfileModalProps {
  open: boolean;
  onClose: () => void;
  onAvatarChange?: (url: string | null) => void;
}

export function ProfileModal({ open, onClose, onAvatarChange }: ProfileModalProps) {
  const [userId, setUserId] = useState<string | null>(null);
  const [authEmail, setAuthEmail] = useState<string>("");
  const [emailConfirmed, setEmailConfirmed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [pwdSaving, setPwdSaving] = useState(false);
  const [emailNotice, setEmailNotice] = useState<string | null>(null);

  const [form, setForm] = useState<Profile>({
    avatar_url: null,
    avatar_name: "",
    prenom: "",
    nom: "",
    email: "",
    telephone: "",
    date_naissance: "",
  });
  const initialEmailRef = useRef<string>("");

  const [oldPwd, setOldPwd] = useState("");
  const [newPwd, setNewPwd] = useState("");
  const [confirmPwd, setConfirmPwd] = useState("");
  const [showOld, setShowOld] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [pwdError, setPwdError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [avatarHover, setAvatarHover] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data: u } = await supabase.auth.getUser();
      const user = u.user;
      if (!user) return;
      setUserId(user.id);
      setAuthEmail(user.email ?? "");
      setEmailConfirmed(!!user.email_confirmed_at);
      const { data: profile } = await supabase
        .from("profiles")
        .select("avatar_url, avatar_name, prenom, nom, email, telephone, date_naissance")
        .eq("id", user.id)
        .maybeSingle();
      const p: Profile = profile ?? {
        avatar_url: null, avatar_name: "", prenom: "", nom: "",
        email: user.email ?? "", telephone: "", date_naissance: "",
      };
      const next: Profile = {
        avatar_url: p.avatar_url,
        avatar_name: p.avatar_name ?? "",
        prenom: p.prenom ?? "",
        nom: p.nom ?? "",
        email: p.email ?? user.email ?? "",
        telephone: p.telephone ?? "",
        date_naissance: p.date_naissance ?? "",
      };
      setForm(next);
      initialEmailRef.current = next.email ?? "";
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) {
      setEmailNotice(null);
      setOldPwd(""); setNewPwd(""); setConfirmPwd(""); setPwdError(null);
      void load();
    }
  }, [open, load]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const handleAvatarPick = async (file: File) => {
    if (!userId) return;
    if (!ALLOWED_TYPES.includes(file.type)) {
      toast.error("Format non supporté (jpeg, jpg, png, gif)");
      return;
    }
    if (file.size > MAX_AVATAR_BYTES) {
      toast.error("Fichier trop volumineux (max 3.1 MB)");
      return;
    }
    setUploading(true);
    try {
      const ext = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
      const path = `${userId}/avatar-${Date.now()}.${ext}`;
      const up = await supabase.storage.from("zeste-avatars").upload(path, file, {
        cacheControl: "3600", upsert: false, contentType: file.type,
      });
      if (up.error) throw up.error;
      const signed = await supabase.storage.from("zeste-avatars").createSignedUrl(path, SIGNED_URL_EXPIRY);
      if (signed.error) throw signed.error;
      const url = signed.data.signedUrl;
      const { error: updErr } = await supabase.from("profiles").update({ avatar_url: url }).eq("id", userId);
      if (updErr) throw updErr;
      setForm((f) => ({ ...f, avatar_url: url }));
      onAvatarChange?.(url);
      toast.success("Photo de profil mise à jour");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Échec de l'envoi";
      toast.error(msg);
    } finally {
      setUploading(false);
    }
  };

  const handleSaveProfile = async () => {
    if (!userId) return;
    setSaving(true);
    setEmailNotice(null);
    try {
      const { error } = await supabase.from("profiles").update({
        avatar_name: form.avatar_name || null,
        prenom: form.prenom || null,
        nom: form.nom || null,
        telephone: form.telephone || null,
        date_naissance: form.date_naissance || null,
      }).eq("id", userId);
      if (error) throw error;

      const newEmail = (form.email ?? "").trim().toLowerCase();
      const oldEmail = (initialEmailRef.current ?? "").trim().toLowerCase();
      if (newEmail && newEmail !== oldEmail) {
        const { error: emailErr } = await supabase.auth.updateUser({ email: newEmail });
        if (emailErr) {
          toast.error(`Email : ${emailErr.message}`);
        } else {
          setEmailNotice(`Un email de confirmation a été envoyé à ${newEmail}. L'email sera mis à jour après confirmation.`);
          setEmailConfirmed(false);
        }
      }
      toast.success("Profil mis à jour");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Erreur lors de la sauvegarde";
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  const handleSavePassword = async () => {
    setPwdError(null);
    if (!oldPwd || !newPwd || !confirmPwd) {
      setPwdError("Tous les champs sont requis");
      return;
    }
    if (newPwd.length < 12) {
      setPwdError("Le nouveau mot de passe doit faire au moins 12 caractères");
      return;
    }
    if (newPwd !== confirmPwd) {
      setPwdError("Les mots de passe ne correspondent pas");
      return;
    }
    setPwdSaving(true);
    try {
      const email = authEmail;
      if (!email) throw new Error("Email introuvable");
      const reauth = await supabase.auth.signInWithPassword({ email, password: oldPwd });
      if (reauth.error) {
        setPwdError("Ancien mot de passe incorrect");
        return;
      }
      const { error } = await supabase.auth.updateUser({ password: newPwd });
      if (error) throw error;
      toast.success("Mot de passe mis à jour");
      setOldPwd(""); setNewPwd(""); setConfirmPwd("");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Échec de la mise à jour";
      setPwdError(msg);
    } finally {
      setPwdSaving(false);
    }
  };

  if (!open) return null;

  const initials = (() => {
    const a = (form.prenom || form.avatar_name || form.email || "?").trim();
    const parts = a.split(/[\s@.]+/).filter(Boolean);
    const i = parts.slice(0, 2).map((s) => s[0]?.toUpperCase() ?? "").join("");
    return i || "?";
  })();

  const inputStyle: React.CSSProperties = {
    width: "100%",
    background: COLORS.inputBg,
    border: `1px solid ${COLORS.border}`,
    borderRadius: 8,
    padding: "12px 14px",
    fontSize: 14,
    color: COLORS.textPrimary,
    fontFamily: "var(--font-sans)",
    outline: "none",
  };
  const labelStyle: React.CSSProperties = {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginBottom: 4,
    display: "block",
    fontFamily: "var(--font-sans)",
  };

  const primaryBtn: React.CSSProperties = {
    background: COLORS.primary,
    color: "#fff",
    border: "none",
    borderRadius: 8,
    padding: "10px 24px",
    fontSize: 14,
    fontWeight: 600,
    cursor: "pointer",
    fontFamily: "var(--font-sans)",
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Profil"
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, background: "rgba(33,43,54,0.5)",
        zIndex: 100, display: "grid", placeItems: "center",
        padding: 16, overflowY: "auto",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "#fff", borderRadius: 12, width: "100%",
          maxWidth: 780, maxHeight: "calc(100vh - 32px)",
          overflowY: "auto", boxShadow: "0 24px 48px rgba(0,0,0,0.2)",
          fontFamily: "var(--font-sans)",
        }}
      >
        {/* Header */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "20px 24px", borderBottom: `1px solid ${COLORS.border}`,
        }}>
          <h2 style={{
            margin: 0, fontSize: 18, fontWeight: 600, color: COLORS.textPrimary,
            fontFamily: "var(--font-display)",
          }}>Mon profil</h2>
          <button type="button" onClick={onClose} aria-label="Fermer" style={{
            background: "transparent", border: "none", cursor: "pointer", color: COLORS.textSecondary,
            display: "grid", placeItems: "center", padding: 4,
          }}>
            <X size={20} />
          </button>
        </div>

        {loading ? (
          <div style={{ padding: 48, textAlign: "center", color: COLORS.textSecondary }}>Chargement…</div>
        ) : (
          <>
            {/* Section 1 */}
            <div style={{ padding: 24, display: "grid", gridTemplateColumns: "minmax(0,1fr)", gap: 24 }}>
              {/* Avatar + form grid */}
              <div style={{
                display: "grid",
                gridTemplateColumns: "minmax(180px, 220px) 1fr",
                gap: 24,
                alignItems: "start",
              }} className="profile-modal-row">
                {/* Avatar */}
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    onMouseEnter={() => setAvatarHover(true)}
                    onMouseLeave={() => setAvatarHover(false)}
                    disabled={uploading}
                    style={{
                      position: "relative", width: 140, height: 140, borderRadius: "50%",
                      border: `2px dashed ${COLORS.border}`, padding: 6, background: "transparent",
                      cursor: uploading ? "wait" : "pointer",
                    }}
                    aria-label="Mettre à jour la photo"
                  >
                    <div style={{
                      width: "100%", height: "100%", borderRadius: "50%", overflow: "hidden",
                      background: form.avatar_url ? "#000" : COLORS.primary,
                      color: "#fff", display: "grid", placeItems: "center",
                      fontWeight: 700, fontSize: 32, position: "relative",
                    }}>
                      {form.avatar_url ? (
                        <img src={form.avatar_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                      ) : initials}
                      {(avatarHover || uploading) && (
                        <div style={{
                          position: "absolute", inset: 0, background: "rgba(33,43,54,0.6)",
                          display: "grid", placeItems: "center", color: "#fff",
                          flexDirection: "column",
                        }}>
                          <div style={{ display: "grid", placeItems: "center", gap: 4 }}>
                            <Camera size={20} />
                            <span style={{ fontSize: 11 }}>{uploading ? "Envoi…" : "Mettre à jour"}</span>
                          </div>
                        </div>
                      )}
                    </div>
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".jpeg,.jpg,.png,.gif,image/jpeg,image/png,image/gif"
                    style={{ display: "none" }}
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) void handleAvatarPick(f);
                      e.target.value = "";
                    }}
                  />
                  <div style={{ fontSize: 12, color: COLORS.textDisabled, textAlign: "center", lineHeight: 1.4 }}>
                    Formats : *.jpeg, *.jpg, *.png, *.gif<br />Taille max : 3.1 MB
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8 }}>
                    <span
                      role="img"
                      aria-label={emailConfirmed ? "Email vérifié" : "Email non vérifié"}
                      style={{
                        width: 34, height: 18, borderRadius: 999,
                        background: emailConfirmed ? COLORS.primary : "#C4CDD5",
                        position: "relative", display: "inline-block",
                      }}
                    >
                      <span style={{
                        position: "absolute", top: 2, left: emailConfirmed ? 18 : 2,
                        width: 14, height: 14, borderRadius: "50%", background: "#fff",
                        transition: "left 0.2s",
                      }} />
                    </span>
                    <span style={{
                      fontSize: 12, fontWeight: 600,
                      color: emailConfirmed ? COLORS.success : COLORS.warning,
                    }}>
                      {emailConfirmed ? "E-mail vérifié" : "E-mail non vérifié"}
                    </span>
                  </div>
                </div>

                {/* Form fields */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }} className="profile-form-grid">
                  <Field label="Avatar Name" full>
                    <input
                      style={inputStyle}
                      placeholder="Votre nom affiché dans les événements"
                      value={form.avatar_name ?? ""}
                      onChange={(e) => setForm({ ...form, avatar_name: e.target.value })}
                    />
                  </Field>
                  <Field label="Prénom">
                    <input style={inputStyle} value={form.prenom ?? ""}
                      onChange={(e) => setForm({ ...form, prenom: e.target.value })} />
                  </Field>
                  <Field label="Nom">
                    <input style={inputStyle} value={form.nom ?? ""}
                      onChange={(e) => setForm({ ...form, nom: e.target.value })} />
                  </Field>
                  <Field label="Adresse email">
                    <input type="email" style={inputStyle} value={form.email ?? ""}
                      onChange={(e) => setForm({ ...form, email: e.target.value })} />
                  </Field>
                  <Field label="Numéro de téléphone">
                    <input type="tel" style={inputStyle} value={form.telephone ?? ""}
                      onChange={(e) => setForm({ ...form, telephone: e.target.value })} />
                  </Field>
                  <Field label="Date de naissance">
                    <input type="date" style={inputStyle} value={form.date_naissance ?? ""}
                      onChange={(e) => setForm({ ...form, date_naissance: e.target.value })} />
                  </Field>
                  {emailNotice && (
                    <div style={{
                      gridColumn: "1 / -1",
                      fontSize: 12, color: COLORS.warning, background: "#FFF7E6",
                      padding: "10px 12px", borderRadius: 8,
                    }}>{emailNotice}</div>
                  )}
                </div>
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end" }}>
                <button type="button" onClick={handleSaveProfile} disabled={saving} style={{
                  ...primaryBtn, opacity: saving ? 0.7 : 1,
                }}>
                  {saving ? "Enregistrement…" : "Enregistrer"}
                </button>
              </div>
            </div>

            {/* Section 2 — password */}
            <div style={{
              padding: 24, borderTop: `1px solid ${COLORS.border}`,
              display: "flex", flexDirection: "column", gap: 16,
            }}>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: COLORS.textPrimary, fontFamily: "var(--font-display)" }}>
                Modifier mon mot de passe
              </h3>
              <PwdField label="Ancien mot de passe" value={oldPwd} setValue={setOldPwd} show={showOld} setShow={setShowOld} inputStyle={inputStyle} labelStyle={labelStyle} />
              <div>
                <PwdField label="Nouveau mot de passe" value={newPwd} setValue={setNewPwd} show={showNew} setShow={setShowNew} inputStyle={inputStyle} labelStyle={labelStyle} />
                <div style={{ fontSize: 12, color: COLORS.textDisabled, marginTop: 6 }}>
                  Le mot de passe doit faire minimum 12 caractères
                </div>
              </div>
              <PwdField label="Confirmer le nouveau mot de passe" value={confirmPwd} setValue={setConfirmPwd} show={showConfirm} setShow={setShowConfirm} inputStyle={inputStyle} labelStyle={labelStyle} />
              {pwdError && (
                <div style={{ fontSize: 13, color: COLORS.danger }}>{pwdError}</div>
              )}
              <div style={{ display: "flex", justifyContent: "flex-end" }}>
                <button type="button" onClick={handleSavePassword} disabled={pwdSaving} style={{
                  ...primaryBtn, opacity: pwdSaving ? 0.7 : 1,
                }}>
                  {pwdSaving ? "Mise à jour…" : "Mettre à jour le mot de passe"}
                </button>
              </div>
            </div>
          </>
        )}
      </div>
      <style>{`
        @media (max-width: 640px) {
          .profile-modal-row { grid-template-columns: 1fr !important; }
          .profile-form-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  );
}

function Field({ label, full, children }: { label: string; full?: boolean; children: React.ReactNode }) {
  return (
    <label style={{ display: "block", gridColumn: full ? "1 / -1" : undefined }}>
      <span style={{ fontSize: 12, color: COLORS.textSecondary, marginBottom: 4, display: "block" }}>{label}</span>
      {children}
    </label>
  );
}

function PwdField({
  label, value, setValue, show, setShow, inputStyle, labelStyle,
}: {
  label: string; value: string; setValue: (v: string) => void;
  show: boolean; setShow: (v: boolean) => void;
  inputStyle: React.CSSProperties; labelStyle: React.CSSProperties;
}) {
  return (
    <label style={{ display: "block" }}>
      <span style={labelStyle}>{label}</span>
      <div style={{ position: "relative" }}>
        <input
          type={show ? "text" : "password"}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          style={{ ...inputStyle, paddingRight: 40 }}
        />
        <button type="button" onClick={() => setShow(!show)} aria-label={show ? "Masquer" : "Afficher"} style={{
          position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)",
          background: "transparent", border: "none", color: COLORS.textSecondary, cursor: "pointer",
          display: "grid", placeItems: "center", padding: 6,
        }}>
          {show ? <EyeOff size={16} /> : <Eye size={16} />}
        </button>
      </div>
    </label>
  );
}