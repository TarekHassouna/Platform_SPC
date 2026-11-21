-- =============================================================================
-- Platform SPC — School Scale Upgrades:
--   1) Admin Bulk Actions (Bulk Approve Accounts & Bulk Assign Students to Class)
--   2) Class Announcements & Course PDF / Revision Sheet Uploads
-- Run ONCE in Supabase SQL Editor.
-- =============================================================================

-- 1. Admin Bulk Approve Accounts (selected IDs, or ALL pending accounts if NULL)
create or replace function public.admin_bulk_approve_users(
  p_user_ids uuid[] default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  if not public.is_admin_user() then
    return jsonb_build_object('ok', false, 'error', 'Accès réservé aux administrateurs.');
  end if;

  if p_user_ids is null or array_length(p_user_ids, 1) is null then
    update public.profiles
    set account_status = 'approved', updated_at = now()
    where account_status = 'pending';
  else
    update public.profiles
    set account_status = 'approved', updated_at = now()
    where id = any(p_user_ids)
      and account_status <> 'approved';
  end if;

  get diagnostics v_count = row_count;
  return jsonb_build_object('ok', true, 'approved_count', v_count);
end;
$$;

-- 2. Admin Bulk Assign Multiple Students to a Specific Class
create or replace function public.admin_bulk_add_students_to_class(
  p_class_id uuid,
  p_student_ids uuid[]
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_class record;
  v_count integer;
begin
  if not public.is_admin_user() then
    return jsonb_build_object('ok', false, 'error', 'Accès réservé aux administrateurs.');
  end if;

  select id, name into v_class from public.classes where id = p_class_id;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'Classe introuvable.');
  end if;

  if p_student_ids is null or array_length(p_student_ids, 1) is null then
    return jsonb_build_object('ok', false, 'error', 'Aucun élève sélectionné.');
  end if;

  insert into public.class_members (class_id, student_id)
  select p_class_id, p.id
  from public.profiles p
  where p.id = any(p_student_ids)
    and p.default_role = 'student'
  on conflict (class_id, student_id) do nothing;

  get diagnostics v_count = row_count;
  return jsonb_build_object('ok', true, 'added_count', v_count, 'class_name', v_class.name);
end;
$$;

grant execute on function public.admin_bulk_approve_users(uuid[]) to authenticated;
grant execute on function public.admin_bulk_add_students_to_class(uuid, uuid[]) to authenticated;

-- 3. Class Announcements & Course PDFs / Revision Sheets
create table if not exists public.class_announcements (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes(id) on delete cascade,
  teacher_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  body text not null default '',
  attachment_path text,
  attachment_name text,
  is_pinned boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists idx_class_announcements_class_created
  on public.class_announcements(class_id, is_pinned desc, created_at desc);

alter table public.class_announcements enable row level security;

drop policy if exists "announcements_teacher_manage" on public.class_announcements;
create policy "announcements_teacher_manage" on public.class_announcements
  for all using (
    teacher_id = auth.uid()
    or public.is_teacher_of_class(class_id)
    or public.is_admin_user()
  )
  with check (
    teacher_id = auth.uid()
    or public.is_teacher_of_class(class_id)
    or public.is_admin_user()
  );

drop policy if exists "announcements_student_read" on public.class_announcements;
create policy "announcements_student_read" on public.class_announcements
  for select using (
    public.is_student_in_class(class_id)
  );

drop policy if exists "announcements_parent_read" on public.class_announcements;
create policy "announcements_parent_read" on public.class_announcements
  for select using (
    exists (
      select 1
      from public.class_members cm
      where cm.class_id = class_announcements.class_id
        and public.is_parent_of_student(cm.student_id)
    )
  );

grant select, insert, update, delete on public.class_announcements to authenticated;

-- 4. Private Storage Bucket `course-files` for Course PDFs & Revision Sheets (up to 15 MB)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'course-files',
  'course-files',
  false,
  15728640,
  array['application/pdf', 'image/png', 'image/jpeg', 'image/webp']
)
on conflict (id) do nothing;

drop policy if exists "course_files_teacher_upload" on storage.objects;
create policy "course_files_teacher_upload" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'course-files'
    and exists (
      select 1 from public.profiles
      where id = auth.uid()
        and default_role in ('teacher', 'org_admin', 'platform_admin')
        and account_status = 'approved'
    )
  );

drop policy if exists "course_files_auth_read" on storage.objects;
create policy "course_files_auth_read" on storage.objects
  for select to authenticated
  using (bucket_id = 'course-files');

drop policy if exists "course_files_owner_delete" on storage.objects;
create policy "course_files_owner_delete" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'course-files'
    and (
      owner = auth.uid()
      or public.is_admin_user()
    )
  );
