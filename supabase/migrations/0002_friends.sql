-- Friends: each friend is a guest profile (public data only) owned by a user.
create table if not exists public.friends (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (owner_user_id, profile_id)
);

alter table public.friends enable row level security;

create policy "own friends" on public.friends
  for all using (auth.uid() = owner_user_id) with check (auth.uid() = owner_user_id);
