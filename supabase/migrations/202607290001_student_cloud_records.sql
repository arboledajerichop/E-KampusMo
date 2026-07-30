begin;

create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

revoke all on function public.set_updated_at() from public;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  user_id uuid not null unique references auth.users(id) on delete cascade,
  full_name text not null default '',
  avatar_path text,
  timezone text not null default 'Asia/Manila',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_owner_matches_id check (id = user_id)
);

create table if not exists public.subjects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 160),
  code text not null default '',
  instructor_name text not null default '',
  units numeric(4,1),
  color text not null default '#1d4ed8',
  term text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint subjects_units_range check (units is null or units between 0 and 20)
);

create table if not exists public.class_schedules (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  subject_id uuid not null references public.subjects(id) on delete cascade,
  day_of_week smallint not null check (day_of_week between 1 and 7),
  start_time time not null,
  end_time time not null,
  meeting_type text not null check (meeting_type in ('lecture', 'laboratory', 'other')),
  room text not null default '',
  building text not null default '',
  campus text not null default '',
  mode text not null check (mode in ('face-to-face', 'online', 'hybrid')),
  meeting_link text not null default '',
  reminder_minutes integer not null default 15 check (reminder_minutes between 0 and 10080),
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint class_schedules_time_range check (end_time > start_time)
);

create table if not exists public.assignments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  subject_id uuid not null references public.subjects(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 240),
  description text not null default '',
  type text not null check (type in ('assignment', 'project', 'exam', 'quiz', 'other')),
  deadline timestamptz not null,
  priority text not null check (priority in ('low', 'medium', 'high')),
  status text not null check (status in ('not-started', 'in-progress', 'completed', 'submitted')),
  estimated_minutes integer check (estimated_minutes is null or estimated_minutes > 0),
  weight_percent numeric(5,2) check (weight_percent is null or weight_percent between 0 and 100),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.attendance_records (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  subject_id uuid not null references public.subjects(id) on delete cascade,
  date date not null,
  status text not null check (status in ('present', 'late', 'absent', 'excused', 'no-class')),
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, subject_id, date)
);

create table if not exists public.attendance_settings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  subject_id uuid not null references public.subjects(id) on delete cascade,
  absence_limit integer not null default 3 check (absence_limit between 0 and 100),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, subject_id)
);

create table if not exists public.internships (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  company_name text not null check (char_length(company_name) between 1 and 200),
  company_address text not null default '',
  position text not null check (char_length(position) between 1 and 160),
  supervisor_name text not null default '',
  required_minutes integer not null check (required_minutes >= 60),
  start_date date not null,
  expected_end_date date not null,
  default_break_minutes integer not null default 60 check (default_break_minutes between 0 and 240),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint internships_date_range check (expected_end_date >= start_date)
);

create table if not exists public.internship_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  internship_id uuid not null references public.internships(id) on delete cascade,
  date date not null,
  clock_in time not null,
  clock_out time not null,
  break_minutes integer not null default 0 check (break_minutes between 0 and 480),
  adjustment_minutes integer not null default 0 check (adjustment_minutes between -480 and 480),
  adjustment_note text not null default '',
  activities text not null check (char_length(activities) between 1 and 10000),
  reflection text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, internship_id, date),
  constraint internship_entries_time_range check (clock_out > clock_in),
  constraint internship_adjustment_has_note check (
    adjustment_minutes = 0 or char_length(trim(adjustment_note)) > 0
  )
);

create table if not exists public.allowance_periods (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  amount_centavos bigint not null check (amount_centavos > 0),
  frequency text not null check (frequency in ('weekly', 'biweekly', 'monthly', 'custom')),
  start_date date not null,
  end_date date not null,
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint allowance_periods_date_range check (end_date >= start_date)
);

create table if not exists public.expenses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  amount_centavos bigint not null check (amount_centavos > 0),
  category text not null,
  date date not null,
  payment_method text not null,
  description text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.student_files (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  bucket_id text not null default 'student-files',
  storage_path text not null unique,
  original_name text not null,
  content_type text not null,
  size_bytes bigint not null check (size_bytes between 1 and 10485760),
  folder text not null default 'General',
  important boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint student_files_user_path check (
    split_part(storage_path, '/', 1) = user_id::text
  )
);

create table if not exists public.internship_photos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  internship_id uuid not null references public.internships(id) on delete cascade,
  entry_id uuid not null references public.internship_entries(id) on delete cascade,
  bucket_id text not null default 'internship-photos',
  storage_path text not null unique,
  original_name text not null,
  content_type text not null,
  size_bytes bigint not null check (size_bytes between 1 and 10485760),
  caption text not null default '',
  sort_order integer not null default 0 check (sort_order >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint internship_photos_user_path check (
    split_part(storage_path, '/', 1) = user_id::text
  )
);

create index if not exists subjects_user_id_idx on public.subjects(user_id);
create index if not exists class_schedules_user_id_idx on public.class_schedules(user_id);
create index if not exists class_schedules_subject_id_idx on public.class_schedules(subject_id);
create index if not exists assignments_user_id_deadline_idx on public.assignments(user_id, deadline);
create index if not exists attendance_records_user_id_date_idx on public.attendance_records(user_id, date);
create index if not exists attendance_settings_user_id_idx on public.attendance_settings(user_id);
create index if not exists internship_entries_user_id_date_idx on public.internship_entries(user_id, date);
create index if not exists allowance_periods_user_id_dates_idx on public.allowance_periods(user_id, start_date, end_date);
create index if not exists expenses_user_id_date_idx on public.expenses(user_id, date);
create index if not exists student_files_user_id_idx on public.student_files(user_id);
create index if not exists internship_photos_user_id_entry_idx on public.internship_photos(user_id, entry_id);

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at before update on public.profiles
for each row execute function public.set_updated_at();
drop trigger if exists subjects_set_updated_at on public.subjects;
create trigger subjects_set_updated_at before update on public.subjects
for each row execute function public.set_updated_at();
drop trigger if exists class_schedules_set_updated_at on public.class_schedules;
create trigger class_schedules_set_updated_at before update on public.class_schedules
for each row execute function public.set_updated_at();
drop trigger if exists assignments_set_updated_at on public.assignments;
create trigger assignments_set_updated_at before update on public.assignments
for each row execute function public.set_updated_at();
drop trigger if exists attendance_records_set_updated_at on public.attendance_records;
create trigger attendance_records_set_updated_at before update on public.attendance_records
for each row execute function public.set_updated_at();
drop trigger if exists attendance_settings_set_updated_at on public.attendance_settings;
create trigger attendance_settings_set_updated_at before update on public.attendance_settings
for each row execute function public.set_updated_at();
drop trigger if exists internships_set_updated_at on public.internships;
create trigger internships_set_updated_at before update on public.internships
for each row execute function public.set_updated_at();
drop trigger if exists internship_entries_set_updated_at on public.internship_entries;
create trigger internship_entries_set_updated_at before update on public.internship_entries
for each row execute function public.set_updated_at();
drop trigger if exists allowance_periods_set_updated_at on public.allowance_periods;
create trigger allowance_periods_set_updated_at before update on public.allowance_periods
for each row execute function public.set_updated_at();
drop trigger if exists expenses_set_updated_at on public.expenses;
create trigger expenses_set_updated_at before update on public.expenses
for each row execute function public.set_updated_at();
drop trigger if exists student_files_set_updated_at on public.student_files;
create trigger student_files_set_updated_at before update on public.student_files
for each row execute function public.set_updated_at();
drop trigger if exists internship_photos_set_updated_at on public.internship_photos;
create trigger internship_photos_set_updated_at before update on public.internship_photos
for each row execute function public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, user_id, full_name)
  values (
    new.id,
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', '')
  )
  on conflict (id) do update
  set full_name = excluded.full_name;
  return new;
end;
$$;

revoke all on function public.handle_new_user() from public;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

insert into public.profiles (id, user_id, full_name)
select
  id,
  id,
  coalesce(raw_user_meta_data ->> 'full_name', '')
from auth.users
on conflict (id) do nothing;

alter table public.profiles enable row level security;
alter table public.subjects enable row level security;
alter table public.class_schedules enable row level security;
alter table public.assignments enable row level security;
alter table public.attendance_records enable row level security;
alter table public.attendance_settings enable row level security;
alter table public.internships enable row level security;
alter table public.internship_entries enable row level security;
alter table public.allowance_periods enable row level security;
alter table public.expenses enable row level security;
alter table public.student_files enable row level security;
alter table public.internship_photos enable row level security;

revoke all on table public.profiles from anon;
revoke all on table public.subjects from anon;
revoke all on table public.class_schedules from anon;
revoke all on table public.assignments from anon;
revoke all on table public.attendance_records from anon;
revoke all on table public.attendance_settings from anon;
revoke all on table public.internships from anon;
revoke all on table public.internship_entries from anon;
revoke all on table public.allowance_periods from anon;
revoke all on table public.expenses from anon;
revoke all on table public.student_files from anon;
revoke all on table public.internship_photos from anon;

grant usage on schema public to authenticated;
grant select, insert, update, delete on table
  public.profiles,
  public.subjects,
  public.class_schedules,
  public.assignments,
  public.attendance_records,
  public.attendance_settings,
  public.internships,
  public.internship_entries,
  public.allowance_periods,
  public.expenses,
  public.student_files,
  public.internship_photos
to authenticated;

drop policy if exists "Students manage their own profile" on public.profiles;
create policy "Students manage their own profile"
on public.profiles for all to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id and id = user_id);

drop policy if exists "Students manage their own subjects" on public.subjects;
create policy "Students manage their own subjects"
on public.subjects for all to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists "Students manage their own schedules" on public.class_schedules;
create policy "Students manage their own schedules"
on public.class_schedules for all to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists "Students manage their own assignments" on public.assignments;
create policy "Students manage their own assignments"
on public.assignments for all to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists "Students manage their own attendance" on public.attendance_records;
create policy "Students manage their own attendance"
on public.attendance_records for all to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists "Students manage their own attendance settings" on public.attendance_settings;
create policy "Students manage their own attendance settings"
on public.attendance_settings for all to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists "Students manage their own internship" on public.internships;
create policy "Students manage their own internship"
on public.internships for all to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists "Students manage their own internship entries" on public.internship_entries;
create policy "Students manage their own internship entries"
on public.internship_entries for all to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists "Students manage their own allowance periods" on public.allowance_periods;
create policy "Students manage their own allowance periods"
on public.allowance_periods for all to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists "Students manage their own expenses" on public.expenses;
create policy "Students manage their own expenses"
on public.expenses for all to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists "Students manage their own file metadata" on public.student_files;
create policy "Students manage their own file metadata"
on public.student_files for all to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists "Students manage their own internship photo metadata" on public.internship_photos;
create policy "Students manage their own internship photo metadata"
on public.internship_photos for all to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values
  (
    'student-files',
    'student-files',
    false,
    10485760,
    array[
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-powerpoint',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'text/plain',
      'text/csv',
      'image/jpeg',
      'image/png',
      'image/webp'
    ]
  ),
  (
    'internship-photos',
    'internship-photos',
    false,
    10485760,
    array['image/jpeg', 'image/png', 'image/webp']
  )
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Students read their own private objects" on storage.objects;
create policy "Students read their own private objects"
on storage.objects for select to authenticated
using (
  bucket_id in ('student-files', 'internship-photos')
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

drop policy if exists "Students upload their own private objects" on storage.objects;
create policy "Students upload their own private objects"
on storage.objects for insert to authenticated
with check (
  bucket_id in ('student-files', 'internship-photos')
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

drop policy if exists "Students update their own private objects" on storage.objects;
create policy "Students update their own private objects"
on storage.objects for update to authenticated
using (
  bucket_id in ('student-files', 'internship-photos')
  and owner_id = (select auth.uid())::text
  and (storage.foldername(name))[1] = (select auth.uid())::text
)
with check (
  bucket_id in ('student-files', 'internship-photos')
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

drop policy if exists "Students delete their own private objects" on storage.objects;
create policy "Students delete their own private objects"
on storage.objects for delete to authenticated
using (
  bucket_id in ('student-files', 'internship-photos')
  and owner_id = (select auth.uid())::text
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

commit;
