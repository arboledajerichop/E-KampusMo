begin;

-- A device can retain an older local copy after another device deletes it.
-- These durable markers prevent that stale copy from being uploaded again.
create table if not exists public.student_record_deletions (
  user_id uuid not null references auth.users(id) on delete cascade,
  table_name text not null check (
    table_name in ('class_schedules', 'internships', 'internship_entries')
  ),
  record_id uuid not null,
  deleted_at timestamptz not null default now(),
  primary key (user_id, table_name, record_id)
);

create index if not exists student_record_deletions_user_id_idx
on public.student_record_deletions (user_id, deleted_at desc);

alter table public.student_record_deletions enable row level security;
revoke all on table public.student_record_deletions from anon;
grant select, insert, update, delete
on table public.student_record_deletions to authenticated, service_role;

drop policy if exists "Students manage their own record deletions"
on public.student_record_deletions;
create policy "Students manage their own record deletions"
on public.student_record_deletions
for all to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

-- Protect against a stale device that began a sync immediately before it
-- learned about a deletion marker.
create or replace function public.reject_deleted_record_recreation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (
    select 1
    from public.student_record_deletions
    where user_id = new.user_id
      and table_name = tg_table_name
      and record_id = new.id
  ) then
    raise exception 'This record was deleted from another device.';
  end if;
  return new;
end;
$$;

revoke all on function public.reject_deleted_record_recreation() from public;

drop trigger if exists class_schedules_reject_deleted_recreation
on public.class_schedules;
create trigger class_schedules_reject_deleted_recreation
before insert or update on public.class_schedules
for each row execute function public.reject_deleted_record_recreation();

drop trigger if exists internships_reject_deleted_recreation
on public.internships;
create trigger internships_reject_deleted_recreation
before insert or update on public.internships
for each row execute function public.reject_deleted_record_recreation();

drop trigger if exists internship_entries_reject_deleted_recreation
on public.internship_entries;
create trigger internship_entries_reject_deleted_recreation
before insert or update on public.internship_entries
for each row execute function public.reject_deleted_record_recreation();

commit;
