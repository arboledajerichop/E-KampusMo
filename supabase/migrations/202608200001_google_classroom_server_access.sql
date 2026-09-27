begin;

-- New Supabase secret API keys operate as service_role but still require
-- explicit table privileges. The Classroom token is intentionally stored
-- server-side so one account connection is available on every device.
grant select, insert, update, delete
on table
  public.google_classroom_connections,
  public.google_classroom_connection_revocations
to service_role;

commit;
