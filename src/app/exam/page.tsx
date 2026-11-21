"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { MathText } from "@/components/MathText";
import { MathKeypad } from "@/components/MathKeypad";
import { recordExerciseSubmission } from "@/lib/db";
import type { ExamQuestion, GeneratedExam } from "@/app/api/exam/generate/route";

const CHAPTERS_BY_LEVEL: Record<"Seconde" | "Première" | "Terminale", string[]> = {
  Seconde: [
    "Conversions d'unités & chiffres significatifs",
    "Solutions aqueuses & concentration massique",
    "Atome, ions & classification périodique",
    "Mouvement, vitesse & actions mécaniques",
    "Loi d'Ohm & circuits électriques",
    "Optique : réflexion & réfraction",
  ],
  Première: [
    "Quantité de matière & tableau d'avancement",
    "Titrages colorimétriques & dosage",
    "Chimie organique : groupes caractéristiques",
    "Champs électrostatique & gravitationnel",
    "Travail d'une force & énergie mécanique",
    "Ondes mécaniques progressives",
  ],
  Terminale: [
    "Acides, bases & titrages pH-métriques",
    "Cinétique chimique & temps de demi-réaction",
    "Deuxième loi de Newton & mécanique",
    "Énergie mécanique & mouvements dans un champ",
    "Dipôle RC & électricité",
    "Ondes, diffraction & interférences",
    "Radioactivité & décroissance nucléaire",
  ],
};

interface GradedQuestionResult {
  question: ExamQuestion;
  studentAnswer: string;
  status: "correct" | "partially_correct" | "incorrect";
  earnedPoints: number;
  feedback: string;
  errorCode?: string | null;
}

function getMention(score20: number): { label: string; cls: string } {
  if (score20 >= 16) return { label: "Mention Très Bien 🏆", cls: "bg-emerald-100 text-emerald-800" };
  if (score20 >= 14) return { label: "Mention Bien 🌟", cls: "bg-lime-100 text-lime-800" };
  if (score20 >= 12) return { label: "Mention Assez Bien 👍", cls: "bg-indigo-100 text-indigo-800" };
  if (score20 >= 10) return { label: "Admis · À consolider", cls: "bg-amber-100 text-amber-800" };
  return { label: "À retravailler 💪", cls: "bg-rose-100 text-rose-800" };
}

function formatMMSS(totalSeconds: number): string {
  const s = Math.max(0, totalSeconds);
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}

export default function BacBlancExamPage() {
  const { user } = useAuth();
  const router = useRouter();

  // Setup state
  const [level, setLevel] = useState<"Seconde" | "Première" | "Terminale">(
    user?.level === "Seconde" || user?.level === "Première" ? user.level : "Terminale"
  );
  const [selectedChapters, setSelectedChapters] = useState<string[]>([
    CHAPTERS_BY_LEVEL.Terminale[0],
    CHAPTERS_BY_LEVEL.Terminale[2],
  ]);
  const [durationMinutes, setDurationMinutes] = useState<number>(40);
  const [questionCount, setQuestionCount] = useState<number>(6);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Active exam state
  const [exam, setExam] = useState<GeneratedExam | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [openKeypadId, setOpenKeypadId] = useState<string | null>(null);
  const [remainingSec, setRemainingSec] = useState<number>(0);
  const [grading, setGrading] = useState(false);
  const [results, setResults] = useState<GradedQuestionResult[] | null>(null);
  const [totalScore20, setTotalScore20] = useState<number>(0);
  const [elapsedSec, setElapsedSec] = useState<number>(0);

  const autoSubmittedRef = useRef(false);

  // Sync default level once user loads
  useEffect(() => {
    if (user?.level === "Seconde" || user?.level === "Première" || user?.level === "Terminale") {
      setLevel(user.level);
      const list = CHAPTERS_BY_LEVEL[user.level];
      setSelectedChapters([list[0], list[1]]);
    }
  }, [user?.level]);

  const handleChangeLevel = (nextLvl: "Seconde" | "Première" | "Terminale") => {
    setLevel(nextLvl);
    const list = CHAPTERS_BY_LEVEL[nextLvl];
    setSelectedChapters([list[0], list[1]]);
  };

  const toggleChapter = (ch: string) => {
    setSelectedChapters((prev) => {
      if (prev.includes(ch)) {
        return prev.length > 1 ? prev.filter((x) => x !== ch) : prev;
      }
      if (prev.length >= 4) return prev;
      return [...prev, ch];
    });
  };

  const handleStartExam = async () => {
    if (selectedChapters.length === 0) return;
    setGenerating(true);
    setError(null);
    try {
      const res = await fetch("/api/exam/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          level,
          chapters: selectedChapters,
          durationMinutes,
          questionCount,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Impossible de générer le sujet.");
        setGenerating(false);
        return;
      }
      setExam(data as GeneratedExam);
      setAnswers({});
      setResults(null);
      setRemainingSec((data.durationMinutes || durationMinutes) * 60);
      setElapsedSec(0);
      autoSubmittedRef.current = false;
    } catch {
      setError("Erreur réseau lors de la génération du Bac Blanc.");
    } finally {
      setGenerating(false);
    }
  };

  const handleSubmitExam = useCallback(async () => {
    if (!exam || grading || results) return;
    setGrading(true);

    const graded: GradedQuestionResult[] = await Promise.all(
      exam.questions.map(async (q) => {
        const stuAns = (answers[q.id] || "").trim();
        if (!stuAns) {
          return {
            question: q,
            studentAnswer: "",
            status: "incorrect",
            earnedPoints: 0,
            feedback: "Question laissée vide.",
            errorCode: "NO_ANSWER",
          };
        }

        try {
          const evRes = await fetch("/api/evaluate", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              answer: stuAns,
              expected: q.expected,
              type: q.type,
              questionPrompt: q.prompt,
              exerciseTitle: exam.title,
            }),
          });
          const ev = await evRes.json();
          const status: "correct" | "partially_correct" | "incorrect" =
            ev.status === "correct"
              ? "correct"
              : ev.status === "partially_correct"
              ? "partially_correct"
              : "incorrect";
          const multiplier =
            status === "correct" ? 1 : status === "partially_correct" ? 0.5 : 0;
          return {
            question: q,
            studentAnswer: stuAns,
            status,
            earnedPoints: Number((q.points * multiplier).toFixed(2)),
            feedback: String(ev.feedback || q.correction),
            errorCode: ev.error_code || null,
          };
        } catch {
          return {
            question: q,
            studentAnswer: stuAns,
            status: "incorrect",
            earnedPoints: 0,
            feedback: q.correction,
            errorCode: "EVAL_ERROR",
          };
        }
      })
    );

    const total = Number(
      Math.min(
        20,
        graded.reduce((acc, g) => acc + g.earnedPoints, 0)
      ).toFixed(1)
    );
    setTotalScore20(total);
    setResults(graded);
    setGrading(false);

    // Persist real Bac Blanc grade to Supabase so it appears in /dashboard, /progress & Parent PDF
    if (user?.id) {
      const overallStatus =
        total >= 16 ? "correct" : total >= 10 ? "partially_correct" : "incorrect";
      const errList = graded
        .filter((g) => g.status !== "correct")
        .map((g) => ({
          code: g.errorCode || "EXAM_ERROR",
          category: g.question.chapter,
          evidence: g.studentAnswer || "Vide",
        }));
      await recordExerciseSubmission({
        studentId: user.id,
        exerciseTitle: exam.title,
        renderedParams: {
          mode: "bac_blanc",
          level: exam.level,
          chapters: exam.chapters,
          durationMinutes: exam.durationMinutes,
        },
        rawAnswers: answers,
        score: total,
        maxScore: 20,
        status: overallStatus,
        engine: "bac_blanc_simulator",
        errors: errList,
      });
    }
  }, [exam, grading, results, answers, user?.id]);

  // Countdown timer during active exam
  useEffect(() => {
    if (!exam || results) return;
    const timer = setInterval(() => {
      setElapsedSec((e) => e + 1);
      setRemainingSec((prev) => {
        if (prev <= 1) {
          if (!autoSubmittedRef.current) {
            autoSubmittedRef.current = true;
            handleSubmitExam();
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [exam, results, handleSubmitExam]);

  const handleReviewWithTutor = () => {
    if (!exam || !results) return;
    const missed = results.filter((r) => r.status !== "correct");
    const summaryLines = (missed.length > 0 ? missed : results).map(
      (r, idx) =>
        `Q${idx + 1} (${r.question.chapter}) : ${r.question.prompt}\n` +
        `Ma réponse : ${r.studentAnswer || "(vide)"} | Attendu : ${r.question.expected} | Correction : ${r.question.correction}`
    );
    try {
      sessionStorage.setItem(
        "spc_tutor_handoff",
        JSON.stringify({
          chapterTitle: exam.title,
          statement: summaryLines.join("\n\n"),
          tutorReply: `Tu viens d'obtenir **${totalScore20}/20** à ton ${exam.title}. Quelle question souhaites-tu reprendre ensemble étape par étape ?`,
        })
      );
    } catch {
      // ignore
    }
    router.push("/tutor");
  };

  const answeredCount = exam
    ? exam.questions.filter((q) => (answers[q.id] || "").trim().length > 0).length
    : 0;

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Top Bar */}
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur border-b border-slate-100 px-6 h-16 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <Link
            href="/dashboard"
            className="text-xs font-semibold text-slate-500 hover:text-indigo-600 shrink-0"
          >
            ← Tableau de bord
          </Link>
          <span className="text-slate-200">|</span>
          <span className="font-extrabold text-slate-900 text-sm truncate">
            🎓 Simulateur Bac Blanc (Chronométré /20)
          </span>
        </div>

        {exam && !results && (
          <div className="flex items-center gap-3 shrink-0">
            <span className="hidden sm:inline-block text-xs font-semibold text-slate-500">
              {answeredCount}/{exam.questions.length} répondues
            </span>
            <span
              className={`font-mono text-sm font-extrabold px-3 py-1.5 rounded-xl ${
                remainingSec <= 60
                  ? "bg-rose-100 text-rose-700 animate-pulse"
                  : remainingSec <= 300
                  ? "bg-amber-100 text-amber-800"
                  : "bg-indigo-50 text-indigo-700"
              }`}
            >
              ⏱️ {formatMMSS(remainingSec)}
            </span>
            <button
              type="button"
              disabled={grading}
              onClick={handleSubmitExam}
              className="bg-emerald-600 text-white text-xs font-bold px-4 py-2 rounded-xl hover:bg-emerald-700 disabled:opacity-50"
            >
              {grading ? "Correction…" : "✅ Rendre ma copie"}
            </button>
          </div>
        )}
      </header>

      <main className="max-w-4xl mx-auto px-6 py-8">
        {/* PHASE 1: EXAM CONFIGURATION */}
        {!exam && (
          <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-7 sm:p-9 space-y-6">
            <div>
              <span className="inline-block text-xs font-bold bg-indigo-50 text-indigo-700 px-3 py-1 rounded-full mb-2">
                Entraînement conditions réelles
              </span>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900">
                🎓 Composer un Bac Blanc / Devoir Surveillé
              </h1>
              <p className="text-sm text-slate-500 mt-1">
                Choisis ton niveau, combine jusqu&apos;à 4 chapitres et entraîne-toi en temps limité avec une correction détaillée sur 20.
              </p>
            </div>

            {error && (
              <div className="bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold rounded-2xl px-4 py-3">
                ⚠️ {error}
              </div>
            )}

            {/* Level */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
                1. Ton niveau
              </label>
              <div className="grid grid-cols-3 gap-2.5">
                {(["Seconde", "Première", "Terminale"] as const).map((lvl) => (
                  <button
                    key={lvl}
                    type="button"
                    onClick={() => handleChangeLevel(lvl)}
                    className={`py-2.5 px-4 rounded-xl text-sm font-bold border transition-all ${
                      level === lvl
                        ? "border-indigo-500 bg-indigo-50 text-indigo-700 ring-2 ring-indigo-100"
                        : "border-slate-200 text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    {lvl}
                  </button>
                ))}
              </div>
            </div>

            {/* Multi-Chapter Selection */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  2. Chapitres à mélanger (1 à 4)
                </label>
                <span className="text-xs font-bold text-indigo-600">
                  {selectedChapters.length} sélectionné(s)
                </span>
              </div>
              <div className="grid sm:grid-cols-2 gap-2.5">
                {CHAPTERS_BY_LEVEL[level].map((ch) => {
                  const active = selectedChapters.includes(ch);
                  return (
                    <button
                      key={ch}
                      type="button"
                      onClick={() => toggleChapter(ch)}
                      className={`text-left px-4 py-3 rounded-2xl border text-xs font-semibold transition-all flex items-center justify-between gap-2 ${
                        active
                          ? "border-indigo-500 bg-indigo-50 text-indigo-900"
                          : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
                      }`}
                    >
                      <span>{ch}</span>
                      <span className="text-sm shrink-0">{active ? "✅" : "○"}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Duration & Question Count */}
            <div className="grid sm:grid-cols-2 gap-5">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
                  3. Durée du chrono
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[20, 40, 60].map((min) => (
                    <button
                      key={min}
                      type="button"
                      onClick={() => setDurationMinutes(min)}
                      className={`py-2.5 rounded-xl text-xs font-bold border ${
                        durationMinutes === min
                          ? "border-indigo-500 bg-indigo-600 text-white"
                          : "border-slate-200 text-slate-600 hover:bg-slate-50"
                      }`}
                    >
                      ⏱️ {min} min
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
                  4. Nombre de questions
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[4, 6, 8].map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setQuestionCount(n)}
                      className={`py-2.5 rounded-xl text-xs font-bold border ${
                        questionCount === n
                          ? "border-indigo-500 bg-indigo-600 text-white"
                          : "border-slate-200 text-slate-600 hover:bg-slate-50"
                      }`}
                    >
                      {n} questions
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <button
              type="button"
              disabled={generating || selectedChapters.length === 0}
              onClick={handleStartExam}
              className="w-full bg-gradient-to-r from-indigo-600 to-violet-600 text-white font-extrabold py-4 rounded-2xl hover:opacity-95 shadow-lg shadow-indigo-200 transition-all text-sm disabled:opacity-60"
            >
              {generating
                ? "✨ Rédaction du sujet de Bac Blanc en cours…"
                : `🚀 Démarrer le Bac Blanc (${questionCount} questions · ${durationMinutes} min · /20)`}
            </button>
          </div>
        )}

        {/* PHASE 2: ACTIVE TIMED EXAM */}
        {exam && !results && (
          <div className="space-y-5">
            <div className="bg-gradient-to-r from-indigo-600 to-violet-600 text-white rounded-3xl p-6 shadow-lg">
              <div className="flex flex-wrap items-center gap-2 mb-2">
                <span className="text-[11px] font-bold bg-white/20 px-2.5 py-0.5 rounded-full">
                  {exam.level}
                </span>
                <span className="text-[11px] font-bold bg-white/20 px-2.5 py-0.5 rounded-full">
                  Noté sur {exam.totalPoints}
                </span>
                {exam.chapters.map((c) => (
                  <span key={c} className="text-[11px] font-semibold bg-white/15 px-2.5 py-0.5 rounded-full">
                    {c}
                  </span>
                ))}
              </div>
              <h1 className="text-xl font-extrabold">{exam.title}</h1>
              <p className="text-xs text-indigo-100 mt-1">
                Indique bien les unités SI (ex : <code className="font-mono">0.25 A</code>, <code className="font-mono">12.4 m/s</code>) et les expressions littérales précises.
              </p>
            </div>

            {exam.questions.map((q, idx) => (
              <div
                key={q.id}
                className="bg-white rounded-3xl border border-slate-100 p-6 shadow-sm space-y-3"
              >
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-2">
                    <span className="w-7 h-7 rounded-xl bg-indigo-50 text-indigo-700 font-extrabold text-xs flex items-center justify-center">
                      {idx + 1}
                    </span>
                    <span className="text-xs font-bold text-indigo-600">{q.chapter}</span>
                  </div>
                  <span className="text-xs font-extrabold bg-slate-100 text-slate-700 px-2.5 py-1 rounded-full">
                    {q.points} pt{q.points > 1 ? "s" : ""}
                  </span>
                </div>

                {q.context && (
                  <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4 text-sm text-slate-700 leading-relaxed">
                    <MathText text={q.context} />
                  </div>
                )}

                <div className="text-sm font-bold text-slate-900 leading-relaxed">
                  <MathText text={q.prompt} />
                </div>

                <div>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={answers[q.id] || ""}
                      onChange={(e) =>
                        setAnswers((prev) => ({ ...prev, [q.id]: e.target.value }))
                      }
                      placeholder={
                        q.type === "formula"
                          ? "Ta formule littérale (ex : U / R)…"
                          : "Ta réponse avec unité (ex : 0.25 A)…"
                      }
                      className="flex-1 border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-mono text-slate-900 bg-white placeholder:text-slate-400 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                    />
                    <button
                      type="button"
                      onClick={() =>
                        setOpenKeypadId((cur) => (cur === q.id ? null : q.id))
                      }
                      className="border border-slate-200 bg-slate-50 hover:bg-indigo-50 text-slate-700 hover:text-indigo-700 text-xs font-bold px-3 py-2.5 rounded-xl shrink-0"
                    >
                      ∑ Clavier
                    </button>
                  </div>

                  {openKeypadId === q.id && (
                    <MathKeypad
                      onInsert={(tok) =>
                        setAnswers((prev) => ({ ...prev, [q.id]: (prev[q.id] || "") + tok }))
                      }
                    />
                  )}
                </div>
              </div>
            ))}

            <div className="flex justify-end pt-2">
              <button
                type="button"
                disabled={grading}
                onClick={handleSubmitExam}
                className="bg-emerald-600 text-white font-extrabold px-7 py-3.5 rounded-2xl hover:bg-emerald-700 shadow-lg shadow-emerald-100 text-sm disabled:opacity-50"
              >
                {grading ? "⏳ Correction automatique en cours…" : "✅ Rendre ma copie & Voir ma note /20"}
              </button>
            </div>
          </div>
        )}

        {/* PHASE 3: GRADED RESULTS (/20) */}
        {exam && results && (
          <div className="space-y-6">
            <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-7 flex flex-col sm:flex-row sm:items-center justify-between gap-6">
              <div>
                <span
                  className={`inline-block text-xs font-extrabold px-3 py-1 rounded-full mb-2 ${
                    getMention(totalScore20).cls
                  }`}
                >
                  {getMention(totalScore20).label}
                </span>
                <h1 className="text-2xl font-extrabold text-slate-900">{exam.title}</h1>
                <p className="text-xs text-slate-500 mt-1">
                  Temps utilisé : {formatMMSS(elapsedSec)} · Note enregistrée dans ta progression
                </p>
              </div>
              <div className="text-center bg-indigo-50 border border-indigo-100 rounded-2xl px-6 py-4 shrink-0">
                <div className="text-4xl font-extrabold text-indigo-700">
                  {totalScore20} <span className="text-lg text-indigo-400">/ 20</span>
                </div>
                <div className="text-[11px] font-bold text-indigo-600 mt-0.5">
                  {Math.round((totalScore20 / 20) * 100)}% de réussite
                </div>
              </div>
            </div>

            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={handleReviewWithTutor}
                className="bg-indigo-600 text-white font-bold px-5 py-2.5 rounded-xl hover:bg-indigo-700 text-xs shadow-sm"
              >
                🤖 Réviser mes erreurs avec le Tuteur IA
              </button>
              <button
                type="button"
                onClick={() => {
                  setExam(null);
                  setResults(null);
                  setAnswers({});
                }}
                className="bg-white border border-slate-200 text-slate-700 font-bold px-5 py-2.5 rounded-xl hover:border-indigo-300 text-xs"
              >
                🔄 Nouveau Bac Blanc
              </button>
              <Link
                href="/progress"
                className="bg-white border border-slate-200 text-slate-700 font-bold px-5 py-2.5 rounded-xl hover:border-indigo-300 text-xs"
              >
                🗺️ Voir ma progression
              </Link>
            </div>

            {/* Per-question detailed correction */}
            <div className="space-y-4">
              {results.map((r, idx) => (
                <div
                  key={r.question.id}
                  className={`bg-white rounded-3xl border p-6 shadow-xs space-y-2.5 ${
                    r.status === "correct"
                      ? "border-emerald-200"
                      : r.status === "partially_correct"
                      ? "border-amber-200"
                      : "border-rose-200"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">
                        {r.status === "correct"
                          ? "✅"
                          : r.status === "partially_correct"
                          ? "⚠️"
                          : "❌"}
                      </span>
                      <span className="text-xs font-bold text-indigo-600">
                        Question {idx + 1} · {r.question.chapter}
                      </span>
                    </div>
                    <span className="text-xs font-extrabold text-slate-800 bg-slate-100 px-2.5 py-1 rounded-full">
                      {r.earnedPoints} / {r.question.points} pts
                    </span>
                  </div>

                  <div className="text-sm font-bold text-slate-900">
                    <MathText text={r.question.prompt} />
                  </div>

                  <div className="grid sm:grid-cols-2 gap-3 text-xs pt-1">
                    <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
                      <div className="text-[10px] font-bold uppercase text-slate-400">Ta réponse</div>
                      <div className="font-mono font-bold text-slate-800 mt-0.5">
                        {r.studentAnswer || "— (vide)"}
                      </div>
                    </div>
                    <div className="bg-emerald-50 rounded-xl p-3 border border-emerald-100">
                      <div className="text-[10px] font-bold uppercase text-emerald-700">
                        Réponse attendue
                      </div>
                      <div className="font-mono font-bold text-emerald-900 mt-0.5">
                        {r.question.expected}
                      </div>
                    </div>
                  </div>

                  <div className="text-xs text-slate-700 bg-indigo-50/50 border border-indigo-100 rounded-xl p-3 leading-relaxed">
                    <strong>Correction :</strong> <MathText text={r.question.correction} />
                    {r.feedback && r.feedback !== r.question.correction && (
                      <div className="mt-1 text-slate-600">
                        <strong>Remarque :</strong> <MathText text={r.feedback} />
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
