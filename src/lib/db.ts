import { getSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabase/client";
import type { UserProfile, UserRole } from "@/lib/auth-context";

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
      .select("id, email, first_name, last_name, default_role, level")
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

  const profile: UserProfile = {
    id: row.id,
    email: row.email,
    firstName: row.first_name,
    lastName: row.last_name || "",
    role: (row.default_role as UserRole) || "student",
    level: row.level || undefined,
    school: primaryOrg?.name,
    orgSeats: primaryOrg?.seats_purchased,
    childName: childLink?.invited_child_name,
    childEmail: childLink?.invited_child_email || undefined,
    childLevel: childLink?.invited_child_level || undefined,
  };

  return { profile, memberships };
}

/**
 * Runs relational onboarding after signup in Supabase PostgreSQL:
 * - Student with classCode -> RPC join_class_by_code() -> inserts into class_members
 * - Parent -> inserts row in parent_child_links (auto-links when child signs up!)
 * - Org Admin -> RPC create_organization_with_admin() -> creates organization + membership + subscription
 * - Teacher -> joins organization by schoolCode or creates personal/school org row
 */
export async function completeRelationalOnboarding(
  userId: string,
  profile: UserProfile
): Promise<{ warnings: string[] }> {
  const supabase = getSupabaseBrowserClient();
  const warnings: string[] = [];
  if (!isSupabaseConfigured || !supabase) return { warnings };

  // 1. Student joining a class via invite code
  if (profile.role === "student" && profile.classCode?.trim()) {
    const { data, error } = await supabase.rpc("join_class_by_code", {
      p_invite_code: profile.classCode.trim(),
    });
    if (error || (data && !data.ok)) {
      warnings.push(
        `Code classe « ${profile.classCode} » non trouvé : vous pourrez rejoindre une classe plus tard.`
      );
    }
  }

  // 2. Parent creating a relational parent_child_links row
  if (profile.role === "parent" && profile.childName?.trim()) {
    const { error } = await supabase.from("parent_child_links").insert({
      parent_id: userId,
      invited_child_name: profile.childName.trim(),
      invited_child_email: profile.childEmail?.trim() || null,
      invited_child_level: profile.childLevel || null,
      status: "pending",
      parental_consent_given: true,
    });
    if (error) {
      warnings.push("Lien parent-enfant en attente de synchronisation.");
    }
  }

  // 3. Organization Admin creating an organization + admin membership + trial subscription
  if (profile.role === "org_admin" && profile.school?.trim()) {
    const { error } = await supabase.rpc("create_organization_with_admin", {
      p_name: profile.school.trim(),
      p_seats: profile.orgSeats || 60,
    });
    if (error) {
      warnings.push("Création de l'établissement différée.");
    }
  }

  // 4. Teacher joining an existing school or creating their default class
  if (profile.role === "teacher" && profile.school?.trim()) {
    const { data: existingOrg } = profile.schoolCode?.trim()
      ? await supabase
          .from("organizations")
          .select("id")
          .eq("invite_code", profile.schoolCode.trim().toUpperCase())
          .maybeSingle()
      : { data: null };

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
 * Persists a student's evaluated exercise attempt into submissions + evaluation_results
 */
export async function recordExerciseSubmission(params: {
  studentId: string;
  renderedParams: Record<string, unknown>;
  rawAnswers: Record<string, string>;
  score: number;
  maxScore: number;
  status: "correct" | "partially_correct" | "incorrect" | "unreadable";
  engine: string;
}) {
  const supabase = getSupabaseBrowserClient();
  if (!isSupabaseConfigured || !supabase) return;

  const { data: sub } = await supabase
    .from("submissions")
    .insert({
      student_id: params.studentId,
      input_mode: "typed",
      rendered_params: params.renderedParams,
      raw_answers: params.rawAnswers,
    })
    .select("id")
    .single();

  if (sub?.id) {
    await supabase.from("evaluation_results").insert({
      submission_id: sub.id,
      status: params.status,
      score: params.score,
      max_score: params.maxScore,
      engine: params.engine,
    });
  }
}
