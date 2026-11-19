"use client";
import { useState } from "react";
import Link from "next/link";
import { useTeacherStore, Level } from "@/lib/teacher-store";
import { TeacherShell } from "@/components/TeacherShell";

export default function TeacherClassesPage() {
  const { classes, setSelectedClassId, createClass, addStudentToClass } = useTeacherStore();

  const [showCreateForm, setShowCreateForm] = useState(false);
  const [name, setName] = useState("");
  const [level, setLevel] = useState<Level>("Terminale");

  const [inviteModalClassId, setInviteModalClassId] = useState<string | null>(null);
  const [studentName, setStudentName] = useState("");
  const [studentEmail, setStudentEmail] = useState("");
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    createClass(name, level);
    setName("");
    setShowCreateForm(false);
  };

  const handleAddStudent = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteModalClassId || !studentName.trim()) return;
    addStudentToClass(inviteModalClassId, studentName, studentEmail);
    setStudentName("");
    setStudentEmail("");
    setInviteModalClassId(null);
  };

  const copyCode = (code: string) => {
    navigator.clipboard?.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const modalClass = classes.find((c) => c.id === inviteModalClassId);

  return (
    <TeacherShell>
      <div className="mb-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900">🏫 Mes classes</h1>
          <p className="text-slate-500 mt-1 text-sm">
            Gérez toutes vos classes et groupes d&apos;élèves, partagez les codes d&apos;invitation et suivez chaque groupe séparément.
          </p>
        </div>
        <button
          onClick={() => setShowCreateForm(!showCreateForm)}
          className="inline-flex items-center gap-2 bg-indigo-600 text-white font-semibold px-5 py-2.5 rounded-xl hover:bg-indigo-700 transition-colors text-sm shadow-lg shadow-indigo-100"
        >
          ➕ Nouvelle classe
        </button>
      </div>

      {/* Inline create class panel */}
      {showCreateForm && (
        <form
          onSubmit={handleCreate}
          className="bg-white border border-indigo-200 rounded-3xl p-6 mb-8 shadow-sm"
        >
          <h2 className="font-bold text-slate-900 mb-4">Créer une nouvelle classe</h2>
          <div className="grid sm:grid-cols-3 gap-4 items-end">
            <div className="sm:col-span-1">
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">Nom de la classe</label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="ex : Terminale Spé 2"
                className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-900 bg-white placeholder:text-slate-400 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">Niveau</label>
              <select
                value={level}
                onChange={(e) => setLevel(e.target.value as Level)}
                className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-900 bg-white outline-none focus:border-indigo-400"
              >
                <option value="Seconde">Seconde</option>
                <option value="Première">Première</option>
                <option value="Terminale">Terminale</option>
              </select>
            </div>
            <div className="flex gap-2">
              <button
                type="submit"
                className="flex-1 bg-indigo-600 text-white font-bold py-2.5 rounded-xl text-sm hover:bg-indigo-700"
              >
                Créer
              </button>
              <button
                type="button"
                onClick={() => setShowCreateForm(false)}
                className="px-4 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-600 hover:bg-slate-50"
              >
                Annuler
              </button>
            </div>
          </div>
        </form>
      )}

      {/* Classes grid */}
      <div className="grid lg:grid-cols-2 gap-6">
        {classes.map((cls) => {
          const avg = cls.students.length
            ? Math.round(cls.students.reduce((a, s) => a + s.accuracy, 0) / cls.students.length)
            : 0;
          const struggling = cls.students.filter((s) => s.status === "struggling").length;

          return (
            <div
              key={cls.id}
              className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden flex flex-col"
            >
              {/* Card top banner */}
              <div className={`bg-gradient-to-r ${cls.color} p-6 text-white`}>
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <span className="text-xs font-bold uppercase tracking-wider bg-white/20 px-2.5 py-1 rounded-full">
                      {cls.level}
                    </span>
                    <h2 className="text-xl font-extrabold mt-2">{cls.name}</h2>
                    <p className="text-white/80 text-xs mt-1">
                      {cls.students.length} élève(s) · {struggling} en difficulté · Moyenne {avg}%
                    </p>
                  </div>
                  <button
                    onClick={() => copyCode(cls.inviteCode)}
                    className="bg-white/20 hover:bg-white/30 backdrop-blur px-3 py-2 rounded-xl text-xs font-mono font-bold transition-colors text-right"
                    title="Cliquer pour copier le code"
                  >
                    <div className="text-[10px] font-sans font-normal text-white/80">Code classe</div>
                    <div>{copiedCode === cls.inviteCode ? "✅ Copié !" : cls.inviteCode}</div>
                  </button>
                </div>
              </div>

              {/* Roster preview */}
              <div className="p-6 flex-1">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                    Élèves inscrits ({cls.students.length})
                  </h3>
                  <button
                    onClick={() => setInviteModalClassId(cls.id)}
                    className="text-xs font-semibold text-indigo-600 hover:underline"
                  >
                    + Ajouter un élève
                  </button>
                </div>

                {cls.students.length === 0 ? (
                  <div className="bg-slate-50 rounded-2xl p-5 text-center text-xs text-slate-500">
                    Partagez le code <strong className="font-mono text-slate-700">{cls.inviteCode}</strong> à vos élèves ou ajoutez-les manuellement.
                  </div>
                ) : (
                  <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
                    {cls.students.map((stu) => (
                      <div
                        key={stu.id}
                        className="flex items-center justify-between gap-3 bg-slate-50 rounded-xl px-3.5 py-2.5"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="w-7 h-7 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-xs font-bold shrink-0">
                            {stu.name[0]}
                          </div>
                          <div className="min-w-0">
                            <div className="text-sm font-semibold text-slate-800 truncate">{stu.name}</div>
                            <div className="text-[11px] text-slate-400 truncate">{stu.email}</div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-xs font-bold text-slate-700">{stu.accuracy}%</span>
                          <span
                            className={`w-2.5 h-2.5 rounded-full ${
                              stu.status === "top"
                                ? "bg-emerald-500"
                                : stu.status === "struggling"
                                ? "bg-rose-500"
                                : "bg-amber-400"
                            }`}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Card footer actions */}
              <div className="px-6 py-4 bg-slate-50/70 border-t border-slate-100 flex items-center gap-2">
                <Link
                  href="/teacher/dashboard"
                  onClick={() => setSelectedClassId(cls.id)}
                  className="flex-1 text-center text-xs font-bold bg-white border border-slate-200 text-slate-700 py-2.5 rounded-xl hover:border-indigo-300 hover:text-indigo-600 transition-colors"
                >
                  Tableau de bord
                </Link>
                <Link
                  href="/teacher/results"
                  onClick={() => setSelectedClassId(cls.id)}
                  className="flex-1 text-center text-xs font-bold bg-indigo-600 text-white py-2.5 rounded-xl hover:bg-indigo-700 transition-colors"
                >
                  Heatmap & résultats
                </Link>
              </div>
            </div>
          );
        })}
      </div>

      {/* Add Student Modal */}
      {modalClass && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-7 shadow-2xl border border-slate-100">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-lg font-extrabold text-slate-900">
                Ajouter un élève — {modalClass.name}
              </h3>
              <button
                onClick={() => setInviteModalClassId(null)}
                className="text-slate-400 hover:text-slate-600 text-xl"
              >
                ×
              </button>
            </div>
            <form onSubmit={handleAddStudent} className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                  Nom complet de l&apos;élève
                </label>
                <input
                  type="text"
                  required
                  value={studentName}
                  onChange={(e) => setStudentName(e.target.value)}
                  placeholder="ex : Nour El-Din"
                  className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-900 bg-white placeholder:text-slate-400 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                  Adresse e-mail <span className="text-slate-400 font-normal">(optionnel)</span>
                </label>
                <input
                  type="email"
                  value={studentEmail}
                  onChange={(e) => setStudentEmail(e.target.value)}
                  placeholder="nour@lycee.fr"
                  className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-900 bg-white placeholder:text-slate-400 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                />
              </div>
              <div className="bg-slate-50 rounded-xl p-3 text-xs text-slate-600">
                Ou partagez le code classe :{" "}
                <strong className="font-mono text-indigo-600">{modalClass.inviteCode}</strong>
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setInviteModalClassId(null)}
                  className="flex-1 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-50"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-bold hover:bg-indigo-700"
                >
                  Ajouter
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </TeacherShell>
  );
}
