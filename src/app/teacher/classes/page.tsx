"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { useTeacherStore, Level } from "@/lib/teacher-store";
import { TeacherShell } from "@/components/TeacherShell";
import {
  fetchClassAnnouncements,
  createClassAnnouncement,
  deleteClassAnnouncement,
  getCourseFileSignedUrl,
  type ClassAnnouncementRecord,
} from "@/lib/db";

export default function TeacherClassesPage() {
  const { user } = useAuth();
  const { classes, selectedClassId, setSelectedClassId, createClass, addStudentToClass } = useTeacherStore();

  const [showCreateForm, setShowCreateForm] = useState(false);
  const [name, setName] = useState("");
  const [level, setLevel] = useState<Level>("Terminale");

  const [inviteModalClassId, setInviteModalClassId] = useState<string | null>(null);
  const [studentName, setStudentName] = useState("");
  const [studentEmail, setStudentEmail] = useState("");
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  // Class Announcements & Course PDFs state
  const [announcements, setAnnouncements] = useState<ClassAnnouncementRecord[]>([]);
  const [annClassId, setAnnClassId] = useState<string>("");
  const [annTitle, setAnnTitle] = useState("");
  const [annBody, setAnnBody] = useState("");
  const [annPinned, setAnnPinned] = useState(false);
  const [annFile, setAnnFile] = useState<File | null>(null);
  const [publishingAnn, setPublishingAnn] = useState(false);
  const [annMsg, setAnnMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const loadAnnouncements = useCallback(async () => {
    const ids = classes.map((c) => c.id);
    if (ids.length === 0) {
      setAnnouncements([]);
      return;
    }
    const list = await fetchClassAnnouncements(ids);
    setAnnouncements(list);
  }, [classes]);

  useEffect(() => {
    loadAnnouncements();
    if (!annClassId && (selectedClassId || classes[0]?.id)) {
      setAnnClassId(selectedClassId || classes[0]?.id || "");
    }
  }, [loadAnnouncements, annClassId, selectedClassId, classes]);

  const handlePublishAnnouncement = async (e: React.FormEvent) => {
    e.preventDefault();
    const targetClassId = annClassId || classes[0]?.id;
    if (!targetClassId || !user?.id || !annTitle.trim()) return;
    setPublishingAnn(true);
    setAnnMsg(null);
    const res = await createClassAnnouncement({
      classId: targetClassId,
      teacherId: user.id,
      title: annTitle.trim(),
      body: annBody.trim(),
      isPinned: annPinned,
      file: annFile,
    });
    setPublishingAnn(false);
    if (!res.ok) {
      setAnnMsg({ ok: false, text: res.error || "Impossible de publier l'annonce." });
      return;
    }
    setAnnTitle("");
    setAnnBody("");
    setAnnPinned(false);
    setAnnFile(null);
    setAnnMsg({ ok: true, text: "✅ Annonce / fiche publiée pour vos élèves !" });
    await loadAnnouncements();
  };

  const handleDeleteAnnouncement = async (a: ClassAnnouncementRecord) => {
    const ok = await deleteClassAnnouncement(a.id, a.attachmentPath);
    if (ok) {
      setAnnouncements((prev) => prev.filter((x) => x.id !== a.id));
      setAnnMsg({ ok: true, text: "🗑️ Annonce supprimée." });
    }
  };

  const handleOpenAttachment = async (path: string) => {
    const url = await getCourseFileSignedUrl(path);
    if (url) window.open(url, "_blank", "noopener,noreferrer");
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    await createClass(name, level);
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
      {classes.length === 0 ? (
        <div className="bg-white rounded-3xl border border-slate-100 p-12 text-center shadow-sm">
          <div className="text-4xl mb-3">🏫</div>
          <h2 className="text-lg font-extrabold text-slate-900 mb-1">Aucune classe pour le moment</h2>
          <p className="text-sm text-slate-500 mb-5">
            Créez votre première classe (Seconde, Première ou Terminale) pour obtenir un code d&apos;invitation unique pour vos élèves.
          </p>
          <button
            onClick={() => setShowCreateForm(true)}
            className="bg-indigo-600 text-white font-bold text-sm px-6 py-3 rounded-xl hover:bg-indigo-700"
          >
            ➕ Créer ma première classe
          </button>
        </div>
      ) : (
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
                <div className="flex items-center justify-between mb-3 gap-2">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                    Élèves inscrits ({cls.students.length})
                  </h3>
                  <div className="flex items-center gap-3">
                    <label className="cursor-pointer text-xs font-semibold text-emerald-600 hover:underline">
                      📄 Importer CSV
                      <input
                        type="file"
                        accept=".csv,.txt"
                        className="hidden"
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          const text = await file.text();
                          const rows = text
                            .split(/\r?\n/)
                            .map((r) => r.trim())
                            .filter(Boolean);
                          rows.forEach((row, idx) => {
                            if (idx === 0 && row.toLowerCase().includes("nom")) return;
                            const [n, em] = row.split(/[,;]/).map((s) => s.trim());
                            if (n) addStudentToClass(cls.id, n, em || "");
                          });
                          e.target.value = "";
                        }}
                      />
                    </label>
                    <button
                      onClick={() => setInviteModalClassId(cls.id)}
                      className="text-xs font-semibold text-indigo-600 hover:underline"
                    >
                      + Ajouter
                    </button>
                  </div>
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
      )}

      {/* Class Announcements & Course PDFs Section */}
      {classes.length > 0 && (
        <div className="mt-10 grid lg:grid-cols-12 gap-6">
          <form
            onSubmit={handlePublishAnnouncement}
            className="lg:col-span-5 bg-white border border-slate-100 rounded-3xl p-6 shadow-sm space-y-4 self-start"
          >
            <div>
              <h2 className="font-extrabold text-slate-900 text-base">
                📢 Publier une annonce ou fiche de cours (PDF)
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Visible immédiatement sur le tableau de bord de tous les élèves de la classe choisie.
              </p>
            </div>

            {annMsg && (
              <div
                className={`rounded-xl px-3.5 py-2.5 text-xs font-semibold border ${
                  annMsg.ok
                    ? "bg-emerald-50 border-emerald-200 text-emerald-800"
                    : "bg-rose-50 border-rose-200 text-rose-700"
                }`}
              >
                {annMsg.text}
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Classe *</label>
              <select
                value={annClassId || classes[0]?.id || ""}
                onChange={(e) => setAnnClassId(e.target.value)}
                className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs font-semibold text-slate-900 bg-white outline-none focus:border-indigo-400"
              >
                {classes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.level})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Titre *</label>
              <input
                type="text"
                required
                value={annTitle}
                onChange={(e) => setAnnTitle(e.target.value)}
                placeholder="ex : Fiche de révision — Titrages acido-basiques (DS jeudi)"
                className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 bg-white placeholder:text-slate-400 outline-none focus:border-indigo-400"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Message / consignes
              </label>
              <textarea
                rows={3}
                value={annBody}
                onChange={(e) => setAnnBody(e.target.value)}
                placeholder="Détails du cours, date du contrôle, exercices à préparer…"
                className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 bg-white placeholder:text-slate-400 outline-none focus:border-indigo-400"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Joindre un fichier PDF ou image <span className="text-slate-400 font-normal">(optionnel, max 15 Mo)</span>
              </label>
              <input
                type="file"
                accept=".pdf,image/png,image/jpeg,image/webp"
                onChange={(e) => setAnnFile(e.target.files?.[0] || null)}
                className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-600 bg-white file:mr-3 file:py-1 file:px-3 file:rounded-lg file:border-0 file:bg-indigo-50 file:text-indigo-700 file:font-bold"
              />
              {annFile && (
                <div className="text-[11px] text-emerald-700 font-semibold mt-1">
                  📎 {annFile.name} ({Math.round(annFile.size / 1024)} Ko)
                </div>
              )}
            </div>

            <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-slate-700">
              <input
                type="checkbox"
                checked={annPinned}
                onChange={(e) => setAnnPinned(e.target.checked)}
                className="w-4 h-4 accent-indigo-600"
              />
              📌 Épingler en haut du tableau de bord élève
            </label>

            <button
              type="submit"
              disabled={publishingAnn}
              className="w-full bg-indigo-600 text-white font-bold py-2.5 rounded-xl text-xs hover:bg-indigo-700 disabled:opacity-50 shadow-sm"
            >
              {publishingAnn ? "Publication en cours…" : "📢 Publier dans la classe"}
            </button>
          </form>

          <div className="lg:col-span-7 bg-white border border-slate-100 rounded-3xl shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <h2 className="font-bold text-slate-900 text-sm">
                📚 Annonces &amp; cours publiés ({announcements.length})
              </h2>
            </div>
            {announcements.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-400">
                Aucune annonce ni fiche PDF publiée pour le moment.
              </div>
            ) : (
              <div className="divide-y divide-slate-50 max-h-[440px] overflow-y-auto">
                {announcements.map((a) => (
                  <div key={a.id} className="px-6 py-4 space-y-2">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          {a.isPinned && (
                            <span className="text-[10px] font-bold bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full">
                              📌 Épinglé
                            </span>
                          )}
                          {a.className && (
                            <span className="text-[10px] font-bold bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-full">
                              {a.className}
                            </span>
                          )}
                          <span className="text-sm font-bold text-slate-900">{a.title}</span>
                        </div>
                        <div className="text-[11px] text-slate-400 mt-0.5">
                          Publié le {new Date(a.createdAt).toLocaleDateString("fr-FR")}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleDeleteAnnouncement(a)}
                        className="text-xs font-semibold text-rose-500 hover:bg-rose-50 px-2.5 py-1 rounded-lg shrink-0"
                      >
                        🗑️
                      </button>
                    </div>
                    {a.body && (
                      <p className="text-xs text-slate-600 leading-relaxed whitespace-pre-wrap">
                        {a.body}
                      </p>
                    )}
                    {a.attachmentPath && (
                      <button
                        type="button"
                        onClick={() => handleOpenAttachment(a.attachmentPath!)}
                        className="inline-flex items-center gap-1.5 text-xs font-bold bg-indigo-50 text-indigo-700 px-3 py-1.5 rounded-xl hover:bg-indigo-100"
                      >
                        📄 {a.attachmentName || "Ouvrir le fichier PDF"} ↗
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

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
