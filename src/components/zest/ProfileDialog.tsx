import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Avatar } from "./Avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Loader2, Upload } from "lucide-react";
import { z } from "zod";
import type { GuestSession } from "@/lib/zest-session";
import { normalisePrenom, generatePrenomSuggestions } from "@/lib/zest-actions";

const MAX_AVATAR_BYTES = 5 * 1024 * 1024;

const profileSchema = z.object({
  prenom: z
    .string()
    .trim()
    .min(1, "Prénom requis")
    .max(80, "Prénom trop long (80 max)"),
  email: z
    .string()
    .trim()
    .max(255, "Email trop long")
    .email("Email invalide")
    .optional()
    .or(z.literal("")),
});

export function ProfileDialog({
  open,
  onOpenChange,
  guest,
  onUpdated,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  guest: GuestSession;
  onUpdated: (next: { prenom?: string; email?: string | null; avatar_url?: string | null }) => void;
}) {
  const [prenom, setPrenom] = useState(guest.invite.prenom ?? "");
  const [email, setEmail] = useState(guest.invite.email ?? "");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(guest.invite.avatar_url);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [prenomError, setPrenomError] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setPrenom(guest.invite.prenom ?? "");
      setEmail(guest.invite.email ?? "");
      setAvatarUrl(guest.invite.avatar_url);
      setPrenomError(null);
      setSuggestions([]);
    }
  }, [open, guest.invite]);

  const handleAvatarFile = async (file: File | null) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Format image requis");
      return;
    }
    if (file.size > MAX_AVATAR_BYTES) {
      toast.error("Image trop lourde (max 5 Mo)");
      return;
    }
    setUploading(true);
    const ext = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
    const path = `avatars/${guest.event.id}/${guest.invite.id}-${Date.now()}.${ext}`;
    const { error: upErr } = await supabase.storage
      .from("event-photos")
      .upload(path, file, { upsert: true, contentType: file.type });
    if (upErr) {
      setUploading(false);
      toast.error("Échec de l'upload");
      return;
    }
    const { data: pub } = supabase.storage.from("event-photos").getPublicUrl(path);
    setAvatarUrl(pub.publicUrl);
    setUploading(false);
    if (fileRef.current) fileRef.current.value = "";
  };

  const handleSave = async () => {
    const parsed = profileSchema.safeParse({ prenom, email });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Champs invalides");
      return;
    }
    const norm = normalisePrenom(parsed.data.prenom);
    const currentNorm = normalisePrenom(guest.invite.prenom ?? "");
    setSaving(true);
    if (norm.toLocaleLowerCase() !== currentNorm.toLocaleLowerCase()) {
      const { data: clash } = await supabase
        .from("invites")
        .select("id")
        .eq("event_id", guest.event.id)
        .ilike("prenom", norm)
        .neq("id", guest.invite.id)
        .maybeSingle();
      if (clash) {
        const { data: rows } = await supabase
          .from("invites")
          .select("prenom")
          .eq("event_id", guest.event.id)
          .limit(200);
        const taken = (rows ?? []).map((r) => r.prenom).filter(Boolean) as string[];
        setSuggestions(generatePrenomSuggestions(norm, taken, 3));
        setPrenomError(`« ${norm} » est déjà pris dans cet événement.`);
        setSaving(false);
        return;
      }
    }
    const { data, error } = await supabase.rpc("update_own_invite", {
      _device_id: guest.invite.device_id,
      _event_id: guest.event.id,
      _avatar_url: avatarUrl ?? undefined,
      _email: parsed.data.email ? parsed.data.email : undefined,
      _prenom: norm,
    });
    setSaving(false);
    if (error || !data) {
      toast.error("Échec de l'enregistrement");
      return;
    }
    toast.success("Profil mis à jour");
    onUpdated({
      prenom: norm,
      email: parsed.data.email ? parsed.data.email : null,
      avatar_url: avatarUrl,
    });
    onOpenChange(false);
  };

  const initial = (prenom[0] ?? "?").toUpperCase();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Mon profil</DialogTitle>
          <DialogDescription>
            Modifiez vos informations affichées dans la galerie.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          <div className="flex items-center gap-4">
            <Avatar
              initials={initial}
              src={avatarUrl}
              size="lg"
              className="!h-16 !w-16 !text-base"
            />
            <div>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => void handleAvatarFile(e.target.files?.[0] ?? null)}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={uploading}
                onClick={() => fileRef.current?.click()}
              >
                {uploading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Envoi…
                  </>
                ) : (
                  <>
                    <Upload className="mr-2 h-4 w-4" />
                    Changer la photo
                  </>
                )}
              </Button>
              <p className="mt-1 text-xs text-muted-foreground">
                JPG / PNG, max 5 Mo
              </p>
            </div>
          </div>

          <div>
            <Label htmlFor="prenom" className="text-sm">Prénom</Label>
            <Input
              id="prenom"
              value={prenom}
              maxLength={80}
              onChange={(e) => {
                setPrenom(e.target.value);
                if (prenomError) setPrenomError(null);
                if (suggestions.length) setSuggestions([]);
              }}
              className="mt-1"
              style={prenomError ? { borderColor: "#FF4842", boxShadow: "0 0 0 1px #FF4842" } : undefined}
              name="given-name"
              autoComplete="given-name"
              autoCorrect="off"
              autoCapitalize="words"
              spellCheck={false}
            />
            {prenomError && (
              <p
                className="mt-1"
                style={{ color: "#FF4842", fontSize: 13, fontFamily: '"Public Sans", sans-serif' }}
              >
                {prenomError}
              </p>
            )}
            {suggestions.length > 0 && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 8 }}>
                {suggestions.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => {
                      setPrenom(s);
                      setPrenomError(null);
                      setSuggestions([]);
                    }}
                    style={{
                      padding: "6px 14px",
                      borderRadius: 100,
                      border: "none",
                      background: "#F4F6F8",
                      fontSize: 13,
                      fontWeight: 500,
                      color: "#212B36",
                      cursor: "pointer",
                      fontFamily: '"Public Sans", sans-serif',
                    }}
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div>
            <Label htmlFor="email" className="text-sm">Email (optionnel)</Label>
            <Input
              id="email"
              type="email"
              value={email}
              maxLength={255}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="vous@exemple.com"
              className="mt-1"
              name="email"
              autoComplete="email"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck={false}
              inputMode="email"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Annuler
          </Button>
          <Button onClick={handleSave} disabled={saving || uploading}>
            {saving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Enregistrement…
              </>
            ) : (
              "Enregistrer"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}