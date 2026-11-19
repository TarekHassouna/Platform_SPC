import { NextRequest, NextResponse } from "next/server";
import { callTextAI, checkAndIncrementQuota } from "@/lib/ai-provider";

interface TutorPayload {
  userId?: string;
  chapterTitle: string;
  lessonContext?: string;
  exerciseStatement?: string;
  studentError?: string;
  mode: "guide" | "explain" | "quiz";
  messages: { role: "user" | "assistant"; content: string }[];
}

function buildFallbackReply(payload: TutorPayload): string {
  const last = payload.messages[payload.messages.length - 1]?.content.toLowerCase() || "";

  if (last.includes("ma") || last.includes("convert") || last.includes("unité")) {
    return payload.mode === "guide"
      ? "Le préfixe « milli » (m) vaut $10^{-3}$ (un millième). Avant de calculer : $250\\text{ mA}$ est-il plus petit ou plus grand que $1\\text{ A}$ ?"
      : "Pour passer des $\\text{mA}$ aux $\\text{A}$, on divise par $1000$ : $1\\text{ mA} = 10^{-3}\\text{ A}$. De même $1\\text{ g} = 10^{-3}\\text{ kg}$.";
  }

  if (last.includes("ohm") || last.includes("r/u") || last.includes("u =")) {
    return payload.mode === "guide"
      ? "Pars toujours de $U = R \\times I$. Si tu veux isoler $I$, par quelle lettre dois-tu diviser les deux membres de l'équation ?"
      : "D'après la loi d'Ohm, $U = R \\times I$. En divisant par $R$, on obtient $I = \\frac{U}{R}$ (en ampères).";
  }

  if (last.includes("newton") || last.includes("frottement") || last.includes("vlim")) {
    return payload.mode === "guide"
      ? "Applique les 3 étapes de la 2e loi de Newton : système/référentiel, bilan des forces, puis projection. En régime permanent, que vaut l'accélération $\\frac{\\text{d}v}{\\text{d}t}$ ?"
      : "En régime permanent, $\\frac{\\text{d}v}{\\text{d}t} = 0$, donc le poids compense les frottements : $m g = k v_{\\text{lim}} \\implies v_{\\text{lim}} = \\frac{m g}{k}$.";
  }

  if (last.includes("titrage") || last.includes("équivalence") || last.includes("avancement")) {
    return payload.mode === "guide"
      ? "À l'équivalence d'un titrage, les réactifs ont été introduits dans les proportions stœchiométriques. Quelle égalité relie $C_A, V_A, C_B$ et $V_E$ ?"
      : "À l'équivalence (stœchiométrie 1:1), $C_A \\cdot V_A = C_B \\cdot V_E$, donc $C_A = \\frac{C_B \\cdot V_E}{V_A}$.";
  }

  return payload.mode === "guide"
    ? `Bonne question sur « ${payload.chapterTitle} » ! Pour te guider sans te donner directement la solution : quelle est la relation littérale de base que tu peux écrire avec les données de l'énoncé ?`
    : `Sur « ${payload.chapterTitle} », commence toujours par écrire la formule littérale avec les lettres, convertis toutes les grandeurs en unités SI, puis arrondis ton résultat au bon nombre de chiffres significatifs.`;
}

export async function POST(req: NextRequest) {
  let payload: TutorPayload;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: "Requête JSON invalide" }, { status: 400 });
  }

  const quota = checkAndIncrementQuota(payload.userId || "anon", "tutor");
  if (!quota.allowed) {
    return NextResponse.json(
      {
        error: `Quota quotidien atteint (${quota.limit} messages Tuteur IA/jour). Réessaie demain ou consulte la fiche de cours !`,
        quota,
      },
      { status: 429 }
    );
  }

  const systemPrompt = [
    "Tu es un tuteur bienveillant et rigoureux de Physique-Chimie pour lycéens français (Seconde, Première, Terminale).",
    "Réponds toujours en français clair, concis (3–5 phrases max), avec des formules LaTeX entourées de $...$.",
    payload.mode === "guide"
      ? "Approche socratique : NE DONNE PAS la réponse finale tout de suite. Pose une question guidée ou donne un premier indice."
      : payload.mode === "quiz"
      ? "Mode quiz rapide : pose une courte question de vérification et attends la réponse de l'élève."
      : "Mode explication : explique clairement le concept et donne un court exemple chiffré.",
    `Chapitre : ${payload.chapterTitle}.`,
    payload.lessonContext ? `Cours vérifié de référence : ${payload.lessonContext}` : "",
    payload.exerciseStatement ? `Énoncé en cours : ${payload.exerciseStatement}` : "",
    payload.studentError ? `Erreur détectée par le moteur de calcul : ${payload.studentError}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  try {
    const aiRes = await callTextAI({
      system: systemPrompt,
      messages: payload.messages.slice(-10),
      maxTokens: 450,
    });

    if (aiRes) {
      return NextResponse.json({
        reply: aiRes.text,
        provider: aiRes.provider,
        quota,
      });
    }
  } catch {
    // Fallback cleanly if external provider fails
  }

  return NextResponse.json({
    reply: buildFallbackReply(payload),
    provider: "grounded_fallback",
    quota,
  });
}
