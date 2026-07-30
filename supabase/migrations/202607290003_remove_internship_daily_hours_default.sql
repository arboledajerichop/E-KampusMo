begin;

alter table public.internships
  alter column max_daily_minutes drop default;

commit;
