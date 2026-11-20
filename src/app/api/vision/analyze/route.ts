import { NextRequest, NextResponse } from "next/server";
import { callTextAI } from "@/lib/ai-provider";

interface AnalyzePayload {
  mode: "question" | "correct" | "grade";
  questionText?: string;
  lines: { id: number; text: string }[];
}

export interface PhotoAnalysisResult {
  status: "correct" | "partially_correct" | "incorrect";
  score: number;
  maxScore: number;
  errorCode: string | null;
  summary: string;
  tutorReply: string;
  steps: { lineId: number; verdict: "correct" | "error" | "partial" | "info"; comment: string }[];
}

export async function POST(req: NextRequest) {
  let body: AnalyzePayload;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Requête JSON invalide" }, { status: 400 });
  }

  const lines = (body.lines || []).filter((l) => l.text?.trim());
  if (lines.length === 0) {
    return NextResponse.json({ error: "Aucune ligne à analyser." }, { status: 400 });
  }

  const modeInstruction =
    body.mode === "grade"
      ? "Note la copie comme au Bac sur 10 points (crédit partiel, ne pénalise pas deux fois la même erreur)."
      : body.mode === "question"
      ? `L'élève pose cette question sur sa copie : « ${body.questionText || "(pas de question précise)"} ». Réponds-y dans 'tutorReply' en le guidant (méthode socratique, sans tout donner). Évalue quand même chaque ligne.`
      : "Corrige la copie étape par étape : pointe la PREMIÈRE erreur, explique-la, et indique la bonne démarche.";

  const system =
    "Tu es un correcteur expert de Physique-Chimie au lycée français. Tu analyses la transcription confirmée d'une copie manuscrite d'élève. " +
    "Analyse UNIQUEMENT ce qui est écrit (ne invente pas d'énoncé). Vérifie formules, calculs, unités et chiffres significatifs. " +
    modeInstruction +
    " Retourne UNIQUEMENT un JSON valide : " +
    '{"status":"correct"|"partially_correct"|"incorrect","score":0..10,"maxScore":10,"errorCode":null|"formule_inversee"|"erreur_calcul"|"unite_manquante"|"conversion_unites"|"chiffres_significatifs"|"erreur_conceptuelle","summary":"bilan court en français","tutorReply":"message pédagogique à l\'élève en français","steps":[{"lineId":1,"verdict":"correct"|"error"|"partial"|"info","comment":"explication courte en français"}]}';

  const content = lines.map((l) => `Ligne ${l.id} : ${l.text}`).join("\n");

  const aiRes = await callTextAI({
    system,
    messages: [{ role: "user", content }],
    maxTokens: 2000,
    jsonMode: true,
  });

  if (aiRes?.text) {
    const m = aiRes.text.match(/\{[\s\S]*\}/);
    if (m) {
      try {
        const parsed = JSON.parse(m[0]);
        const maxScore = Number(parsed.maxScore) > 0 ? Number(parsed.maxScore) : 10;
        const score = Math.max(0, Math.min(maxScore, Number(parsed.score ?? 0)));
        const result: PhotoAnalysisResult = {
          status: ["correct", "partially_correct", "incorrect"].includes(parsed.status)
            ? parsed.status
            : score >= maxScore * 0.95
            ? "correct"
            : score > 0
            ? "partially_correct"
            : "incorrect",
          score,
          maxScore,
          errorCode: parsed.errorCode || null,
          summary: String(parsed.summary || "Analyse terminée."),
          tutorReply: String(parsed.tutorReply || ""),
          steps: Array.isArray(parsed.steps)
            ? parsed.steps.map((s: Record<string, unknown>) => ({
                lineId: Number(s.lineId),
                verdict: ["correct", "error", "partial", "info"].includes(String(s.verdict))
                  ? (String(s.verdict) as PhotoAnalysisResult["steps"][number]["verdict"])
                  : "info",
                comment: String(s.comment || ""),
              }))
            : [],
        };
        return NextResponse.json({ analysis: result, provider: aiRes.provider });
      } catch {
        // fall through
      }
    }
  }

  return NextResponse.json(
    { error: "L'analyse IA n'a pas abouti. Réessaie dans quelques secondes." },
    { status: 503 }
  );
}
