import { Avatar } from "./Avatar";
import { ImagePlus } from "lucide-react";

export function ComposeBar({ onUpload }: { onUpload: () => void }) {
  return (
    <div className="flex items-center gap-3 rounded-full bg-card p-2 pl-2 pr-3 shadow-card">
      <Avatar initials="ML" />
      <button
        onClick={onUpload}
        className="flex-1 text-left text-sm text-muted-foreground transition hover:text-foreground"
      >
        Quoi de neuf, Michelle ?
      </button>
      <button
        onClick={onUpload}
        className="grid h-10 w-10 place-items-center rounded-full bg-gradient-coral text-primary-foreground shadow-soft transition hover:scale-105"
      >
        <ImagePlus className="h-4 w-4" />
      </button>
    </div>
  );
}