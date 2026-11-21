import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";

const ALLOWED_ROLES = new Set(["student", "teacher", "parent"]);

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next");
  const requestedRole = searchParams.get("role");
  const oauthError = searchParams.get("error_description") || searchParams.get("error");

  if (oauthError) {
    return NextResponse.redirect(
      `${origin}/auth/login?error=${encodeURIComponent(oauthError)}`
    );
  }

  const supabase = await getSupabaseServerClient();
  if (!supabase || !code) {
    return NextResponse.redirect(`${origin}/auth/login`);
  }

  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    return NextResponse.redirect(
      `${origin}/auth/login?error=${encodeURIComponent(error.message)}`
    );
  }

  if (next && next.startsWith("/")) {
    return NextResponse.redirect(`${origin}${next}`);
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("default_role")
      .eq("id", user.id)
      .maybeSingle();

    let role = profile?.default_role || user.user_metadata?.role || "student";

    // If the user explicitly picked a role on /auth/signup before clicking "S'inscrire avec Google"
    if (requestedRole && ALLOWED_ROLES.has(requestedRole) && role === "student" && requestedRole !== "student") {
      await supabase
        .from("profiles")
        .update({ default_role: requestedRole })
        .eq("id", user.id);
      await supabase.auth.updateUser({ data: { role: requestedRole } });
      role = requestedRole;
    }

    if (role === "org_admin" || role === "platform_admin") {
      await supabase.auth.signOut();
      return NextResponse.redirect(`${origin}/`);
    }
    if (role === "teacher") return NextResponse.redirect(`${origin}/teacher/dashboard`);
    if (role === "parent") return NextResponse.redirect(`${origin}/parent/dashboard`);
  }

  return NextResponse.redirect(`${origin}/dashboard`);
}
