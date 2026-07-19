-- Avatars pulled from the Letterboxd feed + review text from the export.
alter table public.profiles add column if not exists avatar_url text;
alter table public.films add column if not exists review text;
