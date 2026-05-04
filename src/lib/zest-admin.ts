import { supabase } from "@/integrations/supabase/client";

export async function deletePost(postId: string) {
  const { error } = await supabase.from("posts").delete().eq("id", postId);
  if (error) throw error;
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