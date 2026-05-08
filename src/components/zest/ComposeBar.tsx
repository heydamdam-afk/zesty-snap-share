import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Avatar } from "./Avatar";
import { ImagePlus, Send, X, Pencil } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { createPost, MAX_PHOTOS_PER_POST } from "@/lib/zest-actions";
import type { GuestSession } from "@/lib/zest-session";
import { toast } from "sonner";

export function ComposeBar({
  guest,
  onPosted,
}: {
  guest: GuestSession;
  onPosted?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

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

  const previews = files.map((f) => ({ name: f.name, url: URL.createObjectURL(f) }));

  const reset = () => {
    setText("");
    setFiles([]);
  };

  const submit = async () => {
    if ((!text.trim() && files.length === 0) || busy) return;
    setBusy(true);
    try {
      const res = await createPost({
        eventId: guest.event.id,
        inviteId: guest.invite.id,
        contenuTexte: text,
        files,
      });
      // createPost returns either a post row (no files) or a batch result.
      if (res && typeof res === "object" && "errors" in res) {
        const r = res as { ok: number; errors: { file: string; error: string }[] };
        if (r.errors.length > 0 && r.ok > 0) {
          toast.warning(`Post publié — ${r.ok}/${files.length} photo(s) envoyée(s)`, {
            description:
              r.errors.map((e) => `• ${e.file} — ${e.error}`).join("\n"),
            duration: 10000,
          });
        } else if (r.errors.length === 0) {
          toast.success("Post publié");
        }
      } else {
        toast.success("Post publié");
      }
      reset();
      setOpen(false);
      onPosted?.();
    } catch (e) {
      console.error(e);
      toast.error("Publication impossible, réessayez.", {
        description: e instanceof Error ? e.message : undefined,
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
            className="fixed inset-0 z-50 flex flex-col bg-background"
            role="dialog"
            aria-modal="true"
          >
            {/* Header sticky : fermer + titre + Publier */}
            <header className="flex items-center justify-between gap-2 border-b border-border px-4 py-3">
              <button
                onClick={() => setOpen(false)}
                className="grid h-9 w-9 place-items-center rounded-full text-muted-foreground hover:bg-secondary"
                aria-label="Fermer"
              >
                <X className="h-5 w-5" />
              </button>
              <h2 className="text-base font-semibold">Nouveau message</h2>
              <button
                onClick={submit}
                disabled={busy || (!text.trim() && files.length === 0)}
                className="inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-soft disabled:opacity-40"
              >
                <Send className="h-4 w-4" />
                {busy ? "…" : "Publier"}
              </button>
            </header>

            {/* Zone scrollable : avatar + textarea + previews */}
            <div className="flex-1 overflow-y-auto px-4 py-4">
              <div className="flex items-start gap-3">
                <Avatar initials={guest.initial} src={guest.invite.avatar_url} />
                <Textarea
                  autoFocus
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder={`Quoi de neuf, ${guest.invite.prenom} ?`}
                  className="min-h-[160px] resize-none border-0 bg-transparent px-0 text-base shadow-none focus-visible:ring-0"
                />
              </div>

              {previews.length > 0 && (
                <div className="mt-3 grid grid-cols-3 gap-2">
                  {previews.map((p, i) => (
                    <div key={p.url} className="relative aspect-square overflow-hidden rounded-xl bg-muted">
                      <img src={p.url} alt={p.name} className="h-full w-full object-cover" />
                      <button
                        onClick={() => setFiles((list) => list.filter((_, idx) => idx !== i))}
                        className="absolute right-1 top-1 grid h-6 w-6 place-items-center rounded-full bg-background/90"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <input
              ref={inputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              multiple
              className="hidden"
              onChange={(e) => {
                if (e.target.files) {
                  setFiles((list) => {
                    const next = [...list, ...Array.from(e.target.files!)];
                    if (next.length > MAX_PHOTOS_PER_POST) {
                      toast.warning(`Maximum ${MAX_PHOTOS_PER_POST} photos par publication`);
                      return next.slice(0, MAX_PHOTOS_PER_POST);
                    }
                    return next;
                  });
                  e.target.value = "";
                }
              }}
            />

            {/* Footer sticky : ajouter des photos */}
            <footer
              className="border-t border-border bg-background px-4 py-3"
              style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}
            >
              <button
                onClick={() => inputRef.current?.click()}
                className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-secondary px-4 py-3 text-sm font-medium text-foreground hover:bg-secondary/80"
              >
                <ImagePlus className="h-4 w-4" />
                Ajouter des photos
              </button>
            </footer>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}