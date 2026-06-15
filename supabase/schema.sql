-- Execute no SQL Editor do Supabase

create table container_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  owner text not null,
  cat text not null,
  qty int not null,
  new_count int not null default 0,
  dup_count int not null default 0,
  nums jsonb not null default '[]',
  created_at timestamptz default now()
);

create table used_numbers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  container_key text not null,   -- ex: "ALSU 000001"
  full_number text not null,     -- ex: "ALSU 000001 3"
  check_digit int not null,
  created_at timestamptz default now(),
  unique(user_id, container_key)
);

-- RLS
alter table container_sessions enable row level security;
alter table used_numbers enable row level security;

create policy "user sees own sessions"
  on container_sessions for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "user sees own numbers"
  on used_numbers for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
