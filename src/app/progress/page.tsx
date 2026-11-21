"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import {
  fetchStudentDashboardData,
  type MasteryRow,
  type SubmissionHistoryRow,
} from "@/lib/db";
import { CURRICULUM_EXERCISES } from "@/lib/curriculum-bank";

interface RealSkillCard {
  key: string;
  label: string;
  category: string;
  score: number;
  bestPct: number;
  attempts: number;
  status: "acquired" | "developing" | "needs_review";
  lastDate: string | null;
  href: string;
}

const statusColors: Record<string, string> = {
  acquired: "bg-emerald-500",
  developing: "bg-amber-400",
  needs_review: "bg-rose-400",
};

const statusLabels: Record<string, { text: string; cls: string }> = {
  acquired: { text: "Acquis", cls: "bg-emerald-100 text-emerald-700" },
  developing: { text: "En cours", cls: "bg-amber-100 text-amber-700" },
  needs_review: { text: "À retravailler", cls: "bg-rose-100 text-rose-700" },
};

function computeStatus(pct: number): "acquired" | "developing" | "needs_review" {
  if (pct >= 80) return "acquired";
  if (pct >= 45) return "developing";
  return "needs_review";
}

export default function ProgressPage() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const [masteryRows, setMasteryRows] = useState<MasteryRow[]>([]);
  const [submissions, setSubmissions] = useState<SubmissionHistoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<"all" | "acquired" | "developing" | "needs_review">("all");

  useEffect(() => {
    if (user?.id) {
      fetchStudentDashboardData(user.id).then((d) => {
        setMasteryRows(d.mastery);
        setSubmissions(d.recentSubmissions);
        setLoading(false);
      });
    } else {
      setLoading(false);
    }
  }, [user?.id]);

  // Build 100% REAL progress strictly from the student's actual submissions + evaluated concept_mastery
  const realSkills = useMemo<RealSkillCard[]>(() => {
    const items: RealSkillCard[] = [];

    // 1. Group real submissions by exerciseTitle (covers teacher assignments, AI quizzes, photo copies, AND official exercises)
    const byExercise = new Map<
      string,
      {
        title: string;
        exerciseId?: string;
        sumPct: number;
        bestPct: number;
        count: number;
        lastDate: string;
      }
    >();

    submissions.forEach((s) => {
      const pct = s.maxScore > 0 ? Math.round((s.score / s.maxScore) * 100) : 0;
      const existing = byExercise.get(s.exerciseTitle);
      if (!existing) {
        byExercise.set(s.exerciseTitle, {
          title: s.exerciseTitle,
          exerciseId: s.exerciseId,
          sumPct: pct,
          bestPct: pct,
          count: 1,
          lastDate: s.createdAt,
        });
      } else {
        existing.sumPct += pct;
        existing.bestPct = Math.max(existing.bestPct, pct);
        existing.count += 1;
        if (!existing.exerciseId && s.exerciseId) existing.exerciseId = s.exerciseId;
      }
    });

    byExercise.forEach((v) => {
      const avgPct = Math.round(v.sumPct / v.count);
      const isPhoto = v.title.toLowerCase().includes("copie");
      items.push({
        key: `ex-${v.title}`,
        label: v.title,
        category: isPhoto ? "Copie papier" : "Exercice / Devoir",
        score: avgPct,
        bestPct: v.bestPct,
        attempts: v.count,
        status: computeStatus(avgPct),
        lastDate: v.lastDate,
        href: isPhoto ? "/photo" : v.exerciseId ? `/exercises/${v.exerciseId}` : "/exercises",
      });
    });

    // 2. Append any actually-evaluated concept_mastery rows (only where attempts > 0)
    masteryRows
      .filter((m) => m.attempts > 0)
      .forEach((m) => {
        const officialEx = CURRICULUM_EXERCISES.find((e) => e.conceptCodes.includes(m.conceptCode));
        items.push({
          key: `concept-${m.conceptCode}`,
          label: m.conceptLabel,
          category: m.domain,
          score: m.masteryScore,
          bestPct: m.masteryScore,
          attempts: m.attempts,
          status:
            m.status === "not_started"
              ? computeStatus(m.masteryScore)
              : m.status,
          lastDate: m.lastPracticedAt,
          href: officialEx ? `/exercises/${officialEx.id}` : "/exercises",
        });
      });

    return items.sort((a, b) => a.score - b.score);
  }, [submissions, masteryRows]);

  const filteredSkills =
    filterStatus === "all"
      ? realSkills
      : realSkills.filter((s) => s.status === filterStatus);

  const acquired = realSkills.filter((s) => s.status === "acquired").length;
  const developing = realSkills.filter((s) => s.status === "developing").length;
  const needsReview = realSkills.filter((s) => s.status === "needs_review").length;
  const overall =
    realSkills.length > 0
      ? Math.round(realSkills.reduce((acc, s) => acc + s.score, 0) / realSkills.length)
      : 0;

  const handleLogout = async () => {
    await logout();
    router.push("/auth/login");
  };

  const initials = user ? (user.firstName?.[0] ?? "E") + (user.lastName?.[0] ?? "") : "EL";

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="bg-white border-b border-slate-100 px-6 py-3 flex items-center gap-4 sticky top-0 z-20">
        <Link href="/dashboard" className="text-slate-500 hover:text-slate-800 transition-colors text-sm font-medium">
          ← Tableau de bord
        </Link>
        <span className="text-slate-200">|</span>
        <span className="text-sm font-bold text-slate-800">🗺️ Ma progression</span>
        <div className="ml-auto flex items-center gap-3">
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

      <div className="max-w-5xl mx-auto p-6 lg:p-10 space-y-8">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900 mb-1">Ma progression réelle</h1>
          <p className="text-slate-500 text-sm">
            {user?.level || "Lycée"} · Physique-Chimie · Calculée uniquement à partir de tes vrais exercices, devoirs et copies notées ({submissions.length} soumission{submissions.length > 1 ? "s" : ""})
          </p>
        </div>

        {/* Real KPI Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            {
              label: "Maîtrise moyenne",
              value: realSkills.length > 0 ? `${overall}%` : "—",
              color: "text-indigo-600",
              bg: "bg-indigo-50",
            },
            {
              label: "Acquis (≥ 80%)",
              value: realSkills.length > 0 ? `${acquired} / ${realSkills.length}` : "0",
              color: "text-emerald-600",
              bg: "bg-emerald-50",
            },
            {
              label: "En cours (45–79%)",
              value: String(developing),
              color: "text-amber-600",
              bg: "bg-amber-50",
            },
            {
              label: "À retravailler (< 45%)",
              value: String(needsReview),
              color: "text-rose-600",
              bg: "bg-rose-50",
            },
          ].map((s) => (
            <div key={s.label} className={`${s.bg} rounded-2xl p-5 border border-white`}>
              <div className={`text-3xl font-extrabold ${s.color}`}>{s.value}</div>
              <div className="text-xs font-semibold text-slate-600 mt-1">{s.label}</div>
            </div>
          ))}
        </div>

        {loading ? (
          <div className="bg-white rounded-3xl border border-slate-100 p-10 text-center text-sm text-slate-400">
            Chargement de tes résultats…
          </div>
        ) : realSkills.length === 0 ? (
          <div className="bg-white rounded-3xl border border-slate-100 p-12 text-center space-y-3 shadow-xs">
            <div className="text-4xl">🎯</div>
            <h2 className="font-bold text-slate-900 text-lg">Aucun exercice évalué pour le moment</h2>
            <p className="text-xs text-slate-500 max-w-md mx-auto leading-relaxed">
              Dès que tu termines un devoir de ta classe, un exercice d&apos;entraînement ou une copie papier notée, ta vraie maîtrise par chapitre apparaît ici automatiquement.
            </p>
            <Link
              href="/exercises"
              className="inline-block bg-indigo-600 text-white text-xs font-bold px-5 py-3 rounded-xl hover:bg-indigo-700 mt-2"
            >
              Commencer un exercice →
            </Link>
          </div>
        ) : (
          <>
            {/* Real Mastery by Exercise / Chapter */}
            <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
              <div className="px-6 py-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h2 className="font-extrabold text-slate-900 text-lg">
                    📊 Maîtrise par exercice &amp; compétence ({realSkills.length})
                  </h2>
                  <p className="text-xs text-slate-400">
                    Classés du plus faible au plus maîtrisé pour savoir quoi réviser en priorité
                  </p>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {[
                    { id: "all", label: `Tout (${realSkills.length})` },
                    { id: "needs_review", label: `À retravailler (${needsReview})` },
                    { id: "developing", label: `En cours (${developing})` },
                    { id: "acquired", label: `Acquis (${acquired})` },
                  ].map((tab) => (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setFilterStatus(tab.id as typeof filterStatus)}
                      className={`text-xs font-bold px-3 py-1.5 rounded-xl transition-colors ${
                        filterStatus === tab.id
                          ? "bg-indigo-600 text-white"
                          : "bg-slate-100 text-slate-600 hover:bg-indigo-50 hover:text-indigo-700"
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="divide-y divide-slate-50">
                {filteredSkills.length === 0 ? (
                  <div className="p-8 text-center text-xs text-slate-400">
                    Aucun exercice dans cette catégorie.
                  </div>
                ) : (
                  filteredSkills.map((skill) => {
                    const lbl = statusLabels[skill.status];
                    return (
                      <div key={skill.key} className="px-6 py-4 flex items-center gap-5">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-2 gap-2 flex-wrap">
                            <div className="flex items-center gap-2 min-w-0">
                              <span className="text-[10px] font-bold bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-md shrink-0">
                                {skill.category}
                              </span>
                              <span className="text-sm font-bold text-slate-800 truncate">
                                {skill.label}
                              </span>
                            </div>
                            <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full whitespace-nowrap ${lbl.cls}`}>
                              {lbl.text} · {skill.score}%
                            </span>
                          </div>
                          <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all ${statusColors[skill.status]}`}
                              style={{ width: `${skill.score}%` }}
                            />
                          </div>
                          <div className="flex items-center gap-3 text-xs text-slate-400 mt-1.5 flex-wrap">
                            <span>Moyenne : {skill.score}%</span>
                            <span>· Meilleur score : {skill.bestPct}%</span>
                            <span>· {skill.attempts} essai(s)</span>
                            {skill.lastDate && (
                              <span>
                                · Dernier essai : {new Date(skill.lastDate).toLocaleDateString("fr-FR")}
                              </span>
                            )}
                          </div>
                        </div>
                        <Link
                          href={skill.href}
                          className="shrink-0 text-xs font-bold text-indigo-600 bg-indigo-50 px-3.5 py-2 rounded-xl hover:bg-indigo-100 transition-colors whitespace-nowrap"
                        >
                          Retravailler →
                        </Link>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Real Submission History */}
            <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-100">
                <h2 className="font-extrabold text-slate-900 text-base">
                  🕒 Historique de mes soumissions &amp; notes ({submissions.length})
                </h2>
                <p className="text-xs text-slate-400">
                  Inclut les notes automatiques ainsi que les notes ajustées et appréciations de ton professeur
                </p>
              </div>
              <div className="divide-y divide-slate-50 max-h-96 overflow-y-auto">
                {submissions.map((sub) => {
                  const pct = sub.maxScore > 0 ? Math.round((sub.score / sub.maxScore) * 100) : 0;
                  const lbl = statusLabels[computeStatus(pct)];
                  return (
                    <div key={sub.id} className="px-6 py-3.5 flex items-center justify-between gap-4">
                      <div className="min-w-0">
                        <div className="text-sm font-bold text-slate-900 truncate">{sub.exerciseTitle}</div>
                        <div className="text-xs text-slate-400">
                          {new Date(sub.createdAt).toLocaleString("fr-FR")}
                          {sub.errorSummary && (
                            <span className="ml-2 text-slate-600">· {sub.errorSummary}</span>
                          )}
                        </div>
                      </div>
                      <span className={`text-xs font-extrabold px-3 py-1 rounded-xl shrink-0 ${lbl.cls}`}>
                        {sub.score.toFixed(2)} / {sub.maxScore} ({pct}%)
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
