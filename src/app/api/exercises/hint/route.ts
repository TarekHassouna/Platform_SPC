import { NextRequest, NextResponse } from "next/server";
import { callTextAI } from "@/lib/ai-provider";
import { enforceRateLimit } from "@/lib/rate-limit";

interface HintPayload {
  title?: string;
  statement?: string;
  questionPrompt: string;
  expected?: string;
  studentAnswer?: string;
}

export async function POST(req: NextRequest) {
  const limited = enforceRateLimit(req, {
    bucket: "exercises_hint",
    limit: 20,
    windowMs: 5 * 60_000,
  });
  if (limited) return limited;

  let body: HintPayload;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON payload" }, { status: 400 });
  }

  if (!body.questionPrompt?.trim()) {
    return NextResponse.json({ error: "Question manquante" }, { status: 400 });
  }

  const aiRes = await callTextAI({
    system:
      "Tu es un professeur de Physique-Chimie au lycée français qui donne un INDICE pédagogique court et utile à un élève. " +
      "RÈGLES STRICTES : " +
      "1) NE DONNE JAMAIS la réponse finale ni la formule complète résolue. " +
      "2) Donne 1 à 2 phrases précises en français qui rappellent la bonne loi physique, la grandeur à identifier ou la première étape de méthode. " +
      "3) Sois concret par rapport aux données et grandeurs de l'énoncé. " +
      'Retourne UNIQUEMENT un JSON valide : {"hint":"..."}',
    messages: [
      {
        role: "user",
        content: [
          body.title ? `Exercice : ${body.title}` : "",
          body.statement ? `Énoncé : ${body.statement}` : "",
          `Question : ${body.questionPrompt}`,
          body.expected ? `Corrigé (CONFIDENTIEL, NE PAS RÉVÉLER) : ${body.expected}` : "",
          body.studentAnswer ? `Tentative actuelle de l'élève : ${body.studentAnswer}` : "",
        ]
          .filter(Boolean)
          .join("\n"),
      },
    ],
    maxTokens: 600,
    jsonMode: true,
  });

  if (aiRes?.text) {
    const m = aiRes.text.match(/\{[\s\S]*\}/);
    if (m) {
      try {
        const parsed = JSON.parse(m[0]);
        if (parsed.hint && typeof parsed.hint === "string") {
          return NextResponse.json({ hint: parsed.hint.trim(), provider: aiRes.provider });
        }
      } catch {
        // fall through
      }
    }
  }

  return NextResponse.json(
    {
      hint: "Identifie d'abord les grandeurs connues dans l'énoncé, vérifie leurs unités SI, puis écris la relation fondamentale du chapitre qui relie ces grandeurs avant d'isoler l'inconnue.",
      provider: "fallback",
    },
    { status: 200 }
  );
}
