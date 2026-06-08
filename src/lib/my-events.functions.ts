import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type MyEventOverview = {
  id: string;
  slug: string;
  titre: string;
  lieu: string | null;
  cover_url: string | null;
  event_date: string | null;
  status: "active" | "expired" | "archived" | "frozen";
  frozen_at: string | null;
  expire_at: string | null;
  zip_download_url: string | null;
  plan_code: string | null;
  role: "organisateur" | "secondaire" | "invite";
  photo_count: number;
  max_photos: number;
  likes_count: number;
  comments_count: number;
  invites_count: number;
};

export const getMyEventsOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<MyEventOverview[]> => {
    const claims = context.claims as { email?: string };
    const email = (claims.email ?? "").toLowerCase().trim();
    if (!email) return [];

    const { supabaseAdmin } = await import(
      "@/integrations/supabase/client.server"
    );

    // 1. Admin rows
    const { data: adminRows } = await supabaseAdmin
      .from("event_admins")
      .select("event_id, role")
      .ilike("email", email);

    // 2. Invited rows (event_ids where user has an invite by email)
    const { data: inviteRows } = await supabaseAdmin
      .from("invites")
      .select("event_id")
      .ilike("email", email);

    const roleByEventId = new Map<string, "organisateur" | "secondaire" | "invite">();
    for (const r of adminRows ?? []) {
      roleByEventId.set(r.event_id as string, r.role as "organisateur" | "secondaire");
    }
    for (const r of inviteRows ?? []) {
      if (!roleByEventId.has(r.event_id as string)) {
        roleByEventId.set(r.event_id as string, "invite");
      }
    }

    const eventIds = Array.from(roleByEventId.keys());
    if (eventIds.length === 0) return [];

    // 3. Events details (exclude archived)
    const { data: events } = await supabaseAdmin
      .from("events")
      .select(
        "id, slug, titre, lieu, cover_url, event_date, status, frozen_at, expire_at, zip_download_url, plan_code",
      )
      .in("id", eventIds)
      .neq("status", "archived");

    const eventsList = events ?? [];
    const activeIds = eventsList.map((e) => e.id as string);
    if (activeIds.length === 0) return [];

    // 4. Plans (for max_photos)
    const planCodes = Array.from(
      new Set(
        eventsList
          .map((e) => e.plan_code as string | null)
          .filter((c): c is string => !!c),
      ),
    );
    const { data: plans } = planCodes.length
      ? await supabaseAdmin
          .from("event_plans")
          .select("code, max_photos")
          .in("code", planCodes)
      : { data: [] as Array<{ code: string; max_photos: number }> };
    const maxByPlan = new Map<string, number>(
      (plans ?? []).map((p) => [p.code as string, (p.max_photos as number) ?? 0]),
    );

    // 5. Addon counts per event
    const { data: addons } = await supabaseAdmin
      .from("addon_purchases")
      .select("event_id, addon_type")
      .in("event_id", activeIds);
    const addonCount = new Map<string, number>();
    for (const a of addons ?? []) {
      if ((a.addon_type as string) === "addon_images") {
        addonCount.set(
          a.event_id as string,
          (addonCount.get(a.event_id as string) ?? 0) + 1,
        );
      }
    }

    // 6. Posts (for photo count & likes sum)
    const { data: posts } = await supabaseAdmin
      .from("posts")
      .select("id, event_id, url_full, nb_likes")
      .in("event_id", activeIds);
    const photoCount = new Map<string, number>();
    const likesCount = new Map<string, number>();
    const postIdsByEvent = new Map<string, string[]>();
    for (const p of posts ?? []) {
      const eid = p.event_id as string;
      if (p.url_full) photoCount.set(eid, (photoCount.get(eid) ?? 0) + 1);
      likesCount.set(eid, (likesCount.get(eid) ?? 0) + ((p.nb_likes as number) ?? 0));
      const arr = postIdsByEvent.get(eid) ?? [];
      arr.push(p.id as string);
      postIdsByEvent.set(eid, arr);
    }

    // 7. Comments count via posts mapping
    const allPostIds = Array.from(postIdsByEvent.values()).flat();
    const commentsByEvent = new Map<string, number>();
    if (allPostIds.length > 0) {
      const { data: comments } = await supabaseAdmin
        .from("commentaires")
        .select("photo_id")
        .in("photo_id", allPostIds);
      const postToEvent = new Map<string, string>();
      for (const [eid, ids] of postIdsByEvent) for (const id of ids) postToEvent.set(id, eid);
      for (const c of comments ?? []) {
        const eid = postToEvent.get(c.photo_id as string);
        if (eid) commentsByEvent.set(eid, (commentsByEvent.get(eid) ?? 0) + 1);
      }
    }

    // 8. Invites count
    const { data: invitesAll } = await supabaseAdmin
      .from("invites")
      .select("event_id")
      .in("event_id", activeIds);
    const invitesCount = new Map<string, number>();
    for (const i of invitesAll ?? []) {
      invitesCount.set(
        i.event_id as string,
        (invitesCount.get(i.event_id as string) ?? 0) + 1,
      );
    }

    return eventsList.map((e) => {
      const id = e.id as string;
      const planMax = e.plan_code ? maxByPlan.get(e.plan_code as string) ?? 0 : 0;
      const max_photos = planMax + (addonCount.get(id) ?? 0) * 100;
      return {
        id,
        slug: e.slug as string,
        titre: e.titre as string,
        lieu: (e.lieu as string | null) ?? null,
        cover_url: (e.cover_url as string | null) ?? null,
        event_date: (e.event_date as string | null) ?? null,
        status: e.status as MyEventOverview["status"],
        frozen_at: (e.frozen_at as string | null) ?? null,
        expire_at: (e.expire_at as string | null) ?? null,
        zip_download_url: (e.zip_download_url as string | null) ?? null,
        plan_code: (e.plan_code as string | null) ?? null,
        role: roleByEventId.get(id) ?? "invite",
        photo_count: photoCount.get(id) ?? 0,
        max_photos,
        likes_count: likesCount.get(id) ?? 0,
        comments_count: commentsByEvent.get(id) ?? 0,
        invites_count: invitesCount.get(id) ?? 0,
      };
    });
  });