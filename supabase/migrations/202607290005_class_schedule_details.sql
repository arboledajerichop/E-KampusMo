begin;

alter table public.subjects
  add column if not exists class_code text not null default '';

alter table public.subjects
  drop constraint if exists subjects_class_code_length;

alter table public.subjects
  add constraint subjects_class_code_length
  check (char_length(class_code) <= 80);

commit;
