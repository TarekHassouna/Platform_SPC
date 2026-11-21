import { NextRequest, NextResponse } from "next/server";
import { callTextAI } from "@/lib/ai-provider";
import { enforceRateLimit } from "@/lib/rate-limit";
import { CURRICULUM_EXERCISES } from "@/lib/curriculum-bank";

export interface ExamQuestion {
  id: string;
  chapter: string;
  context: string;
  prompt: string;
  type: "numerical_with_unit" | "formula" | "short_answer";
  expected: string;
  points: number;
  correction: string;
}

export interface GeneratedExam {
  title: string;
  level: "Seconde" | "Première" | "Terminale";
  chapters: string[];
  durationMinutes: number;
  totalPoints: number;
  questions: ExamQuestion[];
  source: "ai" | "curriculum";
}

function distributePointsTo20(count: number): number[] {
  const safeCount = Math.max(1, count);
  const base = Math.floor((20 / safeCount) * 2) / 2; // multiples of 0.5
  const pts = Array(safeCount).fill(base);
  let sum = pts.reduce((a, b) => a + b, 0);
  let idx = 0;
  while (sum < 20 - 1e-6) {
    pts[idx % safeCount] = Number((pts[idx % safeCount] + 0.5).toFixed(1));
    sum = pts.reduce((a, b) => a + b, 0);
    idx++;
  }
  return pts;
}

function buildFallbackExam(
  level: "Seconde" | "Première" | "Terminale",
  chapters: string[],
  questionCount: number,
  durationMinutes: number
): GeneratedExam {
  const pool = CURRICULUM_EXERCISES.filter((ex) => ex.level === level);
  const effectivePool = pool.length > 0 ? pool : CURRICULUM_EXERCISES;

  const picked: ExamQuestion[] = [];
  let qIdx = 1;
  const seed = Math.floor(Date.now() / 1000);
  for (const ex of effectivePool) {
    const rendered = ex.generate(seed + qIdx);
    for (const q of rendered.questions) {
      if (picked.length >= questionCount) break;
      picked.push({
        id: `q${qIdx++}`,
        chapter: ex.chapter,
        context: rendered.statement,
        prompt: q.prompt,
        type:
          q.type === "expression"
            ? "formula"
            : "numerical_with_unit",
        expected: q.unit ? `${q.expected} ${q.unit}` : q.expected,
        points: 0,
        correction: q.hint || `Réponse attendue : ${q.expected}${q.unit ? ` ${q.unit}` : ""}`,
      });
    }
    if (picked.length >= questionCount) break;
  }

  const pts = distributePointsTo20(picked.length);
  picked.forEach((q, i) => {
    q.points = pts[i];
  });

  return {
    title: `Bac Blanc ${level} — ${chapters.slice(0, 2).join(" & ") || "Physique-Chimie"}`,
    level,
    chapters: chapters.length > 0 ? chapters : [effectivePool[0]?.chapter || "Physique-Chimie"],
    durationMinutes,
    totalPoints: 20,
    questions: picked,
    source: "curriculum",
  };
}

export async function POST(req: NextRequest) {
  const limited = enforceRateLimit(req, {
    bucket: "exam_generate",
    limit: 8,
    windowMs: 5 * 60_000,
  });
  if (limited) return limited;

  let body: {
    level?: string;
    chapters?: string[];
    questionCount?: number;
    durationMinutes?: number;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Requête JSON invalide." }, { status: 400 });
  }

  const level: "Seconde" | "Première" | "Terminale" =
    body.level === "Seconde" || body.level === "Première" ? body.level : "Terminale";
  const chapters = Array.isArray(body.chapters)
    ? body.chapters.map((c) => String(c).trim()).filter(Boolean).slice(0, 4)
    : [];
  if (chapters.length === 0) {
    return NextResponse.json(
      { error: "Choisis au moins un chapitre pour générer le sujet." },
      { status: 400 }
    );
  }

  const questionCount = Math.min(8, Math.max(3, Math.round(Number(body.questionCount) || 6)));
  const durationMinutes = Math.min(120, Math.max(10, Math.round(Number(body.durationMinutes) || 40)));

  const systemPrompt =
    "Tu es un professeur agrégé de Physique-Chimie au lycée français qui rédige un sujet officiel de Bac Blanc / Devoir Surveillé. " +
    "RÈGLES STRICTES : " +
    `1) Génère EXACTEMENT ${questionCount} questions couvrant de façon équilibrée TOUS les chapitres demandés : ${chapters.join(", ")}. ` +
    `2) Niveau : ${level} (programme officiel français). ` +
    "3) Utilise la notation LaTeX entre $...$ pour toutes les formules et unités ($v = \\frac{d}{t}$, $U = R \\cdot I$, $2,5\\text{ mol/L}$). " +
    "4) Chaque question doit avoir une réponse attendue précise et vérifiable automatiquement ('expected' : valeur numérique avec unité SI comme '0.25 A' ou formule symbolique comme 'U/R' ou réponse courte claire). " +
    "5) Le champ 'correction' explique en 1 à 2 phrases la méthode de calcul exacte. " +
    "6) Retourne UNIQUEMENT un JSON valide respectant ce schéma exact :\n" +
    '{"title":"...","questions":[{"chapter":"...","context":"Données et contexte court de l\'exercice","prompt":"Question précise","type":"numerical_with_unit|formula|short_answer","expected":"...","correction":"..."}]}';

  const ai = await callTextAI({
    system: systemPrompt,
    messages: [
      {
        role: "user",
        content: `Crée un sujet de Bac Blanc (${level}, durée ${durationMinutes} min) de ${questionCount} questions mêlant ces chapitres : ${chapters.join(" ; ")}.`,
      },
    ],
    jsonMode: true,
    maxTokens: 3200,
  });

  if (ai?.text) {
    try {
      const cleaned = ai.text.replace(/^```json\s*|\s*```$/g, "").trim();
      const parsed = JSON.parse(cleaned) as {
        title?: string;
        questions?: Partial<ExamQuestion>[];
      };
      if (Array.isArray(parsed.questions) && parsed.questions.length > 0) {
        const sliced = parsed.questions.slice(0, questionCount);
        const pts = distributePointsTo20(sliced.length);
        const questions: ExamQuestion[] = sliced.map((q, idx) => ({
          id: `q${idx + 1}`,
          chapter: String(q.chapter || chapters[idx % chapters.length]),
          context: String(q.context || ""),
          prompt: String(q.prompt || `Question ${idx + 1}`),
          type:
            q.type === "formula" || q.type === "numerical_with_unit" || q.type === "short_answer"
              ? q.type
              : "numerical_with_unit",
          expected: String(q.expected || ""),
          points: pts[idx],
          correction: String(q.correction || `Réponse attendue : ${q.expected || ""}`),
        }));

        const exam: GeneratedExam = {
          title:
            String(parsed.title || "").trim() ||
            `Bac Blanc ${level} — ${chapters.slice(0, 2).join(" & ")}`,
          level,
          chapters,
          durationMinutes,
          totalPoints: 20,
          questions,
          source: "ai",
        };
        return NextResponse.json(exam);
      }
    } catch {
      // Fall through cleanly to curriculum fallback
    }
  }

  return NextResponse.json(buildFallbackExam(level, chapters, questionCount, durationMinutes));
}
