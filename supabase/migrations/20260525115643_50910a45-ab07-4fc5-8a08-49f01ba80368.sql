
create or replace function public.is_email_admin_of_event(_event_id uuid, _email text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.event_admins
    where event_id = _event_id
      and lower(email) = lower(_email)
  )
$$;

grant execute on function public.is_email_admin_of_event(uuid, text) to anon, authenticated;
