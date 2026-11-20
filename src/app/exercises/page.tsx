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
import {
  fetchStudentBankExercises,
  fetchStudentDashboardData,
  type ClassAssignmentRow,
  type DatabaseExerciseRecord,
} from "@/lib/db";
import { MathText } from "@/components/MathText";

interface UnifiedBankItem {
  id: string;
  href: string;
  title: string;
  level: string;
  domain: string;
  chapter: string;
  difficulty: string;
  source: "teacher" | "official";
  tags: string[];
  lessonTitle?: string;
  lessonContent?: string;
  workedExample?: string;
}

export default function ExerciseCatalogPage() {
  const { user, logout } = useAuth();
  const router = useRouter();

  const [levelFilter, setLevelFilter] = useState<string>("all");
  const [domainFilter, setDomainFilter] = useState<string>("all");
  const [sourceFilter, setSourceFilter] = useState<"all" | "teacher" | "official">("all");
  const [search, setSearch] = useState("");
  const [lessonOpenId, setLessonOpenId] = useState<string | null>(null);
  const [assignments, setAssignments] = useState<ClassAssignmentRow[]>([]);
  const [hwTab, setHwTab] = useState<"todo" | "done">("todo");
  const [teacherBank, setTeacherBank] = useState<DatabaseExerciseRecord[]>([]);

  useEffect(() => {
    if (user?.level && ["Seconde", "Première", "Terminale"].includes(user.level)) {
      setLevelFilter(user.level);
    }
    if (user?.id) {
      fetchStudentDashboardData(user.id).then((d) => setAssignments(d.assignments));
    }
    fetchStudentBankExercises().then(setTeacherBank);
  }, [user?.id, user?.level]);

  const todoAssignments = assignments.filter((a) => !a.completed);
  const doneAssignments = assignments.filter((a) => a.completed);
  const visibleAssignments = hwTab === "todo" ? todoAssignments : doneAssignments;

  const unifiedCatalog: UnifiedBankItem[] = [
    ...teacherBank.map((ex) => ({
      id: `teacher-${ex.versionId}`,
      href: `/exercises/${ex.versionId}`,
      title: ex.title,
      level: ex.level,
      domain: ex.domain,
      chapter: ex.chapter,
      difficulty: ex.difficulty,
      source: "teacher" as const,
      tags: ex.skills && ex.skills.length > 0 ? ex.skills : [`${ex.questions.length} question(s)`],
      lessonTitle: ex.lessonTitle,
      lessonContent: ex.lessonContent,
      workedExample: ex.workedExample,
    })),
    ...CURRICULUM_EXERCISES.map((ex) => ({
      id: ex.id,
      href: `/exercises/${ex.id}`,
      title: ex.title,
      level: ex.level,
      domain: ex.domain,
      chapter: ex.chapter,
      difficulty: ex.difficulty,
      source: "official" as const,
      tags: ex.conceptCodes,
      lessonTitle: ex.lessonTitle,
      lessonContent: ex.lessonContent,
      workedExample: ex.workedExample,
    })),
  ];

  const filtered = unifiedCatalog.filter((ex) => {
    if (sourceFilter !== "all" && ex.source !== sourceFilter) return false;
    if (levelFilter !== "all" && ex.level !== levelFilter) return false;
    if (domainFilter !== "all" && ex.domain !== domainFilter) return false;
    if (
      search.trim() &&
      !`${ex.title} ${ex.chapter} ${ex.domain} ${ex.lessonTitle || ""}`
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
            {unifiedCatalog.length} exercices disponibles ({teacherBank.length} ajouté(s) par ton professeur · {CURRICULUM_EXERCISES.length} du programme), avec fiches de cours et correction intelligente.
          </p>
        </div>

        {/* Compact Split Class Assignments Banner (À faire vs Déjà faits) */}
        {assignments.length > 0 && (
          <div className="mb-8 bg-indigo-50/80 border border-indigo-200 rounded-3xl p-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
              <h2 className="text-sm font-extrabold text-indigo-900">
                📌 Devoirs assignés par ton professeur
              </h2>
              <div className="inline-flex bg-white p-1 rounded-xl border border-indigo-100 self-start sm:self-auto">
                <button
                  type="button"
                  onClick={() => setHwTab("todo")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    hwTab === "todo"
                      ? "bg-indigo-600 text-white shadow-xs"
                      : "text-slate-600 hover:text-indigo-700"
                  }`}
                >
                  ⏳ À faire ({todoAssignments.length})
                </button>
                <button
                  type="button"
                  onClick={() => setHwTab("done")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    hwTab === "done"
                      ? "bg-emerald-600 text-white shadow-xs"
                      : "text-slate-600 hover:text-emerald-700"
                  }`}
                >
                  ✅ Déjà faits ({doneAssignments.length})
                </button>
              </div>
            </div>

            {visibleAssignments.length === 0 ? (
              <div className="bg-white/90 rounded-2xl p-4 text-center text-xs font-semibold text-slate-600 border border-indigo-100">
                {hwTab === "todo"
                  ? "🎉 Bravo ! Tu as terminé tous les devoirs assignés par ton professeur."
                  : "Tu n'as encore soumis aucun devoir. Commence par l'onglet « À faire » !"}
              </div>
            ) : (
              <div className="grid sm:grid-cols-2 gap-3 max-h-64 overflow-y-auto pr-1">
                {visibleAssignments.map((a) => {
                  const pct =
                    a.bestScore !== undefined && a.maxScore
                      ? Math.round((a.bestScore / a.maxScore) * 100)
                      : null;
                  return (
                    <Link
                      key={a.id}
                      href={
                        a.submissionType === "photo_copy"
                          ? `/photo?copyAssignmentId=${a.id}`
                          : a.targetExerciseId
                          ? `/exercises/${a.targetExerciseId}?assignmentId=${a.id}`
                          : "/exercises"
                      }
                      className={`bg-white rounded-2xl p-4 border flex items-center justify-between gap-3 transition-all ${
                        a.completed
                          ? "border-emerald-200 hover:border-emerald-400"
                          : "border-indigo-100 hover:border-indigo-300"
                      }`}
                    >
                      <div className="min-w-0">
                        <div className="text-xs font-bold text-indigo-600 flex items-center gap-1.5 flex-wrap">
                          <span>{a.className} · {a.submissionType === "photo_copy" ? "📸 Copie papier" : a.mode}</span>
                          {a.completed && pct !== null && (
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                              ✅ {a.bestScore?.toFixed(1)}/{a.maxScore} ({pct}%)
                            </span>
                          )}
                          <span
                            className={`text-[10px] px-2 py-0.5 rounded-full ${
                              a.allowRetry
                                ? "bg-emerald-50 text-emerald-700"
                                : "bg-amber-100 text-amber-800"
                            }`}
                          >
                            {a.allowRetry ? "🔄 Réessais" : "🔒 1 essai"}
                          </span>
                          {!a.allowHints && (
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-rose-50 text-rose-700">
                              🚫 Sans indices
                            </span>
                          )}
                          {a.timeLimitMinutes && (
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-violet-100 text-violet-700">
                              ⏱️ {a.timeLimitMinutes} min
                            </span>
                          )}
                        </div>
                        <div className="text-sm font-bold text-slate-900 mt-1 truncate">{a.title}</div>
                      </div>
                      <span
                        className={`text-xs font-bold shrink-0 ${
                          a.completed ? "text-emerald-600" : "text-indigo-600"
                        }`}
                      >
                        {a.completed ? (a.allowRetry ? "Refaire →" : "Voir →") : "Faire →"}
                      </span>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Filters */}
        <div className="bg-white rounded-2xl border border-slate-100 p-4 mb-7 flex flex-col gap-3 shadow-xs">
          <div className="flex flex-col md:flex-row gap-3">
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
          {teacherBank.length > 0 && (
            <div className="flex items-center gap-2 flex-wrap pt-1 border-t border-slate-100">
              <span className="text-[11px] font-semibold text-slate-400">Source :</span>
              {[
                { key: "all", label: `Tout (${unifiedCatalog.length})` },
                { key: "teacher", label: `👨‍🏫 Banque du prof (${teacherBank.length})` },
                { key: "official", label: `📚 Programme officiel (${CURRICULUM_EXERCISES.length})` },
              ].map((s) => (
                <button
                  key={s.key}
                  type="button"
                  onClick={() => setSourceFilter(s.key as "all" | "teacher" | "official")}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition-colors ${
                    sourceFilter === s.key
                      ? "bg-violet-600 text-white"
                      : "bg-slate-100 text-slate-600 hover:bg-violet-50 hover:text-violet-700"
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Exercise Grid */}
        <div className="grid md:grid-cols-2 gap-5">
          {filtered.map((ex) => {
            const isLessonOpen = lessonOpenId === ex.id;
            const hasLesson = Boolean(ex.lessonContent && ex.lessonContent.trim());
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
                    {ex.source === "teacher" && (
                      <span className="text-xs font-bold bg-violet-100 text-violet-700 px-2.5 py-1 rounded-lg">
                        👨‍🏫 Ajouté par ton prof
                      </span>
                    )}
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
                  {isLessonOpen && hasLesson && (
                    <div className="mb-4 bg-indigo-50/60 border border-indigo-100 rounded-2xl p-4 space-y-2.5 text-xs text-slate-700 leading-relaxed">
                      <div className="font-extrabold text-indigo-900">
                        📖 Rappel de cours : {ex.lessonTitle || ex.chapter}
                      </div>
                      <div className="whitespace-pre-line">
                        <MathText text={ex.lessonContent!} />
                      </div>
                      {ex.workedExample && (
                        <div className="bg-white rounded-xl p-3 border border-indigo-100">
                          <strong className="text-slate-900">Exemple résolu : </strong>
                          <MathText text={ex.workedExample} />
                        </div>
                      )}
                    </div>
                  )}

                  <div className="flex flex-wrap gap-1.5 mb-5">
                    {ex.tags.map((c) => (
                      <span key={c} className="text-[11px] bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full font-mono">
                        {c}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="flex items-center gap-2.5 pt-3 border-t border-slate-100">
                  {hasLesson && (
                    <button
                      type="button"
                      onClick={() => setLessonOpenId(isLessonOpen ? null : ex.id)}
                      className="px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-50 transition-colors"
                    >
                      {isLessonOpen ? "Masquer le cours" : "📖 Fiche de cours"}
                    </button>
                  )}
                  <Link
                    href={ex.href}
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
