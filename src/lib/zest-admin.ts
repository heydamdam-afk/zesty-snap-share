import { supabase } from "@/integrations/supabase/client";
import { deletePostWithR2 } from "@/server/r2.functions";

export async function deletePost(postId: string, deviceId?: string) {
  // Forward the supabase access token so admin auth can be verified server-side.
  const { data } = await supabase.auth.getSession();
  const adminToken = data.session?.access_token;
  await deletePostWithR2({ data: { postId, deviceId, adminToken } });
}

export async function deleteCommentAsAdmin(commentId: string) {
  const { error } = await supabase
    .from("commentaires")
    .delete()
    .eq("id", commentId);
  if (error) throw error;
}

export async function banInvite(eventId: string, deviceId: string) {
  const { error } = await supabase.rpc("ban_invite_cascade", {
    _event_id: eventId,
    _device_id: deviceId,
  });
  if (error) throw error;
}