import { photos } from "@/data/mock-event";

function aggregate() {
  const map = new Map<
    string,
    { author: string; initials: string; count: number }
  >();
  for (const p of photos) {
    const key = p.author;
    const cur = map.get(key);
    if (cur) cur.count += 1;
    else map.set(key, { author: p.author, initials: p.initials, count: 1 });
  }
  return Array.from(map.values()).sort((a, b) => b.count - a.count);
}

export function GuestsList() {
  const list = aggregate();
  const totalPhotos = photos.length;
  return (
    <div className="px-3 pt-4">
      <p className="px-1 pb-3 text-center text-base font-bold text-foreground">
        {list.length} invités connectés · {totalPhotos} photos partagées
      </p>
      <ul className="grid grid-cols-2 gap-3">
        {list.map((g) => (
          <li
            key={g.author}
            className="flex items-center gap-2 rounded-2xl bg-card p-2 shadow-card"
          >
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-gradient-coral text-xs font-bold text-primary-foreground">
              {g.initials}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-foreground">
                {g.author}
              </p>
              <p className="text-xs text-muted-foreground">
                {g.count} photo{g.count > 1 ? "s" : ""}
              </p>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}