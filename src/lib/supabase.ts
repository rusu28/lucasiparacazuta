import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const supabaseUrl =
  import.meta.env.VITE_SUPABASE_URL ||
  import.meta.env.NEXT_PUBLIC_SUPABASE_URL ||
  import.meta.env.SUPABASE_URL;
const supabaseAnonKey =
  import.meta.env.VITE_SUPABASE_ANON_KEY ||
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  import.meta.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  import.meta.env.SUPABASE_ANON_KEY;

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(supabaseUrl as string, supabaseAnonKey as string, {
      auth: {
        autoRefreshToken: true,
        detectSessionInUrl: true,
        persistSession: true,
        storageKey: "purcar-auth-session",
      },
    })
  : null;

export const suggestedSchema = `
create extension if not exists pgcrypto;

create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  username text unique,
  display_name text,
  role text default 'student',
  plan text default 'free',
  creativity integer default 50 check (creativity between 0 and 100),
  created_at timestamptz default now()
);

alter table profiles
  add column if not exists temperature numeric default 1 check (temperature between 0.01 and 1000);

create table if not exists chat_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  title text not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists chat_messages (
  id uuid primary key default gen_random_uuid(),
  session_id uuid references chat_sessions(id) on delete cascade,
  role text check (role in ('user', 'assistant')) not null,
  content text not null,
  created_at timestamptz default now(),
  training_eligible boolean default true
);

create table if not exists presentation_overrides (
  id text primary key,
  content text not null,
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz default now()
);

create table if not exists token_usage_windows (
  user_id uuid primary key references auth.users(id) on delete cascade,
  window_started_at timestamptz not null default now(),
  tokens_used integer not null default 0,
  updated_at timestamptz default now()
);

create table if not exists support_threads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  subject text not null,
  status text default 'open' check (status in ('open', 'answered', 'closed')),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists support_messages (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid references support_threads(id) on delete cascade,
  sender_id uuid references auth.users(id) on delete set null,
  sender_role text default 'user' check (sender_role in ('user', 'admin')),
  body text not null,
  created_at timestamptz default now()
);

create table if not exists app_audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references auth.users(id) on delete set null,
  event text not null,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz default now()
);

create or replace function public.is_admin(uid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = uid and role = 'admin'
  );
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, username, display_name, role, plan)
  values (
    new.id,
    new.email,
    nullif(
      lower(regexp_replace(coalesce(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1)), '[^a-zA-Z0-9_]+', '_', 'g'))
        || '_' || right(new.id::text, 6),
      ''
    ),
    coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1), 'Student'),
    'student',
    'free'
  )
  on conflict (id) do update set
    email = excluded.email,
    display_name = coalesce(public.profiles.display_name, excluded.display_name);
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert or update of email on auth.users
for each row execute procedure public.handle_new_user();

alter table profiles enable row level security;
alter table chat_sessions enable row level security;
alter table chat_messages enable row level security;
alter table presentation_overrides enable row level security;
alter table token_usage_windows enable row level security;
alter table support_threads enable row level security;
alter table support_messages enable row level security;
alter table app_audit_logs enable row level security;

grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on public.profiles to authenticated;
grant select, insert, update, delete on public.chat_sessions to authenticated;
grant select, insert, update, delete on public.chat_messages to authenticated;
grant select, insert, update, delete on public.token_usage_windows to authenticated;
grant select, insert, update, delete on public.support_threads to authenticated;
grant select, insert, update, delete on public.support_messages to authenticated;
grant select on public.presentation_overrides to anon, authenticated;
grant insert, update, delete on public.presentation_overrides to authenticated;
grant insert, select on public.app_audit_logs to authenticated;

drop policy if exists "profiles_select_own" on profiles;
create policy "profiles_select_own" on profiles
for select using (auth.uid() = id or is_admin(auth.uid()));

drop policy if exists "profiles_update_own" on profiles;
create policy "profiles_update_own" on profiles
for update using (auth.uid() = id or is_admin(auth.uid()))
with check (auth.uid() = id or is_admin(auth.uid()));

drop policy if exists "profiles_insert_own" on profiles;
create policy "profiles_insert_own" on profiles
for insert with check (auth.uid() = id);

drop policy if exists "chat_sessions_owner" on chat_sessions;
create policy "chat_sessions_owner" on chat_sessions
for all using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "chat_messages_owner" on chat_messages;
create policy "chat_messages_owner" on chat_messages
for all using (
  exists (
    select 1 from chat_sessions
    where chat_sessions.id = chat_messages.session_id
    and chat_sessions.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1 from chat_sessions
    where chat_sessions.id = chat_messages.session_id
    and chat_sessions.user_id = auth.uid()
  )
);

drop policy if exists "presentation_public_read" on presentation_overrides;
create policy "presentation_public_read" on presentation_overrides
for select using (true);

drop policy if exists "presentation_admin_write" on presentation_overrides;
create policy "presentation_admin_write" on presentation_overrides
for all using (is_admin(auth.uid()))
with check (is_admin(auth.uid()));

drop policy if exists "token_usage_owner" on token_usage_windows;
create policy "token_usage_owner" on token_usage_windows
for all using (auth.uid() = user_id or is_admin(auth.uid()))
with check (auth.uid() = user_id or is_admin(auth.uid()));

drop policy if exists "support_threads_owner_or_admin" on support_threads;
create policy "support_threads_owner_or_admin" on support_threads
for all using (auth.uid() = user_id or is_admin(auth.uid()))
with check (auth.uid() = user_id or is_admin(auth.uid()));

drop policy if exists "support_messages_owner_or_admin" on support_messages;
create policy "support_messages_owner_or_admin" on support_messages
for all using (
  is_admin(auth.uid()) or exists (
    select 1 from support_threads
    where support_threads.id = support_messages.thread_id
    and support_threads.user_id = auth.uid()
  )
)
with check (
  is_admin(auth.uid()) or exists (
    select 1 from support_threads
    where support_threads.id = support_messages.thread_id
    and support_threads.user_id = auth.uid()
  )
);

drop policy if exists "audit_insert_authenticated" on app_audit_logs;
create policy "audit_insert_authenticated" on app_audit_logs
for insert with check (auth.uid() = actor_id);

drop policy if exists "audit_admin_read" on app_audit_logs;
create policy "audit_admin_read" on app_audit_logs
for select using (is_admin(auth.uid()));

do $$
begin
  alter publication supabase_realtime add table presentation_overrides;
exception
  when duplicate_object then null;
end $$;
`;
