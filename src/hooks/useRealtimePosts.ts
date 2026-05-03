import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

export type PostRow = Tables<"posts"> & {
  post_photos: Tables<"post_photos">[];
};

/**
 * Subscribes to INSERTs on `posts` and `post_photos` for the given event.
 * Returns the live list of posts (newest first), with photos joined client-side.
 */
export function useRealtimePosts(eventId: string) {
  const [posts, setPosts] = useState<PostRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      const { data, error } = await supabase
        .from("posts")
        .select("*, post_photos(*)")
        .eq("event_id", eventId)
        .order("created_at", { ascending: false });

      if (!mounted) return;
      if (error) {
        console.error("[useRealtimePosts] load failed", error);
      } else {
        setPosts((data ?? []) as PostRow[]);
      }
      setLoading(false);
    };
    load();

    const channel = supabase
      .channel(`event-posts-${eventId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "posts",
          filter: `event_id=eq.${eventId}`,
        },
        (payload) => {
          const newPost = payload.new as Tables<"posts">;
          setPosts((prev) => {
            if (prev.some((p) => p.id === newPost.id)) return prev;
            return [{ ...newPost, post_photos: [] }, ...prev];
          });
        },
      )
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "post_photos",
          filter: `event_id=eq.${eventId}`,
        },
        (payload) => {
          const photo = payload.new as Tables<"post_photos">;
          setPosts((prev) =>
            prev.map((p) =>
              p.id === photo.post_id
                ? { ...p, post_photos: [...p.post_photos, photo] }
                : p,
            ),
          );
        },
      )
      .subscribe();

    return () => {
      mounted = false;
      supabase.removeChannel(channel);
    };
  }, [eventId]);

  return { posts, loading };
}