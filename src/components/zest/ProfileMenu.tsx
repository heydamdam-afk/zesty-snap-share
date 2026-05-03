import { useRef, useState } from "react";
import { Drawer, DrawerContent, DrawerTrigger } from "@/components/ui/drawer";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Camera, Images, Trash2 } from "lucide-react";
import { clearGuest, type GuestSession } from "./AccessGate";

type Props = {
  guest: GuestSession;
  onAvatarChange: (dataUrl: string) => void;
  onShowMyPhotos: () => void;
  onLeave: () => void;
};

export function ProfileMenu({
  guest,
  onAvatarChange,
  onShowMyPhotos,
  onLeave,
}: Props) {
  const [open, setOpen] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = (file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) return;
    if (file.size > 5 * 1024 * 1024) return;
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      try {
        localStorage.setItem("zeste_avatar_url", dataUrl);
      } catch {}
      onAvatarChange(dataUrl);
    };
    reader.readAsDataURL(file);
  };

  const handleDelete = () => {
    clearGuest();
    setConfirm(false);
    setOpen(false);
    onLeave();
  };

  return (
    <>
      <Drawer open={open} onOpenChange={setOpen}>
        <DrawerTrigger asChild>
          <button
            type="button"
            aria-label="Profil"
            className="absolute right-3 top-3 z-20 h-10 w-10 overflow-hidden rounded-full ring-2 ring-white/80 shadow-lg"
            style={{
              backgroundColor: guest.avatarUrl ? "transparent" : guest.avatarColor,
            }}
          >
            {guest.avatarUrl ? (
              <img
                src={guest.avatarUrl}
                alt={guest.prenom}
                className="h-full w-full object-cover"
              />
            ) : (
              <span className="flex h-full w-full items-center justify-center font-display text-base font-bold text-white">
                {guest.initial}
              </span>
            )}
          </button>
        </DrawerTrigger>
        <DrawerContent className="px-4 pb-6">
          <div className="mx-auto w-full max-w-md">
            <div className="flex flex-col items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="group relative h-20 w-20 overflow-hidden rounded-full ring-2 ring-card"
                style={{
                  backgroundColor: guest.avatarUrl
                    ? "transparent"
                    : guest.avatarColor,
                }}
              >
                {guest.avatarUrl ? (
                  <img
                    src={guest.avatarUrl}
                    alt={guest.prenom}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <span className="flex h-full w-full items-center justify-center font-display text-2xl font-bold text-white">
                    {guest.initial}
                  </span>
                )}
                <span className="absolute inset-x-0 bottom-0 flex items-center justify-center bg-black/50 py-1 text-[10px] font-medium text-white opacity-0 transition group-hover:opacity-100">
                  <Camera className="mr-1 h-3 w-3" /> Changer
                </span>
              </button>
              <input
                ref={fileRef}
                type="file"
                accept="image/jpeg,image/png,image/heic,image/webp"
                className="hidden"
                onChange={(e) => handleFile(e.target.files?.[0])}
              />
              <h2 className="font-display text-xl font-bold text-foreground">
                Bonjour, {guest.prenom} 👋
              </h2>
            </div>

            <div className="mt-6 space-y-2">
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="flex w-full items-center gap-3 rounded-2xl bg-card px-4 py-3 text-left shadow-card"
              >
                <Camera className="h-5 w-5 text-primary" />
                <span className="text-sm font-medium text-foreground">
                  Modifier mon avatar
                </span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  onShowMyPhotos();
                }}
                className="flex w-full items-center gap-3 rounded-2xl bg-card px-4 py-3 text-left shadow-card"
              >
                <Images className="h-5 w-5 text-primary" />
                <span className="text-sm font-medium text-foreground">
                  Mes photos
                </span>
              </button>
              <button
                type="button"
                onClick={() => setConfirm(true)}
                className="flex w-full items-center gap-3 rounded-2xl bg-card px-4 py-3 text-left shadow-card"
              >
                <Trash2 className="h-5 w-5 text-destructive" />
                <span className="text-sm font-medium text-destructive">
                  Supprimer ma participation
                </span>
              </button>
            </div>
          </div>
        </DrawerContent>
      </Drawer>

      <AlertDialog open={confirm} onOpenChange={setConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer votre participation ?</AlertDialogTitle>
            <AlertDialogDescription>
              Vos photos, likes et commentaires seront retirés de la galerie.
              Cette action est irréversible.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}