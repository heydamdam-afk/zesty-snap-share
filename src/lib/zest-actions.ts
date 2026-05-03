import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

const BUCKET = "event-photos";

export async function findEventBySlug(slug: string) {
  const { data, error } = await supabase
    .from("events")
    .select("*")
    .eq("slug", slug)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function findEventByCode(code: string) {
  const { data, error } = await supabase
    .from("events")
    .select("*")
    .ilike("code_acces", code.trim())
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function findInvite(eventId: string, deviceId: string) {
  const { data, error } = await supabase
    .from("invites")
    .select("*")
    .eq("event_id", eventId)
    .eq("device_id", deviceId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function loginToEvent(args: {
  slug: string;
  code: string;
  prenom: string;
  email?: string;
  rgpd: boolean;
  deviceId: string;
  avatarUrl?: string;
}) {
  // L'invité ne connaît que le code d'accès — on retrouve l'event par code.
  const event = await findEventByCode(args.code);
  if (!event) return { ok: false as const, reason: "bad_code" };

  const existing = await findInvite(event.id, args.deviceId);
  if (existing) return { ok: true as const, event, invite: existing };

  const { data, error } = await supabase
    .from("invites")
    .insert({
      event_id: event.id,
      prenom: args.prenom.trim(),
      email: args.email?.trim().toLowerCase() || null,
      device_id: args.deviceId,
      avatar_url: args.avatarUrl ?? null,
      rgpd_consent: args.rgpd,
    })
    .select()
    .single();
  if (error) return { ok: false as const, reason: "insert_failed", error };
  return { ok: true as const, event, invite: data };
}

export async function uploadEventPhoto(file: File, eventId: string) {
  const ext = file.name.split(".").pop() || "jpg";
  const path = `${eventId}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
    cacheControl: "3600",
    upsert: false,
    contentType: file.type,
  });
  if (error) throw error;
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

export async function createPost(args: {
  eventId: string;
  inviteId: string;
  contenuTexte?: string;
  files?: File[];
}) {
  const trimmed = args.contenuTexte?.trim() || null;
  const files = args.files ?? [];
  if (!trimmed && files.length === 0) {
    throw new Error("Post vide");
  }

  // Pour ce MVP, 1 post = 1 photo (la première). Un post texte = pas de photo.
  let urls: { miniature: string | null; medium: string | null; full: string | null } = {
    miniature: null,
    medium: null,
    full: null,
  };
  if (files[0]) {
    const url = await uploadEventPhoto(files[0], args.eventId);
    urls = { miniature: url, medium: url, full: url };
  }

  const { data, error } = await supabase
    .from("posts")
    .insert({
      event_id: args.eventId,
      invite_id: args.inviteId,
      contenu_texte: trimmed,
      url_miniature: urls.miniature,
      url_medium: urls.medium,
      url_full: urls.full,
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function toggleLike(args: {
  photoId: string;
  inviteId: string;
  deviceId: string;
  currentlyLiked: boolean;
}) {
  if (args.currentlyLiked) {
    const { data, error } = await supabase.rpc("delete_own_like", {
      _photo_id: args.photoId,
      _device_id: args.deviceId,
    });
    if (error) throw error;
    return !data; // returns boolean indicating still liked
  }
  const { error } = await supabase
    .from("likes")
    .insert({ photo_id: args.photoId, invite_id: args.inviteId });
  if (error && error.code !== "23505") throw error;
  return true;
}

export async function addComment(args: {
  photoId: string;
  inviteId: string;
  contenu: string;
}) {
  const { data, error } = await supabase
    .from("commentaires")
    .insert({
      photo_id: args.photoId,
      invite_id: args.inviteId,
      contenu: args.contenu.trim(),
    })
    .select("*, invites(id, prenom)")
    .single();
  if (error) throw error;
  return data;
}

export async function deleteOwnComment(commentId: string, deviceId: string) {
  const { data, error } = await supabase.rpc("delete_own_commentaire", {
    _commentaire_id: commentId,
    _device_id: deviceId,
  });
  if (error) throw error;
  return !!data;
}

export async function updateOwnInvite(args: {
  deviceId: string;
  eventId: string;
  avatarUrl?: string;
  email?: string;
  rgpdConsent?: boolean;
}) {
  const { data, error } = await supabase.rpc("update_own_invite", {
    _device_id: args.deviceId,
    _event_id: args.eventId,
    _avatar_url: args.avatarUrl,
    _email: args.email,
    _rgpd_consent: args.rgpdConsent,
  });
  if (error) throw error;
  return data as Tables<"invites">;
}