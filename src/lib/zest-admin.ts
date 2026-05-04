import { supabase } from "@/integrations/supabase/client";
import { deletePostWithR2 } from "@/server/r2.functions";

export async function deletePost(postId: string, deviceId?: string) {
  // Use the server fn so the R2 object is also removed and admin auth
  // (via Bearer header) or owner device_id is verified server-side.
  await deletePostWithR2({ data: { postId, deviceId } });
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