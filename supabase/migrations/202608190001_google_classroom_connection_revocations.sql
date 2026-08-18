begin;

-- A disconnect must apply to every device. This keeps an old browser cookie
-- from restoring a connection after the student has disconnected elsewhere.
create table if not exists public.google_classroom_connection_revocations (
  user_id uuid primary key references auth.users(id) on delete cascade,
  disconnected_at timestamptz not null default now()
);

alter table public.google_classroom_connection_revocations enable row level security;
revoke all on table public.google_classroom_connection_revocations from anon, authenticated;

create or replace function public.disconnect_google_classroom()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'Authentication is required.';
  end if;

  insert into public.google_classroom_connection_revocations (user_id)
  values (auth.uid())
  on conflict (user_id) do update
  set disconnected_at = excluded.disconnected_at;

  delete from public.google_classroom_connections
  where user_id = auth.uid();
end;
$$;

create or replace function public.reconnect_google_classroom()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'Authentication is required.';
  end if;

  delete from public.google_classroom_connection_revocations
  where user_id = auth.uid();
end;
$$;

create or replace function public.google_classroom_connection_is_revoked()
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'Authentication is required.';
  end if;

  return exists (
    select 1
    from public.google_classroom_connection_revocations
    where user_id = auth.uid()
  );
end;
$$;

revoke all on function public.disconnect_google_classroom() from public;
revoke all on function public.reconnect_google_classroom() from public;
revoke all on function public.google_classroom_connection_is_revoked() from public;
grant execute on function public.disconnect_google_classroom() to authenticated;
grant execute on function public.reconnect_google_classroom() to authenticated;
grant execute on function public.google_classroom_connection_is_revoked() to authenticated;

commit;
