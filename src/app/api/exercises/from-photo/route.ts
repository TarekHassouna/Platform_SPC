import { NextRequest, NextResponse } from "next/server";
import { callVisionAI, checkAndIncrementQuota } from "@/lib/ai-provider";
import { enforceRateLimit } from "@/lib/rate-limit";

interface FromPhotoPayload {
  userId?: string;
  imageBase64: string;
  mimeType?: string;
  level: "Seconde" | "Première" | "Terminale";
  difficulty: "Guidé" | "Standard" | "Type Bac";
  questionCount?: number;
  extraInstructions?: string;
}

export async function POST(req: NextRequest) {
  const limited = enforceRateLimit(req, {
    bucket: "exercises_from_photo",
    limit: 10,
    windowMs: 5 * 60_000,
  });
  if (limited) return limited;

  let payload: FromPhotoPayload;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: "Requête JSON invalide" }, { status: 400 });
  }

  if (!payload.imageBase64) {
    return NextResponse.json({ error: "Aucune image fournie." }, { status: 400 });
  }

  const quota = checkAndIncrementQuota(payload.userId || "teacher", "vision");
  if (!quota.allowed) {
    return NextResponse.json(
      { error: `Limite quotidienne atteinte (${quota.limit} analyses photo/jour).`, quota },
      { status: 429 }
    );
  }

  const targetCount = Math.min(15, Math.max(1, Math.round(payload.questionCount || 5)));

  const system =
    "Tu es un professeur agrégé de Physique-Chimie qui numérise une photo d'une feuille de cours, d'un tableau ou d'un sujet papier pour créer une fiche de cours + un exercice interactif pour le lycée français. " +
    `RÈGLE ABSOLUE : analyse fidèlement tout le contenu visible sur la photo (formules, définitions, énoncé, données) et génère EXACTEMENT ${targetCount} questions progressives dans le tableau 'questions'. ` +
    "Rédige aussi une fiche de cours complète et fidèle à la photo ('lessonTitle', 'lessonContent' avec formules KaTeX entre $...$, et 'workedExample' avec un exemple résolu clair). " +
    "Pour chaque question, ajoute un vrai 'hint' pédagogique (1 à 2 phrases qui guident la méthode SANS donner la réponse). " +
    "Retourne UNIQUEMENT un JSON valide avec cette structure exacte : " +
    '{"title":"...","domain":"Électricité|Mécanique|Chimie|Métrologie","chapter":"...","skills":["..."],"lessonTitle":"...","lessonContent":"...","workedExample":"...","statement":"...","params":[],"questions":[{"prompt":"...","type":"Expression|Grandeur|Texte libre","expected":"...","hint":"...","misconception":"..."}],"verificationChecks":["..."]}';

  const prompt = [
    `Niveau ciblé : ${payload.level}. Style : ${payload.difficulty}.`,
    `Nombre EXACT de questions à produire : ${targetCount}.`,
    "Si la photo est une feuille de cours, extrais le cours dans lessonTitle / lessonContent / workedExample et crée un exercice d'application complet basé sur ce cours.",
    "Si la photo est déjà un exercice papier, transcris l'énoncé et ses questions (complète jusqu'au nombre demandé si besoin) et rédige le rappel de cours correspondant.",
    payload.extraInstructions ? `Consigne supplémentaire du professeur : ${payload.extraInstructions}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  try {
    const aiRes = await callVisionAI({
      system,
      prompt,
      imageBase64: payload.imageBase64,
      mimeType: payload.mimeType || "image/jpeg",
      maxTokens: Math.max(3000, targetCount * 450),
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
              params: Array.isArray(parsed.params) ? parsed.params : [],
              verificationChecks: parsed.verificationChecks || [
                `Extrait depuis la photo (${parsed.questions.length} questions + fiche de cours)`,
                "Formules et grandeurs vérifiées par Gemini Vision",
                "Modifiable librement avant publication dans la banque élèves",
              ],
            },
            provider: `${aiRes.provider}_vision`,
            quota,
          });
        }
      }
    }
  } catch (err) {
    console.error("from-photo error:", err);
  }

  return NextResponse.json(
    {
      error: "Impossible de lire cette photo clairement. Essaie avec une image plus nette ou bien éclairée.",
      quota,
    },
    { status: 422 }
  );
}
