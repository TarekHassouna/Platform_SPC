import {
  createEphemeralSupabaseClient,
  getSupabaseBrowserClient,
  isSupabaseConfigured,
} from "@/lib/supabase/client";
import type { AccountStatus, UserProfile, UserRole } from "@/lib/auth-context";

export interface MembershipRecord {
  id: string;
  organization_id: string;
  role: "student" | "teacher" | "org_admin";
  status: string;
  organization?: {
    id: string;
    name: string;
    invite_code: string;
    seats_purchased: number;
  };
}

export interface MasteryRow {
  conceptCode: string;
  conceptLabel: string;
  domain: string;
  attempts: number;
  correctAttempts: number;
  masteryScore: number;
  status: "not_started" | "developing" | "acquired" | "needs_review";
  lastPracticedAt: string | null;
  nextReviewAt: string | null;
}

export interface SubmissionHistoryRow {
  id: string;
  exerciseId?: string;
  exerciseTitle: string;
  score: number;
  maxScore: number;
  status: string;
  createdAt: string;
  errorSummary?: string;
}

export interface EnrolledClassRow {
  id: string;
  name: string;
  level: string;
  inviteCode: string;
}

export interface ClassAssignmentRow {
  id: string;
  title: string;
  className: string;
  mode: string;
  submissionType: "online" | "photo_copy";
  referenceCorrection?: string;
  allowRetry: boolean;
  allowHints: boolean;
  timeLimitMinutes: number | null;
  dueAt: string | null;
  targetExerciseId?: string;
  completed: boolean;
  bestScore?: number;
  maxScore?: number;
  lastSubmittedAt?: string;
}

export interface DatabaseExerciseRecord {
  id: string;
  versionId: string;
  title: string;
  level: string;
  domain: string;
  chapter: string;
  difficulty: string;
  skills?: string[];
  lessonTitle?: string;
  lessonContent?: string;
  workedExample?: string;
  showInStudentBank?: boolean;
  statement: string;
  questions: {
    prompt: string;
    type: string;
    expected: string;
    hint?: string;
    misconception?: string;
  }[];
}

export interface ConceptRow {
  code: string;
  label: string;
  domain: string;
  level: string;
}

export interface StudentDashboardPayload {
  enrolledClasses: EnrolledClassRow[];
  assignments: ClassAssignmentRow[];
  mastery: MasteryRow[];
  allConcepts: ConceptRow[];
  recentSubmissions: SubmissionHistoryRow[];
  fromDatabase: boolean;
}

export async function fetchRelationalProfile(userId: string): Promise<{
  profile: UserProfile | null;
  memberships: MembershipRecord[];
}> {
  const supabase = getSupabaseBrowserClient();
  if (!isSupabaseConfigured || !supabase) {
    return { profile: null, memberships: [] };
  }

  const [{ data: row }, { data: memRows }, { data: childLink }] = await Promise.all([
    supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .maybeSingle(),
    supabase
      .from("memberships")
      .select("id, organization_id, role, status, organizations(id, name, invite_code, seats_purchased)")
      .eq("user_id", userId),
    supabase
      .from("parent_child_links")
      .select("invited_child_name, invited_child_email, invited_child_level, status")
      .eq("parent_id", userId)
      .limit(1)
      .maybeSingle(),
  ]);

  const memberships: MembershipRecord[] = (memRows || []).map((m: Record<string, unknown>) => ({
    id: String(m.id),
    organization_id: String(m.organization_id),
    role: m.role as MembershipRecord["role"],
    status: String(m.status),
    organization: Array.isArray(m.organizations)
      ? (m.organizations[0] as MembershipRecord["organization"])
      : (m.organizations as MembershipRecord["organization"]),
  }));

  if (!row) {
    return { profile: null, memberships };
  }

  const primaryOrg = memberships[0]?.organization;
  const rawRole = String(row.default_role || "student");
  const normalizedRole: UserRole =
    rawRole === "platform_admin" || rawRole === "org_admin"
      ? "org_admin"
      : rawRole === "teacher" || rawRole === "parent"
      ? (rawRole as UserRole)
      : "student";
  const rawStatus = String((row as Record<string, unknown>).account_status || "approved");
  const accountStatus: AccountStatus =
    rawStatus === "pending" || rawStatus === "rejected" ? rawStatus : "approved";

  const profile: UserProfile = {
    id: row.id,
    email: row.email,
    firstName: row.first_name,
    lastName: row.last_name || "",
    role: normalizedRole,
    accountStatus,
    level: row.level || undefined,
    school: primaryOrg?.name,
    orgSeats: primaryOrg?.seats_purchased,
    childName: childLink?.invited_child_name,
    childEmail: childLink?.invited_child_email || undefined,
    childLevel: childLink?.invited_child_level || undefined,
  };

  return { profile, memberships };
}

export async function completeRelationalOnboarding(
  userId: string,
  profile: UserProfile
): Promise<{ warnings: string[] }> {
  const supabase = getSupabaseBrowserClient();
  const warnings: string[] = [];
  if (!isSupabaseConfigured || !supabase) return { warnings };

  if (profile.role === "student" && profile.classCode?.trim()) {
    const { data, error } = await supabase.rpc("join_class_by_code", {
      p_invite_code: profile.classCode.trim(),
    });
    if (error || (data && !data.ok)) {
      warnings.push(
        `Code classe « ${profile.classCode} » non trouvé : tu pourras rejoindre ta classe depuis ton tableau de bord.`
      );
    }
  }

  if (profile.role === "parent" && (profile.childEmail?.trim() || profile.childName?.trim())) {
    if (profile.childEmail?.trim()) {
      const linkedRes = await linkParentToChild({
        childEmail: profile.childEmail.trim(),
        childName: profile.childName?.trim(),
        childLevel: profile.childLevel,
      });
      if (!linkedRes.ok) {
        // Fallback insert if link_parent_to_child_by_email RPC hasn't been executed yet
        const { error } = await supabase.from("parent_child_links").insert({
          parent_id: userId,
          invited_child_name: profile.childName?.trim() || profile.childEmail.split("@")[0],
          invited_child_email: profile.childEmail.trim().toLowerCase(),
          invited_child_level: profile.childLevel || null,
          status: "pending",
          parental_consent_given: true,
        });
        if (error) warnings.push("Lien parent-enfant en attente de synchronisation.");
      }
    } else if (profile.childName?.trim()) {
      const { error } = await supabase.from("parent_child_links").insert({
        parent_id: userId,
        invited_child_name: profile.childName.trim(),
        invited_child_email: null,
        invited_child_level: profile.childLevel || null,
        status: "pending",
        parental_consent_given: true,
      });
      if (error) warnings.push("Lien parent-enfant en attente de synchronisation.");
    }
  }

  if (profile.role === "org_admin" && profile.school?.trim()) {
    const { error } = await supabase.rpc("create_organization_with_admin", {
      p_name: profile.school.trim(),
      p_seats: profile.orgSeats || 60,
    });
    if (error) warnings.push("Création de l'établissement différée.");
  }

  if (profile.role === "teacher" && profile.schoolCode?.trim()) {
    const { data: existingOrg } = await supabase
      .from("organizations")
      .select("id")
      .eq("invite_code", profile.schoolCode.trim().toUpperCase())
      .maybeSingle();

    if (existingOrg?.id) {
      await supabase.from("memberships").insert({
        user_id: userId,
        organization_id: existingOrg.id,
        role: "teacher",
        status: "active",
      });
    }
  }

  return { warnings };
}

/**
 * Student joins a class anytime using a teacher's invite code (RPC join_class_by_code)
 */
export async function joinClassWithCode(code: string): Promise<{
  ok: boolean;
  className?: string;
  level?: string;
  error?: string;
}> {
  const supabase = getSupabaseBrowserClient();
  if (!isSupabaseConfigured || !supabase) {
    return { ok: true, className: `Classe ${code.toUpperCase()}`, level: "Terminale" };
  }

  const { data, error } = await supabase.rpc("join_class_by_code", {
    p_invite_code: code.trim(),
  });
  if (error) return { ok: false, error: error.message };
  if (data && !data.ok) return { ok: false, error: data.error || "Code classe introuvable." };
  return { ok: true, className: data?.class_name, level: data?.level };
}

/**
 * Fetches real Student Dashboard data (classes, assignments, concept_mastery, submissions) from Supabase
 */
export async function fetchStudentDashboardData(studentId: string): Promise<StudentDashboardPayload> {
  const supabase = getSupabaseBrowserClient();
  if (!isSupabaseConfigured || !supabase || !studentId || studentId.startsWith("local-") || studentId.startsWith("demo-")) {
    return { enrolledClasses: [], assignments: [], mastery: [], allConcepts: [], recentSubmissions: [], fromDatabase: false };
  }

  const [{ data: memberRows }, { data: masteryRows }, { data: subRows }, { data: conceptRows }] = await Promise.all([
    supabase
      .from("class_members")
      .select("class_id, classes(id, name, level, invite_code)")
      .eq("student_id", studentId),
    supabase
      .from("concept_mastery")
      .select("attempts, correct_attempts, mastery_score, status, last_practiced_at, next_review_at, concepts(code, label, domain)")
      .eq("student_id", studentId),
    supabase
      .from("submissions")
      .select("id, assignment_id, rendered_params, created_at, evaluation_results(score, max_score, status, feedback_summary)")
      .eq("student_id", studentId)
      .order("created_at", { ascending: false })
      .limit(60),
    supabase.from("concepts").select("code, label, domain, level"),
  ]);

  // Index completed submissions by assignment_id so student sees "À faire" vs "Déjà faits"
  const subByAssignment = new Map<
    string,
    { bestScore: number; maxScore: number; lastSubmittedAt: string }
  >();
  (subRows || []).forEach((s: Record<string, unknown>) => {
    const asgId = s.assignment_id ? String(s.assignment_id) : null;
    if (!asgId) return;
    const ev = (Array.isArray(s.evaluation_results)
      ? s.evaluation_results[0]
      : s.evaluation_results) as Record<string, unknown> | null;
    const score = Number(ev?.score ?? 0);
    const maxScore = Number(ev?.max_score ?? 1);
    const existing = subByAssignment.get(asgId);
    if (!existing || score > existing.bestScore) {
      subByAssignment.set(asgId, {
        bestScore: score,
        maxScore,
        lastSubmittedAt: existing?.lastSubmittedAt || String(s.created_at),
      });
    }
  });

  const enrolledClasses: EnrolledClassRow[] = (memberRows || [])
    .map((r: Record<string, unknown>) => {
      const c = (Array.isArray(r.classes) ? r.classes[0] : r.classes) as Record<string, string> | null;
      if (!c) return null;
      return { id: c.id, name: c.name, level: c.level, inviteCode: c.invite_code };
    })
    .filter(Boolean) as EnrolledClassRow[];

  let assignments: ClassAssignmentRow[] = [];
  if (enrolledClasses.length > 0) {
    const classIds = enrolledClasses.map((c) => c.id);
    const [{ data: asgRows }, { data: allVersions }] = await Promise.all([
      supabase
        .from("assignments")
        .select("*")
        .in("class_id", classIds)
        .order("created_at", { ascending: false }),
      supabase
        .from("exercise_versions")
        .select("id, exercise_id, title")
        .order("created_at", { ascending: false }),
    ]);

    assignments = (asgRows || [])
      .filter((a: Record<string, unknown>) => a.is_visible !== false)
      .map((a: Record<string, unknown>) => {
      const versionIds = Array.isArray(a.exercise_version_ids)
        ? (a.exercise_version_ids as string[])
        : [];
      let targetExerciseId: string | undefined = versionIds[0];

      // If assignment didn't store exercise_version_ids (or was matched by title), resolve by title
      if (!targetExerciseId && allVersions && allVersions.length > 0) {
        const cleanTitle = String(a.title || "")
          .replace(/^Devoir\s*[—–-]\s*/i, "")
          .trim()
          .toLowerCase();
        const found = allVersions.find((v: Record<string, unknown>) => {
          const vt = String(v.title || "").trim().toLowerCase();
          return vt === cleanTitle || cleanTitle.includes(vt) || vt.includes(cleanTitle);
        });
        if (found) targetExerciseId = String(found.id);
      }

      const isGraded = a.mode === "graded";
      const allowRetry = typeof a.allow_retry === "boolean" ? a.allow_retry : !isGraded;
      const allowHints = typeof a.allow_hints === "boolean" ? a.allow_hints : !isGraded;
      const timeLimitMinutes =
        typeof a.time_limit_minutes === "number" && a.time_limit_minutes > 0
          ? a.time_limit_minutes
          : null;

      const doneInfo = subByAssignment.get(String(a.id));
      const submissionType: "online" | "photo_copy" =
        a.submission_type === "photo_copy" ? "photo_copy" : "online";
      const referenceCorrection =
        typeof a.reference_correction === "string" ? a.reference_correction : undefined;

      return {
        id: String(a.id),
        title: String(a.title),
        className: enrolledClasses.find((c) => c.id === a.class_id)?.name || "Classe",
        mode: isGraded ? "Noté" : "Entraînement",
        submissionType,
        referenceCorrection,
        allowRetry,
        allowHints,
        timeLimitMinutes,
        dueAt: a.due_at ? String(a.due_at) : null,
        targetExerciseId,
        completed: Boolean(doneInfo),
        bestScore: doneInfo?.bestScore,
        maxScore: doneInfo?.maxScore,
        lastSubmittedAt: doneInfo?.lastSubmittedAt,
      };
    });
  }

  const mastery: MasteryRow[] = (masteryRows || []).map((m: Record<string, unknown>) => {
    const c = (Array.isArray(m.concepts) ? m.concepts[0] : m.concepts) as Record<string, string> | null;
    return {
      conceptCode: c?.code || "concept",
      conceptLabel: c?.label || "Compétence",
      domain: c?.domain || "Physique-Chimie",
      attempts: Number(m.attempts || 0),
      correctAttempts: Number(m.correct_attempts || 0),
      masteryScore: Number(m.mastery_score || 0),
      status: (m.status as MasteryRow["status"]) || "developing",
      lastPracticedAt: m.last_practiced_at ? String(m.last_practiced_at) : null,
      nextReviewAt: m.next_review_at ? String(m.next_review_at) : null,
    };
  });

  const recentSubmissions: SubmissionHistoryRow[] = (subRows || []).map((s: Record<string, unknown>) => {
    const ev = (Array.isArray(s.evaluation_results)
      ? s.evaluation_results[0]
      : s.evaluation_results) as Record<string, unknown> | null;
    const params = (s.rendered_params as Record<string, unknown>) || {};
    return {
      id: String(s.id),
      exerciseId: params.exerciseId ? String(params.exerciseId) : undefined,
      exerciseTitle: String(params.exerciseTitle || "Exercice Physique-Chimie"),
      score: Number(ev?.score ?? 0),
      maxScore: Number(ev?.max_score ?? 2),
      status: String(ev?.status ?? "incorrect"),
      createdAt: String(s.created_at),
      errorSummary: ev?.feedback_summary ? String(ev.feedback_summary) : undefined,
    };
  });

  const allConcepts: ConceptRow[] = (conceptRows || []).map((c: Record<string, unknown>) => ({
    code: String(c.code),
    label: String(c.label),
    domain: String(c.domain),
    level: String(c.level),
  }));

  return { enrolledClasses, assignments, mastery, allConcepts, recentSubmissions, fromDatabase: true };
}

/**
 * Adaptive Learning Engine + Submission Persistence (§10):
 * Saves submission, evaluation_results, error_records, AND updates concept_mastery with spaced review!
 */
export async function recordExerciseSubmission(params: {
  studentId: string;
  assignmentId?: string;
  exerciseId?: string;
  exerciseTitle?: string;
  conceptCodes?: string[];
  renderedParams: Record<string, unknown>;
  rawAnswers: Record<string, string>;
  score: number;
  maxScore: number;
  status: "correct" | "partially_correct" | "incorrect" | "unreadable";
  engine: string;
  errors?: { code: string; category: string; evidence: string }[];
}) {
  const supabase = getSupabaseBrowserClient();
  if (!isSupabaseConfigured || !supabase || params.studentId.startsWith("local-") || params.studentId.startsWith("demo-")) {
    return;
  }

  const isUuid = (v?: string) =>
    Boolean(v && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v));

  const { data: sub } = await supabase
    .from("submissions")
    .insert({
      student_id: params.studentId,
      assignment_id: isUuid(params.assignmentId) ? params.assignmentId : null,
      input_mode: "typed",
      rendered_params: {
        ...params.renderedParams,
        exerciseId: params.exerciseId,
        exerciseTitle: params.exerciseTitle,
      },
      raw_answers: params.rawAnswers,
    })
    .select("id")
    .single();

  if (!sub?.id) return;

  const errorSummary =
    params.errors && params.errors.length > 0
      ? params.errors.map((e) => e.code).join(", ")
      : null;

  const { data: evalRow } = await supabase
    .from("evaluation_results")
    .insert({
      submission_id: sub.id,
      status: params.status,
      score: params.score,
      max_score: params.maxScore,
      engine: params.engine,
      feedback_summary: errorSummary,
    })
    .select("id")
    .single();

  // Save structured error_records + update concept_mastery per concept
  const codes = params.conceptCodes || [];
  if (codes.length === 0) return;

  const { data: concepts } = await supabase
    .from("concepts")
    .select("id, code")
    .in("code", codes);

  if (!concepts || concepts.length === 0) return;

  if (evalRow?.id && params.errors?.length) {
    await supabase.from("error_records").insert(
      params.errors.map((err) => ({
        evaluation_result_id: evalRow.id,
        concept_id: concepts[0].id,
        error_code: err.code,
        error_category: err.category,
        evidence: err.evidence,
        confidence: "computed",
      }))
    );
  }

  const ratio = params.maxScore > 0 ? params.score / params.maxScore : 0;
  const isSuccess = ratio >= 0.85;
  const now = new Date();

  for (const concept of concepts) {
    const { data: existing } = await supabase
      .from("concept_mastery")
      .select("attempts, correct_attempts, mastery_score")
      .eq("student_id", params.studentId)
      .eq("concept_id", concept.id)
      .maybeSingle();

    const prevAttempts = Number(existing?.attempts || 0);
    const prevCorrect = Number(existing?.correct_attempts || 0);
    const prevScore = Number(existing?.mastery_score || 0);

    const newAttempts = prevAttempts + 1;
    const newCorrect = prevCorrect + (isSuccess ? 1 : 0);
    // Weighted blend: 60% recent attempt + 40% history (Vision Doc §10.1)
    const attemptPct = Math.round(ratio * 100);
    const newScore =
      prevAttempts === 0
        ? attemptPct
        : Math.min(100, Math.max(0, Math.round(prevScore * 0.55 + attemptPct * 0.45)));

    // Mastery requires multiple successful attempts (Principle §5.3)
    const newStatus: MasteryRow["status"] =
      newScore >= 80 && newCorrect >= 2
        ? "acquired"
        : newScore < 50
        ? "needs_review"
        : "developing";

    // Spaced review interval (days)
    const reviewDays = newStatus === "acquired" ? 7 : newStatus === "developing" ? 3 : 1;
    const nextReview = new Date(now.getTime() + reviewDays * 86400 * 1000).toISOString();

    await supabase.from("concept_mastery").upsert(
      {
        student_id: params.studentId,
        concept_id: concept.id,
        attempts: newAttempts,
        correct_attempts: newCorrect,
        mastery_score: newScore,
        status: newStatus,
        last_practiced_at: now.toISOString(),
        next_review_at: nextReview,
      },
      { onConflict: "student_id,concept_id" }
    );
  }
}

export interface ParentChildSnapshot {
  linkId: string;
  linked: boolean;
  status: "pending_admin" | "pending" | "linked" | "rejected" | "revoked";
  studentId?: string;
  childName: string;
  childLevel: string;
  childEmail: string;
  enrolledClasses: EnrolledClassRow[];
  assignments: ClassAssignmentRow[];
  mastery: MasteryRow[];
  recentSubmissions: SubmissionHistoryRow[];
}

/**
 * Submits a Parent -> Student link request by student email.
 * The request stays in 'pending_admin' until an Administrator approves it.
 */
export async function linkParentToChild(params: {
  childEmail: string;
  childName?: string;
  childLevel?: string;
}): Promise<{
  ok: boolean;
  linked?: boolean;
  status?: string;
  studentFound?: boolean;
  childName?: string;
  error?: string;
}> {
  const supabase = getSupabaseBrowserClient();
  if (!isSupabaseConfigured || !supabase) {
    return { ok: false, error: "Connexion à la base indisponible." };
  }
  const email = params.childEmail.trim().toLowerCase();
  if (!email || !email.includes("@")) {
    return { ok: false, error: "Veuillez entrer une adresse e-mail valide pour votre enfant." };
  }

  const { data, error } = await supabase.rpc("link_parent_to_child_by_email", {
    p_child_email: email,
    p_child_name: params.childName?.trim() || null,
    p_child_level: params.childLevel || null,
  });

  if (error) {
    return { ok: false, error: error.message };
  }

  if (data && !data.ok) {
    return { ok: false, error: data.error || "Impossible d'envoyer la demande de liaison." };
  }

  return {
    ok: true,
    linked: Boolean(data?.linked),
    status: data?.status ? String(data.status) : data?.linked ? "linked" : "pending_admin",
    studentFound: Boolean(data?.student_found),
    childName: data?.child_name ? String(data.child_name) : params.childName,
  };
}

/**
 * Removes a parent-child link row owned by the logged-in parent.
 */
export async function unlinkParentChild(linkId: string): Promise<boolean> {
  const supabase = getSupabaseBrowserClient();
  if (!isSupabaseConfigured || !supabase || !linkId) return false;
  const { error } = await supabase.from("parent_child_links").delete().eq("id", linkId);
  return !error;
}

/**
 * Fetches ALL linked, pending & rejected children.
 * Student progress is ONLY fetched when status === 'linked' (approved by Admin).
 */
export async function fetchParentChildrenDashboards(
  parentId: string
): Promise<ParentChildSnapshot[]> {
  const supabase = getSupabaseBrowserClient();
  if (!isSupabaseConfigured || !supabase || !parentId || parentId.startsWith("local-") || parentId.startsWith("demo-")) {
    return [];
  }

  const { data: links } = await supabase
    .from("parent_child_links")
    .select("id, student_id, invited_child_name, invited_child_email, invited_child_level, status")
    .eq("parent_id", parentId)
    .order("created_at", { ascending: true });

  if (!links || links.length === 0) return [];

  const snapshots = await Promise.all(
    links.map(async (link: Record<string, unknown>): Promise<ParentChildSnapshot> => {
      const studentId = link.student_id ? String(link.student_id) : undefined;
      const rawStatus = String(link.status || "pending_admin");
      const status: ParentChildSnapshot["status"] =
        rawStatus === "linked" ||
        rawStatus === "rejected" ||
        rawStatus === "revoked" ||
        rawStatus === "pending"
          ? rawStatus
          : "pending_admin";
      const isLinked = Boolean(studentId && status === "linked");

      const base: ParentChildSnapshot = {
        linkId: String(link.id),
        linked: isLinked,
        status,
        studentId,
        childName: String(link.invited_child_name || "Votre enfant"),
        childLevel: String(link.invited_child_level || "Lycée"),
        childEmail: String(link.invited_child_email || ""),
        enrolledClasses: [],
        assignments: [],
        mastery: [],
        recentSubmissions: [],
      };

      if (!isLinked || !studentId) return base;

      const childData = await fetchStudentDashboardData(studentId);
      return {
        ...base,
        linked: true,
        enrolledClasses: childData.enrolledClasses,
        assignments: childData.assignments,
        mastery: childData.mastery,
        recentSubmissions: childData.recentSubmissions,
      };
    })
  );

  return snapshots;
}

/**
 * Fetches first linked child progress for Parent Dashboard via parent_child_links
 */
export async function fetchParentChildDashboard(parentId: string): Promise<{
  linked: boolean;
  childName?: string;
  childLevel?: string;
  childEmail?: string;
  mastery: MasteryRow[];
  recentSubmissions: SubmissionHistoryRow[];
}> {
  const list = await fetchParentChildrenDashboards(parentId);
  const first = list[0];
  if (!first) return { linked: false, mastery: [], recentSubmissions: [] };
  return {
    linked: first.linked,
    childName: first.childName,
    childLevel: first.childLevel,
    childEmail: first.childEmail,
    mastery: first.mastery,
    recentSubmissions: first.recentSubmissions,
  };
}

/**
 * Uploads handwritten student photo into Supabase Private Storage bucket `student-photos`
 */
export async function uploadStudentPhoto(
  studentId: string,
  file: File
): Promise<{ path?: string; error?: string }> {
  const supabase = getSupabaseBrowserClient();
  if (!isSupabaseConfigured || !supabase || !studentId || studentId.startsWith("local-")) {
    return { path: `local/${file.name}` };
  }

  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const path = `${studentId}/${Date.now()}_${safeName}`;
  const { error } = await supabase.storage.from("student-photos").upload(path, file, {
    cacheControl: "3600",
    upsert: false,
  });

  if (error) return { error: error.message };
  return { path };
}

/**
 * Persists a student's confirmed handwritten photo submission into Supabase (`input_mode = 'photo'`)
 * so teachers see it live in /teacher/grading.
 */
export async function recordPhotoSubmission(params: {
  studentId: string;
  assignmentId?: string;
  assignmentTitle?: string;
  fileName: string;
  storagePath?: string | null;
  mode: "question" | "correct" | "grade";
  lines: { id: number; text: string; confidence: string }[];
  analysis?: {
    status: "correct" | "partially_correct" | "incorrect";
    score: number;
    maxScore: number;
    summary: string;
    errorCode?: string;
    steps?: { lineId: number; verdict: string; comment: string }[];
  } | null;
}): Promise<{ ok: boolean; error?: string }> {
  const supabase = getSupabaseBrowserClient();
  if (!isSupabaseConfigured || !supabase || !params.studentId) return { ok: false };

  const isUuid = (v?: string) =>
    Boolean(v && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v));

  const expiresAt = new Date(Date.now() + 90 * 86400 * 1000).toISOString();
  const { data: sub, error } = await supabase
    .from("submissions")
    .insert({
      student_id: params.studentId,
      assignment_id: isUuid(params.assignmentId) ? params.assignmentId : null,
      input_mode: "photo",
      rendered_params: {
        exerciseTitle: params.assignmentTitle || `Copie manuscrite (${params.fileName})`,
        mode: params.mode,
      },
      raw_answers: { lines: params.lines, steps: params.analysis?.steps || [] },
      photo_storage_path: params.storagePath || null,
      photo_expires_at: expiresAt,
    })
    .select("id")
    .single();

  if (error || !sub?.id) return { ok: false, error: error?.message };

  // Only store an evaluation if the AI actually produced a real analysis (no fake scores)
  if (params.analysis) {
    await supabase.from("evaluation_results").insert({
      submission_id: sub.id,
      status: params.analysis.status,
      score: params.analysis.score,
      max_score: params.analysis.maxScore,
      engine: "gemini_photo_analysis",
      feedback_summary: params.analysis.summary,
    });
  }
  return { ok: true };
}

/**
 * Fetches a teacher-created / AI-generated exercise from Supabase by exercise_versions.id OR exercises.id
 */
export async function fetchDatabaseExercise(
  idOrVersionId: string
): Promise<DatabaseExerciseRecord | null> {
  const supabase = getSupabaseBrowserClient();
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    idOrVersionId
  );
  if (!isSupabaseConfigured || !supabase || !isUuid) return null;

  // Try matching exercise_versions.id first, then exercise_versions.exercise_id
  let { data: version } = await supabase
    .from("exercise_versions")
    .select(
      "id, exercise_id, title, statement_template, questions_schema, rubric_schema, exercises(level, domain, chapter, difficulty)"
    )
    .eq("id", idOrVersionId)
    .maybeSingle();

  if (!version) {
    const res = await supabase
      .from("exercise_versions")
      .select(
        "id, exercise_id, title, statement_template, questions_schema, rubric_schema, exercises(level, domain, chapter, difficulty)"
      )
      .eq("exercise_id", idOrVersionId)
      .order("version_number", { ascending: false })
      .limit(1)
      .maybeSingle();
    version = res.data;
  }

  if (!version) return null;

  const exMeta = (Array.isArray(version.exercises)
    ? version.exercises[0]
    : version.exercises) as Record<string, string> | null;
  const rubric = (version.rubric_schema as Record<string, unknown>) || {};

  const diffMap: Record<string, string> = {
    guided: "Guidé",
    standard: "Standard",
    bac: "Type Bac",
  };

  return {
    id: String(version.exercise_id),
    versionId: String(version.id),
    title: String(version.title || "Exercice de classe"),
    level: exMeta?.level || "Terminale",
    domain: exMeta?.domain || "Physique-Chimie",
    chapter: exMeta?.chapter || "Devoir de classe",
    difficulty: diffMap[exMeta?.difficulty || "standard"] || "Standard",
    skills: Array.isArray(rubric.skills) ? (rubric.skills as string[]) : [],
    lessonTitle: rubric.lessonTitle ? String(rubric.lessonTitle) : undefined,
    lessonContent: rubric.lessonContent ? String(rubric.lessonContent) : undefined,
    workedExample: rubric.workedExample ? String(rubric.workedExample) : undefined,
    showInStudentBank: rubric.showInStudentBank === true,
    statement: String(version.statement_template || ""),
    questions: Array.isArray(version.questions_schema)
      ? (version.questions_schema as DatabaseExerciseRecord["questions"])
      : [],
  };
}

/**
 * Fetches all teacher-published exercises marked showInStudentBank = true
 * so they appear in the bottom practice bank alongside the official exercises.
 */
export async function fetchStudentBankExercises(): Promise<DatabaseExerciseRecord[]> {
  const supabase = getSupabaseBrowserClient();
  if (!isSupabaseConfigured || !supabase) return [];

  const { data } = await supabase
    .from("exercise_versions")
    .select(
      "id, exercise_id, title, statement_template, questions_schema, rubric_schema, exercises!inner(level, domain, chapter, difficulty, status)"
    )
    .eq("exercises.status", "published")
    .order("created_at", { ascending: false });

  const diffMap: Record<string, string> = {
    guided: "Guidé",
    standard: "Standard",
    bac: "Type Bac",
  };

  const results: DatabaseExerciseRecord[] = [];
  const seenExerciseIds = new Set<string>();

  (data || []).forEach((v: Record<string, unknown>) => {
    const exId = String(v.exercise_id);
    if (seenExerciseIds.has(exId)) return;
    const rubric = (v.rubric_schema as Record<string, unknown>) || {};
    if (rubric.showInStudentBank !== true) return;
    seenExerciseIds.add(exId);

    const exMeta = (Array.isArray(v.exercises) ? v.exercises[0] : v.exercises) as Record<
      string,
      string
    > | null;

    results.push({
      id: exId,
      versionId: String(v.id),
      title: String(v.title || "Exercice du professeur"),
      level: exMeta?.level || "Terminale",
      domain: exMeta?.domain || "Physique-Chimie",
      chapter: exMeta?.chapter || "Chapitre",
      difficulty: diffMap[exMeta?.difficulty || "standard"] || "Standard",
      skills: Array.isArray(rubric.skills) ? (rubric.skills as string[]) : [],
      lessonTitle: rubric.lessonTitle ? String(rubric.lessonTitle) : undefined,
      lessonContent: rubric.lessonContent ? String(rubric.lessonContent) : undefined,
      workedExample: rubric.workedExample ? String(rubric.workedExample) : undefined,
      showInStudentBank: true,
      statement: String(v.statement_template || ""),
      questions: Array.isArray(v.questions_schema)
        ? (v.questions_schema as DatabaseExerciseRecord["questions"])
        : [],
    });
  });

  return results;
}

/**
 * Reads teacher's retry policy for an assignment + checks if the student already submitted it.
 */
export async function fetchAssignmentPolicyAndAttempt(
  assignmentId: string,
  studentId?: string
): Promise<{
  title: string;
  mode: "Noté" | "Entraînement";
  allowRetry: boolean;
  allowHints: boolean;
  isVisible: boolean;
  timeLimitMinutes: number | null;
  previousAttempt?: {
    answers: Record<string, string>;
    score: number;
    maxScore: number;
    submittedAt: string;
  };
} | null> {
  const supabase = getSupabaseBrowserClient();
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(assignmentId);
  if (!isSupabaseConfigured || !supabase || !isUuid) return null;

  const { data: asg } = await supabase
    .from("assignments")
    .select("*")
    .eq("id", assignmentId)
    .maybeSingle();

  if (!asg) return null;
  const isGraded = asg.mode === "graded";
  const allowRetry = typeof asg.allow_retry === "boolean" ? asg.allow_retry : !isGraded;
  const allowHints = typeof asg.allow_hints === "boolean" ? asg.allow_hints : !isGraded;
  const isVisible = typeof asg.is_visible === "boolean" ? asg.is_visible : true;
  const timeLimitMinutes =
    typeof asg.time_limit_minutes === "number" && asg.time_limit_minutes > 0
      ? asg.time_limit_minutes
      : null;

  let previousAttempt: {
    answers: Record<string, string>;
    score: number;
    maxScore: number;
    submittedAt: string;
  } | undefined;

  if (studentId) {
    const { data: sub } = await supabase
      .from("submissions")
      .select("raw_answers, created_at, evaluation_results(score, max_score)")
      .eq("student_id", studentId)
      .eq("assignment_id", assignmentId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (sub) {
      const ev = (Array.isArray(sub.evaluation_results)
        ? sub.evaluation_results[0]
        : sub.evaluation_results) as Record<string, unknown> | null;
      previousAttempt = {
        answers: (sub.raw_answers as Record<string, string>) || {},
        score: Number(ev?.score ?? 0),
        maxScore: Number(ev?.max_score ?? 1),
        submittedAt: String(sub.created_at),
      };
    }
  }

  return {
    title: String(asg.title),
    mode: isGraded ? "Noté" : "Entraînement",
    allowRetry,
    allowHints,
    isVisible,
    timeLimitMinutes,
    previousAttempt,
  };
}

// =============================================================================
// ADMIN CRUD & APPROVAL RPCs (Students, Teachers/Tutors, Parents, Parent Links)
// =============================================================================

export interface AdminUserRecord {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: "student" | "teacher" | "parent" | "org_admin" | "platform_admin";
  level: string | null;
  accountStatus: "pending" | "approved" | "rejected";
  createdAt: string;
}

export interface AdminParentLinkRecord {
  id: string;
  parentId: string;
  parentName: string;
  parentEmail: string;
  studentId: string | null;
  studentName: string;
  studentEmail: string;
  studentLevel: string;
  studentAccountExists: boolean;
  status: "pending_admin" | "pending" | "linked" | "rejected" | "revoked";
  createdAt: string;
}

export async function fetchAdminUsers(): Promise<{
  users: AdminUserRecord[];
  error?: string;
}> {
  const supabase = getSupabaseBrowserClient();
  if (!isSupabaseConfigured || !supabase) {
    return { users: [], error: "Connexion à la base indisponible." };
  }

  const { data, error } = await supabase.rpc("admin_list_all_users");
  if (error) {
    return { users: [], error: error.message };
  }

  const users: AdminUserRecord[] = (Array.isArray(data) ? data : []).map(
    (r: Record<string, unknown>) => ({
      id: String(r.id),
      email: String(r.email || ""),
      firstName: String(r.first_name || ""),
      lastName: String(r.last_name || ""),
      role: (String(r.default_role || "student") as AdminUserRecord["role"]),
      level: r.level ? String(r.level) : null,
      accountStatus:
        r.account_status === "pending" || r.account_status === "rejected"
          ? r.account_status
          : "approved",
      createdAt: String(r.created_at || new Date().toISOString()),
    })
  );

  return { users };
}

export async function adminCreateUser(params: {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  role: "student" | "teacher" | "parent" | "org_admin";
  level?: string;
}): Promise<{ ok: boolean; userId?: string; error?: string; warning?: string }> {
  const supabase = getSupabaseBrowserClient();
  const ephemeral = createEphemeralSupabaseClient();
  if (!isSupabaseConfigured || !supabase || !ephemeral) {
    return { ok: false, error: "Connexion à la base indisponible." };
  }

  const normalizedEmail = params.email.trim().toLowerCase();
  const cleanLevel = params.role === "student" ? params.level || "Terminale" : null;

  const { data, error } = await ephemeral.auth.signUp({
    email: normalizedEmail,
    password: params.password,
    options: {
      data: {
        firstName: params.firstName.trim(),
        lastName: params.lastName.trim(),
        role: params.role,
        level: cleanLevel,
      },
    },
  });

  if (error) {
    return { ok: false, error: error.message };
  }

  const newUserId = data.user?.id;
  if (!newUserId) {
    return { ok: false, error: "Compte non créé (vérifiez si l'adresse e-mail existe déjà)." };
  }

  // Accounts created directly by Admin are approved immediately
  const { data: updateRes, error: updateErr } = await supabase.rpc("admin_update_user", {
    p_user_id: newUserId,
    p_first_name: params.firstName.trim(),
    p_last_name: params.lastName.trim(),
    p_role: params.role,
    p_level: cleanLevel || "",
    p_account_status: "approved",
  });

  if (updateErr || (updateRes && !updateRes.ok)) {
    return {
      ok: true,
      userId: newUserId,
      warning:
        "Compte créé mais la validation automatique a échoué — cliquez sur Approuver dans la liste.",
    };
  }

  return { ok: true, userId: newUserId };
}

export async function adminUpdateUser(params: {
  userId: string;
  firstName?: string;
  lastName?: string;
  role?: "student" | "teacher" | "parent" | "org_admin" | "platform_admin";
  level?: string | null;
  accountStatus?: "pending" | "approved" | "rejected";
}): Promise<{ ok: boolean; error?: string }> {
  const supabase = getSupabaseBrowserClient();
  if (!isSupabaseConfigured || !supabase) {
    return { ok: false, error: "Connexion à la base indisponible." };
  }

  const { data, error } = await supabase.rpc("admin_update_user", {
    p_user_id: params.userId,
    p_first_name: params.firstName ?? null,
    p_last_name: params.lastName ?? null,
    p_role: params.role ?? null,
    p_level: params.level === undefined ? null : params.level ?? "",
    p_account_status: params.accountStatus ?? null,
  });

  if (error) return { ok: false, error: error.message };
  if (data && !data.ok) return { ok: false, error: data.error || "Erreur lors de la mise à jour." };
  return { ok: true };
}

export async function adminDeleteUser(userId: string): Promise<{ ok: boolean; error?: string }> {
  const supabase = getSupabaseBrowserClient();
  if (!isSupabaseConfigured || !supabase) {
    return { ok: false, error: "Connexion à la base indisponible." };
  }

  const { data, error } = await supabase.rpc("admin_delete_user", {
    p_user_id: userId,
  });

  if (error) return { ok: false, error: error.message };
  if (data && !data.ok) return { ok: false, error: data.error || "Impossible de supprimer ce compte." };
  return { ok: true };
}

export async function fetchAdminParentLinks(): Promise<{
  links: AdminParentLinkRecord[];
  error?: string;
}> {
  const supabase = getSupabaseBrowserClient();
  if (!isSupabaseConfigured || !supabase) {
    return { links: [], error: "Connexion à la base indisponible." };
  }

  const { data, error } = await supabase.rpc("admin_list_parent_links");
  if (error) return { links: [], error: error.message };

  const links: AdminParentLinkRecord[] = (Array.isArray(data) ? data : []).map(
    (r: Record<string, unknown>) => ({
      id: String(r.id),
      parentId: String(r.parent_id),
      parentName: String(r.parent_name || "Parent"),
      parentEmail: String(r.parent_email || ""),
      studentId: r.student_id ? String(r.student_id) : null,
      studentName: String(r.student_name || "Élève"),
      studentEmail: String(r.student_email || ""),
      studentLevel: String(r.student_level || "Lycée"),
      studentAccountExists: Boolean(r.student_account_exists),
      status: (String(r.status || "pending_admin") as AdminParentLinkRecord["status"]),
      createdAt: String(r.created_at || new Date().toISOString()),
    })
  );

  return { links };
}

export async function adminReviewParentLink(
  linkId: string,
  action: "approve" | "reject" | "delete"
): Promise<{ ok: boolean; error?: string }> {
  const supabase = getSupabaseBrowserClient();
  if (!isSupabaseConfigured || !supabase) {
    return { ok: false, error: "Connexion à la base indisponible." };
  }

  const { data, error } = await supabase.rpc("admin_review_parent_link", {
    p_link_id: linkId,
    p_action: action,
  });

  if (error) return { ok: false, error: error.message };
  if (data && !data.ok) return { ok: false, error: data.error || "Action impossible." };
  return { ok: true };
}

export async function adminCreateParentLink(
  parentId: string,
  studentId: string
): Promise<{ ok: boolean; error?: string }> {
  const supabase = getSupabaseBrowserClient();
  if (!isSupabaseConfigured || !supabase) {
    return { ok: false, error: "Connexion à la base indisponible." };
  }

  const { data, error } = await supabase.rpc("admin_create_parent_link", {
    p_parent_id: parentId,
    p_student_id: studentId,
  });

  if (error) return { ok: false, error: error.message };
  if (data && !data.ok) return { ok: false, error: data.error || "Impossible de créer la liaison." };
  return { ok: true };
}

// =============================================================================
// ADMIN CLASSES, CLASS CODES & STUDENT ENROLLMENT RPCs
// =============================================================================

export interface AdminClassStudent {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  level: string | null;
  joinedAt: string;
}

export interface AdminClassRecord {
  id: string;
  name: string;
  level: string;
  inviteCode: string;
  color: string;
  teacherId: string;
  teacherName: string;
  teacherEmail: string;
  createdAt: string;
  students: AdminClassStudent[];
}

export async function fetchAdminClasses(): Promise<{
  classes: AdminClassRecord[];
  error?: string;
}> {
  const supabase = getSupabaseBrowserClient();
  if (!isSupabaseConfigured || !supabase) {
    return { classes: [], error: "Connexion à la base indisponible." };
  }

  const { data, error } = await supabase.rpc("admin_list_all_classes");
  if (error) {
    // Gracefully return empty if admin_classes.sql hasn't been executed yet
    if (error.message.includes("admin_list_all_classes")) {
      return { classes: [] };
    }
    return { classes: [], error: error.message };
  }

  const classes: AdminClassRecord[] = (Array.isArray(data) ? data : []).map(
    (r: Record<string, unknown>) => {
      const rawStudents = Array.isArray(r.students)
        ? (r.students as Record<string, unknown>[])
        : [];
      return {
        id: String(r.id),
        name: String(r.name || "Classe"),
        level: String(r.level || "Terminale"),
        inviteCode: String(r.invite_code || ""),
        color: String(r.color || "from-indigo-500 to-violet-600"),
        teacherId: String(r.teacher_id || ""),
        teacherName: String(r.teacher_name || "Enseignant"),
        teacherEmail: String(r.teacher_email || ""),
        createdAt: String(r.created_at || new Date().toISOString()),
        students: rawStudents.map((s) => ({
          id: String(s.id),
          firstName: String(s.firstName || ""),
          lastName: String(s.lastName || ""),
          email: String(s.email || ""),
          level: s.level ? String(s.level) : null,
          joinedAt: String(s.joinedAt || ""),
        })),
      };
    }
  );

  return { classes };
}

export async function adminAddStudentToClass(
  classId: string,
  studentId: string
): Promise<{ ok: boolean; error?: string }> {
  const supabase = getSupabaseBrowserClient();
  if (!isSupabaseConfigured || !supabase) {
    return { ok: false, error: "Connexion à la base indisponible." };
  }
  const { data, error } = await supabase.rpc("admin_add_student_to_class", {
    p_class_id: classId,
    p_student_id: studentId,
  });
  if (error) return { ok: false, error: error.message };
  if (data && !data.ok) return { ok: false, error: data.error || "Impossible d'ajouter cet élève." };
  return { ok: true };
}

export async function adminRemoveStudentFromClass(
  classId: string,
  studentId: string
): Promise<{ ok: boolean; error?: string }> {
  const supabase = getSupabaseBrowserClient();
  if (!isSupabaseConfigured || !supabase) {
    return { ok: false, error: "Connexion à la base indisponible." };
  }
  const { data, error } = await supabase.rpc("admin_remove_student_from_class", {
    p_class_id: classId,
    p_student_id: studentId,
  });
  if (error) return { ok: false, error: error.message };
  if (data && !data.ok) return { ok: false, error: data.error || "Impossible de retirer cet élève." };
  return { ok: true };
}

export async function adminCreateClass(params: {
  name: string;
  level: string;
  teacherId: string;
  inviteCode?: string;
}): Promise<{ ok: boolean; inviteCode?: string; error?: string }> {
  const supabase = getSupabaseBrowserClient();
  if (!isSupabaseConfigured || !supabase) {
    return { ok: false, error: "Connexion à la base indisponible." };
  }
  const { data, error } = await supabase.rpc("admin_create_class", {
    p_name: params.name.trim(),
    p_level: params.level,
    p_teacher_id: params.teacherId,
    p_invite_code: params.inviteCode?.trim() || null,
  });
  if (error) return { ok: false, error: error.message };
  if (data && !data.ok) return { ok: false, error: data.error || "Impossible de créer la classe." };
  return { ok: true, inviteCode: data?.invite_code ? String(data.invite_code) : undefined };
}

export async function adminDeleteClass(classId: string): Promise<{ ok: boolean; error?: string }> {
  const supabase = getSupabaseBrowserClient();
  if (!isSupabaseConfigured || !supabase) {
    return { ok: false, error: "Connexion à la base indisponible." };
  }
  const { data, error } = await supabase.rpc("admin_delete_class", {
    p_class_id: classId,
  });
  if (error) return { ok: false, error: error.message };
  if (data && !data.ok) return { ok: false, error: data.error || "Impossible de supprimer la classe." };
  return { ok: true };
}

// =============================================================================
// ADMIN BULK ACTIONS & CLASS ANNOUNCEMENTS / COURSE PDFs
// =============================================================================

export async function adminBulkApproveUsers(
  userIds?: string[]
): Promise<{ ok: boolean; approvedCount?: number; error?: string }> {
  const supabase = getSupabaseBrowserClient();
  if (!isSupabaseConfigured || !supabase) {
    return { ok: false, error: "Connexion à la base indisponible." };
  }
  const { data, error } = await supabase.rpc("admin_bulk_approve_users", {
    p_user_ids: userIds && userIds.length > 0 ? userIds : null,
  });
  if (error) return { ok: false, error: error.message };
  if (data && !data.ok) return { ok: false, error: data.error || "Erreur lors de la validation groupée." };
  return { ok: true, approvedCount: Number(data?.approved_count ?? 0) };
}

export async function adminBulkAddStudentsToClass(
  classId: string,
  studentIds: string[]
): Promise<{ ok: boolean; addedCount?: number; className?: string; error?: string }> {
  const supabase = getSupabaseBrowserClient();
  if (!isSupabaseConfigured || !supabase) {
    return { ok: false, error: "Connexion à la base indisponible." };
  }
  const { data, error } = await supabase.rpc("admin_bulk_add_students_to_class", {
    p_class_id: classId,
    p_student_ids: studentIds,
  });
  if (error) return { ok: false, error: error.message };
  if (data && !data.ok) return { ok: false, error: data.error || "Affectation groupée impossible." };
  return {
    ok: true,
    addedCount: Number(data?.added_count ?? 0),
    className: data?.class_name ? String(data.class_name) : undefined,
  };
}

export interface ClassAnnouncementRecord {
  id: string;
  classId: string;
  className?: string;
  teacherId: string;
  title: string;
  body: string;
  attachmentPath: string | null;
  attachmentName: string | null;
  isPinned: boolean;
  createdAt: string;
}

export async function fetchClassAnnouncements(
  classIds: string[]
): Promise<ClassAnnouncementRecord[]> {
  const supabase = getSupabaseBrowserClient();
  if (!isSupabaseConfigured || !supabase || classIds.length === 0) return [];

  const { data, error } = await supabase
    .from("class_announcements")
    .select("id, class_id, teacher_id, title, body, attachment_path, attachment_name, is_pinned, created_at, classes(name)")
    .in("class_id", classIds)
    .order("is_pinned", { ascending: false })
    .order("created_at", { ascending: false });

  if (error || !data) return [];

  return data.map((r: Record<string, unknown>) => {
    const cls = (Array.isArray(r.classes) ? r.classes[0] : r.classes) as { name?: string } | null;
    return {
      id: String(r.id),
      classId: String(r.class_id),
      className: cls?.name || undefined,
      teacherId: String(r.teacher_id),
      title: String(r.title || ""),
      body: String(r.body || ""),
      attachmentPath: r.attachment_path ? String(r.attachment_path) : null,
      attachmentName: r.attachment_name ? String(r.attachment_name) : null,
      isPinned: Boolean(r.is_pinned),
      createdAt: String(r.created_at || new Date().toISOString()),
    };
  });
}

export async function createClassAnnouncement(params: {
  classId: string;
  teacherId: string;
  title: string;
  body: string;
  isPinned?: boolean;
  file?: File | null;
}): Promise<{ ok: boolean; announcement?: ClassAnnouncementRecord; error?: string }> {
  const supabase = getSupabaseBrowserClient();
  if (!isSupabaseConfigured || !supabase) {
    return { ok: false, error: "Connexion à la base indisponible." };
  }

  let attachmentPath: string | null = null;
  let attachmentName: string | null = null;

  if (params.file) {
    const safeName = params.file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const path = `${params.classId}/${Date.now()}_${safeName}`;
    const { error: upErr } = await supabase.storage
      .from("course-files")
      .upload(path, params.file, { cacheControl: "3600", upsert: false });
    if (upErr) {
      return { ok: false, error: `Échec de l'envoi du fichier : ${upErr.message}` };
    }
    attachmentPath = path;
    attachmentName = params.file.name;
  }

  const { data, error } = await supabase
    .from("class_announcements")
    .insert({
      class_id: params.classId,
      teacher_id: params.teacherId,
      title: params.title.trim(),
      body: params.body.trim(),
      attachment_path: attachmentPath,
      attachment_name: attachmentName,
      is_pinned: Boolean(params.isPinned),
    })
    .select("id, class_id, teacher_id, title, body, attachment_path, attachment_name, is_pinned, created_at")
    .single();

  if (error || !data) {
    return { ok: false, error: error?.message || "Impossible de publier l'annonce." };
  }

  return {
    ok: true,
    announcement: {
      id: String(data.id),
      classId: String(data.class_id),
      teacherId: String(data.teacher_id),
      title: String(data.title),
      body: String(data.body),
      attachmentPath: data.attachment_path ? String(data.attachment_path) : null,
      attachmentName: data.attachment_name ? String(data.attachment_name) : null,
      isPinned: Boolean(data.is_pinned),
      createdAt: String(data.created_at),
    },
  };
}

export async function deleteClassAnnouncement(
  announcementId: string,
  attachmentPath?: string | null
): Promise<boolean> {
  const supabase = getSupabaseBrowserClient();
  if (!isSupabaseConfigured || !supabase || !announcementId) return false;

  if (attachmentPath) {
    await supabase.storage.from("course-files").remove([attachmentPath]);
  }
  const { error } = await supabase
    .from("class_announcements")
    .delete()
    .eq("id", announcementId);
  return !error;
}

export async function getCourseFileSignedUrl(path: string): Promise<string | null> {
  const supabase = getSupabaseBrowserClient();
  if (!isSupabaseConfigured || !supabase || !path) return null;
  const { data, error } = await supabase.storage
    .from("course-files")
    .createSignedUrl(path, 3600);
  if (error || !data?.signedUrl) return null;
  return data.signedUrl;
}
