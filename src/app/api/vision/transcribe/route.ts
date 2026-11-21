import { NextRequest, NextResponse } from "next/server";
import { callVisionAI, checkAndIncrementQuota } from "@/lib/ai-provider";
import { enforceRateLimit } from "@/lib/rate-limit";

interface VisionPayload {
  userId?: string;
  imageBase64?: string;
  mimeType?: string;
  mode: "question" | "correct" | "grade";
  questionText?: string;
}

export async function POST(req: NextRequest) {
  const limited = enforceRateLimit(req, {
    bucket: "vision_transcribe",
    limit: 12,
    windowMs: 5 * 60_000,
  });
  if (limited) return limited;

  let payload: VisionPayload;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: "Requête JSON invalide" }, { status: 400 });
  }

  if (!payload.imageBase64 || !payload.mimeType) {
    return NextResponse.json(
      { error: "Aucune photo reçue. Choisis une image de ta copie." },
      { status: 400 }
    );
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

  const system =
    "Tu es un moteur de transcription manuscrite ET visuelle de Physique-Chimie (lycée français). " +
    "Transcris FIDÈLEMENT tout ce qui est sur la photo, sans corriger les erreurs de l'élève : " +
    "1) Toutes les lignes de texte, énoncés, équations, calculs et résultats. " +
    "2) N'IGNORE JAMAIS LES DESSINS / SCHÉMAS DE L'ÉLÈVE ! Si la photo contient un schéma, dessin, circuit électrique, bilan des forces (vecteurs, sens des flèches, longueurs), graphique (axes, unités, allure de la courbe, tangente), schéma optique (rayons, lentille, normale), montage de chimie, tableau d'avancement ou formule de Lewis / molécule : ajoute une ligne commençant par '[Schéma] ' qui décrit PRÉCISÉMENT et fidèlement ce que l'élève a dessiné (y compris ses éventuelles erreurs d'orientation ou d'oubli). " +
    "RÈGLE ABSOLUE : ne devine jamais ce qui est illisible ; marque-le confidence: 'low'. " +
    'Si l\'image ne contient aucune écriture ni dessin exploitable, retourne {"lines": []}. ' +
    'Retourne UNIQUEMENT un JSON valide : {"lines": [{"id": 1, "text": "...", "confidence": "high"|"medium"|"low", "kind": "text"|"drawing"}]}';

  const prompt =
    "Transcris ligne par ligne TOUT ce que l'élève a écrit (formules, calculs, texte) ET décris fidèlement chaque schéma, vecteur, circuit, graphique, tableau ou molécule dessiné sur cette feuille de Physique-Chimie.";

  try {
    const visionRes = await callVisionAI({
      system,
      prompt,
      imageBase64: payload.imageBase64,
      mimeType: payload.mimeType,
      maxTokens: 2400,
      jsonMode: true,
    });

    if (visionRes?.text) {
      const jsonMatch = visionRes.text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        if (Array.isArray(parsed.lines) && parsed.lines.length > 0) {
          const lines = parsed.lines
            .map((l: Record<string, unknown>, idx: number) => ({
              id: idx + 1,
              text: String(l.text || "").trim(),
              confidence: ["high", "medium", "low"].includes(String(l.confidence))
                ? String(l.confidence)
                : "medium",
              kind: l.kind === "drawing" || /^\[sch[eé]ma|\[dessin/i.test(String(l.text || ""))
                ? "drawing"
                : "text",
            }))
            .filter((l: { text: string }) => l.text.length > 0);
          if (lines.length > 0) {
            return NextResponse.json({ lines, provider: visionRes.provider, quota });
          }
        }
        return NextResponse.json(
          {
            error:
              "Aucune écriture ni schéma lisible détecté sur cette photo. Reprends la photo de plus près, bien éclairée et à plat.",
            quota,
          },
          { status: 422 }
        );
      }
    }
  } catch (err) {
    console.error("vision transcribe error:", err);
  }

  return NextResponse.json(
    {
      error:
        "Le service de lecture IA n'a pas pu analyser la photo pour le moment. Réessaie dans quelques secondes.",
      quota,
    },
    { status: 503 }
  );
}
