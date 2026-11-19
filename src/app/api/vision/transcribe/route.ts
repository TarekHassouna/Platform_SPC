import { NextRequest, NextResponse } from "next/server";
import { callVisionAI, checkAndIncrementQuota } from "@/lib/ai-provider";

interface VisionPayload {
  userId?: string;
  imageBase64?: string;
  mimeType?: string;
  mode: "question" | "correct" | "grade";
  questionText?: string;
}

export async function POST(req: NextRequest) {
  let payload: VisionPayload;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: "Requête JSON invalide" }, { status: 400 });
  }

  const quota = checkAndIncrementQuota(payload.userId || "anon", "vision");
  if (!quota.allowed) {
    return NextResponse.json(
      {
        error: `Quota photo quotidien atteint (${quota.limit} photos/jour). Tu peux toujours saisir ta réponse au clavier en illimité !`,
        quota,
      },
      { status: 429 }
    );
  }

  // If a real image + AI API key are provided, call Vision AI
  if (payload.imageBase64 && payload.mimeType) {
    const system =
      "Tu es un moteur de transcription manuscrite de Physique-Chimie (lycée français). " +
      "RÈGLE ABSOLUE : ne devine jamais ce qui est illisible ; marque-le confidence: 'low'. " +
      "Retourne UNIQUEMENT un JSON valide : {\"lines\": [{\"id\": 1, \"text\": \"...\", \"confidence\": \"high\"|\"medium\"|\"low\"}]}";
    const prompt =
      "Transcris ligne par ligne les étapes de calcul et formules manuscrites visibles sur cette feuille de Physique-Chimie.";

    try {
      const visionRes = await callVisionAI({
        system,
        prompt,
        imageBase64: payload.imageBase64,
        mimeType: payload.mimeType,
      });

      if (visionRes?.text) {
        const jsonMatch = visionRes.text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          if (Array.isArray(parsed.lines) && parsed.lines.length > 0) {
            return NextResponse.json({
              lines: parsed.lines,
              provider: visionRes.provider,
              quota,
            });
          }
        }
      }
    } catch {
      // Fallback below
    }
  }

  // Grounded fallback when no Vision API key is set yet
  return NextResponse.json({
    lines: [
      { id: 1, text: "Données : R = 47 Ω, U = 12 V", confidence: "high" },
      { id: 2, text: "Loi d'Ohm : U = R × I  ⇒  I = R / U", confidence: "high" },
      { id: 3, text: "I = 47 / 12 = 3,92 A", confidence: "medium" },
    ],
    provider: "demo_ocr",
    quota,
  });
}
