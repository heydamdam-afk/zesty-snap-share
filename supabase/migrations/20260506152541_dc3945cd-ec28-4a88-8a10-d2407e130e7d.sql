create or replace function public.set_event_cover(_event_id uuid, _cover_url text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_event_admin(_event_id, auth.uid()) then
    raise exception 'not_admin';
  end if;
  if _cover_url is null or char_length(_cover_url) < 1 or char_length(_cover_url) > 2048 then
    raise exception 'invalid_cover_url';
  end if;
  update public.events set cover_url = _cover_url where id = _event_id;
  return true;
end;
$$;