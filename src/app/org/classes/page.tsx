"use client";
import { useMemo, useState } from "react";
import { useOrgStore } from "@/lib/org-store";
import { OrgShell } from "@/components/OrgShell";

const inputCls =
  "w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 bg-white placeholder:text-slate-400 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100";

export default function OrgClassesPage() {
  const {
    users,
    classes,
    loading,
    error,
    reloadAll,
    createClass,
    deleteClass,
    addStudentToClass,
    removeStudentFromClass,
  } = useOrgStore();

  const [search, setSearch] = useState("");
  const [levelFilter, setLevelFilter] = useState<string>("all");
  const [toast, setToast] = useState<string | null>(null);
  const [busyKey, setBusyKey] = useState<string | null>(null);

  // Quick enroll form (top card)
  const [quickClassId, setQuickClassId] = useState("");
  const [quickStudentId, setQuickStudentId] = useState("");
  const [enrolling, setEnrolling] = useState(false);

  // Per-class inline student picker
  const [inlineStudentByClass, setInlineStudentByClass] = useState<Record<string, string>>({});

  // Create class form
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [newLevel, setNewLevel] = useState("Terminale");
  const [newTeacherId, setNewTeacherId] = useState("");
  const [newCode, setNewCode] = useState("");

  // Delete confirmation
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3500);
  };

  const students = useMemo(
    () =>
      users
        .filter((u) => u.role === "student")
        .sort((a, b) =>
          `${a.lastName} ${a.firstName}`.localeCompare(`${b.lastName} ${b.firstName}`, "fr")
        ),
    [users]
  );

  const teachers = useMemo(
    () =>
      users.filter(
        (u) => u.role === "teacher" || u.role === "org_admin" || u.role === "platform_admin"
      ),
    [users]
  );

  const filteredClasses = useMemo(() => {
    const q = search.trim().toLowerCase();
    return classes.filter((c) => {
      if (levelFilter !== "all" && c.level !== levelFilter) return false;
      if (!q) return true;
      const inMeta = `${c.name} ${c.inviteCode} ${c.level} ${c.teacherName} ${c.teacherEmail}`
        .toLowerCase()
        .includes(q);
      const inStudents = c.students.some((s) =>
        `${s.firstName} ${s.lastName} ${s.email}`.toLowerCase().includes(q)
      );
      return inMeta || inStudents;
    });
  }, [classes, search, levelFilter]);

  const copyCode = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      showToast(`📋 Code copié : ${code}`);
    } catch {
      showToast(`Code classe : ${code}`);
    }
  };

  const handleQuickEnroll = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickClassId || !quickStudentId) return;
    setEnrolling(true);
    const res = await addStudentToClass(quickClassId, quickStudentId);
    setEnrolling(false);
    if (!res.ok) {
      showToast(`⚠️ ${res.error || "Impossible d'ajouter cet élève."}`);
      return;
    }
    const cls = classes.find((c) => c.id === quickClassId);
    const stu = students.find((s) => s.id === quickStudentId);
    showToast(
      `✅ ${stu ? `${stu.firstName} ${stu.lastName}` : "Élève"} ajouté(e) à ${cls?.name || "la classe"} !`
    );
    setQuickStudentId("");
  };

  const handleInlineAdd = async (classId: string) => {
    const studentId = inlineStudentByClass[classId];
    if (!studentId) return;
    setBusyKey(`add-${classId}`);
    const res = await addStudentToClass(classId, studentId);
    setBusyKey(null);
    if (!res.ok) {
      showToast(`⚠️ ${res.error || "Erreur"}`);
      return;
    }
    setInlineStudentByClass((prev) => ({ ...prev, [classId]: "" }));
    showToast("✅ Élève inscrit dans la classe !");
  };

  const handleRemoveStudent = async (
    classId: string,
    studentId: string,
    studentName: string,
    className: string
  ) => {
    setBusyKey(`rm-${classId}-${studentId}`);
    const res = await removeStudentFromClass(classId, studentId);
    setBusyKey(null);
    if (!res.ok) {
      showToast(`⚠️ ${res.error || "Impossible de retirer cet élève."}`);
      return;
    }
    showToast(`🗑️ ${studentName} retiré(e) de ${className}.`);
  };

  const handleCreateClass = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim() || !newTeacherId) return;
    setCreating(true);
    const res = await createClass({
      name: newName.trim(),
      level: newLevel,
      teacherId: newTeacherId,
      inviteCode: newCode.trim() || undefined,
    });
    setCreating(false);
    if (!res.ok) {
      showToast(`⚠️ ${res.error || "Impossible de créer la classe."}`);
      return;
    }
    showToast(`✅ Classe « ${newName.trim()} » créée ! Code : ${res.inviteCode || ""}`);
    setNewName("");
    setNewCode("");
    setShowCreate(false);
  };

  const handleDeleteClass = async (classId: string, className: string) => {
    setBusyKey(`del-${classId}`);
    const res = await deleteClass(classId);
    setBusyKey(null);
    setConfirmDeleteId(null);
    if (!res.ok) {
      showToast(`⚠️ ${res.error || "Suppression impossible."}`);
      return;
    }
    showToast(`🗑️ Classe « ${className} » supprimée.`);
  };

  return (
    <OrgShell>
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 text-white text-sm font-medium px-5 py-3 rounded-2xl shadow-xl">
          {toast}
        </div>
      )}

      {/* Header */}
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900">
            🏫 Classes, Codes &amp; Affectation d&apos;élèves
          </h1>
          <p className="text-slate-500 mt-1 text-sm">
            Consultez tous les codes d&apos;accès des classes et affectez ou retirez n&apos;importe quel élève en 1 clic.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => reloadAll()}
            className="border border-slate-200 bg-white text-slate-700 font-semibold px-3.5 py-2.5 rounded-xl hover:border-indigo-300 text-xs"
          >
            🔄 Actualiser
          </button>
          <button
            type="button"
            onClick={() => setShowCreate((v) => !v)}
            className="bg-indigo-600 text-white font-bold px-4 py-2.5 rounded-xl hover:bg-indigo-700 shadow-lg shadow-indigo-100 text-xs"
          >
            {showCreate ? "Fermer" : "➕ Créer une classe"}
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-5 bg-rose-50 border border-rose-200 text-rose-800 rounded-2xl p-4 text-xs font-semibold">
          ⚠️ {error}
        </div>
      )}

      {/* CREATE Class Form */}
      {showCreate && (
        <form
          onSubmit={handleCreateClass}
          className="bg-white rounded-3xl border border-indigo-200 p-6 mb-6 shadow-sm space-y-4"
        >
          <h2 className="font-extrabold text-slate-900 text-base">➕ Créer une nouvelle classe</h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Nom de la classe *
              </label>
              <input
                type="text"
                required
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="ex : Terminale Spé 1"
                className={inputCls}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Niveau *</label>
              <select
                value={newLevel}
                onChange={(e) => setNewLevel(e.target.value)}
                className={inputCls}
              >
                <option value="Seconde">Seconde</option>
                <option value="Première">Première</option>
                <option value="Terminale">Terminale</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Enseignant responsable *
              </label>
              <select
                required
                value={newTeacherId}
                onChange={(e) => setNewTeacherId(e.target.value)}
                className={inputCls}
              >
                <option value="">Choisir un enseignant…</option>
                {teachers.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.firstName} {t.lastName} ({t.email})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Code classe <span className="text-slate-400 font-normal">(optionnel)</span>
              </label>
              <input
                type="text"
                value={newCode}
                onChange={(e) => setNewCode(e.target.value.toUpperCase())}
                placeholder="Auto-généré si vide"
                className={`${inputCls} font-mono uppercase`}
              />
            </div>
          </div>
          <div className="flex gap-2.5">
            <button
              type="submit"
              disabled={creating}
              className="bg-emerald-600 text-white font-bold px-5 py-2.5 rounded-xl text-xs hover:bg-emerald-700 disabled:opacity-50"
            >
              {creating ? "Création…" : "✅ Créer la classe"}
            </button>
            <button
              type="button"
              onClick={() => setShowCreate(false)}
              className="border border-slate-200 text-slate-600 font-semibold px-4 py-2.5 rounded-xl text-xs hover:bg-slate-50"
            >
              Annuler
            </button>
          </div>
        </form>
      )}

      {/* Quick Enroll Student into a Specific Class */}
      <form
        onSubmit={handleQuickEnroll}
        className="bg-white rounded-3xl border border-emerald-200 p-6 mb-6 shadow-sm space-y-4"
      >
        <div>
          <h2 className="font-extrabold text-slate-900 text-base">
            🎓 Affecter un élève dans une classe spécifique
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Sélectionnez une classe et un élève pour l&apos;inscrire directement (sans qu&apos;il ait besoin de saisir le code).
          </p>
        </div>
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Classe ({classes.length})
            </label>
            <select
              required
              value={quickClassId}
              onChange={(e) => setQuickClassId(e.target.value)}
              className={inputCls}
            >
              <option value="">Choisir une classe…</option>
              {classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} — {c.level} · Code : {c.inviteCode} ({c.students.length} él.)
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Élève ({students.length})
            </label>
            <select
              required
              value={quickStudentId}
              onChange={(e) => setQuickStudentId(e.target.value)}
              className={inputCls}
            >
              <option value="">Choisir un élève…</option>
              {students.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.firstName} {s.lastName} — {s.level || "Lycée"} ({s.email})
                </option>
              ))}
            </select>
          </div>
        </div>
        <button
          type="submit"
          disabled={enrolling || !quickClassId || !quickStudentId}
          className="bg-emerald-600 text-white font-bold px-5 py-2.5 rounded-xl text-xs hover:bg-emerald-700 disabled:opacity-50"
        >
          {enrolling ? "Affectation…" : "✅ Ajouter l'élève dans cette classe"}
        </button>
      </form>

      {/* Search & Level Filter */}
      <div className="bg-white rounded-3xl border border-slate-100 p-4 mb-6 shadow-sm flex flex-col sm:flex-row sm:items-center gap-3">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="🔍 Rechercher une classe, un code (ex : PHY-...), un prof ou un élève…"
          className="flex-1 border border-slate-200 rounded-xl px-4 py-2 text-xs text-slate-900 bg-white placeholder:text-slate-400 outline-none focus:border-indigo-400"
        />
        <div className="flex items-center gap-1.5 flex-wrap">
          {["all", "Seconde", "Première", "Terminale"].map((lvl) => (
            <button
              key={lvl}
              type="button"
              onClick={() => setLevelFilter(lvl)}
              className={`px-3 py-1.5 rounded-xl text-[11px] font-bold transition-all ${
                levelFilter === lvl
                  ? "bg-slate-900 text-white"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              {lvl === "all" ? `Tous niveaux (${classes.length})` : lvl}
            </button>
          ))}
        </div>
      </div>

      {/* All Classes + Codes + Student Rosters */}
      {loading ? (
        <div className="bg-white rounded-3xl border border-slate-100 p-10 text-center text-xs text-slate-400">
          Chargement des classes et codes…
        </div>
      ) : filteredClasses.length === 0 ? (
        <div className="bg-white rounded-3xl border border-slate-100 p-10 text-center text-xs text-slate-500">
          Aucune classe trouvée. Les classes créées par vos enseignants (ou par vous ci-dessus) apparaîtront ici avec leur code.
        </div>
      ) : (
        <div className="grid lg:grid-cols-2 gap-5">
          {filteredClasses.map((cls) => {
            const enrolledIds = new Set(cls.students.map((s) => s.id));
            const availableStudents = students.filter((s) => !enrolledIds.has(s.id));

            return (
              <div
                key={cls.id}
                className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden flex flex-col"
              >
                {/* Class Header + Prominent Copyable Invite Code */}
                <div className="p-5 border-b border-slate-100 bg-slate-50/60">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-extrabold text-slate-900 text-base truncate">
                          {cls.name}
                        </h3>
                        <span className="text-[11px] font-bold bg-indigo-50 text-indigo-700 px-2.5 py-0.5 rounded-full">
                          {cls.level}
                        </span>
                      </div>
                      <div className="text-xs text-slate-500 mt-0.5 truncate">
                        👨‍🏫 {cls.teacherName}
                        {cls.teacherEmail && ` (${cls.teacherEmail})`}
                      </div>
                    </div>

                    {/* Class Code Pill */}
                    <button
                      type="button"
                      onClick={() => copyCode(cls.inviteCode)}
                      title="Cliquer pour copier le code classe"
                      className="shrink-0 bg-indigo-600 text-white font-mono text-xs font-extrabold px-3 py-1.5 rounded-xl hover:bg-indigo-700 transition-colors flex items-center gap-1.5 shadow-xs"
                    >
                      <span>🔑 {cls.inviteCode}</span>
                      <span className="text-[10px] opacity-80">📋</span>
                    </button>
                  </div>
                </div>

                {/* Enrolled Students List */}
                <div className="p-5 flex-1 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-700">
                      🎓 Élèves inscrits ({cls.students.length})
                    </span>
                    {confirmDeleteId === cls.id ? (
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          disabled={busyKey === `del-${cls.id}`}
                          onClick={() => handleDeleteClass(cls.id, cls.name)}
                          className="bg-rose-600 text-white text-[11px] font-bold px-2.5 py-1 rounded-lg hover:bg-rose-700"
                        >
                          Confirmer suppression
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteId(null)}
                          className="text-[11px] font-semibold text-slate-500 px-2 py-1"
                        >
                          Annuler
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteId(cls.id)}
                        className="text-[11px] font-semibold text-rose-500 hover:text-rose-700"
                      >
                        🗑️ Supprimer classe
                      </button>
                    )}
                  </div>

                  {cls.students.length === 0 ? (
                    <div className="bg-slate-50 rounded-2xl p-3.5 text-xs text-slate-400 text-center">
                      Aucun élève dans cette classe pour le moment.
                    </div>
                  ) : (
                    <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                      {cls.students.map((st) => {
                        const sName = `${st.firstName} ${st.lastName}`.trim() || st.email;
                        return (
                          <div
                            key={st.id}
                            className="flex items-center justify-between gap-2 bg-slate-50 border border-slate-100 rounded-xl px-3 py-2"
                          >
                            <div className="min-w-0">
                              <div className="text-xs font-bold text-slate-800 truncate">
                                {sName}
                              </div>
                              <div className="text-[11px] text-slate-400 truncate">
                                {st.email}
                              </div>
                            </div>
                            <button
                              type="button"
                              disabled={busyKey === `rm-${cls.id}-${st.id}`}
                              onClick={() =>
                                handleRemoveStudent(cls.id, st.id, sName, cls.name)
                              }
                              className="text-[11px] font-bold text-rose-600 hover:bg-rose-50 px-2 py-1 rounded-lg shrink-0 disabled:opacity-40"
                            >
                              ✕ Retirer
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Inline quick-add student to THIS class */}
                  <div className="pt-2 border-t border-slate-100 flex items-center gap-2">
                    <select
                      value={inlineStudentByClass[cls.id] || ""}
                      onChange={(e) =>
                        setInlineStudentByClass((prev) => ({
                          ...prev,
                          [cls.id]: e.target.value,
                        }))
                      }
                      className="flex-1 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 bg-white outline-none focus:border-indigo-400"
                    >
                      <option value="">
                        {availableStudents.length === 0
                          ? "Tous les élèves sont déjà inscrits"
                          : "+ Ajouter un élève à cette classe…"}
                      </option>
                      {availableStudents.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.firstName} {s.lastName} ({s.level || "Lycée"} · {s.email})
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      disabled={
                        !inlineStudentByClass[cls.id] || busyKey === `add-${cls.id}`
                      }
                      onClick={() => handleInlineAdd(cls.id)}
                      className="bg-indigo-600 text-white text-xs font-bold px-3.5 py-2 rounded-xl hover:bg-indigo-700 disabled:opacity-40 shrink-0"
                    >
                      Ajouter
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </OrgShell>
  );
}
