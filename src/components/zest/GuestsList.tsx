import type { FeedPost } from "@/hooks/useEventFeed";
import { Shield, UserX } from "lucide-react";
import { banInvite } from "@/lib/zest-admin";

const CONNECTED_WINDOW_MS = 5 * 60 * 1000;

function aggregate(posts: FeedPost[]) {
  const map = new Map<
    string,
    {
      author: string;
      initials: string;
      count: number;
      deviceId: string | null;
      lastActivity: number;
    }
  >();
  const bump = (
    author: string | undefined | null,
    deviceId: string | null,
    ts: string | null | undefined,
    incrementPhoto: boolean,
  ) => {
    const name = author ?? "Invité";
    const initials = (name[0] ?? "?").toUpperCase();
    const t = ts ? new Date(ts).getTime() : 0;
    const cur = map.get(name);
    if (cur) {
      if (incrementPhoto) cur.count += 1;
      if (t > cur.lastActivity) cur.lastActivity = t;
      if (!cur.deviceId && deviceId) cur.deviceId = deviceId;
    } else {
      map.set(name, {
        author: name,
        initials,
        count: incrementPhoto ? 1 : 0,
        deviceId,
        lastActivity: t,
      });
    }
  };
  for (const p of posts) {
    bump(p.invites?.prenom, p.invites?.device_id ?? null, p.created_at, true);
    for (const c of p.comments) {
      bump(
        c.invites?.prenom,
        c.invites?.device_id ?? null,
        c.created_at,
        false,
      );
    }
  }
  return Array.from(map.values()).sort((a, b) => b.count - a.count);
}

export function GuestsList({
  posts,
  eventId,
  isAdmin = false,
  currentDeviceId,
  onChanged,
}: {
  posts: FeedPost[];
  eventId?: string;
  isAdmin?: boolean;
  currentDeviceId?: string | null;
  onChanged?: () => void | Promise<void>;
}) {
  const list = aggregate(posts);
  const totalPhotos = posts.filter((p) => p.url_medium).length;
  const now = Date.now();

  const onBan = async (deviceId: string | null, name: string) => {
    if (!deviceId || !eventId) return;
    if (
      !window.confirm(
        `Supprimer ${name} ? Tous ses posts et commentaires seront supprimés.`,
      )
    )
      return;
    try {
      await banInvite(eventId, deviceId);
      await onChanged?.();
    } catch (e) {
      console.error(e);
      window.alert("Suppression impossible");
    }
  };

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
        {list.map((g) => {
          const isMe = !!currentDeviceId && g.deviceId === currentDeviceId;
          const isThisAdmin = isAdmin && isMe;
          const connected =
            g.lastActivity > 0 && now - g.lastActivity < CONNECTED_WINDOW_MS;
          return (
            <li
              key={g.author}
              className="relative flex items-center gap-2 rounded-2xl bg-card p-2 shadow-card"
            >
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-gradient-coral text-xs font-bold text-primary-foreground">
                {g.initials}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1">
                  <p className="truncate text-sm font-semibold text-foreground">
                    {g.author}
                  </p>
                  {isThisAdmin && (
                    <span className="inline-flex shrink-0 items-center gap-0.5 rounded-full bg-foreground/90 px-1.5 py-0.5 text-[9px] font-semibold uppercase text-background">
                      <Shield className="h-2.5 w-2.5" /> admin
                    </span>
                  )}
                </div>
                <p className="flex items-center gap-1 text-xs text-muted-foreground">
                  <span
                    aria-hidden
                    className={`inline-block h-2 w-2 rounded-full ${connected ? "bg-emerald-500" : "bg-muted-foreground/40"}`}
                  />
                  <span>{connected ? "Connecté" : "Déconnecté"}</span>
                  <span aria-hidden>·</span>
                  <span>
                    {g.count} photo{g.count > 1 ? "s" : ""}
                  </span>
                </p>
              </div>
              {isAdmin && !isMe && g.deviceId && (
                <button
                  type="button"
                  onClick={() => onBan(g.deviceId, g.author)}
                  title="Supprimer cet invité"
                  className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                >
                  <UserX className="h-4 w-4" />
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}