create or replace function public.get_auth_user_summary_by_email(_email text)
returns table(id uuid, last_sign_in_at timestamptz, has_password boolean)
language sql
stable
security definer
set search_path = public, auth
as $$
  select
    u.id,
    u.last_sign_in_at,
    (u.encrypted_password is not null and u.encrypted_password <> '') as has_password
  from auth.users u
  where lower(u.email) = lower(_email)
  limit 1;
$$;

revoke all on function public.get_auth_user_summary_by_email(text) from public;
revoke all on function public.get_auth_user_summary_by_email(text) from anon;
revoke all on function public.get_auth_user_summary_by_email(text) from authenticated;
grant execute on function public.get_auth_user_summary_by_email(text) to service_role;