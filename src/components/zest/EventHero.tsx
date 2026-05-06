import defaultCover from "@/assets/event-cover.jpg";

function formatDate(iso?: string | null) {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleDateString("fr-FR", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  } catch {
    return "";
  }
}

export function EventHero({
  title,
  dateIso,
  coverUrl,
}: {
  title: string;
  dateIso?: string | null;
  coverUrl?: string | null;
}) {
  const date = formatDate(dateIso);
  const src = coverUrl && coverUrl.trim().length > 0 ? coverUrl : defaultCover;
  return (
    <div className="relative h-[220px] w-full overflow-hidden">
      <img
        src={src}
        alt={title}
        className="h-full w-full object-cover"
        onError={(e) => {
          // Fallback to default cover if the remote URL fails to load.
          const img = e.currentTarget;
          if (img.src !== defaultCover) img.src = defaultCover;
        }}
      />
      {/* Gradient bas */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(to bottom, transparent 40%, rgba(0,0,0,0.7) 100%)",
        }}
      />
      {/* Titre */}
      <div className="absolute inset-x-0 bottom-0 p-4">
        <h1 className="font-display text-[28px] font-bold leading-tight text-white">
          {title}
        </h1>
        {date && <p className="mt-1 text-sm text-white/80">📅 {date}</p>}
      </div>
    </div>
  );
}
