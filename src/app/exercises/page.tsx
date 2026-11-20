"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import {
  CURRICULUM_EXERCISES,
  type CurriculumLevel,
  type Domain,
} from "@/lib/curriculum-bank";
import { fetchStudentDashboardData, type ClassAssignmentRow } from "@/lib/db";
import { MathText } from "@/components/MathText";

export default function ExerciseCatalogPage() {
  const { user, logout } = useAuth();
  const router = useRouter();

  const [levelFilter, setLevelFilter] = useState<string>("all");
  const [domainFilter, setDomainFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [lessonOpenId, setLessonOpenId] = useState<string | null>(null);
  const [assignments, setAssignments] = useState<ClassAssignmentRow[]>([]);

  useEffect(() => {
    if (user?.level && ["Seconde", "Première", "Terminale"].includes(user.level)) {
      setLevelFilter(user.level);
    }
    if (user?.id) {
      fetchStudentDashboardData(user.id).then((d) => setAssignments(d.assignments));
    }
  }, [user?.id, user?.level]);

  const filtered = CURRICULUM_EXERCISES.filter((ex) => {
    if (levelFilter !== "all" && ex.level !== levelFilter) return false;
    if (domainFilter !== "all" && ex.domain !== domainFilter) return false;
    if (
      search.trim() &&
      !`${ex.title} ${ex.chapter} ${ex.domain} ${ex.lessonTitle}`
        .toLowerCase()
        .includes(search.toLowerCase())
    ) {
      return false;
    }
    return true;
  });

  const handleLogout = async () => {
    await logout();
    router.push("/auth/login");
  };

  const initials = user ? (user.firstName?.[0] ?? "E") + (user.lastName?.[0] ?? "") : "EL";

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Top Bar */}
      <header className="bg-white border-b border-slate-100 px-6 py-3 flex items-center gap-4 sticky top-0 z-20">
        <Link href="/dashboard" className="text-slate-500 hover:text-slate-800 text-sm font-medium">
          ← Tableau de bord
        </Link>
        <span className="text-slate-200">|</span>
        <span className="font-bold text-slate-900 text-sm">📚 Banque d&apos;exercices &amp; fiches de cours</span>
        <div className="ml-auto flex items-center gap-3">
          <Link
            href="/tutor"
            className="hidden sm:inline-flex items-center gap-1.5 text-xs font-semibold bg-indigo-50 text-indigo-700 px-3 py-1.5 rounded-xl hover:bg-indigo-100"
          >
            💬 Tuteur IA
          </Link>
          <div className="w-7 h-7 rounded-full bg-gradient-to-br from-pink-400 to-violet-500 flex items-center justify-center text-white text-xs font-bold uppercase">
            {initials}
          </div>
          <button onClick={handleLogout} className="text-xs font-medium text-rose-500 hover:text-rose-700">
            🚪 Déconnexion
          </button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto p-6 lg:p-10">
        <div className="mb-8">
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 mb-1">
            Exercices de Physique-Chimie
          </h1>
          <p className="text-slate-500 text-sm">
            {CURRICULUM_EXERCISES.length} exercices vérifiés à valeurs aléatoires, avec fiches de cours, exemples résolus et correction intelligente.
          </p>
        </div>

        {/* Class assignments banner if any */}
        {assignments.length > 0 && (
          <div className="mb-8 bg-indigo-50 border border-indigo-200 rounded-3xl p-5">
            <h2 className="text-sm font-extrabold text-indigo-900 mb-3">
              📌 Devoirs assignés par ton professeur ({assignments.length})
            </h2>
            <div className="grid sm:grid-cols-2 gap-3">
              {assignments.map((a) => (
                <Link
                  key={a.id}
                  href={
                    a.targetExerciseId
                      ? `/exercises/${a.targetExerciseId}?assignmentId=${a.id}`
                      : "/exercises"
                  }
                  className="bg-white rounded-2xl p-4 border border-indigo-100 hover:border-indigo-300 flex items-center justify-between gap-3 transition-all"
                >
                  <div>
                    <div className="text-xs font-bold text-indigo-600 flex items-center gap-2 flex-wrap">
                      <span>{a.className} · {a.mode}</span>
                      <span
                        className={`text-[10px] px-2 py-0.5 rounded-full ${
                          a.allowRetry
                            ? "bg-emerald-50 text-emerald-700"
                            : "bg-amber-100 text-amber-800"
                        }`}
                      >
                        {a.allowRetry ? "🔄 Réessais autorisés" : "🔒 1 seul essai"}
                      </span>
                      {!a.allowHints && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-rose-50 text-rose-700">
                          🚫 Sans indices
                        </span>
                      )}
                    </div>
                    <div className="text-sm font-bold text-slate-900 mt-0.5">{a.title}</div>
                  </div>
                  <span className="text-xs font-bold text-indigo-600 shrink-0">Faire →</span>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="bg-white rounded-2xl border border-slate-100 p-4 mb-7 flex flex-col md:flex-row gap-3 shadow-xs">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher un chapitre (Ohm, Newton, titrage, avancement…)"
            className="flex-1 border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-900 bg-white placeholder:text-slate-400 outline-none focus:border-indigo-400"
          />
          <div className="flex gap-2 flex-wrap">
            {(["all", "Seconde", "Première", "Terminale"] as ("all" | CurriculumLevel)[]).map((lvl) => (
              <button
                key={lvl}
                onClick={() => setLevelFilter(lvl)}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all ${
                  levelFilter === lvl
                    ? "bg-indigo-600 text-white shadow-sm"
                    : "bg-slate-50 text-slate-600 border border-slate-200 hover:border-indigo-300"
                }`}
              >
                {lvl === "all" ? "Tous niveaux" : lvl}
              </button>
            ))}
          </div>
          <select
            value={domainFilter}
            onChange={(e) => setDomainFilter(e.target.value)}
            className="border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 bg-white outline-none focus:border-indigo-400"
          >
            <option value="all">Tous domaines</option>
            {(["Électricité", "Mécanique", "Chimie", "Métrologie"] as Domain[]).map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        </div>

        {/* Exercise Grid */}
        <div className="grid md:grid-cols-2 gap-5">
          {filtered.map((ex) => {
            const isLessonOpen = lessonOpenId === ex.id;
            return (
              <div
                key={ex.id}
                className="bg-white rounded-3xl border border-slate-100 p-6 shadow-sm hover:shadow-md transition-all flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center gap-2 flex-wrap mb-3">
                    <span className="text-xs font-bold bg-indigo-50 text-indigo-700 px-2.5 py-1 rounded-lg">
                      {ex.level}
                    </span>
                    <span className="text-xs font-semibold bg-slate-100 text-slate-600 px-2.5 py-1 rounded-lg">
                      {ex.domain}
                    </span>
                    <span
                      className={`text-xs font-bold px-2.5 py-1 rounded-lg ml-auto ${
                        ex.difficulty === "Type Bac"
                          ? "bg-rose-50 text-rose-600"
                          : ex.difficulty === "Standard"
                          ? "bg-amber-50 text-amber-700"
                          : "bg-emerald-50 text-emerald-700"
                      }`}
                    >
                      {ex.difficulty}
                    </span>
                  </div>

                  <h2 className="font-extrabold text-slate-900 text-lg mb-1">{ex.title}</h2>
                  <p className="text-xs text-slate-500 mb-4">{ex.chapter}</p>

                  {/* Collapsible Lesson Sheet */}
                  {isLessonOpen && (
                    <div className="mb-4 bg-indigo-50/60 border border-indigo-100 rounded-2xl p-4 space-y-2.5 text-xs text-slate-700 leading-relaxed">
                      <div className="font-extrabold text-indigo-900">📖 Rappel de cours : {ex.lessonTitle}</div>
                      <div>
                        <MathText text={ex.lessonContent} />
                      </div>
                      <div className="bg-white rounded-xl p-3 border border-indigo-100">
                        <strong className="text-slate-900">Exemple résolu : </strong>
                        <MathText text={ex.workedExample} />
                      </div>
                    </div>
                  )}

                  <div className="flex flex-wrap gap-1.5 mb-5">
                    {ex.conceptCodes.map((c) => (
                      <span key={c} className="text-[11px] bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full font-mono">
                        {c}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="flex items-center gap-2.5 pt-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setLessonOpenId(isLessonOpen ? null : ex.id)}
                    className="px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-50 transition-colors"
                  >
                    {isLessonOpen ? "Masquer le cours" : "📖 Fiche de cours"}
                  </button>
                  <Link
                    href={`/exercises/${ex.id}`}
                    className="flex-1 text-center bg-indigo-600 text-white font-bold text-xs py-2.5 px-4 rounded-xl hover:bg-indigo-700 transition-colors shadow-sm"
                  >
                    Commencer l&apos;exercice →
                  </Link>
                </div>
              </div>
            );
          })}
        </div>

        {filtered.length === 0 && (
          <div className="bg-white rounded-3xl border border-slate-100 p-12 text-center text-sm text-slate-500">
            Aucun exercice ne correspond à ces filtres. Essayez « Tous niveaux ».
          </div>
        )}
      </main>
    </div>
  );
}
