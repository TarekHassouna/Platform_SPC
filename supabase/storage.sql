-- =============================================================================
-- Platform SPC — Storage Bucket + Complete Student/Teacher/Parent RLS Policies
-- Run in Supabase SQL Editor (after schema.sql & seed.sql).
-- =============================================================================

-- 1. Evaluation Results: students write/read own; teachers & linked parents read
drop policy if exists "eval_results_student_insert" on public.evaluation_results;
create policy "eval_results_student_insert" on public.evaluation_results for all using (
  exists (
    select 1 from public.submissions s
    where s.id = evaluation_results.submission_id and s.student_id = auth.uid()
  )
);

drop policy if exists "eval_results_teacher_parent_select" on public.evaluation_results;
create policy "eval_results_teacher_parent_select" on public.evaluation_results for select using (
  exists (
    select 1
    from public.submissions s
    join public.class_members cm on cm.student_id = s.student_id
    join public.classes c on c.id = cm.class_id
    where s.id = evaluation_results.submission_id and c.teacher_id = auth.uid()
  )
  or exists (
    select 1
    from public.submissions s
    join public.parent_child_links pcl on pcl.student_id = s.student_id
    where s.id = evaluation_results.submission_id
      and pcl.parent_id = auth.uid()
      and pcl.status = 'linked'
  )
);

-- 2. Error Records: students write/read own; teachers read class students
alter table public.error_records enable row level security;
drop policy if exists "error_records_student_all" on public.error_records;
create policy "error_records_student_all" on public.error_records for all using (
  exists (
    select 1 from public.evaluation_results er
    join public.submissions s on s.id = er.submission_id
    where er.id = error_records.evaluation_result_id and s.student_id = auth.uid()
  )
);

drop policy if exists "error_records_teacher_select" on public.error_records;
create policy "error_records_teacher_select" on public.error_records for select using (
  exists (
    select 1 from public.evaluation_results er
    join public.submissions s on s.id = er.submission_id
    join public.class_members cm on cm.student_id = s.student_id
    join public.classes c on c.id = cm.class_id
    where er.id = error_records.evaluation_result_id and c.teacher_id = auth.uid()
  )
);

-- 3. Concept Mastery: students write own
drop policy if exists "mastery_student_write" on public.concept_mastery;
create policy "mastery_student_write" on public.concept_mastery for all using (student_id = auth.uid());

-- 4. Exercise Versions: authors can insert/update versions of their own exercises
drop policy if exists "exercise_versions_author_write" on public.exercise_versions;
create policy "exercise_versions_author_write" on public.exercise_versions for all using (
  exists (
    select 1 from public.exercises e
    where e.id = exercise_versions.exercise_id and e.author_id = auth.uid()
  )
);

-- 5. Parent read access to their linked child's submissions
drop policy if exists "submissions_parent_read" on public.submissions;
create policy "submissions_parent_read" on public.submissions for select using (
  exists (
    select 1 from public.parent_child_links pcl
    where pcl.parent_id = auth.uid()
      and pcl.student_id = submissions.student_id
      and pcl.status = 'linked'
  )
);

-- 6. Private Storage Bucket for handwritten student photos (auto-delete §14)
insert into storage.buckets (id, name, public)
values ('student-photos', 'student-photos', false)
on conflict (id) do nothing;

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
