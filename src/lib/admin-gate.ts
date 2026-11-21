/**
 * Edge-compatible cryptographic Admin Gate utility (Web Crypto HMAC-SHA256).
 * Runs cleanly in both Next.js Edge Middleware and Node.js API Route Handlers.
 *
 * Server-only env variables (NEVER expose as NEXT_PUBLIC_*):
 *   - ADMIN_ACCESS_CODE     : Secret passphrase required at /spc-admin-gate
 *   - ADMIN_SESSION_SECRET  : 32+ char random secret signing the HttpOnly cookie
 */

export const ADMIN_GATE_COOKIE = "spc_admin_gate";
export const ADMIN_GATE_TTL_SECONDS = 8 * 60 * 60; // 8 hours

function getSigningSecret(): string | null {
  const s = process.env.ADMIN_SESSION_SECRET || process.env.ADMIN_ACCESS_CODE || "";
  return s.trim().length >= 8 ? s.trim() : null;
}

/**
 * Constant-time string comparison to avoid timing side-channel leaks.
 */
export function timingSafeEqualStrings(a: string, b: string): boolean {
  const enc = new TextEncoder();
  const ab = enc.encode(a);
  const bb = enc.encode(b);
  const len = Math.max(ab.length, bb.length);
  let diff = ab.length ^ bb.length;
  for (let i = 0; i < len; i++) {
    diff |= (ab[i] ?? 0) ^ (bb[i] ?? 0);
  }
  return diff === 0;
}

export function isAdminAccessCodeConfigured(): boolean {
  return Boolean((process.env.ADMIN_ACCESS_CODE || "").trim().length >= 8);
}

export function isAdminAccessCodeValid(candidate: string): boolean {
  const expected = (process.env.ADMIN_ACCESS_CODE || "").trim();
  if (expected.length < 8) return false;
  return timingSafeEqualStrings(candidate.trim(), expected);
}

async function hmacSha256Hex(secret: string, message: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(message));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Mints a signed token bound strictly to a specific Admin userId + expiration timestamp.
 */
export async function signAdminGateToken(userId: string): Promise<string | null> {
  const secret = getSigningSecret();
  if (!secret || !userId) return null;
  const exp = Math.floor(Date.now() / 1000) + ADMIN_GATE_TTL_SECONDS;
  const payload = `${userId}.${exp}`;
  const sig = await hmacSha256Hex(secret, payload);
  return `${payload}.${sig}`;
}

/**
 * Verifies signature, expiration, and strict binding to the authenticated userId.
 */
export async function verifyAdminGateToken(
  token: string | undefined,
  expectedUserId: string
): Promise<boolean> {
  if (!token || !expectedUserId) return false;
  const secret = getSigningSecret();
  if (!secret) return false;

  const parts = token.split(".");
  if (parts.length !== 3) return false;
  const [userId, expStr, providedSig] = parts;
  if (!timingSafeEqualStrings(userId, expectedUserId)) return false;

  const exp = Number(expStr);
  if (!Number.isFinite(exp) || exp < Math.floor(Date.now() / 1000)) return false;

  const expectedSig = await hmacSha256Hex(secret, `${userId}.${expStr}`);
  return timingSafeEqualStrings(providedSig, expectedSig);
}
