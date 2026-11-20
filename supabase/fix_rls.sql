-- =============================================================================
-- Platform SPC — Fix RLS Infinite Recursion on classes / class_members / memberships
-- Run ONCE in Supabase SQL Editor.
-- =============================================================================

-- 1. SECURITY DEFINER helper functions (bypass cyclic RLS safely)
create or replace function public.is_teacher_of_class(p_class_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.classes
    where id = p_class_id and teacher_id = auth.uid()
  );
$$;

create or replace function public.is_student_in_class(p_class_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.class_members
    where class_id = p_class_id and student_id = auth.uid()
  );
$$;

create or replace function public.is_org_admin(p_org_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.memberships
    where organization_id = p_org_id
      and user_id = auth.uid()
      and role = 'org_admin'
  );
$$;

grant execute on function public.is_teacher_of_class(uuid) to authenticated;
grant execute on function public.is_student_in_class(uuid) to authenticated;
grant execute on function public.is_org_admin(uuid) to authenticated;

-- 2. Replace cyclic policies on classes & class_members
drop policy if exists "classes_teacher_all" on public.classes;
create policy "classes_teacher_all" on public.classes
  for all using (teacher_id = auth.uid())
  with check (teacher_id = auth.uid());

drop policy if exists "classes_student_select" on public.classes;
create policy "classes_student_select" on public.classes
  for select using (public.is_student_in_class(id));

drop policy if exists "class_members_select" on public.class_members;
create policy "class_members_select" on public.class_members
  for select using (
    student_id = auth.uid()
    or public.is_teacher_of_class(class_id)
  );

-- 3. Replace self-referencing policies on memberships
drop policy if exists "memberships_select_own_or_admin" on public.memberships;
create policy "memberships_select_own_or_admin" on public.memberships
  for select using (
    user_id = auth.uid()
    or public.is_org_admin(organization_id)
  );

drop policy if exists "memberships_insert_self_or_admin" on public.memberships;
create policy "memberships_insert_self_or_admin" on public.memberships
  for insert with check (
    user_id = auth.uid()
    or public.is_org_admin(organization_id)
  );
