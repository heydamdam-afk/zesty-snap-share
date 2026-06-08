create or replace function public.get_profiles_by_emails(_emails text[])
returns table(email text, avatar_url text, avatar_name text, prenom text, nom text)
language sql
stable
security definer
set search_path = public
as $$
  select lower(p.email), p.avatar_url, p.avatar_name, p.prenom, p.nom
  from public.profiles p
  where p.email is not null
    and lower(p.email) = any (select lower(x) from unnest(_emails) as x);
$$;

grant execute on function public.get_profiles_by_emails(text[]) to authenticated, anon;