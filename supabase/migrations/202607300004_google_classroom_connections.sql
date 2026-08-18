begin;

create table if not exists public.google_classroom_connections (
  user_id uuid primary key references auth.users(id) on delete cascade,
  token_ciphertext text not null,
  updated_at timestamptz not null default now()
);

alter table public.google_classroom_connections enable row level security;
revoke all on table public.google_classroom_connections from anon, authenticated;

commit;
