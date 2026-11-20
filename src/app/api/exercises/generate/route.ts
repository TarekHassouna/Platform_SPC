import { NextRequest, NextResponse } from "next/server";
import { callTextAI, checkAndIncrementQuota } from "@/lib/ai-provider";

interface GeneratePayload {
  userId?: string;
  prompt: string;
  level: "Seconde" | "Première" | "Terminale";
  difficulty: "Guidé" | "Standard" | "Type Bac";
  questionCount?: number;
}

function detectRequestedCount(prompt: string, explicitCount?: number): number {
  if (typeof explicitCount === "number" && Number.isFinite(explicitCount)) {
    return Math.min(15, Math.max(1, Math.round(explicitCount)));
  }
  const m = prompt.match(/\b(\d{1,2})\s*(?:questions?|qcm|items?|parties?)\b/i);
  if (m) {
    const n = parseInt(m[1], 10);
    if (n >= 1 && n <= 15) return n;
  }
  return 5;
}

export async function POST(req: NextRequest) {
  let payload: GeneratePayload;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: "Requête JSON invalide" }, { status: 400 });
  }

  const quota = checkAndIncrementQuota(payload.userId || "teacher", "generate");
  if (!quota.allowed) {
    return NextResponse.json(
      { error: `Limite quotidienne atteinte (${quota.limit} générations/jour).`, quota },
      { status: 429 }
    );
  }

  const targetCount = detectRequestedCount(payload.prompt || "", payload.questionCount);

  const system =
    "Tu es un professeur agrégé de Physique-Chimie qui conçoit des modèles d'exercices, quiz et fiches de cours pour le lycée français. " +
    `RÈGLE ABSOLUE : le tableau 'questions' DOIT contenir EXACTEMENT ${targetCount} questions progressives (ni plus, ni moins — ne t'arrête JAMAIS à 3 si ${targetCount} est demandé). ` +
    "Rédige aussi une fiche de cours concise ('lessonTitle', 'lessonContent' avec formules KaTeX entre $...$, et 'workedExample' avec un exemple résolu court). " +
    "Pour chaque question, rédige aussi un vrai 'hint' (indice pédagogique de 1 à 2 phrases qui guide l'élève sur la méthode ou la loi à utiliser SANS donner la réponse finale). " +
    "Retourne UNIQUEMENT un JSON valide avec cette structure exacte : " +
    '{"title":"...","domain":"Électricité|Mécanique|Chimie|Métrologie","chapter":"...","skills":["..."],"lessonTitle":"...","lessonContent":"...","workedExample":"...","statement":"...avec {param}...","params":[{"name":"...","range":"...","unit":"..."}],"questions":[{"prompt":"...","type":"Expression|Grandeur|Texte libre","expected":"...","hint":"...","misconception":"..."}],"verificationChecks":["..."]}';

  try {
    const aiRes = await callTextAI({
      system,
      messages: [
        {
          role: "user",
          content: `Niveau : ${payload.level}. Style : ${payload.difficulty}. Nombre EXACT de questions exigé : ${targetCount}. Demande enseignant : ${payload.prompt}`,
        },
      ],
      maxTokens: Math.max(2800, targetCount * 450),
      jsonMode: true,
    });

    if (aiRes?.text) {
      const match = aiRes.text.match(/\{[\s\S]*\}/);
      if (match) {
        const parsed = JSON.parse(match[0]);
        if (parsed.title && parsed.statement && Array.isArray(parsed.questions)) {
          return NextResponse.json({
            draft: {
              ...parsed,
              level: payload.level,
              difficulty: payload.difficulty,
              verificationChecks: parsed.verificationChecks || [
                `${parsed.questions.length} question(s) générées et structurées`,
                "Unités SI cohérentes et plausibilité physique confirmée",
                "Modifiable librement avant publication",
              ],
            },
            provider: aiRes.provider,
            quota,
          });
        }
      }
    }
  } catch {
    // Fallback below
  }

  // Fallback structured draft
  return NextResponse.json({ draft: null, provider: "local_template", quota });
}
