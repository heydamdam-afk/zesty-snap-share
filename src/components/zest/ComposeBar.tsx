import { useRef, useState } from "react";
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

export function ComposeBar({ onUpload }: { onUpload?: () => void }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  const previews = files.map((f) => ({ name: f.name, url: URL.createObjectURL(f) }));

  const reset = () => {
    setText("");
    setFiles([]);
  };

  const submit = () => {
    if (!text.trim() && files.length === 0) return;
    console.log("post", { text, files });
    onUpload?.();
    reset();
    setOpen(false);
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex w-full items-center gap-3 rounded-full bg-card p-2 pl-2 pr-3 text-left shadow-card transition hover:bg-card/80"
      >
        <Avatar initials="ML" />
        <span className="flex-1 text-sm text-muted-foreground">Écrire un message</span>
        <span className="grid h-10 w-10 place-items-center rounded-full bg-gradient-coral text-primary-foreground shadow-soft">
          <Pencil className="h-4 w-4" />
        </span>
      </button>

      <Drawer open={open} onOpenChange={setOpen}>
        <DrawerContent className="px-4 pb-6">
          <DrawerHeader className="px-0 pt-2">
            <div className="flex items-center justify-between">
              <DrawerTitle>Nouveau message</DrawerTitle>
              <DrawerClose className="grid h-8 w-8 place-items-center rounded-full text-muted-foreground hover:bg-secondary">
                <X className="h-4 w-4" />
              </DrawerClose>
            </div>
          </DrawerHeader>

          <div className="flex items-start gap-3">
            <Avatar initials="ML" />
            <Textarea
              autoFocus
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Quoi de neuf, Michelle ?"
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
                    aria-label="Retirer"
                    className="absolute right-1 top-1 grid h-6 w-6 place-items-center rounded-full bg-background/90 text-foreground shadow"
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
            accept="image/jpeg,image/png,image/heic,image/webp"
            multiple
            className="hidden"
            onChange={(e) => {
              if (e.target.files) {
                setFiles((list) => [...list, ...Array.from(e.target.files!)]);
                e.target.value = "";
              }
            }}
          />

          <div className="mt-4 flex items-center justify-between gap-2">
            <button
              onClick={() => inputRef.current?.click()}
              className="inline-flex items-center gap-2 rounded-full bg-secondary px-4 py-2 text-sm font-medium text-foreground transition hover:bg-secondary/80"
            >
              <ImagePlus className="h-4 w-4" />
              Ajouter des photos
            </button>
            <button
              onClick={submit}
              disabled={!text.trim() && files.length === 0}
              className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground shadow-soft transition hover:scale-[1.02] disabled:opacity-40 disabled:hover:scale-100"
            >
              <Send className="h-4 w-4" />
              Publier
            </button>
          </div>
        </DrawerContent>
      </Drawer>
    </>
  );
}