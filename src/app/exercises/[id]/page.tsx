"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { getExerciseById, CURRICULUM_EXERCISES } from "@/lib/curriculum-bank";
import { recordExerciseSubmission } from "@/lib/db";
import { MathText } from "@/components/MathText";
import { MathKeypad } from "@/components/MathKeypad";

type EvalResult = {
  status: "correct" | "partially_correct" | "incorrect" | "unreadable";
  score: number;
  max_score: number;
  error_code?: string;
  error_category?: string;
  explanation: string;
  expected_display: string;
  engine: string;
};

export default function ExerciseRunnerPage() {
  const params = useParams();
  const router = useRouter();
  const { user, logout } = useAuth();

  const exerciseId = String(params?.id || "ohm-001");
  const template = getExerciseById(exerciseId) || CURRICULUM_EXERCISES[0];

  const [seed, setSeed] = useState(0);
  const instance = useMemo(() => template.generate(seed), [template, seed]);

  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [activeInputId, setActiveInputId] = useState<string>("q1");
  const [feedback, setFeedback] = useState<Record<string, EvalResult>>({});
  const [revealedHints, setRevealedHints] = useState<Record<string, boolean>>({});
  const [showLesson, setShowLesson] = useState(false);
  const [showTutor, setShowTutor] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [checking, setChecking] = useState(false);
  const [savedToDb, setSavedToDb] = useState(false);

  const [tutorMessages, setTutorMessages] = useState<
    { role: "assistant" | "user"; content: string }[]
  >([
    {
      role: "assistant",
      content: `Bonjour ! Je suis ton tuteur IA pour « ${template.title} ». Pose-moi une question si tu bloques — je te guide étape par étape.`,
    },
  ]);
  const [tutorInput, setTutorInput] = useState("");
  const [tutorLoading, setTutorLoading] = useState(false);

  const handleSubmit = async () => {
    setChecking(true);
    const results: Record<string, EvalResult> = {};

    await Promise.all(
      instance.questions.map(async (q) => {
        const res = await fetch("/api/evaluate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            question_type: q.type,
            student_answer: answers[q.id] || "",
            expected: q.expected,
            unit: q.unit,
            sig_figs: q.sig_figs,
            target_symbol: q.target_symbol,
            misconceptions: q.misconceptions || [],
          }),
        });
        results[q.id] = await res.json();
      })
    );

    setFeedback(results);
    setSubmitted(true);
    setChecking(false);

    if (user?.id) {
      const vals = Object.values(results);
      const sumScore = vals.reduce((a, r) => a + r.score, 0);
      const overallStatus =
        sumScore >= instance.questions.length * 0.95
          ? "correct"
          : sumScore > 0
          ? "partially_correct"
          : "incorrect";

      const errors = vals
        .filter((r) => r.error_code)
        .map((r) => ({
          code: r.error_code!,
          category: r.error_category || "Physique-Chimie",
          evidence: r.explanation,
        }));

      await recordExerciseSubmission({
        studentId: user.id,
        exerciseId: template.id,
        exerciseTitle: template.title,
        conceptCodes: template.conceptCodes,
        renderedParams: instance.params,
        rawAnswers: answers,
        score: sumScore,
        maxScore: instance.questions.length,
        status: overallStatus,
        engine: vals[0]?.engine || "ts_fallback",
        errors,
      });
      setSavedToDb(true);
    }
  };

  const resetWithNewValues = () => {
    setSeed((s) => s + 1);
    setSubmitted(false);
    setFeedback({});
    setAnswers({});
    setRevealedHints({});
    setSavedToDb(false);
  };

  const sendTutorMessage = async () => {
    if (!tutorInput.trim() || tutorLoading) return;
    const nextUserMsg = { role: "user" as const, content: tutorInput.trim() };
    const history = [...tutorMessages, nextUserMsg];
    setTutorMessages(history);
    setTutorInput("");
    setTutorLoading(true);

    const detectedErrors = Object.values(feedback)
      .filter((f) => f.error_code)
      .map((f) => `${f.error_code}: ${f.explanation}`)
      .join(" | ");

    try {
      const res = await fetch("/api/tutor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: user?.id,
          chapterTitle: `${template.domain} — ${template.chapter}`,
          lessonContext: template.lessonContent,
          exerciseStatement: instance.statement,
          studentError: detectedErrors || undefined,
          mode: "guide",
          messages: history,
        }),
      });
      const data = await res.json();
      setTutorMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: data.reply || data.error || "Je n'ai pas pu répondre pour le moment.",
        },
      ]);
    } catch {
      setTutorMessages((prev) => [
        ...prev,
        { role: "assistant", content: "Erreur réseau — réessaie dans quelques secondes." },
      ]);
    }
    setTutorLoading(false);
  };

  const handleLogout = async () => {
    await logout();
    router.push("/auth/login");
  };

  const initials = user ? (user.firstName?.[0] ?? "E") + (user.lastName?.[0] ?? "") : "EL";
  const totalScore = Object.values(feedback).reduce((acc, f) => acc + f.score, 0);
  const engineUsed = Object.values(feedback)[0]?.engine;

  const feedbackBg: Record<string, string> = {
    correct: "bg-emerald-50 border-emerald-200",
    partially_correct: "bg-amber-50 border-amber-200",
    incorrect: "bg-rose-50 border-rose-200",
    unreadable: "bg-slate-100 border-slate-300",
  };
  const feedbackIcon: Record<string, string> = {
    correct: "✅",
    partially_correct: "⚠️",
    incorrect: "❌",
    unreadable: "🔎",
  };

  const nextExerciseIdx =
    (CURRICULUM_EXERCISES.findIndex((e) => e.id === template.id) + 1) %
    CURRICULUM_EXERCISES.length;
  const nextExercise = CURRICULUM_EXERCISES[nextExerciseIdx];

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Top Bar */}
      <header className="bg-white border-b border-slate-100 px-6 py-3 flex items-center gap-4 sticky top-0 z-20">
        <Link href="/exercises" className="text-slate-500 hover:text-slate-800 transition-colors text-sm font-medium">
          ← Tous les exercices
        </Link>
        <div className="hidden sm:flex items-center gap-2 text-xs text-slate-500">
          <span className="bg-indigo-50 text-indigo-700 font-bold px-2 py-0.5 rounded-lg">
            {template.level}
          </span>
          <span>·</span>
          <span>{template.domain}</span>
          <span>·</span>
          <span className="font-semibold text-slate-700">{template.chapter}</span>
        </div>
        <div className="ml-auto flex items-center gap-2.5">
          <button
            onClick={() => setShowLesson(!showLesson)}
            className="text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 px-3 py-1.5 rounded-xl transition-colors"
          >
            📖 {showLesson ? "Masquer cours" : "Cours"}
          </button>
          <button
            onClick={() => setShowTutor(!showTutor)}
            className="text-xs font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 px-3 py-1.5 rounded-xl transition-colors"
          >
            💬 {showTutor ? "Fermer tuteur" : "Tuteur IA"}
          </button>
          <div className="w-7 h-7 rounded-full bg-gradient-to-br from-pink-400 to-violet-500 flex items-center justify-center text-white text-xs font-bold uppercase">
            {initials}
          </div>
          <button onClick={handleLogout} className="text-xs font-medium text-rose-500 hover:text-rose-700">
            🚪
          </button>
        </div>
      </header>

      <div className="max-w-6xl mx-auto p-6 lg:p-10 flex flex-col lg:flex-row gap-8">
        <div className="flex-1 min-w-0">
          {/* Collapsible Lesson Sheet */}
          {showLesson && (
            <div className="bg-indigo-50/70 border border-indigo-200 rounded-3xl p-6 mb-6 space-y-3 text-sm text-slate-700">
              <div className="font-extrabold text-indigo-900">📖 Rappel : {template.lessonTitle}</div>
              <div className="leading-relaxed">
                <MathText text={template.lessonContent} />
              </div>
              <div className="bg-white rounded-2xl p-4 border border-indigo-100 text-xs">
                <strong className="text-slate-900">Exemple résolu : </strong>
                <MathText text={template.workedExample} />
              </div>
            </div>
          )}

          {/* Exercise Statement */}
          <div className="bg-white rounded-3xl border border-slate-100 p-7 mb-6 shadow-sm">
            <div className="flex items-start justify-between gap-4 mb-5">
              <div>
                <h1 className="text-xl font-extrabold text-slate-900 mb-1.5">{template.title}</h1>
                <div className="flex gap-1.5 flex-wrap">
                  {template.conceptCodes.map((c) => (
                    <span key={c} className="text-[11px] font-mono bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full">
                      {c}
                    </span>
                  ))}
                </div>
              </div>
              <button
                onClick={resetWithNewValues}
                className="text-xs font-bold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 px-3 py-2 rounded-xl whitespace-nowrap"
              >
                🎲 Nouvelles valeurs
              </button>
            </div>
            <div className="bg-slate-50 rounded-2xl p-5 text-slate-800 leading-relaxed text-sm sm:text-base">
              <MathText text={instance.statement} />
            </div>
          </div>

          {/* Questions */}
          <div className="space-y-5">
            {instance.questions.map((q) => {
              const fb = feedback[q.id];
              return (
                <div key={q.id} className="bg-white rounded-3xl border border-slate-100 p-6 shadow-sm">
                  <div className="font-semibold text-slate-900 mb-3 text-sm sm:text-base">
                    <MathText text={q.prompt} />
                  </div>

                  <div className="flex gap-3">
                    <input
                      type="text"
                      value={answers[q.id] || ""}
                      onFocus={() => setActiveInputId(q.id)}
                      onChange={(e) => setAnswers({ ...answers, [q.id]: e.target.value })}
                      placeholder={q.placeholder}
                      disabled={submitted}
                      className={`flex-1 border rounded-xl px-4 py-3 font-mono text-slate-900 placeholder:text-slate-400 bg-white text-sm outline-none focus:ring-2 focus:ring-indigo-300 ${
                        fb ? `${feedbackBg[fb.status]} border` : "border-slate-200 focus:border-indigo-400"
                      }`}
                    />
                    {!submitted && (
                      <button
                        type="button"
                        onClick={() => setRevealedHints((p) => ({ ...p, [q.id]: !p[q.id] }))}
                        className="text-xs font-bold text-slate-500 hover:text-indigo-600 px-3 whitespace-nowrap"
                      >
                        💡 Indice
                      </button>
                    )}
                  </div>

                  {!submitted && activeInputId === q.id && (
                    <MathKeypad
                      onInsert={(token) =>
                        setAnswers((prev) => ({ ...prev, [q.id]: (prev[q.id] || "") + token }))
                      }
                    />
                  )}

                  {revealedHints[q.id] && !submitted && (
                    <div className="mt-3 bg-indigo-50 border border-indigo-100 rounded-xl px-4 py-2.5 text-xs text-indigo-800">
                      💡 <strong>Indice :</strong> <MathText text={q.hint} />
                    </div>
                  )}

                  {fb && (
                    <div className={`mt-4 rounded-2xl border p-4 ${feedbackBg[fb.status]}`}>
                      <div className="flex items-start gap-3">
                        <span className="text-lg">{feedbackIcon[fb.status]}</span>
                        <div className="text-sm text-slate-700 leading-relaxed flex-1">
                          <div className="flex items-center gap-2 flex-wrap mb-1">
                            <span className="font-bold text-slate-900">
                              Score : {Math.round(fb.score * 100)}%
                            </span>
                            {fb.error_category && (
                              <span className="bg-white/80 text-slate-700 text-[11px] font-bold px-2 py-0.5 rounded-full border border-black/5">
                                {fb.error_category}
                              </span>
                            )}
                            {fb.error_code && (
                              <span className="bg-rose-100 text-rose-700 text-[11px] font-mono font-bold px-2 py-0.5 rounded-full">
                                {fb.error_code}
                              </span>
                            )}
                          </div>
                          <div>
                            <MathText text={fb.explanation} />
                          </div>
                          {fb.status !== "correct" && (
                            <p className="mt-2 text-xs font-semibold text-slate-800">
                              Attendu :{" "}
                              <code className="bg-white/80 px-1.5 py-0.5 rounded font-mono">
                                {fb.expected_display}
                              </code>
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Actions */}
          <div className="mt-6 flex flex-col sm:flex-row gap-3">
            {!submitted ? (
              <button
                onClick={handleSubmit}
                disabled={checking}
                className="flex-1 bg-indigo-600 text-white font-bold py-4 rounded-2xl hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200 text-base disabled:opacity-60"
              >
                {checking ? "⏳ Vérification…" : "Vérifier mes réponses"}
              </button>
            ) : (
              <>
                <button
                  onClick={resetWithNewValues}
                  className="flex-1 bg-indigo-600 text-white font-bold py-3.5 rounded-2xl hover:bg-indigo-700 text-sm shadow-lg shadow-indigo-100"
                >
                  🎲 Refaire avec de nouvelles valeurs
                </button>
                <Link
                  href={`/exercises/${nextExercise.id}`}
                  className="flex-1 text-center bg-emerald-600 text-white font-bold py-3.5 rounded-2xl hover:bg-emerald-700 text-sm"
                >
                  Suivant : {nextExercise.title.slice(0, 26)}… →
                </Link>
              </>
            )}
          </div>

          {submitted && (
            <div className="mt-4 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500 px-1">
              <span>
                Note : <strong className="text-slate-900">{totalScore.toFixed(2)} / {instance.questions.length}</strong>
                {savedToDb && (
                  <span className="ml-2 text-emerald-600 font-semibold">✓ Enregistré dans ta carte de maîtrise</span>
                )}
              </span>
              <span className="bg-white border border-slate-200 px-2.5 py-1 rounded-full font-mono">
                {engineUsed === "sympy_pint" ? "🐍 SymPy + Pint" : "⚡ Évaluateur SPC"}
              </span>
            </div>
          )}
        </div>

        {/* Grounded AI Tutor Drawer */}
        {showTutor && (
          <aside className="lg:w-84 shrink-0">
            <div className="bg-white border border-slate-100 rounded-3xl shadow-sm flex flex-col h-[560px] sticky top-20">
              <div className="p-4 border-b border-slate-100 flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center text-white text-base">
                  🤖
                </div>
                <div>
                  <div className="font-bold text-slate-900 text-sm">Tuteur IA (Guidé)</div>
                  <div className="text-[11px] text-emerald-600 font-medium">● Basé sur la fiche du chapitre</div>
                </div>
              </div>
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {tutorMessages.map((msg, i) => (
                  <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                    <div
                      className={`max-w-[88%] rounded-2xl px-3.5 py-2.5 text-xs leading-relaxed ${
                        msg.role === "user" ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-800"
                      }`}
                    >
                      <MathText text={msg.content} />
                    </div>
                  </div>
                ))}
                {tutorLoading && (
                  <div className="text-xs text-slate-400 italic px-2">Le tuteur réfléchit…</div>
                )}
              </div>
              <div className="p-3 border-t border-slate-100">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={tutorInput}
                    onChange={(e) => setTutorInput(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && sendTutorMessage()}
                    placeholder="Pose ta question…"
                    className="flex-1 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 bg-white placeholder:text-slate-400 outline-none focus:border-indigo-400"
                  />
                  <button
                    onClick={sendTutorMessage}
                    disabled={tutorLoading}
                    className="w-9 h-9 bg-indigo-600 text-white rounded-xl flex items-center justify-center hover:bg-indigo-700 disabled:opacity-50"
                  >
                    →
                  </button>
                </div>
              </div>
            </div>
          </aside>
        )}
      </div>
    </div>
  );
}
