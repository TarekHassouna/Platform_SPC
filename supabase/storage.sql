-- =============================================================================
-- Platform SPC — Storage Bucket + Student Mastery Write Policies
-- Run in Supabase SQL Editor (after schema.sql & seed.sql).
-- =============================================================================

-- 1. Allow authenticated students to write their own evaluation_results, error_records & concept_mastery
drop policy if exists "eval_results_student_insert" on public.evaluation_results;
create policy "eval_results_student_insert" on public.evaluation_results for all using (
  exists (
    select 1 from public.submissions s
    where s.id = evaluation_results.submission_id and s.student_id = auth.uid()
  )
);

alter table public.error_records enable row level security;
drop policy if exists "error_records_student_all" on public.error_records;
create policy "error_records_student_all" on public.error_records for all using (
  exists (
    select 1 from public.evaluation_results er
    join public.submissions s on s.id = er.submission_id
    where er.id = error_records.evaluation_result_id and s.student_id = auth.uid()
  )
);

drop policy if exists "mastery_student_write" on public.concept_mastery;
create policy "mastery_student_write" on public.concept_mastery for all using (student_id = auth.uid());

-- 2. Create Private Storage Bucket for handwritten student photos (auto-delete policy §14)
insert into storage.buckets (id, name, public)
values ('student-photos', 'student-photos', false)
on conflict (id) do nothing;

-- Students can only upload & read photos inside their own folder: <user_id>/...
drop policy if exists "student_photos_own_upload" on storage.objects;
create policy "student_photos_own_upload" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'student-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "student_photos_own_read" on storage.objects;
create policy "student_photos_own_read" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'student-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "student_photos_own_delete" on storage.objects;
create policy "student_photos_own_delete" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'student-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
