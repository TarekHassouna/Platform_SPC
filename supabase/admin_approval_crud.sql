-- =============================================================================
-- Platform SPC — Admin Full CRUD, Account Approval Gate & Parent-Student Link Gate
-- Run ONCE in Supabase SQL Editor.
--
-- What this migration enables:
--   1) Every NEW Student, Teacher/Tutor, or Parent signup starts with
--      account_status = 'pending' and is blocked until Admin approves it.
--      (Existing accounts stay 'approved' so current users are not locked out.)
--   2) Parents CANNOT connect to any student directly: requests start as
--      status = 'pending_admin' and unlock child data ONLY after Admin approves.
--   3) Admin CRUD RPCs for listing, creating, approving, rejecting, editing,
--      and deleting Students, Teachers/Tutors, Parents, and Parent-Student links.
-- =============================================================================

-- 1. Add account_status column to public.profiles (existing users stay 'approved')
alter table public.profiles
  add column if not exists account_status text not null default 'approved';

alter table public.profiles
  drop constraint if exists profiles_account_status_check;

alter table public.profiles
  add constraint profiles_account_status_check
  check (account_status in ('pending', 'approved', 'rejected'));

-- 2. Expand parent_child_links.status constraint to support pending_admin & rejected
do $$
declare
  v_con record;
begin
  for v_con in
    select conname
    from pg_constraint
    where conrelid = 'public.parent_child_links'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%status%'
  loop
    execute format('alter table public.parent_child_links drop constraint %I', v_con.conname);
  end loop;
end $$;

alter table public.parent_child_links
  add constraint parent_child_links_status_check
  check (status in ('pending_admin', 'pending', 'linked', 'rejected', 'revoked'));

-- 3. Recursion-safe Admin & Parent helpers
create or replace function public.is_admin_user()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and default_role in ('org_admin', 'platform_admin')
      and account_status = 'approved'
  );
$$;

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

grant execute on function public.is_admin_user() to authenticated;
grant execute on function public.is_parent_of_student(uuid) to authenticated;

-- 4. Prevent non-admin users from self-approving or escalating themselves to admin
create or replace function public.protect_profile_sensitive_columns()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is not null and not public.is_admin_user() then
    new.account_status := old.account_status;
    if new.default_role in ('org_admin', 'platform_admin')
       and old.default_role not in ('org_admin', 'platform_admin') then
      new.default_role := old.default_role;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_protect_profile_sensitive_columns on public.profiles;
create trigger trg_protect_profile_sensitive_columns
  before update on public.profiles
  for each row execute procedure public.protect_profile_sensitive_columns();

-- 5. Update handle_new_user() trigger:
--    - New student / teacher / parent accounts start as 'pending' (sent to Admin!)
--    - Admin accounts start as 'approved'
--    - Matching parent requests stay 'pending_admin' until Admin explicitly approves
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text;
  v_status text;
  v_level text;
begin
  v_role := coalesce(new.raw_user_meta_data->>'role', 'student');
  if v_role not in ('student', 'parent', 'teacher', 'org_admin', 'platform_admin') then
    v_role := 'student';
  end if;

  if v_role in ('org_admin', 'platform_admin') then
    v_status := 'approved';
  else
    v_status := 'pending';
  end if;

  v_level := nullif(new.raw_user_meta_data->>'level', '');
  if v_level not in ('Seconde', 'Première', 'Terminale') then
    v_level := null;
  end if;

  insert into public.profiles (
    id, email, first_name, last_name, default_role, level, account_status, gdpr_consent_at
  )
  values (
    new.id,
    new.email,
    coalesce(nullif(new.raw_user_meta_data->>'firstName', ''), split_part(new.email, '@', 1)),
    coalesce(new.raw_user_meta_data->>'lastName', ''),
    v_role,
    v_level,
    v_status,
    now()
  )
  on conflict (id) do update set
    first_name = excluded.first_name,
    last_name = excluded.last_name,
    level = coalesce(excluded.level, public.profiles.level),
    updated_at = now();

  -- If a parent already requested this student's email, attach student_id
  -- while keeping status = 'pending_admin' so Admin MUST still approve!
  if v_role = 'student' then
    update public.parent_child_links
    set student_id = new.id
    where lower(invited_child_email) = lower(new.email)
      and status in ('pending', 'pending_admin');
  end if;

  return new;
end;
$$;

-- 6. Update Parent -> Student link request RPC:
--    NEVER auto-links! Always sets status = 'pending_admin' until Admin accepts.
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
    case when p_child_level in ('Seconde', 'Première', 'Terminale') then p_child_level else null end,
    'Terminale'
  );

  select id, status into v_existing
  from public.parent_child_links
  where parent_id = auth.uid()
    and (
      lower(coalesce(invited_child_email, '')) = v_email
      or (v_student.id is not null and student_id = v_student.id)
    )
  limit 1;

  if v_existing.id is not null then
    if v_existing.status = 'linked' then
      return jsonb_build_object(
        'ok', true,
        'link_id', v_existing.id,
        'status', 'linked',
        'linked', true,
        'student_found', true,
        'child_name', v_final_name,
        'child_email', v_email,
        'child_level', v_final_level
      );
    end if;

    update public.parent_child_links
    set
      student_id = coalesce(v_student.id, student_id),
      invited_child_email = v_email,
      invited_child_name = v_final_name,
      invited_child_level = v_final_level,
      status = 'pending_admin',
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
      'pending_admin',
      true
    )
    returning id into v_link_id;
  end if;

  return jsonb_build_object(
    'ok', true,
    'link_id', v_link_id,
    'status', 'pending_admin',
    'linked', false,
    'student_found', (v_student.id is not null),
    'child_name', v_final_name,
    'child_email', v_email,
    'child_level', v_final_level
  );
end;
$$;

grant execute on function public.link_parent_to_child_by_email(text, text, text) to authenticated;

-- 7. Lock down parent_child_links RLS so parents can NEVER self-approve a link
drop policy if exists "parent_links_manage" on public.parent_child_links;
drop policy if exists "parent_links_select" on public.parent_child_links;
drop policy if exists "parent_links_insert_pending" on public.parent_child_links;
drop policy if exists "parent_links_delete_own_or_admin" on public.parent_child_links;
drop policy if exists "parent_links_admin_all" on public.parent_child_links;

create policy "parent_links_select" on public.parent_child_links
  for select using (
    parent_id = auth.uid()
    or student_id = auth.uid()
    or public.is_admin_user()
  );

create policy "parent_links_insert_pending" on public.parent_child_links
  for insert with check (
    (parent_id = auth.uid() and status in ('pending_admin', 'pending'))
    or public.is_admin_user()
  );

create policy "parent_links_delete_own_or_admin" on public.parent_child_links
  for delete using (
    parent_id = auth.uid()
    or public.is_admin_user()
  );

create policy "parent_links_admin_all" on public.parent_child_links
  for update using (public.is_admin_user())
  with check (public.is_admin_user());

-- Also allow admins to read/update/delete profiles directly when needed
drop policy if exists "profiles_admin_all" on public.profiles;
create policy "profiles_admin_all" on public.profiles
  for all using (public.is_admin_user())
  with check (public.is_admin_user());

-- 8. Admin CRUD RPCs for ALL users (Students, Teachers/Tutors, Parents, Admins)

create or replace function public.admin_list_all_users()
returns table (
  id uuid,
  email text,
  first_name text,
  last_name text,
  default_role text,
  level text,
  account_status text,
  created_at timestamptz
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
    p.id,
    p.email,
    p.first_name,
    p.last_name,
    p.default_role,
    p.level,
    p.account_status,
    p.created_at
  from public.profiles p
  order by
    case p.account_status when 'pending' then 0 when 'rejected' then 1 else 2 end,
    p.created_at desc;
end;
$$;

create or replace function public.admin_update_user(
  p_user_id uuid,
  p_first_name text default null,
  p_last_name text default null,
  p_role text default null,
  p_level text default null,
  p_account_status text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_clean_role text;
  v_clean_status text;
  v_clean_level text;
begin
  if not public.is_admin_user() then
    return jsonb_build_object('ok', false, 'error', 'Accès réservé aux administrateurs.');
  end if;

  if p_role is not null then
    if p_role not in ('student', 'teacher', 'parent', 'org_admin', 'platform_admin') then
      return jsonb_build_object('ok', false, 'error', 'Rôle invalide.');
    end if;
    v_clean_role := p_role;
  end if;

  if p_account_status is not null then
    if p_account_status not in ('pending', 'approved', 'rejected') then
      return jsonb_build_object('ok', false, 'error', 'Statut invalide.');
    end if;
    v_clean_status := p_account_status;
  end if;

  if p_level is not null and trim(p_level) <> '' then
    if p_level not in ('Seconde', 'Première', 'Terminale') then
      return jsonb_build_object('ok', false, 'error', 'Niveau scolaire invalide.');
    end if;
    v_clean_level := p_level;
  end if;

  update public.profiles
  set
    first_name = coalesce(nullif(trim(p_first_name), ''), first_name),
    last_name = case when p_last_name is not null then trim(p_last_name) else last_name end,
    default_role = coalesce(v_clean_role, default_role),
    level = case
      when coalesce(v_clean_role, default_role) = 'student' then coalesce(v_clean_level, level)
      when p_level is not null and trim(p_level) = '' then null
      else level
    end,
    account_status = coalesce(v_clean_status, account_status),
    updated_at = now()
  where id = p_user_id;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'Utilisateur introuvable.');
  end if;

  return jsonb_build_object('ok', true);
end;
$$;

create or replace function public.admin_delete_user(p_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin_user() then
    return jsonb_build_object('ok', false, 'error', 'Accès réservé aux administrateurs.');
  end if;

  if p_user_id = auth.uid() then
    return jsonb_build_object('ok', false, 'error', 'Vous ne pouvez pas supprimer votre propre compte administrateur.');
  end if;

  begin
    delete from auth.users where id = p_user_id;
  exception when insufficient_privilege then
    delete from public.profiles where id = p_user_id;
  end;

  -- Ensure profile is deleted if auth.users row was already missing
  delete from public.profiles where id = p_user_id;

  return jsonb_build_object('ok', true);
end;
$$;

-- 9. Admin CRUD RPCs for Parent <-> Student link requests

create or replace function public.admin_list_parent_links()
returns table (
  id uuid,
  parent_id uuid,
  parent_name text,
  parent_email text,
  student_id uuid,
  student_name text,
  student_email text,
  student_level text,
  student_account_exists boolean,
  status text,
  created_at timestamptz
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
    pcl.id,
    pcl.parent_id,
    trim(coalesce(pp.first_name, '') || ' ' || coalesce(pp.last_name, '')) as parent_name,
    coalesce(pp.email, '') as parent_email,
    coalesce(pcl.student_id, sp_mail.id) as student_id,
    coalesce(
      nullif(trim(coalesce(sp.first_name, '') || ' ' || coalesce(sp.last_name, '')), ''),
      nullif(trim(coalesce(sp_mail.first_name, '') || ' ' || coalesce(sp_mail.last_name, '')), ''),
      pcl.invited_child_name
    ) as student_name,
    coalesce(sp.email, sp_mail.email, pcl.invited_child_email, '') as student_email,
    coalesce(sp.level, sp_mail.level, pcl.invited_child_level, 'Lycée') as student_level,
    (coalesce(sp.id, sp_mail.id) is not null) as student_account_exists,
    pcl.status,
    pcl.created_at
  from public.parent_child_links pcl
  left join public.profiles pp on pp.id = pcl.parent_id
  left join public.profiles sp on sp.id = pcl.student_id
  left join public.profiles sp_mail
    on pcl.student_id is null
   and lower(sp_mail.email) = lower(coalesce(pcl.invited_child_email, ''))
   and sp_mail.default_role = 'student'
  order by
    case when pcl.status in ('pending_admin', 'pending') then 0 when pcl.status = 'linked' then 1 else 2 end,
    pcl.created_at desc;
end;
$$;

create or replace function public.admin_review_parent_link(
  p_link_id uuid,
  p_action text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_link record;
  v_student record;
begin
  if not public.is_admin_user() then
    return jsonb_build_object('ok', false, 'error', 'Accès réservé aux administrateurs.');
  end if;

  select * into v_link
  from public.parent_child_links
  where id = p_link_id;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'Demande de liaison introuvable.');
  end if;

  if p_action = 'delete' then
    delete from public.parent_child_links where id = p_link_id;
    return jsonb_build_object('ok', true, 'action', 'delete');
  end if;

  if p_action = 'reject' then
    update public.parent_child_links
    set status = 'rejected'
    where id = p_link_id;
    return jsonb_build_object('ok', true, 'action', 'reject');
  end if;

  if p_action = 'approve' then
    -- Resolve matching student profile (by existing student_id or invited_child_email)
    select id, first_name, last_name, email, level
    into v_student
    from public.profiles
    where (
      (v_link.student_id is not null and id = v_link.student_id)
      or (v_link.student_id is null and lower(email) = lower(coalesce(v_link.invited_child_email, '')))
    )
      and default_role = 'student'
    limit 1;

    if v_student.id is null then
      return jsonb_build_object(
        'ok', false,
        'error', 'Aucun compte élève trouvé pour cet e-mail. Créez ou vérifiez le compte élève avant d''approuver la liaison.'
      );
    end if;

    update public.parent_child_links
    set
      student_id = v_student.id,
      invited_child_email = v_student.email,
      invited_child_name = coalesce(
        nullif(trim(coalesce(v_student.first_name, '') || ' ' || coalesce(v_student.last_name, '')), ''),
        v_link.invited_child_name
      ),
      invited_child_level = coalesce(v_student.level, v_link.invited_child_level),
      status = 'linked'
    where id = p_link_id;

    return jsonb_build_object('ok', true, 'action', 'approve', 'student_id', v_student.id);
  end if;

  return jsonb_build_object('ok', false, 'error', 'Action invalide.');
end;
$$;

create or replace function public.admin_create_parent_link(
  p_parent_id uuid,
  p_student_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_parent record;
  v_student record;
  v_existing_id uuid;
  v_link_id uuid;
begin
  if not public.is_admin_user() then
    return jsonb_build_object('ok', false, 'error', 'Accès réservé aux administrateurs.');
  end if;

  select id, default_role into v_parent
  from public.profiles
  where id = p_parent_id and default_role = 'parent';

  if not found then
    return jsonb_build_object('ok', false, 'error', 'Compte parent introuvable.');
  end if;

  select id, first_name, last_name, email, level into v_student
  from public.profiles
  where id = p_student_id and default_role = 'student';

  if not found then
    return jsonb_build_object('ok', false, 'error', 'Compte élève introuvable.');
  end if;

  select id into v_existing_id
  from public.parent_child_links
  where parent_id = p_parent_id
    and (student_id = p_student_id or lower(coalesce(invited_child_email, '')) = lower(v_student.email))
  limit 1;

  if v_existing_id is not null then
    update public.parent_child_links
    set
      student_id = v_student.id,
      invited_child_email = v_student.email,
      invited_child_name = trim(coalesce(v_student.first_name, '') || ' ' || coalesce(v_student.last_name, '')),
      invited_child_level = coalesce(v_student.level, 'Terminale'),
      status = 'linked',
      parental_consent_given = true
    where id = v_existing_id
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
      p_parent_id,
      v_student.id,
      trim(coalesce(v_student.first_name, '') || ' ' || coalesce(v_student.last_name, '')),
      v_student.email,
      coalesce(v_student.level, 'Terminale'),
      'linked',
      true
    )
    returning id into v_link_id;
  end if;

  return jsonb_build_object('ok', true, 'link_id', v_link_id);
end;
$$;

grant execute on function public.admin_list_all_users() to authenticated;
grant execute on function public.admin_update_user(uuid, text, text, text, text, text) to authenticated;
grant execute on function public.admin_delete_user(uuid) to authenticated;
grant execute on function public.admin_list_parent_links() to authenticated;
grant execute on function public.admin_review_parent_link(uuid, text) to authenticated;
grant execute on function public.admin_create_parent_link(uuid, uuid) to authenticated;
