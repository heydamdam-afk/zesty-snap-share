import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAdminContext } from "./AdminContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Image as ImageIcon, Loader2, Upload, Download } from "lucide-react";
import { QRCodeCanvas } from "qrcode.react";
import { z } from "zod";

const settingsSchema = z.object({
  titre: z.string().trim().min(1, "Titre requis").max(120, "Trop long"),
  lieu: z.string().trim().max(200, "Trop long").optional().or(z.literal("")),
  code_acces: z
    .string()
    .trim()
    .min(3, "Min. 3 caractères")
    .max(40, "Max. 40 caractères")
    .regex(/^[A-Za-z0-9_-]+$/, "Lettres, chiffres, - et _ uniquement"),
});

const MAX_COVER_BYTES = 5 * 1024 * 1024;
const ACCEPTED_COVER_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MIN_COVER_W = 800;
const MIN_COVER_H = 450;

export function EventSettingsSection() {
  const { event, reloadEvent } = useAdminContext();

  const [titre, setTitre] = useState(event.titre);
  const [lieu, setLieu] = useState(event.lieu ?? "");
  const [codeAcces, setCodeAcces] = useState(event.code_acces);
  const [commentairesActifs, setCommentairesActifs] = useState(
    event.commentaires_actifs,
  );
  const [likesActifs, setLikesActifs] = useState(event.likes_actifs);
  const [uploadsActifs, setUploadsActifs] = useState(event.uploads_actifs);

  const [saving, setSaving] = useState(false);
  const [uploadingCover, setUploadingCover] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const qrRef = useRef<HTMLDivElement>(null);

  const galleryUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/${event.slug}`
      : `/${event.slug}`;

  const handleDownloadQr = () => {
    const canvas = qrRef.current?.querySelector("canvas");
    if (!canvas) {
      toast.error("QR code indisponible");
      return;
    }
    const url = canvas.toDataURL("image/png");
    const a = document.createElement("a");
    a.href = url;
    a.download = `qr-${event.slug}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  useEffect(() => {
    setTitre(event.titre);
    setLieu(event.lieu ?? "");
    setCodeAcces(event.code_acces);
    setCommentairesActifs(event.commentaires_actifs);
    setLikesActifs(event.likes_actifs);
    setUploadsActifs(event.uploads_actifs);
  }, [event]);

  const dirty =
    titre !== event.titre ||
    (lieu ?? "") !== (event.lieu ?? "") ||
    codeAcces !== event.code_acces ||
    commentairesActifs !== event.commentaires_actifs ||
    likesActifs !== event.likes_actifs ||
    uploadsActifs !== event.uploads_actifs;

  const handleSave = async () => {
    const parsed = settingsSchema.safeParse({ titre, lieu, code_acces: codeAcces });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Champs invalides");
      return;
    }
    setSaving(true);
    const { error } = await supabase
      .from("events")
      .update({
        titre: parsed.data.titre,
        lieu: parsed.data.lieu ? parsed.data.lieu : null,
        code_acces: parsed.data.code_acces,
        commentaires_actifs: commentairesActifs,
        likes_actifs: likesActifs,
        uploads_actifs: uploadsActifs,
      })
      .eq("id", event.id);
    setSaving(false);
    if (error) {
      if (error.code === "23505") {
        toast.error("Ce code d'accès est déjà utilisé.");
      } else {
        toast.error("Échec de l'enregistrement");
      }
      return;
    }
    toast.success("Paramètres enregistrés");
    await reloadEvent();
  };

  const handleCoverChange = async (file: File | null) => {
    if (!file) return;
    if (!ACCEPTED_COVER_TYPES.includes(file.type.toLowerCase())) {
      toast.error("Format non supporté (JPG, PNG ou WebP uniquement)");
      return;
    }
    if (file.size > MAX_COVER_BYTES) {
      toast.error("Image trop lourde (max 5 Mo)");
      return;
    }
    // Vérifier les dimensions
    const url = URL.createObjectURL(file);
    try {
      await new Promise<void>((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
          if (img.naturalWidth < MIN_COVER_W || img.naturalHeight < MIN_COVER_H) {
            reject(new Error(`Image trop petite (min ${MIN_COVER_W}×${MIN_COVER_H} px)`));
          } else {
            resolve();
          }
        };
        img.onerror = () => reject(new Error("Image illisible"));
        img.src = url;
      });
    } catch (e) {
      URL.revokeObjectURL(url);
      toast.error(e instanceof Error ? e.message : "Image invalide");
      return;
    }
    URL.revokeObjectURL(url);
    setUploadingCover(true);
    const ext = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
    const path = `covers/${event.id}/${Date.now()}.${ext}`;
    const { error: upErr } = await supabase.storage
      .from("event-photos")
      .upload(path, file, { upsert: true, contentType: file.type });
    if (upErr) {
      setUploadingCover(false);
      toast.error("Échec de l'upload");
      return;
    }
    const { data: pub } = supabase.storage.from("event-photos").getPublicUrl(path);
    const { error: updErr } = await supabase
      .from("events")
      .update({ cover_url: pub.publicUrl })
      .eq("id", event.id);
    setUploadingCover(false);
    if (updErr) {
      toast.error("Photo uploadée mais maj échouée");
      return;
    }
    toast.success("Photo de couverture mise à jour");
    await reloadEvent();
    if (fileRef.current) fileRef.current.value = "";
  };

  return (
    <section className="rounded-2xl bg-card p-6 shadow-card">
      <header className="mb-5">
        <h2 className="font-display text-xl text-foreground">
          Paramètres de l'événement
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Informations affichées aux invités et options de la galerie.
        </p>
      </header>

      <div className="space-y-5">
        {/* Cover photo */}
        <div>
          <Label className="text-sm">Photo de couverture</Label>
          <div className="mt-2 flex items-center gap-4">
            <div className="relative h-20 w-32 overflow-hidden rounded-lg bg-muted">
              {event.cover_url ? (
                <img
                  src={event.cover_url}
                  alt="Couverture"
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="grid h-full w-full place-items-center text-muted-foreground">
                  <ImageIcon className="h-6 w-6" />
                </div>
              )}
            </div>
            <div>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) =>
                  void handleCoverChange(e.target.files?.[0] ?? null)
                }
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={uploadingCover}
                onClick={() => fileRef.current?.click()}
              >
                {uploadingCover ? (
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
                JPG / PNG / WebP — max 5 Mo — recommandé 1600×900 px (min 800×450 px)
              </p>
            </div>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="titre" className="text-sm">
              Titre
            </Label>
            <Input
              id="titre"
              value={titre}
              maxLength={120}
              onChange={(e) => setTitre(e.target.value)}
              className="mt-1"
            />
          </div>
          <div>
            <Label htmlFor="lieu" className="text-sm">
              Lieu
            </Label>
            <Input
              id="lieu"
              value={lieu}
              maxLength={200}
              onChange={(e) => setLieu(e.target.value)}
              placeholder="Optionnel"
              className="mt-1"
            />
          </div>
        </div>

        <div>
          <Label htmlFor="code_acces" className="text-sm">
            Code d'accès
          </Label>
          <Input
            id="code_acces"
            value={codeAcces}
            maxLength={40}
            onChange={(e) => setCodeAcces(e.target.value)}
            className="mt-1 font-mono"
          />
          <p className="mt-1 text-xs text-muted-foreground">
            Sert aussi de slug pour l'URL de la galerie.
          </p>
        </div>

        <div className="space-y-3 rounded-xl border border-border bg-secondary/40 p-4">
          <ToggleRow
            label="Uploads de photos"
            description="Les invités peuvent publier des photos."
            checked={uploadsActifs}
            onChange={setUploadsActifs}
          />
          <ToggleRow
            label="Commentaires"
            description="Les invités peuvent commenter les photos."
            checked={commentairesActifs}
            onChange={setCommentairesActifs}
          />
          <ToggleRow
            label="Likes"
            description="Les invités peuvent liker les photos."
            checked={likesActifs}
            onChange={setLikesActifs}
          />
        </div>

        <div className="rounded-xl border border-border bg-secondary/40 p-4">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            <div
              ref={qrRef}
              className="grid place-items-center rounded-lg bg-white p-3"
            >
              <QRCodeCanvas
                value={galleryUrl}
                size={1024}
                level="H"
                includeMargin={false}
                style={{ width: 128, height: 128 }}
              />
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-foreground">
                QR code de la galerie
              </p>
              <p className="mt-1 break-all text-xs text-muted-foreground">
                {galleryUrl}
              </p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="mt-3"
                onClick={handleDownloadQr}
              >
                <Download className="mr-2 h-4 w-4" />
                Télécharger le QR code
              </Button>
            </div>
          </div>
        </div>

        <div className="flex justify-end">
          <Button onClick={handleSave} disabled={!dirty || saving}>
            {saving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Enregistrement…
              </>
            ) : (
              "Enregistrer"
            )}
          </Button>
        </div>
      </div>
    </section>
  );
}

function ToggleRow({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div>
        <p className="text-sm font-medium text-foreground">{label}</p>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}