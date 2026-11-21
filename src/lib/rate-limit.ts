import { NextRequest, NextResponse } from "next/server";

interface BucketEntry {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, BucketEntry>();
let lastPruneAt = Date.now();

function pruneExpired(now: number) {
  // Periodic lightweight cleanup to keep memory bounded
  if (now - lastPruneAt < 60_000) return;
  lastPruneAt = now;
  for (const [key, entry] of buckets.entries()) {
    if (now > entry.resetAt) {
      buckets.delete(key);
    }
  }
}

export function getClientIdentifier(req: NextRequest): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  const realIp = req.headers.get("x-real-ip");
  if (realIp) return realIp.trim();
  return "local";
}

/**
 * Lightweight per-IP sliding-window rate limiter to protect Gemini API quota
 * against rapid bursts / accidental spam across 600+ students.
 */
export function enforceRateLimit(
  req: NextRequest,
  opts: {
    bucket: string;
    limit: number;
    windowMs: number;
  }
): NextResponse | null {
  const now = Date.now();
  pruneExpired(now);

  const clientId = getClientIdentifier(req);
  const key = `${opts.bucket}:${clientId}`;
  const entry = buckets.get(key);

  if (!entry || now > entry.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + opts.windowMs });
    return null;
  }

  if (entry.count >= opts.limit) {
    const retryAfterSec = Math.max(1, Math.ceil((entry.resetAt - now) / 1000));
    return NextResponse.json(
      {
        error: `Trop de requêtes en peu de temps. Patientez ${retryAfterSec} seconde(s) avant de réessayer.`,
      },
      {
        status: 429,
        headers: { "Retry-After": String(retryAfterSec) },
      }
    );
  }

  entry.count += 1;
  return null;
}
