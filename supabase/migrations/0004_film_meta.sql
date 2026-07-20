-- Cached TMDB metadata per film — genres, runtime, language, rating.
-- Filled progressively by the server; service-role only.
create table if not exists public.film_meta (
  slug text primary key,
  title text not null,
  year int,
  runtime int,
  genre_ids int[] not null default '{}',
  language text,
  vote numeric(3, 1),
  popularity numeric,
  fetched_at timestamptz not null default now()
);

alter table public.film_meta enable row level security;
-- No client policies: only the server (service role) reads and writes this.
