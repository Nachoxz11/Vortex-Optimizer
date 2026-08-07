create table if not exists public.premium_keys (
  id uuid primary key default gen_random_uuid(),
  key_hash text not null unique,
  duration_days integer,
  redeemed_by uuid references auth.users(id) on delete set null,
  redeemed_at timestamptz,
  created_at timestamptz not null default now(),
  constraint premium_keys_duration_positive check (duration_days is null or duration_days > 0),
  constraint premium_keys_redeemed_pair check ((redeemed_by is null) = (redeemed_at is null))
);

alter table public.premium_keys enable row level security;

revoke all on public.premium_keys from anon, authenticated;

create index if not exists premium_keys_hash_idx on public.premium_keys (key_hash);
