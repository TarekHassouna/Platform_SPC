-- Allow teacher/tutor to show or hide any assignment from students (prepare exams in advance or close access)
alter table public.assignments
  add column if not exists is_visible boolean not null default true;
