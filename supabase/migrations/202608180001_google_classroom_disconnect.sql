begin;

-- Lets an authenticated student remove only their own encrypted Classroom
-- connection when the server-only Supabase key is unavailable.
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

  delete from public.google_classroom_connections
  where user_id = auth.uid();
end;
$$;

revoke all on function public.disconnect_google_classroom() from public;
grant execute on function public.disconnect_google_classroom() to authenticated;

commit;
