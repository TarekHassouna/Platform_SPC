import { NextRequest, NextResponse } from "next/server";
import { callTextAI } from "@/lib/ai-provider";

interface AnalyzePayload {
  mode: "question" | "correct" | "grade";
  questionText?: string;
  lines: { id: number; text: string }[];
}

export interface PhotoAnalysisResult {
  mode: "question" | "correct" | "grade";
  hasStudentWork: boolean;
  status: "correct" | "partially_correct" | "incorrect" | "no_work";
  score: number | null;
  maxScore: number;
  errorCode: string | null;
  summary: string;
  tutorReply: string;
  rubricBreakdown?: { criterion: string; points: number; maxPoints: number; comment: string }[];
  steps: { lineId: number; verdict: "correct" | "error" | "partial" | "info"; comment: string }[];
}

function detectLooksLikeStatementOnly(lines: { id: number; text: string }[]): boolean {
  const texts = lines.map((l) => l.text.trim()).filter(Boolean);
  if (texts.length === 0) return true;
  const questionVerbRegex =
    /\b(exprimer|calculer|déterminer|determiner|rappeler|montrer|démontrer|demontrer|justifier|expliquer|donner|en déduire|quelle?|quel|comment|pourquoi|établir|etablir)\b|\?/i;
  const answerCalcRegex =
    /(?:^|\s)[a-zA-Z_]+\s*=\s*[^?]+(?:[+\-*/×÷]|(?:\d+(?:[.,]\d+)?\s*[a-zA-ZΩ°µ%]))/;

  let questionLikeCount = 0;
  let calcLikeCount = 0;
  for (const t of texts) {
    if (questionVerbRegex.test(t)) questionLikeCount++;
    if (answerCalcRegex.test(t) && !questionVerbRegex.test(t)) calcLikeCount++;
  }
  return questionLikeCount > 0 && calcLikeCount === 0;
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

  const mode: "question" | "correct" | "grade" =
    body.mode === "question" || body.mode === "grade" ? body.mode : "correct";

  const baseDetectionRule =
    "RÈGLE CRITIQUE N°1 — DÉTECTION DE RÉPONSE ÉLÈVE : " +
    "Détermine d'abord si l'élève a réellement rédigé des réponses / calculs / raisonnements sur cette feuille ('hasStudentWork': true) " +
    "OU s'il s'agit UNIQUEMENT d'un énoncé d'exercice / de questions imprimées sans réponse d'élève ('hasStudentWork': false). " +
    "Si 'hasStudentWork' est false : NE DONNE JAMAIS 10/10 ni 20/20 ! Mets 'status': 'no_work' et 'score': null (en mode question, aide l'élève sur l'énoncé ; en mode correct ou grade, préviens-le qu'aucune réponse d'élève n'est présente sur la photo). ";

  const modeInstruction =
    mode === "question"
      ? "MODE 'J'AI UNE QUESTION' (NON NOTÉ — TUTEUR SOCRATIQUE) : " +
        `Question de l'élève : « ${body.questionText || "Peux-tu m'aider à comprendre et démarrer cet exercice ?"} ». ` +
        "NE NOTE PAS l'élève ('score': null). Dans 'tutorReply', réponds clairement en français à sa question en l'aidant à comprendre l'énoncé, en rappelant les lois utiles et la première étape à faire SANS lui donner directement toute la réponse finale. Dans 'steps', commente brièvement les données ou étapes clés (verdict: 'info' ou 'correct'/'error' s'il y a un brouillon)."
      : mode === "grade"
      ? "MODE 'NOTE-MOI' (NOTATION TYPE BAC SUR 20) : " +
        "Évalue la copie sur 20 points ('maxScore': 20) selon un vrai barème de Bac de Physique-Chimie avec 'rubricBreakdown' (3 à 4 critères : Lois & formules, Démarche & calculs, Unités & chiffres significatifs, Rédaction/justification). " +
        "Si 'hasStudentWork' est false (énoncé sans réponse), mets 'score': 0, 'status': 'no_work', et explique dans 'summary' qu'une copie sans réponse ne peut pas être notée."
      : "MODE 'CORRIGE-MOI' (CORRECTION DÉTAILLÉE ÉTAPE PAR ÉTAPE SUR 10) : " +
        "Si 'hasStudentWork' est true, vérifie chaque ligne rédigée par l'élève, pointe clairement la PREMIÈRE erreur physique/mathématique/d'unité, explique pourquoi c'est faux, et donne la bonne démarche dans 'tutorReply' ('maxScore': 10). " +
        "Si 'hasStudentWork' est false (énoncé sans réponse), mets 'score': null, 'status': 'no_work', et invite l'élève à rédiger d'abord sa réponse ou à utiliser le mode 'J'ai une question'.";

  const system =
    "Tu es un professeur agrégé de Physique-Chimie au lycée français. Tu analyses la transcription d'une photo soumise par un élève. " +
    baseDetectionRule +
    modeInstruction +
    " Retourne UNIQUEMENT un JSON valide : " +
    '{"hasStudentWork":true|false,"status":"correct"|"partially_correct"|"incorrect"|"no_work","score":null|number,"maxScore":10|20,"errorCode":null|"formule_inversee"|"erreur_calcul"|"unite_manquante"|"conversion_unites"|"chiffres_significatifs"|"erreur_conceptuelle","summary":"bilan court en français","tutorReply":"explication ou réponse pédagogique claire en français","rubricBreakdown":[{"criterion":"...","points":0,"maxPoints":5,"comment":"..."}],"steps":[{"lineId":1,"verdict":"correct"|"error"|"partial"|"info","comment":"explication courte en français"}]}';

  const content = lines.map((l) => `Ligne ${l.id} : ${l.text}`).join("\n");

  const aiRes = await callTextAI({
    system,
    messages: [{ role: "user", content }],
    maxTokens: 2200,
    jsonMode: true,
  });

  if (aiRes?.text) {
    const m = aiRes.text.match(/\{[\s\S]*\}/);
    if (m) {
      try {
        const parsed = JSON.parse(m[0]);
        const hasStudentWork = parsed.hasStudentWork !== false;
        const maxScore = mode === "grade" ? 20 : Number(parsed.maxScore) > 0 ? Number(parsed.maxScore) : 10;

        let score: number | null = null;
        if (mode === "question") {
          score = null;
        } else if (!hasStudentWork) {
          score = mode === "grade" ? 0 : null;
        } else if (parsed.score !== null && parsed.score !== undefined && Number.isFinite(Number(parsed.score))) {
          score = Math.max(0, Math.min(maxScore, Number(parsed.score)));
        }

        const status: PhotoAnalysisResult["status"] = !hasStudentWork
          ? "no_work"
          : ["correct", "partially_correct", "incorrect"].includes(parsed.status)
          ? parsed.status
          : score !== null && score >= maxScore * 0.95
          ? "correct"
          : score !== null && score > 0
          ? "partially_correct"
          : "incorrect";

        const result: PhotoAnalysisResult = {
          mode,
          hasStudentWork,
          status,
          score,
          maxScore,
          errorCode: hasStudentWork ? parsed.errorCode || null : null,
          summary: String(
            parsed.summary ||
              (!hasStudentWork
                ? "Énoncé détecté sans réponse rédigée par l'élève."
                : "Analyse terminée.")
          ),
          tutorReply: String(parsed.tutorReply || ""),
          rubricBreakdown:
            mode === "grade" && hasStudentWork && Array.isArray(parsed.rubricBreakdown)
              ? parsed.rubricBreakdown.map((r: Record<string, unknown>) => ({
                  criterion: String(r.criterion || "Critère"),
                  points: Number(r.points ?? 0),
                  maxPoints: Number(r.maxPoints ?? 5),
                  comment: String(r.comment || ""),
                }))
              : undefined,
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

  // Safe deterministic fallback if AI is temporarily overloaded (503) — NEVER awards 20/20 to blank statements!
  const looksStatementOnly = detectLooksLikeStatementOnly(lines);
  if (looksStatementOnly || mode === "question") {
    return NextResponse.json({
      analysis: {
        mode,
        hasStudentWork: !looksStatementOnly,
        status: "no_work",
        score: mode === "grade" ? 0 : null,
        maxScore: mode === "grade" ? 20 : 10,
        errorCode: null,
        summary: looksStatementOnly
          ? "Cette photo contient uniquement un énoncé d'exercice sans réponse rédigée."
          : "Mode aide active — aucune note attribuée.",
        tutorReply:
          mode === "question"
            ? "Repère d'abord les grandeurs données dans l'énoncé et leurs unités SI, puis identifie la loi fondamentale du chapitre qui relie ces grandeurs avant de poser ton calcul."
            : "Écris d'abord tes réponses sur feuille puis prends-les en photo pour obtenir une correction ou une note, ou utilise le mode « J'ai une question » pour te faire guider.",
        steps: lines.map((l) => ({
          lineId: l.id,
          verdict: "info",
          comment: "Énoncé / donnée identifiée.",
        })),
      } satisfies PhotoAnalysisResult,
      provider: "spc_deterministic",
    });
  }

  return NextResponse.json(
    { error: "Le service d'analyse IA est momentanément saturé. Réessaie dans quelques secondes." },
    { status: 503 }
  );
}
