-- Add teacher-controlled retry toggle on assignments
alter table public.assignments
  add column if not exists allow_retry boolean not null default true;
