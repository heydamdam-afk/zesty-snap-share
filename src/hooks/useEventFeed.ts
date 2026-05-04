import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

export type FeedPost = Tables<"posts"> & {
  invites: Pick<Tables<"invites">, "id" | "prenom" | "avatar_url" | "device_id"> | null;
  liked_by_me: boolean;
  comments: (Tables<"commentaires"> & {
    invites: Pick<Tables<"invites">, "id" | "prenom"> | null;
  })[];
};

export function useEventFeed(eventId: string | null, inviteId: string | null) {
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    if (!eventId) return;
    const { data: postsData, error } = await supabase
      .from("posts")
      .select("*, invites(id, prenom, avatar_url, device_id)")
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
        .select("*, invites(id, prenom)")
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

    setPosts(
      (postsData ?? []).map((p) => ({
        ...(p as Tables<"posts"> & { invites: FeedPost["invites"] }),
        liked_by_me: myLikes.has(p.id),
        comments: comments.filter((c) => c.photo_id === p.id),
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