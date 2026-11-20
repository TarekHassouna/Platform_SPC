-- Allow teachers to manually edit/override grades & comments on their own class students' submissions
drop policy if exists "eval_results_teacher_update" on public.evaluation_results;
create policy "eval_results_teacher_update" on public.evaluation_results
  for update using (
    exists (
      select 1
      from public.submissions s
      join public.class_members cm on cm.student_id = s.student_id
      join public.classes c on c.id = cm.class_id
      where s.id = evaluation_results.submission_id
        and c.teacher_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from public.submissions s
      join public.class_members cm on cm.student_id = s.student_id
      join public.classes c on c.id = cm.class_id
      where s.id = evaluation_results.submission_id
        and c.teacher_id = auth.uid()
    )
  );

drop policy if exists "eval_results_teacher_insert" on public.evaluation_results;
create policy "eval_results_teacher_insert" on public.evaluation_results
  for insert with check (
    exists (
      select 1
      from public.submissions s
      join public.class_members cm on cm.student_id = s.student_id
      join public.classes c on c.id = cm.class_id
      where s.id = evaluation_results.submission_id
        and c.teacher_id = auth.uid()
    )
  );
