begin;

create table if not exists public.classroom_assignment_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  semester_start date,
  completed_item_keys text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists classroom_assignment_preferences_set_updated_at
on public.classroom_assignment_preferences;
create trigger classroom_assignment_preferences_set_updated_at
before update on public.classroom_assignment_preferences
for each row execute function public.set_updated_at();

alter table public.classroom_assignment_preferences enable row level security;

revoke all on table public.classroom_assignment_preferences from anon;
grant select, insert, update, delete
on table public.classroom_assignment_preferences
to authenticated;

drop policy if exists "Students manage their own Classroom preferences"
on public.classroom_assignment_preferences;
create policy "Students manage their own Classroom preferences"
on public.classroom_assignment_preferences
for all
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

commit;
