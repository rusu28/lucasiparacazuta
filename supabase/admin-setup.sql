-- Ruleaza intai TOT fisierul supabase/schema.sql in SQL Editor.
-- Dupa aceea ruleaza acest fisier pentru a marca un cont ca admin.

do $$
begin
  if to_regclass('public.profiles') is null then
    raise exception 'public.profiles nu exista. Ruleaza supabase/schema.sql inainte de admin-setup.sql.';
  end if;
end $$;

insert into public.profiles (id, email, username, display_name, role, plan)
select
  id,
  email,
  coalesce(raw_user_meta_data->>'username', 'RusVladAdmin'),
  coalesce(raw_user_meta_data->>'display_name', 'Rus Vlad Admin'),
  'admin',
  'elite'
from auth.users
where lower(email) = lower('rusvlad1010@icloud.com')
on conflict (id) do update set
  role = 'admin',
  plan = 'elite',
  username = coalesce(public.profiles.username, excluded.username),
  display_name = coalesce(public.profiles.display_name, excluded.display_name);
