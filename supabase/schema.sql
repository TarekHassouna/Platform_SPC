-- =============================================================================
-- Platform SPC — Production Relational PostgreSQL / Supabase Schema
-- Covers Auth, Organizations, Multi-role Memberships, Parent-Child Links,
-- Multi-Class Rosters, Curriculum DAG, Versioned Exercises, Evaluations,
-- Adaptive Mastery, AI Tutor Sessions, Billing & Audit Logs (Vision §4–§14)
-- =============================================================================

create extension if not exists "pgcrypto";

-- =============================================================================
-- 1. IDENTITY, ORGANIZATIONS & MULTI-ROLE MEMBERSHIPS (§4, §11, §14)
-- =============================================================================

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  first_name text not null,
  last_name text not null default '',
  default_role text not null default 'student'
    check (default_role in ('student', 'parent', 'teacher', 'org_admin', 'platform_admin')),
  level text check (level in ('Seconde', 'Première', 'Terminale')),
  gdpr_consent_at timestamptz,
  photo_retention_days integer not null default 90 check (photo_retention_days in (30, 90)),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  invite_code text not null unique default ('ORG-' || upper(substr(md5(random()::text), 1, 6))),
  country text not null default 'FR',
  plan text not null default 'organization' check (plan in ('organization', 'enterprise')),
  seats_purchased integer not null default 30 check (seats_purchased > 0),
  billing_cycle text not null default 'yearly' check (billing_cycle in ('monthly', 'yearly')),
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

-- A single user can hold multiple roles across organizations (§4)
create table if not exists public.memberships (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  role text not null check (role in ('student', 'teacher', 'org_admin')),
  seat_assigned boolean not null default false,
  status text not null default 'active' check (status in ('invited', 'active', 'suspended')),
  created_at timestamptz not null default now(),
  unique (user_id, organization_id, role)
);

-- Relational Parent <-> Student linking (supports email invitations before child signs up)
create table if not exists public.parent_child_links (
  id uuid primary key default gen_random_uuid(),
  parent_id uuid not null references public.profiles(id) on delete cascade,
  student_id uuid references public.profiles(id) on delete cascade,
  invited_child_name text not null,
  invited_child_email text,
  invited_child_level text check (invited_child_level in ('Seconde', 'Première', 'Terminale')),
  status text not null default 'pending' check (status in ('pending', 'linked', 'revoked')),
  parental_consent_given boolean not null default true,
  created_at timestamptz not null default now()
);

-- Multi-class support for Teachers & Private Tutors (§11.1)
create table if not exists public.classes (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete set null,
  teacher_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  level text not null check (level in ('Seconde', 'Première', 'Terminale')),
  invite_code text not null unique,
  color text not null default 'from-indigo-500 to-violet-600',
  created_at timestamptz not null default now()
);

create table if not exists public.class_members (
  class_id uuid not null references public.classes(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (class_id, student_id)
);

-- =============================================================================
-- 2. CURRICULUM & PREREQUISITES DAG (§1.2, §5.3, §10)
-- =============================================================================

create table if not exists public.concepts (
  id uuid primary key default gen_random_uuid(),
  subject text not null default 'physique_chimie',
  level text not null check (level in ('Seconde', 'Première', 'Terminale')),
  domain text not null,
  chapter text not null,
  code text not null unique,
  label text not null,
  lesson_markdown text,
  created_at timestamptz not null default now()
);

create table if not exists public.concept_prerequisites (
  concept_id uuid not null references public.concepts(id) on delete cascade,
  prerequisite_id uuid not null references public.concepts(id) on delete cascade,
  primary key (concept_id, prerequisite_id),
  check (concept_id <> prerequisite_id)
);

-- =============================================================================
-- 3. VERSIONED EXERCISES & CLASS ASSIGNMENTS (§6)
-- =============================================================================

create table if not exists public.exercises (
  id uuid primary key default gen_random_uuid(),
  author_id uuid references public.profiles(id) on delete set null,
  organization_id uuid references public.organizations(id) on delete set null,
  subject text not null default 'physique_chimie',
  level text not null check (level in ('Seconde', 'Première', 'Terminale')),
  domain text not null,
  chapter text not null,
  difficulty text not null check (difficulty in ('guided', 'standard', 'bac')),
  source text not null check (source in ('official', 'teacher', 'ai_approved', 'imported')),
  status text not null default 'draft' check (status in ('draft', 'pending_review', 'published', 'archived')),
  created_at timestamptz not null default now()
);

create table if not exists public.exercise_versions (
  id uuid primary key default gen_random_uuid(),
  exercise_id uuid not null references public.exercises(id) on delete cascade,
  version_number integer not null default 1,
  title text not null,
  statement_template text not null,
  params_schema jsonb not null default '{}'::jsonb,
  questions_schema jsonb not null default '[]'::jsonb,
  rubric_schema jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (exercise_id, version_number)
);

create table if not exists public.exercise_concepts (
  exercise_id uuid not null references public.exercises(id) on delete cascade,
  concept_id uuid not null references public.concepts(id) on delete cascade,
  primary key (exercise_id, concept_id)
);

create table if not exists public.assignments (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes(id) on delete cascade,
  teacher_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  exercise_version_ids uuid[] not null default '{}',
  mode text not null default 'practice' check (mode in ('practice', 'graded')),
  due_at timestamptz,
  created_at timestamptz not null default now()
);

-- =============================================================================
-- 4. SUBMISSIONS, EVALUATION ENGINE & ADAPTIVE MASTERY (§7, §8, §10)
-- =============================================================================

create table if not exists public.submissions (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles(id) on delete cascade,
  exercise_version_id uuid references public.exercise_versions(id) on delete set null,
  assignment_id uuid references public.assignments(id) on delete set null,
  input_mode text not null check (input_mode in ('typed', 'photo')),
  rendered_params jsonb not null default '{}'::jsonb,
  raw_answers jsonb not null default '{}'::jsonb,
  photo_storage_path text,
  photo_expires_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.evaluation_results (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references public.submissions(id) on delete cascade,
  status text not null check (status in ('correct', 'partially_correct', 'incorrect', 'unreadable')),
  score numeric(5,2) not null,
  max_score numeric(5,2) not null default 10,
  engine text not null default 'sympy_pint',
  feedback_summary text,
  created_at timestamptz not null default now()
);

create table if not exists public.error_records (
  id uuid primary key default gen_random_uuid(),
  evaluation_result_id uuid not null references public.evaluation_results(id) on delete cascade,
  concept_id uuid references public.concepts(id) on delete set null,
  error_code text not null,
  error_category text not null,
  evidence text,
  confidence text not null default 'computed' check (confidence in ('computed', 'high', 'medium', 'low')),
  created_at timestamptz not null default now()
);

create table if not exists public.concept_mastery (
  student_id uuid not null references public.profiles(id) on delete cascade,
  concept_id uuid not null references public.concepts(id) on delete cascade,
  attempts integer not null default 0,
  correct_attempts integer not null default 0,
  mastery_score integer not null default 0 check (mastery_score between 0 and 100),
  status text not null default 'not_started' check (status in ('not_started', 'developing', 'acquired', 'needs_review')),
  last_practiced_at timestamptz,
  next_review_at timestamptz,
  primary key (student_id, concept_id)
);

-- =============================================================================
-- 5. AI TUTOR SESSIONS (Private to student per §11.3)
-- =============================================================================

create table if not exists public.tutor_sessions (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles(id) on delete cascade,
  concept_id uuid references public.concepts(id) on delete set null,
  mode text not null default 'guide' check (mode in ('guide', 'explain', 'quiz')),
  created_at timestamptz not null default now()
);

create table if not exists public.tutor_messages (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.tutor_sessions(id) on delete cascade,
  role text not null check (role in ('student', 'assistant')),
  content text not null,
  tokens_used integer default 0,
  created_at timestamptz not null default now()
);

-- =============================================================================
-- 6. BILLING & AUDIT LOGS (§12, §14)
-- =============================================================================

create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid references public.profiles(id) on delete cascade,
  organization_id uuid references public.organizations(id) on delete cascade,
  provider text not null default 'paddle',
  provider_subscription_id text,
  plan_type text not null check (plan_type in ('individual', 'organization', 'enterprise')),
  status text not null default 'trialing' check (status in ('trialing', 'active', 'past_due', 'canceled')),
  current_period_end timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references public.profiles(id) on delete set null,
  action text not null,
  target_type text not null,
  target_id text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- =============================================================================
-- 7. INDEXES FOR RELATIONAL PERFORMANCE
-- =============================================================================
create index if not exists idx_memberships_user on public.memberships(user_id);
create index if not exists idx_memberships_org on public.memberships(organization_id);
create index if not exists idx_classes_teacher on public.classes(teacher_id);
create index if not exists idx_class_members_student on public.class_members(student_id);
create index if not exists idx_submissions_student on public.submissions(student_id);
create index if not exists idx_parent_links_parent on public.parent_child_links(parent_id);
create index if not exists idx_parent_links_child_email on public.parent_child_links(invited_child_email);

-- =============================================================================
-- 8. ROW-LEVEL SECURITY (RLS) POLICIES (§11.3, §14)
-- =============================================================================
alter table public.profiles enable row level security;
alter table public.organizations enable row level security;
alter table public.memberships enable row level security;
alter table public.parent_child_links enable row level security;
alter table public.classes enable row level security;
alter table public.class_members enable row level security;
alter table public.concepts enable row level security;
alter table public.exercises enable row level security;
alter table public.exercise_versions enable row level security;
alter table public.assignments enable row level security;
alter table public.submissions enable row level security;
alter table public.evaluation_results enable row level security;
alter table public.concept_mastery enable row level security;
alter table public.tutor_sessions enable row level security;
alter table public.tutor_messages enable row level security;

-- PROFILES: self, linked parent, or teacher of a class containing the student
drop policy if exists "profiles_select" on public.profiles;
create policy "profiles_select" on public.profiles for select using (
  auth.uid() = id
  or exists (
    select 1 from public.parent_child_links pcl
    where pcl.parent_id = auth.uid() and pcl.student_id = profiles.id and pcl.status = 'linked'
  )
  or exists (
    select 1 from public.class_members cm
    join public.classes c on c.id = cm.class_id
    where cm.student_id = profiles.id and c.teacher_id = auth.uid()
  )
);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles for update using (auth.uid() = id);

-- ORGANIZATIONS & MEMBERSHIPS
drop policy if exists "orgs_select_member" on public.organizations;
create policy "orgs_select_member" on public.organizations for select using (
  created_by = auth.uid()
  or exists (
    select 1 from public.memberships m
    where m.organization_id = organizations.id and m.user_id = auth.uid()
  )
);

drop policy if exists "orgs_insert_auth" on public.organizations;
create policy "orgs_insert_auth" on public.organizations for insert with check (auth.uid() is not null);

drop policy if exists "memberships_select_own_or_admin" on public.memberships;
create policy "memberships_select_own_or_admin" on public.memberships for select using (
  user_id = auth.uid()
  or exists (
    select 1 from public.memberships m2
    where m2.organization_id = memberships.organization_id
      and m2.user_id = auth.uid()
      and m2.role = 'org_admin'
  )
);

drop policy if exists "memberships_insert_self_or_admin" on public.memberships;
create policy "memberships_insert_self_or_admin" on public.memberships for insert with check (
  user_id = auth.uid()
  or exists (
    select 1 from public.memberships m2
    where m2.organization_id = memberships.organization_id
      and m2.user_id = auth.uid()
      and m2.role = 'org_admin'
  )
);

-- PARENT-CHILD LINKS
drop policy if exists "parent_links_manage" on public.parent_child_links;
create policy "parent_links_manage" on public.parent_child_links for all using (
  parent_id = auth.uid() or student_id = auth.uid()
);

-- CLASSES & CLASS MEMBERS
drop policy if exists "classes_teacher_all" on public.classes;
create policy "classes_teacher_all" on public.classes for all using (teacher_id = auth.uid());

drop policy if exists "classes_student_select" on public.classes;
create policy "classes_student_select" on public.classes for select using (
  exists (
    select 1 from public.class_members cm
    where cm.class_id = classes.id and cm.student_id = auth.uid()
  )
);

drop policy if exists "class_members_select" on public.class_members;
create policy "class_members_select" on public.class_members for select using (
  student_id = auth.uid()
  or exists (
    select 1 from public.classes c where c.id = class_members.class_id and c.teacher_id = auth.uid()
  )
);

-- CURRICULUM & PUBLISHED EXERCISES (Public curriculum catalog readable by anon & authenticated)
drop policy if exists "concepts_read_all" on public.concepts;
create policy "concepts_read_all" on public.concepts for select using (true);

drop policy if exists "exercises_read_published_or_author" on public.exercises;
create policy "exercises_read_published_or_author" on public.exercises for select using (
  status = 'published' or author_id = auth.uid()
);

drop policy if exists "exercises_write_author" on public.exercises;
create policy "exercises_write_author" on public.exercises for all using (author_id = auth.uid());

drop policy if exists "exercise_versions_read" on public.exercise_versions;
create policy "exercise_versions_read" on public.exercise_versions for select using (auth.uid() is not null);

drop policy if exists "assignments_teacher_manage" on public.assignments;
create policy "assignments_teacher_manage" on public.assignments for all using (teacher_id = auth.uid());

drop policy if exists "assignments_student_read" on public.assignments;
create policy "assignments_student_read" on public.assignments for select using (
  exists (
    select 1 from public.class_members cm
    where cm.class_id = assignments.class_id and cm.student_id = auth.uid()
  )
);

-- SUBMISSIONS & MASTERY
drop policy if exists "submissions_student_all" on public.submissions;
create policy "submissions_student_all" on public.submissions for all using (student_id = auth.uid());

drop policy if exists "submissions_teacher_read" on public.submissions;
create policy "submissions_teacher_read" on public.submissions for select using (
  exists (
    select 1 from public.class_members cm
    join public.classes c on c.id = cm.class_id
    where cm.student_id = submissions.student_id and c.teacher_id = auth.uid()
  )
);

drop policy if exists "mastery_student_parent_teacher" on public.concept_mastery;
create policy "mastery_student_parent_teacher" on public.concept_mastery for select using (
  student_id = auth.uid()
  or exists (
    select 1 from public.parent_child_links pcl
    where pcl.parent_id = auth.uid() and pcl.student_id = concept_mastery.student_id and pcl.status = 'linked'
  )
  or exists (
    select 1 from public.class_members cm
    join public.classes c on c.id = cm.class_id
    where cm.student_id = concept_mastery.student_id and c.teacher_id = auth.uid()
  )
);

-- TUTOR SESSIONS: Strictly private to the student (§11.3)
drop policy if exists "tutor_sessions_strict_private" on public.tutor_sessions;
create policy "tutor_sessions_strict_private" on public.tutor_sessions for all using (student_id = auth.uid());

drop policy if exists "tutor_messages_strict_private" on public.tutor_messages;
create policy "tutor_messages_strict_private" on public.tutor_messages for all using (
  exists (
    select 1 from public.tutor_sessions ts
    where ts.id = tutor_messages.session_id and ts.student_id = auth.uid()
  )
);

-- =============================================================================
-- 9. SQL FUNCTIONS & TRIGGERS (Atomic Relational Auth Flows)
-- =============================================================================

-- Automatically create profile & link any pending parent invitation on signup
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  v_role text;
begin
  v_role := coalesce(new.raw_user_meta_data->>'role', 'student');
  if v_role not in ('student', 'parent', 'teacher', 'org_admin', 'platform_admin') then
    v_role := 'student';
  end if;

  insert into public.profiles (id, email, first_name, last_name, default_role, level, gdpr_consent_at)
  values (
    new.id,
    new.email,
    coalesce(nullif(new.raw_user_meta_data->>'firstName', ''), split_part(new.email, '@', 1)),
    coalesce(new.raw_user_meta_data->>'lastName', ''),
    v_role,
    nullif(new.raw_user_meta_data->>'level', ''),
    now()
  )
  on conflict (id) do update set
    first_name = excluded.first_name,
    last_name = excluded.last_name,
    default_role = excluded.default_role,
    level = excluded.level,
    updated_at = now();

  -- If a parent already invited this student's email, automatically link them!
  if v_role = 'student' then
    update public.parent_child_links
    set student_id = new.id, status = 'linked'
    where lower(invited_child_email) = lower(new.email)
      and status = 'pending';
  end if;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Secure RPC: Student joins a class by invite_code without exposing all classes
create or replace function public.join_class_by_code(p_invite_code text)
returns jsonb
language plpgsql
security definer set search_path = public
as $$
declare
  v_class record;
begin
  if auth.uid() is null then
    return jsonb_build_object('ok', false, 'error', 'Non authentifié');
  end if;

  select id, name, level into v_class
  from public.classes
  where upper(invite_code) = upper(trim(p_invite_code))
  limit 1;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'Code classe introuvable');
  end if;

  insert into public.class_members (class_id, student_id)
  values (v_class.id, auth.uid())
  on conflict do nothing;

  return jsonb_build_object('ok', true, 'class_id', v_class.id, 'class_name', v_class.name, 'level', v_class.level);
end;
$$;

-- Secure RPC: Create an organization + assign caller as org_admin in one transaction
create or replace function public.create_organization_with_admin(p_name text, p_seats integer default 30)
returns jsonb
language plpgsql
security definer set search_path = public
as $$
declare
  v_org public.organizations;
begin
  if auth.uid() is null then
    return jsonb_build_object('ok', false, 'error', 'Non authentifié');
  end if;

  insert into public.organizations (name, seats_purchased, created_by)
  values (trim(p_name), greatest(p_seats, 1), auth.uid())
  returning * into v_org;

  insert into public.memberships (user_id, organization_id, role, status)
  values (auth.uid(), v_org.id, 'org_admin', 'active');

  insert into public.subscriptions (organization_id, plan_type, status, current_period_end)
  values (v_org.id, 'organization', 'trialing', now() + interval '14 days');

  return jsonb_build_object('ok', true, 'organization_id', v_org.id, 'invite_code', v_org.invite_code);
end;
$$;

-- =============================================================================
-- 10. TABLE & FUNCTION GRANTS (Required for Supabase anon / authenticated roles)
-- =============================================================================
grant usage on schema public to anon, authenticated;
grant select on public.concepts, public.concept_prerequisites to anon, authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant execute on function public.join_class_by_code(text) to authenticated;
grant execute on function public.create_organization_with_admin(text, integer) to authenticated;
