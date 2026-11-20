-- Allow teacher/tutor to choose whether students can view hints (💡 Indice) on an assignment
alter table public.assignments
  add column if not exists allow_hints boolean not null default true;
