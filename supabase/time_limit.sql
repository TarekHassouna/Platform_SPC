-- Allow teacher/tutor to set an optional countdown timer (in minutes) on any quiz/exam assignment
-- NULL or 0 means unlimited time; > 0 auto-submits and saves student work when time expires
alter table public.assignments
  add column if not exists time_limit_minutes integer default null;
