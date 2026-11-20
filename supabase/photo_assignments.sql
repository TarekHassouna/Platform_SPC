-- Enable teacher-announced handwritten copy drops ('photo_copy') with an editable AI reference correction/rubric
alter table public.assignments
  add column if not exists submission_type text not null default 'online',
  add column if not exists reference_correction text default null;
