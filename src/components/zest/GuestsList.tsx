import type { FeedPost } from "@/hooks/useEventFeed";

function aggregate(posts: FeedPost[]) {
  const map = new Map<string, { author: string; initials: string; count: number }>();
  for (const p of posts) {
    const author = p.invites?.prenom ?? "Invité";
    const initials = (author[0] ?? "?").toUpperCase();
    const cur = map.get(author);
    if (cur) cur.count += 1;
    else map.set(author, { author, initials, count: 1 });
  }
  return Array.from(map.values()).sort((a, b) => b.count - a.count);
}

export function GuestsList({ posts }: { posts: FeedPost[] }) {
  const list = aggregate(posts);
  const totalPhotos = posts.filter((p) => p.url_medium).length;
  return (
    <div className="px-3 pt-4">
      <p className="px-1 pb-3 text-center text-base font-bold text-foreground">
        {list.length} invités connectés · {totalPhotos} photos partagées
      </p>
      {list.length === 0 && (
        <p className="px-6 py-8 text-center text-sm text-muted-foreground">
          Aucun invité actif pour le moment.
        </p>
      )}
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