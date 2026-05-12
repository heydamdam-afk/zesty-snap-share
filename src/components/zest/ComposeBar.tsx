import { useEffect, useState, type ChangeEvent } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Avatar } from "./Avatar";
import { ImagePlus, X, Pencil } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { createPost, MAX_PHOTOS_PER_POST } from "@/lib/zest-actions";
import type { GuestSession } from "@/lib/zest-session";
import { toast } from "sonner";
import { reportImageError } from "@/lib/image-diagnostics";

export function ComposeBar({ guest, onPosted }: { guest: GuestSession; onPosted?: () => void }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const photoLimitReached = files.length >= MAX_PHOTOS_PER_POST;

  // Bloque le scroll body derrière la modale plein écran + ferme avec Échap.
  useEffect(() => {
    if (!open) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  // Previews : créées UNE SEULE FOIS par changement de `files`, révoquées au cleanup.
  // Évite la fuite mémoire et le clignotement des miniatures sur mobile.
  const [previews, setPreviews] = useState<{ name: string; url: string }[]>([]);
  useEffect(() => {
    const urls = files.map((f) => ({
      name: f.name,
      url: URL.createObjectURL(f),
    }));
    setPreviews(urls);
    return () => urls.forEach((u) => URL.revokeObjectURL(u.url));
  }, [files]);

  const reset = () => {
    setText("");
    setFiles([]);
  };

  const onPickPhotos = (e: ChangeEvent<HTMLInputElement>) => {
    console.log("[compose] files selected", e.target.files);
    const list = e.target.files;
    if (list) {
      toast(`${list.length} photo(s) sélectionnée(s)`);
    }
    if (list && list.length > 0) {
      setFiles((cur) => {
        const next = [...cur, ...Array.from(list)];
        if (next.length > MAX_PHOTOS_PER_POST) {
          toast.warning(`Maximum ${MAX_PHOTOS_PER_POST} photos par publication`);
          return next.slice(0, MAX_PHOTOS_PER_POST);
        }
        return next;
      });
    }
    e.target.value = "";
  };

  const submit = async () => {
    if (!guest?.invite?.id || !guest?.event?.id) {
      toast.error("Session expirée — recharge la page");
      return;
    }
    if ((!text.trim() && files.length === 0) || busy) return;
    setBusy(true);
    try {
      console.log("[compose] submit start", {
        text,
        fileCount: files.length,
        files: files.map((f) => ({ name: f.name, type: f.type, size: f.size })),
        eventId: guest.event.id,
        inviteId: guest.invite.id,
      });
      const res = await createPost({
        eventId: guest.event.id,
        inviteId: guest.invite.id,
        contenuTexte: text,
        files,
        onProgress: (p) => console.log("[compose] upload progress", p),
      });
      // createPost returns either a post row (no files) or a batch result.
      if (res && typeof res === "object" && "errors" in res) {
        const r = res as { ok: number; errors: { file: string; error: string }[] };
        if (r.errors.length > 0 && r.ok > 0) {
          toast.warning(`Post publié — ${r.ok}/${files.length} photo(s) envoyée(s)`, {
            description: r.errors.map((e) => `• ${e.file} — ${e.error}`).join("\n"),
            duration: 10000,
          });
        } else if (r.errors.length === 0) {
          toast.success("Post publié");
        }
      } else {
        toast.success("Post publié");
      }
      reset();
      await onPosted?.();
      setOpen(false);
    } catch (e) {
      console.error("[compose] publish failed", e);
      toast.error("Publication impossible", {
        description: e instanceof Error ? e.message : JSON.stringify(e),
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex w-full items-center gap-3 rounded-full bg-card p-2 pl-2 pr-3 text-left shadow-card transition hover:bg-card/80"
      >
        <Avatar initials={guest.initial} src={guest.invite.avatar_url} />
        <span className="flex-1 text-sm text-muted-foreground">Écrire un message</span>
        <span className="grid h-10 w-10 place-items-center rounded-full bg-gradient-coral text-primary-foreground shadow-soft">
          <Pencil className="h-4 w-4" />
        </span>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 16 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-50 flex flex-col bg-white"
            role="dialog"
            aria-modal="true"
          >
            {/* Header fixe : ✕ + titre + Publier */}
            <header
              className="flex items-center justify-between gap-2 border-b border-border bg-white px-4 py-3"
              style={{ paddingTop: "max(0.75rem, env(safe-area-inset-top))" }}
            >
              <button
                onClick={() => setOpen(false)}
                className="grid h-9 w-9 place-items-center rounded-full text-muted-foreground hover:bg-secondary"
                aria-label="Fermer"
              >
                <X className="h-5 w-5" />
              </button>
              <h2 className="text-base font-semibold">Nouvelle publication</h2>
              <button
                onClick={submit}
                disabled={busy || (!text.trim() && files.length === 0)}
                className="inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-semibold text-white shadow-soft disabled:opacity-40"
                style={{ backgroundColor: "#FF4842" }}
              >
                {busy ? "…" : "Publier"}
              </button>
            </header>

            {/* Bloc identité */}
            <div className="flex items-center gap-3 border-b border-border px-4 py-3">
              <Avatar initials={guest.initial} src={guest.invite.avatar_url} size="lg" />
              <span className="text-base font-semibold text-foreground">{guest.invite.prenom}</span>
            </div>

            {/* Bloc photos */}
            <div className="border-b border-border px-4 py-3">
              <label
                aria-disabled={photoLimitReached}
                className={`inline-flex w-full items-center justify-center gap-2 rounded-full bg-secondary px-4 py-3 text-sm font-medium text-foreground ${
                  photoLimitReached
                    ? "cursor-not-allowed opacity-40"
                    : "cursor-pointer hover:bg-secondary/80"
                }`}
              >
                <ImagePlus className="h-4 w-4" />
                Ajouter des photos ({files.length}/{MAX_PHOTOS_PER_POST})
                <input
                  type="file"
                  accept="image/jpeg,image/jpg,image/png,image/webp,image/heic,image/heif"
                  multiple
                  className="hidden"
                  disabled={photoLimitReached}
                  onChange={onPickPhotos}
                />
              </label>

              {previews.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {previews.map((p, i) => (
                    <div
                      key={`${p.name}-${i}`}
                      className="relative h-20 w-20 overflow-hidden rounded-lg bg-muted"
                    >
                      <img
                        src={p.url}
                        alt={p.name}
                        className="h-full w-full object-cover"
                        onError={(e) => {
                          const el = e.currentTarget;
                          void reportImageError(el.src, `preview ${p.name}`);
                        }}
                      />
                      <button
                        type="button"
                        onClick={() => setFiles((list) => list.filter((_, idx) => idx !== i))}
                        className="absolute right-1 top-1 grid h-5 w-5 place-items-center rounded-full bg-black/70 text-white"
                        aria-label="Supprimer la photo"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Textarea : remplit l'espace restant */}
            <div className="flex-1 overflow-y-auto px-4 py-3">
              <Textarea
                autoFocus
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Quoi de neuf ?"
                className="h-full min-h-[200px] w-full resize-none border-0 bg-transparent p-0 text-base shadow-none focus-visible:ring-0"
                name="post-content"
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="sentences"
                spellCheck={false}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
