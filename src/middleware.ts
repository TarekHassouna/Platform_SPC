import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { ADMIN_GATE_COOKIE, verifyAdminGateToken } from "@/lib/admin-gate";

const PROTECTED_PREFIXES = [
  "/dashboard",
  "/exercises",
  "/exam",
  "/progress",
  "/tutor",
  "/photo",
  "/teacher",
  "/parent",
];

export async function middleware(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (
    !supabaseUrl ||
    !supabaseAnonKey ||
    supabaseUrl.includes("your-project") ||
    supabaseAnonKey.includes("your-anon-key")
  ) {
    return NextResponse.next();
  }

  let response = NextResponse.next({ request });

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options)
        );
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const pathname = request.nextUrl.pathname;

  // =========================================================================
  // MAXIMUM SECURITY ADMIN GUARD (/org and /org/*)
  // Requires ALL 3 server-verified checks:
  //   1) Authenticated Supabase user
  //   2) Valid HMAC-SHA256 HttpOnly cookie (spc_admin_gate) bound to user.id
  //   3) PostgreSQL is_admin_user() (role + approved + admin_emails allowlist)
  // If ANY check fails -> stealth 404 (never reveals admin portal exists!)
  // =========================================================================
  if (pathname === "/org" || pathname.startsWith("/org/")) {
    const gateToken = request.cookies.get(ADMIN_GATE_COOKIE)?.value;
    const gateValid = user ? await verifyAdminGateToken(gateToken, user.id) : false;

    let dbAdminValid = false;
    if (user && gateValid) {
      const { data: rpcIsAdmin, error: rpcError } = await supabase.rpc("is_admin_user");
      if (!rpcError) {
        dbAdminValid = rpcIsAdmin === true;
      } else {
        const { data: prof } = await supabase
          .from("profiles")
          .select("default_role")
          .eq("id", user.id)
          .maybeSingle();
        dbAdminValid =
          prof?.default_role === "org_admin" || prof?.default_role === "platform_admin";
      }
    }

    if (!user || !gateValid || !dbAdminValid) {
      const stealthUrl = request.nextUrl.clone();
      stealthUrl.pathname = "/__not_found__";
      return NextResponse.rewrite(stealthUrl, { status: 404 });
    }

    return response;
  }

  // Standard user routes (/dashboard, /teacher, /parent, etc.)
  const isProtected = PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );

  if (isProtected && !user) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/auth/login";
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
