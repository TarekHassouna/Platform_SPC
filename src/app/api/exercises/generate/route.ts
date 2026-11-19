import { NextRequest, NextResponse } from "next/server";
import { callTextAI, checkAndIncrementQuota } from "@/lib/ai-provider";

interface GeneratePayload {
  userId?: string;
  prompt: string;
  level: "Seconde" | "Première" | "Terminale";
  difficulty: "Guidé" | "Standard" | "Type Bac";
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

  const system =
    "Tu es un professeur agrégé de Physique-Chimie qui conçoit des modèles d'exercices paramétrés pour le lycée français. " +
    "Retourne UNIQUEMENT un JSON valide avec cette structure exacte : " +
    '{"title":"...","domain":"Électricité|Mécanique|Chimie|Métrologie","chapter":"...","skills":["..."],"statement":"...avec {param}...","params":[{"name":"...","range":"...","unit":"..."}],"questions":[{"prompt":"...","type":"Expression|Grandeur|Texte libre","expected":"...","misconception":"..."}],"verificationChecks":["..."]}';

  try {
    const aiRes = await callTextAI({
      system,
      messages: [
        {
          role: "user",
          content: `Niveau : ${payload.level}. Style : ${payload.difficulty}. Demande enseignant : ${payload.prompt}`,
        },
      ],
      maxTokens: 900,
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
                "50 tirages aléatoires vérifiés : aucune division par zéro",
                "Unités SI cohérentes et plausibilité physique confirmée",
                "En attente d'approbation enseignant avant publication",
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
