-- Letterboxd Night — initial schema
-- Run this in the Supabase SQL editor (or via `supabase db push`).

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key default gen_random_uuid(),
  -- Nullable so RSS-only "guest" profiles can exist for public compare mode.
  -- unique allows multiple NULLs, so guests don't collide.
  user_id uuid unique references auth.users (id) on delete cascade,
  letterboxd_username text not null,
  rss_url text not null,
  is_guest boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_synced_at timestamptz
);

-- ---------------------------------------------------------------------------
-- films — one row per (profile, film, watch event)
-- ---------------------------------------------------------------------------
create table if not exists public.films (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  film_slug text not null,
  title text not null,
  year int,
  rating numeric(2, 1),
  watched_date date,
  -- 'diary' | 'watched' | 'rating' | 'watchlist' | 'rss'
  entry_type text not null default 'watched',
  source text not null default 'csv' check (source in ('csv', 'rss')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Upsert key: a profile can log the same film on different dates (rewatches),
-- but never twice on the same date. Nulls are coalesced so watchlist/ratings
-- rows (no date) also dedupe.
create unique index if not exists films_profile_slug_date_key
  on public.films (profile_id, film_slug, coalesce(watched_date, '1900-01-01'::date), entry_type);

create index if not exists films_profile_idx on public.films (profile_id);
create index if not exists films_profile_watched_idx on public.films (profile_id, watched_date desc);

-- ---------------------------------------------------------------------------
-- preferences
-- ---------------------------------------------------------------------------
create table if not exists public.preferences (
  profile_id uuid primary key references public.profiles (id) on delete cascade,
  default_mood text not null default 'easy',
  default_intensity text not null default 'medium',
  default_runtime_cap text not null default 'any',
  allow_rewatches boolean not null default false,
  language_pref text not null default 'any',
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- compare sessions
-- ---------------------------------------------------------------------------
create table if not exists public.sessions (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users (id) on delete cascade,
  join_code text not null unique,
  created_at timestamptz not null default now()
);

create table if not exists public.session_profiles (
  session_id uuid not null references public.sessions (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  added_at timestamptz not null default now(),
  primary key (session_id, profile_id)
);

-- ---------------------------------------------------------------------------
-- AI cache + usage accounting
-- ---------------------------------------------------------------------------
create table if not exists public.ai_cache (
  id uuid primary key default gen_random_uuid(),
  cache_key text not null unique,
  response_json jsonb not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null
);

create table if not exists public.ai_usage (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  day date not null default current_date,
  count int not null default 0,
  unique (user_id, day)
);

-- ---------------------------------------------------------------------------
-- Row Level Security
-- Owner-only access from the browser. Cross-profile reads (compare mode) and
-- guest profiles are handled server-side with the service-role key after the
-- API verifies session membership via join_code.
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.films enable row level security;
alter table public.preferences enable row level security;
alter table public.sessions enable row level security;
alter table public.session_profiles enable row level security;
alter table public.ai_cache enable row level security;
alter table public.ai_usage enable row level security;

create policy "own profile" on public.profiles
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "own films" on public.films
  for all using (
    exists (
      select 1 from public.profiles p
      where p.id = films.profile_id and p.user_id = auth.uid()
    )
  );

create policy "own preferences" on public.preferences
  for all using (
    exists (
      select 1 from public.profiles p
      where p.id = preferences.profile_id and p.user_id = auth.uid()
    )
  );

create policy "own sessions" on public.sessions
  for all using (auth.uid() = owner_user_id) with check (auth.uid() = owner_user_id);

create policy "session members read" on public.session_profiles
  for select using (
    exists (
      select 1 from public.sessions s
      where s.id = session_profiles.session_id and s.owner_user_id = auth.uid()
    )
    or exists (
      select 1 from public.profiles p
      where p.id = session_profiles.profile_id and p.user_id = auth.uid()
    )
  );

-- ai_cache / ai_usage: no client policies — service-role only.

-- ---------------------------------------------------------------------------
-- updated_at trigger
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_updated_at on public.profiles;
create trigger profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

drop trigger if exists films_updated_at on public.films;
create trigger films_updated_at before update on public.films
  for each row execute function public.set_updated_at();
