"use client";
import { useState } from "react";
import Link from "next/link";
import { useTeacherStore, ExerciseItem } from "@/lib/teacher-store";
import { TeacherShell } from "@/components/TeacherShell";

export default function TeacherExercisesPage() {
  const {
    classes,
    selectedClassId,
    exercises,
    assignments,
    addAssignment,
    toggleAssignmentRetry,
    toggleAssignmentHints,
    toggleAssignmentVisibility,
    updateAssignmentTimeLimit,
  } = useTeacherStore();

  const [tab, setTab] = useState<"library" | "assignments">("library");
  const [levelFilter, setLevelFilter] = useState<string>("all");
  const [sourceFilter, setSourceFilter] = useState<string>("all");
  const [search, setSearch] = useState("");

  // Assign modal
  const [assigningEx, setAssigningEx] = useState<ExerciseItem | null>(null);
  const [targetClassId, setTargetClassId] = useState<string>(
    selectedClassId !== "all" ? selectedClassId : classes[0]?.id || ""
  );
  const [assignTitle, setAssignTitle] = useState("");
  const [assignDueDate, setAssignDueDate] = useState("28 nov. 2026");
  const [assignMode, setAssignMode] = useState<"Entraînement" | "Noté">("Entraînement");
  const [assignAllowRetry, setAssignAllowRetry] = useState<boolean>(true);
  const [assignAllowHints, setAssignAllowHints] = useState<boolean>(true);
  const [assignIsVisible, setAssignIsVisible] = useState<boolean>(true);
  const [assignTimeLimit, setAssignTimeLimit] = useState<string>("");
  const [toast, setToast] = useState<string | null>(null);

  const filteredExercises = exercises.filter((ex) => {
    if (levelFilter !== "all" && ex.level !== levelFilter) return false;
    if (sourceFilter !== "all" && ex.source !== sourceFilter) return false;
    if (
      search.trim() &&
      !`${ex.title} ${ex.domain} ${ex.chapter} ${ex.skills.join(" ")}`
        .toLowerCase()
        .includes(search.toLowerCase())
    ) {
      return false;
    }
    return true;
  });

  const visibleAssignments = assignments.filter(
    (a) => selectedClassId === "all" || a.classId === selectedClassId
  );

  const openAssignModal = (ex: ExerciseItem) => {
    setAssigningEx(ex);
    setAssignTitle(`Devoir — ${ex.title}`);
    setTargetClassId(selectedClassId !== "all" ? selectedClassId : classes[0]?.id || "");
  };

  const handleAssignSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!assigningEx || !targetClassId) return;
    const parsedMinutes = parseInt(assignTimeLimit, 10);
    await addAssignment({
      title: assignTitle || assigningEx.title,
      classId: targetClassId,
      exerciseIds: [assigningEx.id],
      dueDate: assignDueDate,
      mode: assignMode,
      allowRetry: assignAllowRetry,
      allowHints: assignAllowHints,
      isVisible: assignIsVisible,
      timeLimitMinutes:
        Number.isFinite(parsedMinutes) && parsedMinutes > 0 ? parsedMinutes : null,
    });
    const clsName = classes.find((c) => c.id === targetClassId)?.name || "la classe";
    setAssigningEx(null);
    setToast(`✅ Exercice assigné à ${clsName} !`);
    setTab("assignments");
    setTimeout(() => setToast(null), 3500);
  };

  return (
    <TeacherShell>
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 text-white text-sm font-medium px-5 py-3 rounded-2xl shadow-xl">
          {toast}
        </div>
      )}

      <div className="mb-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900">📚 Exercices & devoirs</h1>
          <p className="text-slate-500 mt-1 text-sm">
            Parcourez la banque vérifiée, vos exercices créés avec l&apos;IA, et assignez-les à n&apos;importe quelle classe.
          </p>
        </div>
        <Link
          href="/teacher/create"
          className="inline-flex items-center gap-2 bg-indigo-600 text-white font-semibold px-5 py-2.5 rounded-xl hover:bg-indigo-700 transition-colors text-sm shadow-lg shadow-indigo-100"
        >
          ✨ Créer avec l&apos;IA
        </Link>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6">
        <button
          onClick={() => setTab("library")}
          className={`px-5 py-2.5 rounded-xl text-sm font-bold transition-all ${
            tab === "library"
              ? "bg-indigo-600 text-white shadow-md shadow-indigo-100"
              : "bg-white text-slate-600 border border-slate-200 hover:border-indigo-300"
          }`}
        >
          Banque d&apos;exercices ({exercises.length})
        </button>
        <button
          onClick={() => setTab("assignments")}
          className={`px-5 py-2.5 rounded-xl text-sm font-bold transition-all ${
            tab === "assignments"
              ? "bg-indigo-600 text-white shadow-md shadow-indigo-100"
              : "bg-white text-slate-600 border border-slate-200 hover:border-indigo-300"
          }`}
        >
          Devoirs assignés ({visibleAssignments.length})
        </button>
      </div>

      {tab === "library" ? (
        <>
          {/* Filters */}
          <div className="bg-white rounded-2xl border border-slate-100 p-4 mb-6 flex flex-col sm:flex-row gap-3">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher un chapitre, compétence, titre…"
              className="flex-1 border border-slate-200 rounded-xl px-4 py-2 text-sm text-slate-900 bg-white placeholder:text-slate-400 outline-none focus:border-indigo-400"
            />
            <select
              value={levelFilter}
              onChange={(e) => setLevelFilter(e.target.value)}
              className="border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-900 bg-white outline-none focus:border-indigo-400"
            >
              <option value="all">Tous les niveaux</option>
              <option value="Seconde">Seconde</option>
              <option value="Première">Première</option>
              <option value="Terminale">Terminale</option>
            </select>
            <select
              value={sourceFilter}
              onChange={(e) => setSourceFilter(e.target.value)}
              className="border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-900 bg-white outline-none focus:border-indigo-400"
            >
              <option value="all">Toutes sources</option>
              <option value="Officiel">Officiel</option>
              <option value="IA approuvé">IA approuvé</option>
              <option value="Créé par moi">Créé par moi</option>
            </select>
          </div>

          {/* Exercise cards */}
          <div className="grid md:grid-cols-2 gap-5">
            {filteredExercises.map((ex) => (
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
                      className={`text-xs font-semibold px-2.5 py-1 rounded-lg ${
                        ex.difficulty === "Type Bac"
                          ? "bg-rose-50 text-rose-600"
                          : ex.difficulty === "Standard"
                          ? "bg-amber-50 text-amber-700"
                          : "bg-emerald-50 text-emerald-700"
                      }`}
                    >
                      {ex.difficulty}
                    </span>
                    <span className="ml-auto text-[11px] font-mono text-slate-400">
                      {ex.version} · {ex.source}
                    </span>
                  </div>

                  <h3 className="font-bold text-slate-900 text-base mb-1">{ex.title}</h3>
                  <p className="text-xs text-slate-500 mb-3">{ex.chapter}</p>
                  <p className="text-sm text-slate-600 bg-slate-50 rounded-xl p-3.5 mb-4 leading-relaxed">
                    {ex.statement}
                  </p>

                  <div className="flex flex-wrap gap-1.5 mb-4">
                    {ex.skills.map((sk) => (
                      <span key={sk} className="text-[11px] font-medium bg-violet-50 text-violet-700 px-2.5 py-0.5 rounded-full">
                        {sk}
                      </span>
                    ))}
                    <span className="text-[11px] font-medium bg-slate-100 text-slate-500 px-2.5 py-0.5 rounded-full">
                      {ex.questions.length} question(s)
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-3 border-t border-slate-100">
                  <button
                    onClick={() => openAssignModal(ex)}
                    className="flex-1 bg-indigo-600 text-white text-xs font-bold py-2.5 rounded-xl hover:bg-indigo-700 transition-colors"
                  >
                    📤 Assigner à une classe
                  </button>
                  <Link
                    href={`/exercises/${ex.versionId || ex.id}`}
                    className="px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    Aperçu élève
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </>
      ) : (
        /* Assignments tab */
        <div className="space-y-4">
          {visibleAssignments.length === 0 ? (
            <div className="bg-white rounded-3xl border border-slate-100 p-10 text-center text-sm text-slate-500">
              Aucun devoir assigné pour cette sélection. Choisissez un exercice dans la banque pour l&apos;assigner.
            </div>
          ) : (
            visibleAssignments.map((asg) => {
              const cls = classes.find((c) => c.id === asg.classId);
              const pct = asg.totalStudents
                ? Math.round((asg.completedCount / asg.totalStudents) * 100)
                : 0;
              return (
                <div
                  key={asg.id}
                  className={`rounded-2xl border p-6 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-all ${
                    asg.isVisible
                      ? "bg-white border-slate-100"
                      : "bg-slate-50/80 border-dashed border-slate-300 opacity-85"
                  }`}
                >
                  <div>
                    <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                      <span className="text-xs font-bold bg-indigo-50 text-indigo-700 px-2.5 py-0.5 rounded-lg">
                        {cls?.name || "Classe"}
                      </span>
                      <button
                        type="button"
                        onClick={() => toggleAssignmentVisibility(asg.id)}
                        title="Cliquer pour afficher ou masquer ce devoir aux élèves"
                        className={`text-xs font-bold px-2.5 py-0.5 rounded-lg transition-colors cursor-pointer ${
                          asg.isVisible
                            ? "bg-emerald-100 text-emerald-800 hover:bg-rose-100 hover:text-rose-800"
                            : "bg-slate-200 text-slate-700 hover:bg-emerald-100 hover:text-emerald-800"
                        }`}
                      >
                        {asg.isVisible ? "👁️ Visible aux élèves" : "🙈 Masqué aux élèves"}
                      </button>
                      <span
                        className={`text-xs font-semibold px-2.5 py-0.5 rounded-lg ${
                          asg.mode === "Noté"
                            ? "bg-rose-50 text-rose-600"
                            : "bg-emerald-50 text-emerald-700"
                        }`}
                      >
                        Mode {asg.mode}
                      </span>
                      <button
                        type="button"
                        onClick={() => toggleAssignmentRetry(asg.id)}
                        title="Cliquer pour autoriser ou bloquer les réessais"
                        className={`text-xs font-semibold px-2.5 py-0.5 rounded-lg transition-colors cursor-pointer ${
                          asg.allowRetry
                            ? "bg-slate-100 text-slate-700 hover:bg-amber-100 hover:text-amber-800"
                            : "bg-amber-100 text-amber-800 hover:bg-slate-100 hover:text-slate-700"
                        }`}
                      >
                        {asg.allowRetry ? "🔄 Réessais autorisés" : "🔒 1 seul essai"}
                      </button>
                      <button
                        type="button"
                        onClick={() => toggleAssignmentHints(asg.id)}
                        title="Cliquer pour activer ou désactiver les indices élève"
                        className={`text-xs font-semibold px-2.5 py-0.5 rounded-lg transition-colors cursor-pointer ${
                          asg.allowHints
                            ? "bg-indigo-50 text-indigo-700 hover:bg-rose-50 hover:text-rose-700"
                            : "bg-rose-50 text-rose-700 hover:bg-indigo-50 hover:text-indigo-700"
                        }`}
                      >
                        {asg.allowHints ? "💡 Indices autorisés" : "🚫 Sans indices"}
                      </button>
                      <select
                        value={asg.timeLimitMinutes ? String(asg.timeLimitMinutes) : ""}
                        onChange={(e) => {
                          const v = parseInt(e.target.value, 10);
                          updateAssignmentTimeLimit(asg.id, Number.isFinite(v) && v > 0 ? v : null);
                        }}
                        title="Durée chronométrée de l'examen"
                        className={`text-xs font-semibold px-2 py-0.5 rounded-lg border outline-none cursor-pointer ${
                          asg.timeLimitMinutes
                            ? "bg-violet-50 text-violet-700 border-violet-200"
                            : "bg-slate-50 text-slate-500 border-slate-200"
                        }`}
                      >
                        <option value="">∞ Sans chronomètre</option>
                        <option value="2">⏱️ 2 min (test)</option>
                        <option value="5">⏱️ 5 min</option>
                        <option value="10">⏱️ 10 min</option>
                        <option value="15">⏱️ 15 min</option>
                        <option value="20">⏱️ 20 min</option>
                        <option value="30">⏱️ 30 min</option>
                        <option value="45">⏱️ 45 min</option>
                        <option value="60">⏱️ 60 min</option>
                        {asg.timeLimitMinutes &&
                          ![2, 5, 10, 15, 20, 30, 45, 60].includes(asg.timeLimitMinutes) && (
                            <option value={String(asg.timeLimitMinutes)}>
                              ⏱️ {asg.timeLimitMinutes} min
                            </option>
                          )}
                      </select>
                      <span className="text-xs text-slate-400">Échéance : {asg.dueDate}</span>
                    </div>
                    <h3 className="font-bold text-slate-900">{asg.title}</h3>
                  </div>

                  <div className="flex items-center gap-5">
                    <div className="w-36">
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-slate-500">Rendus</span>
                        <span className="font-bold text-slate-800">
                          {asg.completedCount}/{asg.totalStudents}
                        </span>
                      </div>
                      <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                        <div className="h-full bg-indigo-500 rounded-full" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                    <Link
                      href="/teacher/results"
                      className="text-xs font-bold text-indigo-600 bg-indigo-50 px-3.5 py-2 rounded-xl hover:bg-indigo-100 whitespace-nowrap"
                    >
                      Voir résultats →
                    </Link>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* Assign Modal */}
      {assigningEx && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-7 shadow-2xl border border-slate-100">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-extrabold text-slate-900">📤 Assigner l&apos;exercice</h3>
              <button onClick={() => setAssigningEx(null)} className="text-slate-400 hover:text-slate-600 text-xl">
                ×
              </button>
            </div>
            <p className="text-xs text-slate-500 mb-4 bg-slate-50 p-3 rounded-xl">
              <strong>{assigningEx.title}</strong> ({assigningEx.level} · {assigningEx.difficulty})
            </p>
            <form onSubmit={handleAssignSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">Titre du devoir</label>
                <input
                  type="text"
                  required
                  value={assignTitle}
                  onChange={(e) => setAssignTitle(e.target.value)}
                  className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-900 bg-white outline-none focus:border-indigo-400"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">Classe destinataire</label>
                <select
                  value={targetClassId}
                  onChange={(e) => setTargetClassId(e.target.value)}
                  className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-900 bg-white outline-none focus:border-indigo-400"
                >
                  {classes.map((cls) => (
                    <option key={cls.id} value={cls.id}>
                      {cls.name} ({cls.level} · {cls.students.length} élèves)
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">Mode</label>
                  <select
                    value={assignMode}
                    onChange={(e) => {
                      const nextMode = e.target.value as "Entraînement" | "Noté";
                      setAssignMode(nextMode);
                      setAssignAllowRetry(nextMode === "Entraînement");
                      setAssignAllowHints(nextMode === "Entraînement");
                    }}
                    className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-900 bg-white outline-none focus:border-indigo-400"
                  >
                    <option value="Entraînement">Entraînement</option>
                    <option value="Noté">Noté (barème)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">Date limite</label>
                  <input
                    type="text"
                    value={assignDueDate}
                    onChange={(e) => setAssignDueDate(e.target.value)}
                    className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-900 bg-white outline-none focus:border-indigo-400"
                  />
                </div>
              </div>

              {/* Teacher retry control */}
              <label className="flex items-start gap-3 cursor-pointer bg-slate-50 border border-slate-200 rounded-2xl p-3.5">
                <input
                  type="checkbox"
                  checked={assignAllowRetry}
                  onChange={(e) => setAssignAllowRetry(e.target.checked)}
                  className="mt-0.5 w-4 h-4 accent-indigo-600 shrink-0"
                />
                <div>
                  <div className="text-xs font-bold text-slate-900">
                    Autoriser l&apos;élève à refaire l&apos;exercice
                  </div>
                  <div className="text-[11px] text-slate-500 mt-0.5">
                    {assignAllowRetry
                      ? "L'élève pourra réessayer autant de fois qu'il le souhaite pour progresser."
                      : "Verrouillé après 1 seul essai : l'élève ne pourra pas refaire ce devoir."}
                  </div>
                </div>
              </label>
              {/* Teacher hints control */}
              <label className="flex items-start gap-3 cursor-pointer bg-slate-50 border border-slate-200 rounded-2xl p-3.5">
                <input
                  type="checkbox"
                  checked={assignAllowHints}
                  onChange={(e) => setAssignAllowHints(e.target.checked)}
                  className="mt-0.5 w-4 h-4 accent-indigo-600 shrink-0"
                />
                <div>
                  <div className="text-xs font-bold text-slate-900">
                    Autoriser les indices (💡 Indice)
                  </div>
                  <div className="text-[11px] text-slate-500 mt-0.5">
                    {assignAllowHints
                      ? "L'élève peut demander un indice pédagogique guidé sur chaque question."
                      : "Mode sans aide : le bouton Indice est masqué pour cet exercice."}
                  </div>
                </div>
              </label>

              {/* Teacher timer control */}
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3.5 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <label className="text-xs font-bold text-slate-900">
                    ⏱️ Chronomètre (minutes) — optionnel
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={180}
                    value={assignTimeLimit}
                    onChange={(e) => setAssignTimeLimit(e.target.value)}
                    placeholder="Illimité"
                    className="w-24 border border-slate-200 rounded-lg px-2.5 py-1 text-xs font-bold text-slate-900 bg-white outline-none focus:border-indigo-400 text-center"
                  />
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {[
                    { label: "Illimité", val: "" },
                    { label: "5 min", val: "5" },
                    { label: "15 min", val: "15" },
                    { label: "30 min", val: "30" },
                    { label: "45 min", val: "45" },
                    { label: "60 min", val: "60" },
                  ].map((opt) => (
                    <button
                      key={opt.label}
                      type="button"
                      onClick={() => setAssignTimeLimit(opt.val)}
                      className={`text-[11px] font-semibold px-2.5 py-1 rounded-lg border transition-colors ${
                        assignTimeLimit === opt.val
                          ? "bg-indigo-600 text-white border-indigo-600"
                          : "bg-white text-slate-600 border-slate-200 hover:border-indigo-300"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
                <div className="text-[11px] text-slate-500">
                  {assignTimeLimit && parseInt(assignTimeLimit, 10) > 0
                    ? `À la fin des ${assignTimeLimit} min, le quiz se ferme automatiquement et sauvegarde tout ce que l'élève a déjà répondu.`
                    : "L'élève dispose d'un temps illimité."}
                </div>
              </div>

              {/* Teacher visibility control */}
              <label className="flex items-start gap-3 cursor-pointer bg-slate-50 border border-slate-200 rounded-2xl p-3.5">
                <input
                  type="checkbox"
                  checked={assignIsVisible}
                  onChange={(e) => setAssignIsVisible(e.target.checked)}
                  className="mt-0.5 w-4 h-4 accent-indigo-600 shrink-0"
                />
                <div>
                  <div className="text-xs font-bold text-slate-900">
                    👁️ Rendre visible aux élèves immédiatement
                  </div>
                  <div className="text-[11px] text-slate-500 mt-0.5">
                    {assignIsVisible
                      ? "Les élèves de la classe verront immédiatement ce devoir dans leur espace."
                      : "Préparé en mode masqué : aucun élève ne pourra le voir ni l'ouvrir tant que tu ne l'actives pas."}
                  </div>
                </div>
              </label>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setAssigningEx(null)}
                  className="flex-1 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-50"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-bold hover:bg-indigo-700"
                >
                  Assigner
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </TeacherShell>
  );
}
