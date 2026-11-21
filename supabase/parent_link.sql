-- =============================================================================
-- Platform SPC — Parent ↔ Student Instant Linking RPC + Read-Only RLS Policies
-- Run once in Supabase SQL Editor.
-- Works in BOTH orders:
--   1) Student signs up first -> Parent links instantly via child's email!
--   2) Parent invites child's email first -> Student signs up later -> auto-linked!
-- =============================================================================

-- 1. Recursion-safe helper to verify parent-child link
create or replace function public.is_parent_of_student(p_student_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.parent_child_links pcl
    where pcl.parent_id = auth.uid()
      and pcl.student_id = p_student_id
      and pcl.status = 'linked'
  );
$$;

-- 2. Secure RPC: Link logged-in parent to a child by student's email (instant if student already exists, pending otherwise)
create or replace function public.link_parent_to_child_by_email(
  p_child_email text,
  p_child_name text default null,
  p_child_level text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text;
  v_student record;
  v_existing record;
  v_link_id uuid;
  v_final_name text;
  v_final_level text;
begin
  if auth.uid() is null then
    return jsonb_build_object('ok', false, 'error', 'Non authentifié');
  end if;

  v_email := lower(trim(coalesce(p_child_email, '')));
  if v_email = '' or position('@' in v_email) = 0 then
    return jsonb_build_object('ok', false, 'error', 'Veuillez saisir une adresse e-mail valide pour votre enfant.');
  end if;

  -- Check if student account already exists
  select id, first_name, last_name, level, email
  into v_student
  from public.profiles
  where lower(email) = v_email
    and default_role = 'student'
  limit 1;

  v_final_name := coalesce(
    nullif(trim(coalesce(v_student.first_name, '') || ' ' || coalesce(v_student.last_name, '')), ''),
    nullif(trim(coalesce(p_child_name, '')), ''),
    split_part(v_email, '@', 1)
  );
  v_final_level := coalesce(
    nullif(v_student.level, ''),
    nullif(trim(coalesce(p_child_level, '')), ''),
    'Terminale'
  );

  -- Check if this parent already has a link for this email or student
  select id into v_existing
  from public.parent_child_links
  where parent_id = auth.uid()
    and (
      lower(coalesce(invited_child_email, '')) = v_email
      or (v_student.id is not null and student_id = v_student.id)
    )
  limit 1;

  if v_existing.id is not null then
    update public.parent_child_links
    set
      student_id = coalesce(v_student.id, student_id),
      invited_child_email = v_email,
      invited_child_name = v_final_name,
      invited_child_level = v_final_level,
      status = case when v_student.id is not null then 'linked' else status end,
      parental_consent_given = true
    where id = v_existing.id
    returning id into v_link_id;
  else
    insert into public.parent_child_links (
      parent_id,
      student_id,
      invited_child_name,
      invited_child_email,
      invited_child_level,
      status,
      parental_consent_given
    )
    values (
      auth.uid(),
      v_student.id,
      v_final_name,
      v_email,
      v_final_level,
      case when v_student.id is not null then 'linked' else 'pending' end,
      true
    )
    returning id into v_link_id;
  end if;

  return jsonb_build_object(
    'ok', true,
    'link_id', v_link_id,
    'linked', (v_student.id is not null),
    'student_id', v_student.id,
    'child_name', v_final_name,
    'child_email', v_email,
    'child_level', v_final_level
  );
end;
$$;

grant execute on function public.is_parent_of_student(uuid) to authenticated;
grant execute on function public.link_parent_to_child_by_email(text, text, text) to authenticated;

-- 3. Parent read-only RLS policies for linked child's classes, assignments, submissions, grades & mastery
-- (Note: tutor_sessions & tutor_messages remain strictly private to the student!)

drop policy if exists "class_members_parent_read" on public.class_members;
create policy "class_members_parent_read" on public.class_members
  for select using (public.is_parent_of_student(student_id));

drop policy if exists "classes_parent_read" on public.classes;
create policy "classes_parent_read" on public.classes
  for select using (
    exists (
      select 1
      from public.class_members cm
      where cm.class_id = classes.id
        and public.is_parent_of_student(cm.student_id)
    )
  );

drop policy if exists "assignments_parent_read" on public.assignments;
create policy "assignments_parent_read" on public.assignments
  for select using (
    exists (
      select 1
      from public.class_members cm
      where cm.class_id = assignments.class_id
        and public.is_parent_of_student(cm.student_id)
    )
  );

drop policy if exists "submissions_parent_read" on public.submissions;
create policy "submissions_parent_read" on public.submissions
  for select using (public.is_parent_of_student(student_id));

drop policy if exists "eval_results_parent_read" on public.evaluation_results;
create policy "eval_results_parent_read" on public.evaluation_results
  for select using (
    exists (
      select 1 from public.submissions s
      where s.id = evaluation_results.submission_id
        and public.is_parent_of_student(s.student_id)
    )
  );

drop policy if exists "mastery_parent_read" on public.concept_mastery;
create policy "mastery_parent_read" on public.concept_mastery
  for select using (public.is_parent_of_student(student_id));
