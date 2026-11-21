-- =============================================================================
-- Platform SPC — Admin Classes, Class Codes & Student Enrollment Management
-- Run ONCE in Supabase SQL Editor (after admin_approval_crud.sql & admin_security_hardening.sql).
--
-- Gives the Admin full visibility and control over:
--   1) Viewing ALL classes, teachers, enrolled students, and ALL class invite codes
--   2) Adding or removing any student from any specific class
--   3) Creating or deleting classes for any teacher
-- =============================================================================

-- 1. Admin RLS policies on classes & class_members
drop policy if exists "classes_admin_all" on public.classes;
create policy "classes_admin_all" on public.classes
  for all using (public.is_admin_user())
  with check (public.is_admin_user());

drop policy if exists "class_members_admin_all" on public.class_members;
create policy "class_members_admin_all" on public.class_members
  for all using (public.is_admin_user())
  with check (public.is_admin_user());

-- 2. RPC: List ALL classes with invite codes, teachers, and enrolled students
create or replace function public.admin_list_all_classes()
returns table (
  id uuid,
  name text,
  level text,
  invite_code text,
  color text,
  teacher_id uuid,
  teacher_name text,
  teacher_email text,
  created_at timestamptz,
  students jsonb
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin_user() then
    raise exception 'Accès réservé aux administrateurs';
  end if;

  return query
  select
    c.id,
    c.name,
    c.level,
    c.invite_code,
    c.color,
    c.teacher_id,
    coalesce(
      nullif(trim(coalesce(tp.first_name, '') || ' ' || coalesce(tp.last_name, '')), ''),
      tp.email,
      'Enseignant'
    ) as teacher_name,
    coalesce(tp.email, '') as teacher_email,
    c.created_at,
    coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'id', sp.id,
            'firstName', sp.first_name,
            'lastName', sp.last_name,
            'email', sp.email,
            'level', sp.level,
            'joinedAt', cm.joined_at
          )
          order by sp.last_name asc, sp.first_name asc
        )
        from public.class_members cm
        join public.profiles sp on sp.id = cm.student_id
        where cm.class_id = c.id
      ),
      '[]'::jsonb
    ) as students
  from public.classes c
  left join public.profiles tp on tp.id = c.teacher_id
  order by c.created_at desc;
end;
$$;

-- 3. RPC: Admin adds a specific student to a specific class
create or replace function public.admin_add_student_to_class(
  p_class_id uuid,
  p_student_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_class record;
  v_student record;
begin
  if not public.is_admin_user() then
    return jsonb_build_object('ok', false, 'error', 'Accès réservé aux administrateurs.');
  end if;

  select id, name into v_class from public.classes where id = p_class_id;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'Classe introuvable.');
  end if;

  select id, default_role into v_student from public.profiles where id = p_student_id;
  if not found or v_student.default_role <> 'student' then
    return jsonb_build_object('ok', false, 'error', 'Compte élève introuvable.');
  end if;

  insert into public.class_members (class_id, student_id)
  values (p_class_id, p_student_id)
  on conflict (class_id, student_id) do nothing;

  return jsonb_build_object('ok', true, 'class_name', v_class.name);
end;
$$;

-- 4. RPC: Admin removes a student from a specific class
create or replace function public.admin_remove_student_from_class(
  p_class_id uuid,
  p_student_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin_user() then
    return jsonb_build_object('ok', false, 'error', 'Accès réservé aux administrateurs.');
  end if;

  delete from public.class_members
  where class_id = p_class_id and student_id = p_student_id;

  return jsonb_build_object('ok', true);
end;
$$;

-- 5. RPC: Admin creates a class for any teacher (with auto or custom invite code)
create or replace function public.admin_create_class(
  p_name text,
  p_level text,
  p_teacher_id uuid,
  p_invite_code text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_code text;
  v_class_id uuid;
begin
  if not public.is_admin_user() then
    return jsonb_build_object('ok', false, 'error', 'Accès réservé aux administrateurs.');
  end if;

  if trim(coalesce(p_name, '')) = '' then
    return jsonb_build_object('ok', false, 'error', 'Veuillez saisir un nom de classe.');
  end if;

  if p_level not in ('Seconde', 'Première', 'Terminale') then
    return jsonb_build_object('ok', false, 'error', 'Niveau scolaire invalide.');
  end if;

  if not exists (
    select 1 from public.profiles
    where id = p_teacher_id and default_role in ('teacher', 'org_admin', 'platform_admin')
  ) then
    return jsonb_build_object('ok', false, 'error', 'Enseignant introuvable.');
  end if;

  v_code := upper(trim(coalesce(p_invite_code, '')));
  if v_code = '' then
    v_code := 'PHY-' || to_char(now(), 'YYYY') || '-' || upper(substr(md5(random()::text), 1, 5));
  end if;

  if exists (select 1 from public.classes where upper(invite_code) = v_code) then
    return jsonb_build_object('ok', false, 'error', 'Ce code de classe est déjà utilisé.');
  end if;

  insert into public.classes (teacher_id, name, level, invite_code)
  values (p_teacher_id, trim(p_name), p_level, v_code)
  returning id into v_class_id;

  return jsonb_build_object('ok', true, 'class_id', v_class_id, 'invite_code', v_code);
end;
$$;

-- 6. RPC: Admin deletes a class
create or replace function public.admin_delete_class(p_class_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin_user() then
    return jsonb_build_object('ok', false, 'error', 'Accès réservé aux administrateurs.');
  end if;

  delete from public.classes where id = p_class_id;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'Classe introuvable.');
  end if;

  return jsonb_build_object('ok', true);
end;
$$;

grant execute on function public.admin_list_all_classes() to authenticated;
grant execute on function public.admin_add_student_to_class(uuid, uuid) to authenticated;
grant execute on function public.admin_remove_student_from_class(uuid, uuid) to authenticated;
grant execute on function public.admin_create_class(text, text, uuid, text) to authenticated;
grant execute on function public.admin_delete_class(uuid) to authenticated;
