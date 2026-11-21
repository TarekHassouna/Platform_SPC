import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import {
  ADMIN_GATE_COOKIE,
  ADMIN_GATE_TTL_SECONDS,
  signAdminGateToken,
} from "@/lib/admin-gate";

const MAX_ATTEMPTS = 5;
const WINDOW_MS = 15 * 60 * 1000;
const mfaAttempts = new Map<string, { count: number; resetAt: number }>();

function getClientIp(req: NextRequest): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return req.headers.get("x-real-ip") || "local";
}

export async function POST(request: NextRequest) {
  const ip = getClientIp(request);
  const now = Date.now();
  const entry = mfaAttempts.get(ip);
  if (entry && now < entry.resetAt && entry.count >= MAX_ATTEMPTS) {
    return NextResponse.json(
      { ok: false, error: "Trop de tentatives 2FA. Réessayez dans 15 minutes." },
      { status: 429 }
    );
  }

  let body: { factorId?: string; code?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Requête invalide." }, { status: 400 });
  }

  const factorId = (body.factorId || "").trim();
  const code = (body.code || "").replace(/\s+/g, "");
  if (!factorId || !/^\d{6}$/.test(code)) {
    return NextResponse.json(
      { ok: false, error: "Veuillez saisir un code à 6 chiffres valide." },
      { status: 400 }
    );
  }

  const supabase = await getSupabaseServerClient();
  if (!supabase) {
    return NextResponse.json({ ok: false, error: "Service indisponible." }, { status: 503 });
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "Session expirée. Reconnectez-vous." }, { status: 401 });
  }

  // Verify user is an allowlisted Admin
  const { data: rpcIsAdmin, error: rpcError } = await supabase.rpc("is_admin_user");
  const isAdmin = !rpcError ? rpcIsAdmin === true : false;
  if (!isAdmin) {
    await supabase.auth.signOut();
    return NextResponse.json({ ok: false, error: "Accès refusé." }, { status: 403 });
  }

  // Verify TOTP 6-digit code via Supabase MFA
  const { error: mfaError } = await supabase.auth.mfa.challengeAndVerify({
    factorId,
    code,
  });

  if (mfaError) {
    if (!entry || now > entry.resetAt) {
      mfaAttempts.set(ip, { count: 1, resetAt: now + WINDOW_MS });
    } else {
      entry.count += 1;
    }
    return NextResponse.json(
      { ok: false, error: "Code 2FA invalide ou expiré. Vérifiez votre application Authenticator." },
      { status: 401 }
    );
  }

  const token = await signAdminGateToken(user.id);
  if (!token) {
    return NextResponse.json({ ok: false, error: "Erreur de session." }, { status: 500 });
  }

  mfaAttempts.delete(ip);
  const res = NextResponse.json({ ok: true });
  res.cookies.set(ADMIN_GATE_COOKIE, token, {
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: ADMIN_GATE_TTL_SECONDS,
  });
  return res;
}
