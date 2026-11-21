import { NextRequest, NextResponse } from "next/server";
import { callTextAI, callVisionAI } from "@/lib/ai-provider";
import { enforceRateLimit } from "@/lib/rate-limit";

interface AnalyzePayload {
  mode: "question" | "correct" | "grade";
  questionText?: string;
  referenceCorrection?: string;
  assignmentTitle?: string;
  imageBase64?: string;
  mimeType?: string;
  lines: { id: number; text: string; kind?: "text" | "drawing" }[];
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
  drawingFeedback?: string;
  rubricBreakdown?: { criterion: string; points: number; maxPoints: number; comment: string }[];
  steps: { lineId: number; verdict: "correct" | "error" | "partial" | "info"; comment: string }[];
}

function detectLooksLikeStatementOnly(lines: { id: number; text: string; kind?: string }[]): boolean {
  const texts = lines.map((l) => l.text.trim()).filter(Boolean);
  if (texts.length === 0) return true;
  // If any line describes a student drawing/schema, it IS student work!
  if (lines.some((l) => l.kind === "drawing" || /^\[sch[eé]ma|\[dessin/i.test(l.text))) {
    return false;
  }
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
  const limited = enforceRateLimit(req, {
    bucket: "vision_analyze",
    limit: 12,
    windowMs: 5 * 60_000,
  });
  if (limited) return limited;

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
    "RÈGLE CRITIQUE N°1 — DÉTECTION DE RÉPONSE ÉLÈVE (TEXTE OU DESSIN) : " +
    "Détermine d'abord si l'élève a réellement produit un travail (calculs, réponses écrites, OU schémas/dessins/graphiques/circuits/vecteurs/molécules dessinés à la main → 'hasStudentWork': true) " +
    "OU s'il s'agit UNIQUEMENT d'un énoncé imprimé sans aucune réponse ni dessin de l'élève ('hasStudentWork': false). " +
    "Si 'hasStudentWork' est false : NE DONNE JAMAIS 10/10 ni 20/20 ! Mets 'status': 'no_work' et 'score': null (ou 0 en mode grade). ";

  const drawingInspectionRule =
    "RÈGLE CRITIQUE N°2 — ANALYSE OBLIGATOIRE DES DESSINS / SCHÉMAS DE L'ÉLÈVE : " +
    "Regarde attentivement l'image (si fournie) ET toutes les lignes '[Schéma]'. N'IGNORE JAMAIS un dessin de l'élève ! " +
    "Vérifie avec précision : sens et direction des vecteurs forces ($\\vec{P}$, $\\vec{R}$, $\\vec{f}$, $\\vec{T}$), point d'application et longueur relative, branchements et sens du courant/tension en convention récepteur ou générateur sur un circuit électrique, rayons lumineux et normale en optique, axes/unités/tangente/asymptote sur un graphique, liaisons/doublets en chimie, ou montage expérimental. " +
    "Si un dessin/schéma est présent, remplis OBLIGATOIREMENT le champ 'drawingFeedback' avec un retour précis sur ce qui est juste et ce qu'il faut corriger sur le dessin (sinon mets null). ";

  const modeInstruction =
    mode === "question"
      ? "MODE 'J'AI UNE QUESTION' (NON NOTÉ — TUTEUR SOCRATIQUE) : " +
        `Question de l'élève : « ${body.questionText || "Peux-tu m'aider à comprendre et démarrer cet exercice ?"} ». ` +
        "NE NOTE PAS l'élève ('score': null). Dans 'tutorReply', réponds clairement en français à sa question en tenant compte de ses dessins/brouillons éventuels, en rappelant les lois utiles et la première étape à faire SANS donner directement toute la réponse finale."
      : mode === "grade"
      ? "MODE 'NOTE-MOI' (NOTATION TYPE BAC SUR 20) : " +
        "Évalue la copie (texte + dessins/schémas !) sur 20 points ('maxScore': 20) selon un vrai barème de Bac de Physique-Chimie avec 'rubricBreakdown' (inclure un critère dédié au schéma/graphique si un dessin est présent). " +
        "Si 'hasStudentWork' est false (énoncé sans réponse ni dessin élève), mets 'score': 0, 'status': 'no_work'."
      : "MODE 'CORRIGE-MOI' (CORRECTION DÉTAILLÉE ÉTAPE PAR ÉTAPE SUR 10) : " +
        "Si 'hasStudentWork' est true, vérifie chaque ligne ET chaque dessin/schéma de l'élève, pointe clairement la PREMIÈRE erreur (calcul, formule, unité OU erreur sur le schéma), explique pourquoi c'est faux, et donne la bonne démarche dans 'tutorReply' ('maxScore': 10). " +
        "Si 'hasStudentWork' est false, mets 'score': null, 'status': 'no_work'.";

  const referenceBlock = body.referenceCorrection?.trim()
    ? `\nCORRIGÉ OFFICIEL & BARÈME DU PROFESSEUR (SOURCE DE VÉRITÉ ABSOLUE POUR NOTER CETTE COPIE${
        body.assignmentTitle ? ` — ${body.assignmentTitle}` : ""
      }) :\n${body.referenceCorrection.trim()}\nCompare strictement les réponses ET les schémas de l'élève à ce corrigé officiel.\n`
    : "";

  const diagramRule =
    "Si un schéma corrigé aide l'élève à visualiser son erreur (circuit, forces, titrage, optique), tu peux inclure un bloc ```svg ... ``` (viewBox=\"0 0 340 180\") dans 'tutorReply'. ";

  const system =
    "Tu es un professeur agrégé de Physique-Chimie au lycée français. Tu analyses la photo ET la transcription confirmée d'une copie soumise par un élève. " +
    baseDetectionRule +
    drawingInspectionRule +
    referenceBlock +
    modeInstruction +
    " " +
    diagramRule +
    " Retourne UNIQUEMENT un JSON valide : " +
    '{"hasStudentWork":true|false,"status":"correct"|"partially_correct"|"incorrect"|"no_work","score":null|number,"maxScore":10|20,"errorCode":null|"formule_inversee"|"erreur_calcul"|"unite_manquante"|"conversion_unites"|"chiffres_significatifs"|"erreur_schema"|"erreur_conceptuelle","summary":"bilan court en français","drawingFeedback":null|"analyse précise du dessin/schéma de l\'élève en français","tutorReply":"explication ou réponse pédagogique claire en français","rubricBreakdown":[{"criterion":"...","points":0,"maxPoints":5,"comment":"..."}],"steps":[{"lineId":1,"verdict":"correct"|"error"|"partial"|"info","comment":"explication courte en français"}]}';

  const content =
    "Transcription confirmée par l'élève :\n" +
    lines
      .map((l) => `Ligne ${l.id}${l.kind === "drawing" ? " [DESSIN/SCHÉMA]" : ""} : ${l.text}`)
      .join("\n");

  // Prefer multimodal Vision analysis whenever the actual photo is available so AI directly inspects student drawings!
  const aiRes =
    body.imageBase64 && body.mimeType
      ? await callVisionAI({
          system,
          prompt:
            "Observe DIRECTEMENT cette photo (y compris tous les dessins, schémas, vecteurs, circuits, graphiques et molécules tracés par l'élève) ainsi que la transcription confirmée ci-dessous, puis évalue l'ensemble :\n\n" +
            content,
          imageBase64: body.imageBase64,
          mimeType: body.mimeType,
          maxTokens: 2600,
          jsonMode: true,
        })
      : await callTextAI({
          system,
          messages: [{ role: "user", content }],
          maxTokens: 2400,
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
                ? "Énoncé détecté sans réponse rédigée ni schéma d'élève."
                : "Analyse terminée.")
          ),
          drawingFeedback:
            parsed.drawingFeedback && typeof parsed.drawingFeedback === "string"
              ? parsed.drawingFeedback.trim()
              : undefined,
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
            : "Écris d'abord tes réponses ou schémas sur feuille puis prends-les en photo pour obtenir une correction ou une note, ou utilise le mode « J'ai une question » pour te faire guider.",
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
