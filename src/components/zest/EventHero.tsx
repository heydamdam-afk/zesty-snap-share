import cover from "@/assets/event-cover.jpg";

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
}: {
  title: string;
  dateIso?: string | null;
}) {
  const date = formatDate(dateIso);
  return (
    <div className="relative h-[220px] w-full overflow-hidden">
      <img
        src={cover}
        alt={title}
        className="h-full w-full object-cover"
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