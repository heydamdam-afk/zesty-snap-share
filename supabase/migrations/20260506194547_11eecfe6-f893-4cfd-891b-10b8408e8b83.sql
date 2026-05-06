grant usage on schema public to anon, authenticated;

-- Public event experience: RLS policies still decide which rows/actions are allowed.
grant select on public.events, public.invites, public.posts, public.post_photos, public.commentaires, public.likes to anon, authenticated;
grant insert on public.invites, public.posts, public.post_photos, public.commentaires, public.likes to anon, authenticated;

-- Guest self-service RPCs used by the app with a device id proof.
grant execute on function public.find_my_invite(uuid, text) to anon, authenticated;
grant execute on function public.is_device_banned(uuid, text) to anon, authenticated;
grant execute on function public.update_own_invite(text, uuid, text, text, boolean) to anon, authenticated;
grant execute on function public.update_own_invite(text, uuid, text, text, boolean, text) to anon, authenticated;
grant execute on function public.delete_own_commentaire(uuid, text) to anon, authenticated;
grant execute on function public.delete_own_like(uuid, text) to anon, authenticated;

-- Organizer/admin actions: access remains constrained by existing RLS policies and SECURITY DEFINER functions.
grant select on public.event_admins, public.banned_invites, public.event_bans, public.event_coupons, public.event_coupon_redemptions, public.platform_admins to authenticated;
grant insert on public.event_admins, public.banned_invites, public.event_bans to authenticated;
grant update on public.event_admins to authenticated;
grant delete on public.event_admins, public.banned_invites, public.event_bans, public.posts, public.post_photos, public.commentaires to authenticated;

grant execute on function public.link_admin_user_id() to authenticated;
grant execute on function public.current_admin_email() to authenticated;
grant execute on function public.is_event_admin(uuid, uuid) to authenticated;
grant execute on function public.is_event_admin_email(uuid) to authenticated;
grant execute on function public.is_event_organisateur_email(uuid) to authenticated;
grant execute on function public.ban_invite_cascade(uuid, text) to authenticated;
grant execute on function public.transfer_organisateur(uuid, uuid, uuid) to authenticated;
grant execute on function public.my_admin_events() to authenticated;
grant execute on function public.validate_coupon(text) to anon, authenticated;
grant execute on function public.create_event_with_coupon(text, text, text, timestamp with time zone, text, text, text, text) to authenticated;
grant execute on function public.set_event_cover(uuid, text) to authenticated;
grant execute on function public.is_platform_admin(uuid) to authenticated;