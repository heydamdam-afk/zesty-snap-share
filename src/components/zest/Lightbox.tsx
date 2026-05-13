import { useEffect } from "react";

type LightboxProps = {
  photos: { url_full: string | null }[];
  index: number | null;
  onClose: () => void;
  onPrev: () => void;
  onNext: () => void;
};

export default function Lightbox({ photos, index, onClose, onPrev, onNext }: LightboxProps) {
  useEffect(() => {
    if (index === null) return;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft") onPrev();
      if (e.key === "ArrowRight") onNext();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [index, onClose, onPrev, onNext]);

  if (index === null) return null;
  const photo = photos[index];
  if (!photo) return null;

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/95"
      role="dialog"
      aria-modal="true"
    >
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onClose();
        }}
        aria-label="Fermer"
        className="absolute right-4 top-4 grid h-10 w-10 place-items-center rounded-full bg-white/10 text-white text-xl hover:bg-white/20"
        style={{ top: "max(1rem, env(safe-area-inset-top))" }}
      >
        ✕
      </button>

      {index > 0 && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onPrev();
          }}
          aria-label="Précédente"
          className="absolute left-3 top-1/2 grid h-12 w-12 -translate-y-1/2 place-items-center rounded-full bg-white/10 text-white text-3xl hover:bg-white/20"
        >
          ‹
        </button>
      )}

      <img
        src={photo.url_full ?? ""}
        alt=""
        onClick={(e) => e.stopPropagation()}
        className="max-h-[90vh] max-w-[95vw] object-contain"
      />

      {index < photos.length - 1 && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onNext();
          }}
          aria-label="Suivante"
          className="absolute right-3 top-1/2 grid h-12 w-12 -translate-y-1/2 place-items-center rounded-full bg-white/10 text-white text-3xl hover:bg-white/20"
        >
          ›
        </button>
      )}

      <p
        className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full bg-white/10 px-3 py-1 text-xs text-white"
        style={{ bottom: "max(1rem, env(safe-area-inset-bottom))" }}
      >
        {index + 1} / {photos.length}
      </p>
    </div>
  );
}