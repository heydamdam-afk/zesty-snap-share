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
  const [prenom, setPrenom] = useState(guest.invite.prenom);
  const [email, setEmail] = useState(guest.invite.email ?? "");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(guest.invite.avatar_url);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setPrenom(guest.invite.prenom);
      setEmail(guest.invite.email ?? "");
      setAvatarUrl(guest.invite.avatar_url);
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
    setSaving(true);
    const { data, error } = await supabase.rpc("update_own_invite", {
      _device_id: guest.invite.device_id,
      _event_id: guest.event.id,
      _avatar_url: avatarUrl ?? undefined,
      _email: parsed.data.email ? parsed.data.email : undefined,
      _prenom: parsed.data.prenom,
    });
    setSaving(false);
    if (error || !data) {
      toast.error("Échec de l'enregistrement");
      return;
    }
    toast.success("Profil mis à jour");
    onUpdated({
      prenom: parsed.data.prenom,
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
            <div className="relative h-16 w-16 overflow-hidden rounded-full bg-muted">
              {avatarUrl ? (
                <img
                  src={avatarUrl}
                  alt="Avatar"
                  className="h-full w-full object-cover"
                />
              ) : (
                <Avatar initials={initial} size="lg" className="!h-16 !w-16 !text-base" />
              )}
            </div>
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
              onChange={(e) => setPrenom(e.target.value)}
              className="mt-1"
            />
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