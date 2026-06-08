import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

export type FeedPost = Tables<"posts"> & {
  invites: Pick<Tables<"invites">, "id" | "prenom" | "avatar_url" | "device_id" | "email"> | null;
  liked_by_me: boolean;
  photos: Pick<Tables<"post_photos">, "id" | "position" | "url_miniature" | "url_medium" | "url_full">[];
  comments: (Tables<"commentaires"> & {
    invites: Pick<Tables<"invites">, "id" | "prenom" | "avatar_url" | "device_id" | "email"> | null;
  })[];
};

type ProfileOverlay = {
  avatar_url: string | null;
  avatar_name: string | null;
  prenom: string | null;
};

/** Replace invite.avatar_url / invite.prenom with the profile values for any
 * invite whose email matches an authenticated user. profiles is the single
 * source of truth for authenticated users' display identity. */
function applyProfileOverlay<T extends { invites: { email?: string | null; avatar_url?: string | null; prenom?: string | null } | null }>(
  rows: T[],
  overlay: Map<string, ProfileOverlay>,
): T[] {
  return rows.map((r) => {
    const email = r.invites?.email?.toLowerCase();
    if (!email) return r;
    const p = overlay.get(email);
    if (!p) return r;
    return {
      ...r,
      invites: {
        ...r.invites!,
        avatar_url: p.avatar_url ?? r.invites!.avatar_url ?? null,
        prenom: p.avatar_name || p.prenom || r.invites!.prenom || null,
      },
    };
  });
}

export function useEventFeed(eventId: string | null, inviteId: string | null) {
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    if (!eventId) return;
    const { data: postsData, error } = await supabase
      .from("posts")
      .select("*, invites(id, prenom, avatar_url, device_id, email), post_photos(id, position, url_miniature, url_medium, url_full)")
      .eq("event_id", eventId)
      .order("created_at", { ascending: false });
    if (error) {
      console.error("[useEventFeed] load posts", error);
      setLoading(false);
      return;
    }

    const postIds = (postsData ?? []).map((p) => p.id);
    let comments: FeedPost["comments"] = [];
    let myLikes = new Set<string>();

    if (postIds.length > 0) {
      const { data: cData } = await supabase
        .from("commentaires")
        .select("*, invites(id, prenom, avatar_url, device_id, email)")
        .in("photo_id", postIds)
        .order("created_at", { ascending: true });
      comments = (cData ?? []) as FeedPost["comments"];

      if (inviteId) {
        const { data: lData } = await supabase
          .from("likes")
          .select("photo_id")
          .eq("invite_id", inviteId)
          .in("photo_id", postIds);
        myLikes = new Set((lData ?? []).map((l) => l.photo_id));
      }
    }

    // Build the overlay map from emails encountered in posts + comments.
    const emailSet = new Set<string>();
    for (const p of postsData ?? []) {
      const e = (p as { invites?: { email?: string | null } | null }).invites?.email;
      if (e) emailSet.add(e.toLowerCase());
    }
    for (const c of comments) {
      const e = c.invites?.email;
      if (e) emailSet.add(e.toLowerCase());
    }
    const overlay = new Map<string, ProfileOverlay>();
    if (emailSet.size > 0) {
      const { data: profs, error: pErr } = await supabase.rpc(
        "get_profiles_by_emails",
        { _emails: Array.from(emailSet) },
      );
      if (pErr) {
        console.error("[useEventFeed] profiles overlay failed", pErr);
      } else {
        for (const p of profs ?? []) {
          if (p.email) {
            overlay.set(p.email.toLowerCase(), {
              avatar_url: p.avatar_url ?? null,
              avatar_name: p.avatar_name ?? null,
              prenom: p.prenom ?? null,
            });
          }
        }
      }
    }

    const postsWithOverlay = applyProfileOverlay(
      (postsData ?? []) as unknown as Array<{ invites: FeedPost["invites"] } & Tables<"posts"> & { post_photos?: FeedPost["photos"] }>,
      overlay,
    );
    const commentsWithOverlay = applyProfileOverlay(comments, overlay);

    setPosts(
      postsWithOverlay.map((p) => ({
        ...(p as Tables<"posts"> & {
          invites: FeedPost["invites"];
          post_photos: FeedPost["photos"];
        }),
        photos: ((p as { post_photos?: FeedPost["photos"] }).post_photos ?? [])
          .slice()
          .sort((a, b) => a.position - b.position),
        liked_by_me: myLikes.has(p.id),
        comments: commentsWithOverlay.filter((c) => c.photo_id === p.id),
      })),
    );
    setLoading(false);
  }, [eventId, inviteId]);

  useEffect(() => {
    if (!eventId) return;
    setLoading(true);
    reload();

    const channel = supabase
      .channel(`event-${eventId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "posts", filter: `event_id=eq.${eventId}` },
        () => reload(),
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "commentaires" },
        (payload) => {
          const c = payload.new as Tables<"commentaires">;
          setPosts((prev) =>
            prev.map((p) =>
              p.id === c.photo_id
                ? { ...p, comments: [...p.comments, { ...c, invites: null }] }
                : p,
            ),
          );
        },
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "commentaires" },
        (payload) => {
          const c = payload.old as Tables<"commentaires">;
          setPosts((prev) =>
            prev.map((p) =>
              p.id === c.photo_id
                ? { ...p, comments: p.comments.filter((x) => x.id !== c.id) }
                : p,
            ),
          );
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "likes" },
        (payload) => {
          const photoId =
            (payload.new as Tables<"likes">)?.photo_id ??
            (payload.old as Tables<"likes">)?.photo_id;
          if (!photoId) return;
          setPosts((prev) =>
            prev.map((p) => {
              if (p.id !== photoId) return p;
              const delta = payload.eventType === "INSERT" ? 1 : -1;
              return { ...p, nb_likes: Math.max(0, p.nb_likes + delta) };
            }),
          );
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [eventId, reload]);

  return { posts, loading, reload };
}