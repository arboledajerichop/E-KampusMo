begin;

alter table public.internship_entries
  alter column activities set default '';

alter table public.internship_entries
  drop constraint if exists internship_entries_activities_check;

alter table public.internship_entries
  drop constraint if exists internship_entries_activities_length;

alter table public.internship_entries
  add constraint internship_entries_activities_length
  check (char_length(activities) <= 10000);

commit;
