import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import {
  ADMIN_GATE_COOKIE,
  ADMIN_GATE_TTL_SECONDS,
  isAdminAccessCodeConfigured,
  isAdminAccessCodeValid,
  signAdminGateToken,
} from "@/lib/admin-gate";

// In-memory brute-force protection: max 5 failed attempts per IP per 15 minutes
const MAX_ATTEMPTS = 5;
const WINDOW_MS = 15 * 60 * 1000;
const attemptsByIp = new Map<string, { count: number; resetAt: number }>();

function getClientIp(req: NextRequest): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return req.headers.get("x-real-ip") || "local";
}

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = attemptsByIp.get(ip);
  if (!entry || now > entry.resetAt) return true;
  return entry.count < MAX_ATTEMPTS;
}

function recordFailure(ip: string) {
  const now = Date.now();
  const entry = attemptsByIp.get(ip);
  if (!entry || now > entry.resetAt) {
    attemptsByIp.set(ip, { count: 1, resetAt: now + WINDOW_MS });
  } else {
    entry.count += 1;
  }
}

function clearFailures(ip: string) {
  attemptsByIp.delete(ip);
}

export async function POST(request: NextRequest) {
  const ip = getClientIp(request);
  if (!checkRateLimit(ip)) {
    return NextResponse.json(
      { ok: false, error: "Trop de tentatives. Réessayez dans 15 minutes." },
      { status: 429 }
    );
  }

  if (!isAdminAccessCodeConfigured()) {
    return NextResponse.json(
      { ok: false, error: "Portail administrateur non configuré sur le serveur." },
      { status: 503 }
    );
  }

  let body: { email?: string; password?: string; accessCode?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Requête invalide." }, { status: 400 });
  }

  const email = (body.email || "").trim().toLowerCase();
  const password = body.password || "";
  const accessCode = body.accessCode || "";

  if (!email || !password || !accessCode) {
    return NextResponse.json(
      { ok: false, error: "Veuillez remplir tous les champs requis." },
      { status: 400 }
    );
  }

  // Factor 1: Server-only Secret Admin Access Code (constant-time check)
  if (!isAdminAccessCodeValid(accessCode)) {
    recordFailure(ip);
    return NextResponse.json(
      { ok: false, error: "Identifiants ou clé d'accès invalides." },
      { status: 401 }
    );
  }

  const supabase = await getSupabaseServerClient();
  if (!supabase) {
    return NextResponse.json(
      { ok: false, error: "Service d'authentification indisponible." },
      { status: 503 }
    );
  }

  // Factor 2: Supabase Email + Password verification
  const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (signInError || !signInData.user) {
    recordFailure(ip);
    return NextResponse.json(
      { ok: false, error: "Identifiants ou clé d'accès invalides." },
      { status: 401 }
    );
  }

  // Factor 3: Database Admin role + approved status + admin_emails allowlist verification
  let verifiedAdmin = false;
  const { data: rpcIsAdmin, error: rpcError } = await supabase.rpc("is_admin_user");
  if (!rpcError) {
    verifiedAdmin = rpcIsAdmin === true;
  } else {
    // Fallback if admin_approval_crud.sql was not run yet
    const { data: prof } = await supabase
      .from("profiles")
      .select("default_role")
      .eq("id", signInData.user.id)
      .maybeSingle();
    verifiedAdmin =
      prof?.default_role === "org_admin" || prof?.default_role === "platform_admin";
  }

  if (!verifiedAdmin) {
    await supabase.auth.signOut();
    recordFailure(ip);
    return NextResponse.json(
      { ok: false, error: "Identifiants ou clé d'accès invalides." },
      { status: 403 }
    );
  }

  // Factor 4: Check if Admin has 2FA (TOTP Authenticator App) enrolled
  const { data: factorsData } = await supabase.auth.mfa.listFactors();
  const verifiedTotp = (factorsData?.totp || []).find((f) => f.status === "verified");

  if (verifiedTotp) {
    // Do NOT issue spc_admin_gate cookie until the 6-digit TOTP code is verified!
    return NextResponse.json({
      ok: true,
      requiresMfa: true,
      factorId: verifiedTotp.id,
    });
  }

  // No 2FA enrolled yet -> mint HMAC-signed HttpOnly Admin Gate cookie
  const token = await signAdminGateToken(signInData.user.id);
  if (!token) {
    await supabase.auth.signOut();
    return NextResponse.json(
      { ok: false, error: "Erreur de signature de session." },
      { status: 500 }
    );
  }

  clearFailures(ip);
  const res = NextResponse.json({ ok: true, requiresMfa: false });
  res.cookies.set(ADMIN_GATE_COOKIE, token, {
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: ADMIN_GATE_TTL_SECONDS,
  });
  return res;
}

export async function DELETE() {
  const supabase = await getSupabaseServerClient();
  if (supabase) {
    await supabase.auth.signOut();
  }
  const res = NextResponse.json({ ok: true });
  res.cookies.set(ADMIN_GATE_COOKIE, "", {
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
  return res;
}
