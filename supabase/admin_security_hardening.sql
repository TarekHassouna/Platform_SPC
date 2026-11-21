-- =============================================================================
-- Platform SPC — MAXIMUM SECURITY Admin Hardening Migration
-- Run ONCE in Supabase SQL Editor (after supabase/admin_approval_crud.sql).
--
-- What this enforces at the PostgreSQL database level:
--   1) ZERO public admin signup: handle_new_user() rejects 'org_admin' and
--      'platform_admin' from ANY signup/API payload and forces 'student' + 'pending'.
--   2) Strict Email Allowlist (public.admin_emails): ONLY emails explicitly
--      inserted from the Supabase SQL Editor can ever pass is_admin_user().
--   3) No privilege escalation via admin_update_user() unless the email is in
--      public.admin_emails.
--
-- AFTER RUNNING THIS SCRIPT, promote YOUR admin account by running:
--
--   insert into public.admin_emails (email)
--   values (lower('YOUR_ADMIN_EMAIL@example.com'))
--   on conflict (email) do nothing;
--
--   update public.profiles
--   set default_role = 'platform_admin', account_status = 'approved'
--   where lower(email) = lower('YOUR_ADMIN_EMAIL@example.com');
-- =============================================================================

-- 1. Private Admin Email Allowlist table (RLS enabled, ZERO public policies!)
create table if not exists public.admin_emails (
  email text primary key check (email = lower(trim(email))),
  created_at timestamptz not null default now()
);

alter table public.admin_emails enable row level security;

-- Revoke direct client access so anon/authenticated roles cannot read or modify it
revoke all on table public.admin_emails from anon, authenticated;

-- 2. Harden is_admin_user() to require:
--    a) profiles.default_role in ('org_admin', 'platform_admin')
--    b) profiles.account_status = 'approved'
--    c) profiles.email exists in public.admin_emails (once at least 1 admin email is registered)
create or replace function public.is_admin_user()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.default_role in ('org_admin', 'platform_admin')
      and p.account_status = 'approved'
      and (
        not exists (select 1 from public.admin_emails)
        or exists (
          select 1
          from public.admin_emails ae
          where lower(ae.email) = lower(p.email)
        )
      )
  );
$$;

grant execute on function public.is_admin_user() to authenticated;

-- 3. Lock handle_new_user() so NO public signup can EVER create an Admin account
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text;
  v_level text;
begin
  -- Strictly allow ONLY student, teacher, or parent from public signups
  v_role := coalesce(new.raw_user_meta_data->>'role', 'student');
  if v_role not in ('student', 'parent', 'teacher') then
    v_role := 'student';
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
    'pending',
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

-- 4. Harden admin_update_user() so nobody can promote a non-allowlisted user to Admin
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
  v_target_email text;
begin
  if not public.is_admin_user() then
    return jsonb_build_object('ok', false, 'error', 'Accès réservé aux administrateurs.');
  end if;

  select email into v_target_email from public.profiles where id = p_user_id;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'Utilisateur introuvable.');
  end if;

  if p_role is not null then
    if p_role not in ('student', 'teacher', 'parent', 'org_admin', 'platform_admin') then
      return jsonb_build_object('ok', false, 'error', 'Rôle invalide.');
    end if;
    -- Promoting to Admin requires the email to already be in public.admin_emails
    if p_role in ('org_admin', 'platform_admin') then
      if not exists (
        select 1 from public.admin_emails ae where lower(ae.email) = lower(v_target_email)
      ) then
        return jsonb_build_object(
          'ok', false,
          'error', 'Promotion administrateur bloquée : ajoutez d''abord cet e-mail dans public.admin_emails via Supabase SQL Editor.'
        );
      end if;
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

  return jsonb_build_object('ok', true);
end;
$$;

grant execute on function public.admin_update_user(uuid, text, text, text, text, text) to authenticated;
