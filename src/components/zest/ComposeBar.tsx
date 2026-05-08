import { useEffect, useRef, useState } from "react";
import { Avatar } from "./Avatar";
import { ImagePlus, Send, X, Pencil } from "lucide-react";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerClose,
} from "@/components/ui/drawer";
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

  // Bloque le scroll de la page derrière quand le drawer est ouvert (mobile).
  useEffect(() => {
    if (!open) return;
    const { body } = document;
    const scrollY = window.scrollY;
    const prev = {
      overflow: body.style.overflow,
      position: body.style.position,
      top: body.style.top,
      width: body.style.width,
    };
    body.style.overflow = "hidden";
    body.style.position = "fixed";
    body.style.top = `-${scrollY}px`;
    body.style.width = "100%";
    return () => {
      body.style.overflow = prev.overflow;
      body.style.position = prev.position;
      body.style.top = prev.top;
      body.style.width = prev.width;
      window.scrollTo(0, scrollY);
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

      <Drawer open={open} onOpenChange={setOpen} shouldScaleBackground={false}>
        <DrawerContent className="h-[75vh] max-h-[75vh] overflow-y-auto overscroll-contain rounded-t-2xl px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
          <DrawerHeader className="px-0 pt-2">
            <div className="flex items-center justify-between">
              <DrawerTitle>Nouveau message</DrawerTitle>
              <DrawerClose className="grid h-8 w-8 place-items-center rounded-full text-muted-foreground hover:bg-secondary">
                <X className="h-4 w-4" />
              </DrawerClose>
            </div>
          </DrawerHeader>

          <div className="flex items-start gap-3">
            <Avatar initials={guest.initial} src={guest.invite.avatar_url} />
            <Textarea
              autoFocus
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={`Quoi de neuf, ${guest.invite.prenom} ?`}
              className="min-h-[120px] resize-none border-0 bg-transparent px-0 text-base shadow-none focus-visible:ring-0"
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

          <div className="mt-4 flex items-center justify-between gap-2">
            <button
              onClick={() => inputRef.current?.click()}
              className="inline-flex items-center gap-2 rounded-full bg-secondary px-4 py-2 text-sm font-medium text-foreground hover:bg-secondary/80"
            >
              <ImagePlus className="h-4 w-4" />
              Ajouter des photos
            </button>
            <button
              onClick={submit}
              disabled={busy || (!text.trim() && files.length === 0)}
              className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground shadow-soft disabled:opacity-40"
            >
              <Send className="h-4 w-4" />
              {busy ? "Publication…" : "Publier"}
            </button>
          </div>
        </DrawerContent>
      </Drawer>
    </>
  );
}