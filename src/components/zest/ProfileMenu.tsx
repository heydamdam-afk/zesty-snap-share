import type { GuestSession } from "@/lib/zest-session";
import { Avatar } from "./Avatar";
import { LogOut, Image as ImageIcon } from "lucide-react";
import { useState } from "react";

export function ProfileMenu({
  guest,
  onShowMyPhotos,
  onLeave,
}: {
  guest: GuestSession;
  onAvatarChange?: (url: string) => void;
  onShowMyPhotos?: () => void;
  onLeave?: () => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="absolute right-3 top-3 z-10">
      <button
        onClick={() => setOpen((v) => !v)}
        className="rounded-full ring-2 ring-card"
        aria-label="Profil"
      >
        <Avatar initials={guest.initial} />
      </button>
      {open && (
        <div className="absolute right-0 mt-2 w-48 overflow-hidden rounded-2xl bg-card shadow-card">
          <button
            onClick={() => {
              setOpen(false);
              onShowMyPhotos?.();
            }}
            className="flex w-full items-center gap-2 px-4 py-3 text-sm text-foreground hover:bg-secondary"
          >
            <ImageIcon className="h-4 w-4" />
            Mes photos
          </button>
          <button
            onClick={() => {
              setOpen(false);
              onLeave?.();
            }}
            className="flex w-full items-center gap-2 px-4 py-3 text-sm text-destructive hover:bg-secondary"
          >
            <LogOut className="h-4 w-4" />
            Quitter
          </button>
        </div>
      )}
    </div>
  );
}