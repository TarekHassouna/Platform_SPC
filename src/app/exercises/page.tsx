"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { recordExerciseSubmission } from "@/lib/db";

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

const PARAM_PRESETS = [
  { R: 47, U: 12 },
  { R: 100, U: 24 },
  { R: 22, U: 5.5 },
  { R: 68, U: 15 },
];

export default function ExercisePage() {
  const { user, logout } = useAuth();
  const router = useRouter();

  const [presetIdx, setPresetIdx] = useState(0);
  const { R, U } = PARAM_PRESETS[presetIdx];
  const expectedI = Number((U / R).toPrecision(2));

  const questions = [
    {
      id: "q1",
      type: "expression" as const,
      prompt: "1. Exprimer I en fonction de U et R.",
      placeholder: "ex : I = U/R  ou  U/R",
      expected: "I = U/R",
      target_symbol: "I",
      hint: "Pars de la loi d'Ohm : U = R × I, puis divise les deux membres par R.",
      misconceptions: [
        {
          expr: "R/U",
          code: "formule_inversee",
          explanation: "Tu as inversé la formule (R/U). La loi d'Ohm est U = R·I, donc I = U/R.",
        },
        {
          expr: "U*R",
          code: "operation_incorrecte",
          explanation: "Tu as multiplié U par R au lieu de diviser U par R.",
        },
      ],
    },
    {
      id: "q2",
      type: "quantity" as const,
      prompt: "2. Calculer I avec 2 chiffres significatifs (en A ou en mA).",
      placeholder: `ex : ${String(expectedI).replace(".", ",")} A  ou  ${Math.round(expectedI * 1000)} mA`,
      expected: String(expectedI),
      unit: "A",
      sig_figs: 2,
      hint: `Remplace U = ${U} V et R = ${R} Ω dans I = U / R. Pense aux 2 chiffres significatifs et à l'unité !`,
    },
  ];

  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [feedback, setFeedback] = useState<Record<string, EvalResult>>({});
  const [revealedHints, setRevealedHints] = useState<Record<string, boolean>>({});
  const [showTutor, setShowTutor] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [checking, setChecking] = useState(false);
  const [tutorMessages, setTutorMessages] = useState([
    {
      role: "ai",
      text: "Bonjour ! Je suis ton tuteur pour cet exercice. Pose-moi n'importe quelle question — je te guide étape par étape sans te donner directement la solution 😊",
    },
  ]);
  const [tutorInput, setTutorInput] = useState("");

  const handleSubmit = async () => {
    setChecking(true);
    const results: Record<string, EvalResult> = {};

    await Promise.all(
      questions.map(async (q) => {
        const res = await fetch("/api/evaluate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            question_type: q.type,
            student_answer: answers[q.id] || "",
            expected: q.expected,
            unit: q.type === "quantity" ? q.unit : undefined,
            sig_figs: q.type === "quantity" ? q.sig_figs : undefined,
            target_symbol: q.type === "expression" ? q.target_symbol : undefined,
            misconceptions: q.type === "expression" ? q.misconceptions : [],
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
        sumScore === questions.length
          ? "correct"
          : sumScore > 0
          ? "partially_correct"
          : "incorrect";
      recordExerciseSubmission({
        studentId: user.id,
        renderedParams: { R, U },
        rawAnswers: answers,
        score: sumScore,
        maxScore: questions.length,
        status: overallStatus,
        engine: vals[0]?.engine || "ts_fallback",
      }).catch(() => {});
    }
  };

  const resetWithNewValues = () => {
    setPresetIdx((prev) => (prev + 1) % PARAM_PRESETS.length);
    setSubmitted(false);
    setFeedback({});
    setAnswers({});
    setRevealedHints({});
  };

  const sendTutorMessage = () => {
    if (!tutorInput.trim()) return;
    const userMsg = tutorInput;
    setTutorInput("");
    setTutorMessages((prev) => [
      ...prev,
      { role: "user", text: userMsg },
      {
        role: "ai",
        text: `Bonne question ! Avec R = ${R} Ω et U = ${U} V, commence par écrire la loi d'Ohm U = R × I. Quelle opération te permet d'isoler I ?`,
      },
    ]);
  };

  const handleLogout = async () => {
    await logout();
    router.push("/auth/login");
  };

  const initials = user ? (user.firstName?.[0] ?? "E") + (user.lastName?.[0] ?? "") : "EL";
  const engineUsed = Object.values(feedback)[0]?.engine;
  const totalScore = Object.values(feedback).reduce((acc, f) => acc + f.score, 0);

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

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Top bar */}
      <div className="bg-white border-b border-slate-100 px-6 py-3 flex items-center gap-4">
        <Link href="/dashboard" className="text-slate-400 hover:text-slate-700 transition-colors text-sm">
          ← Tableau de bord
        </Link>
        <div className="hidden sm:flex items-center gap-2 text-sm text-slate-500">
          <span className="bg-indigo-50 text-indigo-600 font-semibold px-2 py-0.5 rounded-lg text-xs">
            {user?.level || "Terminale"}
          </span>
          <span>·</span>
          <span>Électricité</span>
          <span>·</span>
          <span className="font-medium text-slate-700">Loi d&apos;Ohm</span>
        </div>
        <div className="ml-auto flex items-center gap-3">
          <button
            onClick={() => setShowTutor(!showTutor)}
            className="flex items-center gap-2 text-sm font-medium text-indigo-600 bg-indigo-50 px-3 py-1.5 rounded-xl hover:bg-indigo-100 transition-colors"
          >
            💬 {showTutor ? "Fermer le tuteur" : "Aide du tuteur"}
          </button>
          <span className="hidden md:inline-block text-xs bg-emerald-50 text-emerald-600 font-semibold px-2 py-1 rounded-lg">
            Standard
          </span>
          <div className="h-5 w-px bg-slate-200" />
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-pink-400 to-violet-500 flex items-center justify-center text-white text-xs font-bold uppercase">
              {initials}
            </div>
            <button
              onClick={handleLogout}
              className="text-xs font-medium text-rose-500 hover:text-rose-700 transition-colors flex items-center gap-1"
            >
              🚪 Déconnexion
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto p-6 lg:p-10 flex flex-col lg:flex-row gap-8">
        {/* Exercise panel */}
        <div className="flex-1">
          {/* Statement */}
          <div className="bg-white rounded-3xl border border-slate-100 p-8 mb-6 shadow-sm">
            <div className="flex items-start justify-between gap-4 mb-6">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 bg-indigo-100 rounded-2xl flex items-center justify-center text-xl shrink-0">⚡</div>
                <div>
                  <h1 className="text-xl font-bold text-slate-900 mb-1">Loi d&apos;Ohm — Calcul de courant</h1>
                  <div className="flex gap-2 flex-wrap">
                    {["loi_ohm", "conversion_unites", "chiffres_significatifs"].map((s) => (
                      <span key={s} className="text-xs bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full">
                        {s}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
              <button
                onClick={resetWithNewValues}
                className="text-xs font-semibold text-indigo-600 bg-indigo-50 px-3 py-1.5 rounded-xl hover:bg-indigo-100 whitespace-nowrap"
              >
                🎲 Nouvelles valeurs
              </button>
            </div>
            <div className="bg-slate-50 rounded-2xl p-6 text-slate-700 leading-relaxed">
              Un conducteur ohmique de résistance <strong>R = {R} Ω</strong> est soumis à une tension{" "}
              <strong>U = {U} V</strong>.
            </div>
          </div>

          {/* Questions */}
          <div className="space-y-5">
            {questions.map((q) => {
              const fb = feedback[q.id];
              return (
                <div key={q.id} className="bg-white rounded-3xl border border-slate-100 p-7 shadow-sm">
                  <p className="font-semibold text-slate-900 mb-4">{q.prompt}</p>

                  <div className="flex gap-3">
                    <div className="flex-1 relative">
                      <input
                        type="text"
                        value={answers[q.id] || ""}
                        onChange={(e) => setAnswers({ ...answers, [q.id]: e.target.value })}
                        placeholder={q.placeholder}
                        disabled={submitted}
                        className={`w-full border rounded-xl px-4 py-3 font-mono text-slate-900 placeholder:text-slate-400 bg-white text-sm transition-all outline-none focus:ring-2 focus:ring-indigo-300 ${
                          fb ? `${feedbackBg[fb.status]} border` : "border-slate-200 focus:border-indigo-300"
                        } disabled:opacity-80`}
                      />
                    </div>
                    {!submitted && (
                      <button
                        type="button"
                        onClick={() =>
                          setRevealedHints((prev) => ({ ...prev, [q.id]: !prev[q.id] }))
                        }
                        className="text-sm text-slate-500 hover:text-indigo-600 transition-colors px-3 font-medium whitespace-nowrap"
                      >
                        💡 Indice
                      </button>
                    )}
                  </div>

                  {revealedHints[q.id] && !submitted && (
                    <div className="mt-3 bg-indigo-50 border border-indigo-100 rounded-xl px-4 py-2.5 text-xs text-indigo-800">
                      💡 <strong>Indice :</strong> {q.hint}
                    </div>
                  )}

                  {/* Evaluation API Feedback */}
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
                          <p>{fb.explanation}</p>
                          {fb.status !== "correct" && (
                            <p className="mt-2 text-xs font-semibold text-slate-800">
                              Réponse attendue :{" "}
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

          {/* Engine badge & Submit */}
          <div className="mt-6 flex flex-col sm:flex-row gap-4">
            {!submitted ? (
              <button
                onClick={handleSubmit}
                disabled={checking}
                className="flex-1 bg-indigo-600 text-white font-bold py-4 rounded-2xl hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200 text-lg disabled:opacity-60"
              >
                {checking ? "⏳ Vérification en cours…" : "Vérifier mes réponses"}
              </button>
            ) : (
              <>
                <button
                  onClick={resetWithNewValues}
                  className="flex-1 text-center bg-indigo-600 text-white font-bold py-4 rounded-2xl hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200 text-lg"
                >
                  Exercice suivant (nouvelles valeurs) →
                </button>
                <button
                  onClick={() => {
                    setSubmitted(false);
                    setFeedback({});
                  }}
                  className="bg-white border border-slate-200 text-slate-700 font-semibold px-6 py-4 rounded-2xl hover:border-slate-300 transition-all"
                >
                  Modifier mes réponses
                </button>
              </>
            )}
          </div>

          {submitted && (
            <div className="mt-4 flex items-center justify-between text-xs text-slate-500 px-1">
              <span>
                Note exercice : <strong className="text-slate-800">{totalScore.toFixed(2)} / {questions.length}</strong>
              </span>
              <span className="bg-white border border-slate-200 px-2.5 py-1 rounded-full font-mono">
                Moteur : {engineUsed === "sympy_pint" ? "🐍 FastAPI SymPy + Pint" : "⚡ API /api/evaluate"}
              </span>
            </div>
          )}

          {submitted && totalScore < questions.length && (
            <div className="mt-6 bg-amber-50 border border-amber-100 rounded-3xl p-6">
              <h3 className="font-bold text-slate-900 mb-3">📚 Exercices suggérés suite à tes erreurs</h3>
              <div className="space-y-2">
                {["Conversion mA ↔ A (×5 exercices)", "Formule d'Ohm — isolation de variables (×3)"].map((e) => (
                  <div
                    key={e}
                    className="flex items-center justify-between gap-3 text-sm text-slate-700 bg-white rounded-xl px-4 py-3 border border-amber-100"
                  >
                    <span>→ {e}</span>
                    <button
                      onClick={resetWithNewValues}
                      className="text-xs font-bold text-indigo-600 hover:underline"
                    >
                      Lancer
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* AI Tutor Chat */}
        {showTutor && (
          <div className="lg:w-80 flex-shrink-0">
            <div className="bg-white border border-slate-100 rounded-3xl shadow-sm flex flex-col h-[560px] sticky top-6">
              <div className="p-5 border-b border-slate-100 flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center text-white text-base">
                  🤖
                </div>
                <div>
                  <div className="font-bold text-slate-900 text-sm">Tuteur IA</div>
                  <div className="text-xs text-emerald-500 font-medium">● En ligne</div>
                </div>
              </div>
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {tutorMessages.map((msg, i) => (
                  <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                    <div
                      className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                        msg.role === "user" ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-700"
                      }`}
                    >
                      {msg.text}
                    </div>
                  </div>
                ))}
              </div>
              <div className="p-4 border-t border-slate-100">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={tutorInput}
                    onChange={(e) => setTutorInput(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && sendTutorMessage()}
                    placeholder="Pose ta question..."
                    className="flex-1 border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-900 bg-white placeholder:text-slate-400 outline-none focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100"
                  />
                  <button
                    onClick={sendTutorMessage}
                    className="w-9 h-9 bg-indigo-600 text-white rounded-xl flex items-center justify-center hover:bg-indigo-700 transition-colors"
                  >
                    →
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
