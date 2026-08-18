begin;

alter table public.classroom_assignment_preferences
  add column if not exists read_announcement_keys text[] not null default '{}';

commit;
