import { event } from "@/data/mock-event";

export function EventHero() {
  return (
    <div className="relative h-[220px] w-full overflow-hidden">
      <img
        src={event.cover}
        alt={event.title}
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
          {event.title}
        </h1>
        <p className="mt-1 text-sm text-white/80">📅 {event.date}</p>
      </div>
    </div>
  );
}