begin;

alter table public.internships
  add column if not exists max_daily_minutes integer not null default 480;

alter table public.internships
  drop constraint if exists internships_max_daily_minutes_range;

alter table public.internships
  add constraint internships_max_daily_minutes_range
  check (max_daily_minutes between 60 and 1440);

alter table public.internship_entries
  add column if not exists entry_status text not null default 'worked';

alter table public.internship_entries
  alter column clock_in drop not null,
  alter column clock_out drop not null;

alter table public.internship_entries
  drop constraint if exists internship_entries_time_range;

alter table public.internship_entries
  drop constraint if exists internship_entries_status_valid;

alter table public.internship_entries
  add constraint internship_entries_status_valid
  check (entry_status in ('worked', 'absent'));

alter table public.internship_entries
  drop constraint if exists internship_entries_status_time_valid;

alter table public.internship_entries
  add constraint internship_entries_status_time_valid
  check (
    (
      entry_status = 'worked'
      and clock_in is not null
      and clock_out is not null
      and clock_out > clock_in
    )
    or
    (
      entry_status = 'absent'
      and clock_in is null
      and clock_out is null
      and break_minutes = 0
      and adjustment_minutes = 0
    )
  );

commit;
