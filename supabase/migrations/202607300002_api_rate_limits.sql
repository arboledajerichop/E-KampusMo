begin;

create table if not exists public.api_rate_limits (
  user_id uuid not null references auth.users(id) on delete cascade,
  action text not null,
  window_started_at timestamptz not null default now(),
  request_count integer not null default 1 check (request_count > 0),
  primary key (user_id, action)
);

alter table public.api_rate_limits enable row level security;

revoke all on table public.api_rate_limits from anon;
revoke all on table public.api_rate_limits from authenticated;

create or replace function public.consume_api_rate_limit(p_action text)
returns table (
  allowed boolean,
  limit_count integer,
  remaining integer,
  reset_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_limit integer;
  v_window_seconds integer;
  v_now timestamptz := clock_timestamp();
  v_count integer;
  v_window_started_at timestamptz;
begin
  if v_user_id is null then
    raise exception 'Authentication is required.';
  end if;

  case p_action
    when 'account-deletion-code' then
      v_limit := 3;
      v_window_seconds := 900;
    when 'account-delete' then
      v_limit := 5;
      v_window_seconds := 900;
    when 'classroom-connect' then
      v_limit := 10;
      v_window_seconds := 900;
    when 'classroom-callback' then
      v_limit := 20;
      v_window_seconds := 900;
    when 'classroom-coursework' then
      v_limit := 30;
      v_window_seconds := 60;
    when 'classroom-status' then
      v_limit := 120;
      v_window_seconds := 60;
    when 'classroom-disconnect' then
      v_limit := 10;
      v_window_seconds := 900;
    else
      raise exception 'Unknown rate-limit action.';
  end case;

  insert into public.api_rate_limits (
    user_id,
    action,
    window_started_at,
    request_count
  )
  values (
    v_user_id,
    p_action,
    v_now,
    1
  )
  on conflict (user_id, action) do update
  set
    window_started_at = case
      when public.api_rate_limits.window_started_at
        <= v_now - make_interval(secs => v_window_seconds)
      then v_now
      else public.api_rate_limits.window_started_at
    end,
    request_count = case
      when public.api_rate_limits.window_started_at
        <= v_now - make_interval(secs => v_window_seconds)
      then 1
      else public.api_rate_limits.request_count + 1
    end
  returning
    public.api_rate_limits.request_count,
    public.api_rate_limits.window_started_at
  into v_count, v_window_started_at;

  return query
  select
    v_count <= v_limit,
    v_limit,
    greatest(0, v_limit - v_count),
    v_window_started_at + make_interval(secs => v_window_seconds);
end;
$$;

revoke all on function public.consume_api_rate_limit(text) from public;
grant execute on function public.consume_api_rate_limit(text) to authenticated;

commit;
