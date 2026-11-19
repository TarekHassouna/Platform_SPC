/**
 * Provider-agnostic AI Gateway (Vision Doc §9.3 & §15 Principle #12)
 * Supports Anthropic Claude API (ANTHROPIC_API_KEY) and Google Gemini API (GEMINI_API_KEY).
 * Enforces per-user daily quotas to keep costs predictable across 600+ students.
 */

export type AIQuotaKind = "tutor" | "vision" | "generate";

const DAILY_LIMITS: Record<AIQuotaKind, number> = {
  tutor: 30,
  vision: 10,
  generate: 20,
};

// In-memory daily quota tracker keyed by `${date}:${userId}:${kind}`
const usageMap = new Map<string, number>();

export function checkAndIncrementQuota(userId: string, kind: AIQuotaKind): {
  allowed: boolean;
  used: number;
  limit: number;
  remaining: number;
} {
  const day = new Date().toISOString().slice(0, 10);
  const key = `${day}:${userId || "anon"}:${kind}`;
  const limit = DAILY_LIMITS[kind];
  const used = usageMap.get(key) || 0;

  if (used >= limit) {
    return { allowed: false, used, limit, remaining: 0 };
  }

  const next = used + 1;
  usageMap.set(key, next);
  return { allowed: true, used: next, limit, remaining: limit - next };
}

export function getActiveAIProvider(): "claude" | "gemini" | "fallback" {
  if (process.env.ANTHROPIC_API_KEY && !process.env.ANTHROPIC_API_KEY.startsWith("your-")) {
    return "claude";
  }
  if (process.env.GEMINI_API_KEY && !process.env.GEMINI_API_KEY.startsWith("your-")) {
    return "gemini";
  }
  return "fallback";
}

export async function callTextAI(params: {
  system: string;
  messages: { role: "user" | "assistant"; content: string }[];
  maxTokens?: number;
}): Promise<{ text: string; provider: "claude" | "gemini" } | null> {
  const provider = getActiveAIProvider();
  const maxTokens = params.maxTokens ?? 500;

  if (provider === "claude") {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY!,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: process.env.CLAUDE_MODEL || "claude-3-5-haiku-latest",
        max_tokens: maxTokens,
        system: params.system,
        messages: params.messages,
      }),
    });
    if (res.ok) {
      const data = await res.json();
      const text = data.content?.[0]?.text;
      if (text) return { text, provider: "claude" };
    }
  }

  if (provider === "gemini") {
    const model = process.env.GEMINI_MODEL || "gemini-2.0-flash";
    const contents = params.messages.map((m) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }],
    }));
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${process.env.GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: params.system }] },
          contents,
          generationConfig: { maxOutputTokens: maxTokens, temperature: 0.4 },
        }),
      }
    );
    if (res.ok) {
      const data = await res.json();
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (text) return { text, provider: "gemini" };
    }
  }

  return null;
}

export async function callVisionAI(params: {
  system: string;
  prompt: string;
  imageBase64: string;
  mimeType: string;
}): Promise<{ text: string; provider: "claude" | "gemini" } | null> {
  const provider = getActiveAIProvider();

  if (provider === "claude") {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY!,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: process.env.CLAUDE_VISION_MODEL || "claude-3-5-sonnet-latest",
        max_tokens: 900,
        system: params.system,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "image",
                source: {
                  type: "base64",
                  media_type: params.mimeType,
                  data: params.imageBase64,
                },
              },
              { type: "text", text: params.prompt },
            ],
          },
        ],
      }),
    });
    if (res.ok) {
      const data = await res.json();
      const text = data.content?.[0]?.text;
      if (text) return { text, provider: "claude" };
    }
  }

  if (provider === "gemini") {
    const model = process.env.GEMINI_MODEL || "gemini-2.0-flash";
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${process.env.GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: params.system }] },
          contents: [
            {
              role: "user",
              parts: [
                { inlineData: { mimeType: params.mimeType, data: params.imageBase64 } },
                { text: params.prompt },
              ],
            },
          ],
          generationConfig: { maxOutputTokens: 900, temperature: 0.2 },
        }),
      }
    );
    if (res.ok) {
      const data = await res.json();
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (text) return { text, provider: "gemini" };
    }
  }

  return null;
}
