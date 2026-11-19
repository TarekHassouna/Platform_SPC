import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next");

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

  // Resolve real role from relational profiles table
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("default_role")
      .eq("id", user.id)
      .maybeSingle();

    const role = profile?.default_role || user.user_metadata?.role || "student";
    if (role === "teacher") return NextResponse.redirect(`${origin}/teacher/dashboard`);
    if (role === "parent") return NextResponse.redirect(`${origin}/parent/dashboard`);
    if (role === "org_admin") return NextResponse.redirect(`${origin}/org/dashboard`);
  }

  return NextResponse.redirect(`${origin}/dashboard`);
}
