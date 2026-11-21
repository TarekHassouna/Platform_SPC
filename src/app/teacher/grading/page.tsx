"use client";
import { useMemo, useState } from "react";
import { useTeacherStore } from "@/lib/teacher-store";
import { TeacherShell } from "@/components/TeacherShell";
import { MathText } from "@/components/MathText";

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || "");
      resolve(result.includes(",") ? result.split(",")[1] : result);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export default function TeacherGradingPage() {
  const {
    classes,
    selectedClassId,
    setSelectedClassId,
    assignments,
    copies,
    updateCopy,
    updateStudentAttemptGrade,
    announcePhotoCopyAssignment,
    updateAssignmentReferenceCorrection,
    toggleAssignmentVisibility,
  } = useTeacherStore();

  const [selectedDropId, setSelectedDropId] = useState<string>("all");
  const [activeCopyId, setActiveCopyId] = useState<string>("");
  const [toast, setToast] = useState<string | null>(null);

  // Modal: Announce a new paper copy drop
  const [showAnnounceModal, setShowAnnounceModal] = useState(false);
  const [newClassId, setNewClassId] = useState<string>(
    selectedClassId !== "all" ? selectedClassId : classes[0]?.id || ""
  );
  const [newTitle, setNewTitle] = useState("");
  const [newCorrection, setNewCorrection] = useState("");
  const [newVisible, setNewVisible] = useState(true);
  const [ocrLoading, setOcrLoading] = useState(false);
  const [announcing, setAnnouncing] = useState(false);

  // Inline editor: Update reference correction of an existing announced copy drop
  const [editingCorrectionId, setEditingCorrectionId] = useState<string | null>(null);
  const [editingCorrectionText, setEditingCorrectionText] = useState<string>("");
  const [savingCorrection, setSavingCorrection] = useState(false);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 4000);
  };

  // Announced paper copy drops filtered by selected class
  const photoDrops = useMemo(
    () =>
      assignments.filter(
        (a) =>
          a.submissionType === "photo_copy" &&
          (selectedClassId === "all" || a.classId === selectedClassId)
      ),
    [assignments, selectedClassId]
  );

  // Received student copies filtered by class AND selected drop
  const visibleCopies = useMemo(() => {
    return copies.filter((c) => {
      if (selectedClassId !== "all" && c.classId !== selectedClassId) return false;
      if (selectedDropId === "unassigned") return !c.assignmentId;
      if (selectedDropId !== "all") return c.assignmentId === selectedDropId;
      return true;
    });
  }, [copies, selectedClassId, selectedDropId]);

  const activeCopy =
    visibleCopies.find((c) => c.id === activeCopyId) || visibleCopies[0] || null;

  const extractCorrectionFromPhoto = async (
    file: File,
    onResult: (extractedText: string) => void
  ) => {
    setOcrLoading(true);
    try {
      const imageBase64 = await fileToBase64(file);
      const res = await fetch("/api/vision/transcribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imageBase64,
          mimeType: file.type || "image/jpeg",
          mode: "correct",
        }),
      });
      const data = await res.json();
      if (res.ok && Array.isArray(data.lines) && data.lines.length > 0) {
        const text = data.lines
          .map((l: { text: string }) => l.text)
          .join("\n");
        onResult(text);
        showToast("✅ Corrigé papier lu par l'IA ! Vérifie et enregistre.");
      } else {
        showToast(`⚠️ ${data.error || "Impossible de lire la photo du corrigé."}`);
      }
    } catch {
      showToast("⚠️ Erreur réseau pendant la lecture de la photo.");
    }
    setOcrLoading(false);
  };

  const handleAnnounceSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const targetCls = newClassId || classes[0]?.id;
    if (!targetCls || !newTitle.trim()) return;
    setAnnouncing(true);
    const res = await announcePhotoCopyAssignment({
      classId: targetCls,
      title: newTitle.trim(),
      referenceCorrection: newCorrection,
      isVisible: newVisible,
    });
    setAnnouncing(false);
    if (res.ok) {
      setShowAnnounceModal(false);
      setNewTitle("");
      setNewCorrection("");
      showToast("✅ Dépôt de copie annoncé ! Tes élèves peuvent maintenant y déposer leur copie.");
    } else {
      showToast(`⚠️ ${res.error}`);
    }
  };

  const handleSaveReferenceCorrection = async (dropId: string) => {
    setSavingCorrection(true);
    const res = await updateAssignmentReferenceCorrection(dropId, editingCorrectionText);
    setSavingCorrection(false);
    if (res.ok) {
      setEditingCorrectionId(null);
      showToast("✅ Corrigé de référence mis à jour : l'IA s'appuiera dessus pour noter les copies !");
    } else {
      showToast(`⚠️ ${res.error || "Impossible d'enregistrer le corrigé."}`);
    }
  };

  const handlePublishGrade = async () => {
    if (!activeCopy) return;
    updateCopy(activeCopy.id, { status: "published" });
    const res = await updateStudentAttemptGrade({
      studentId: activeCopy.studentId,
      submissionId: activeCopy.id,
      evaluationResultId: activeCopy.evaluationResultId,
      newScore: activeCopy.teacherScore,
      maxScore: activeCopy.maxScore,
      teacherComment: activeCopy.teacherComment,
    });
    if (res.ok) {
      showToast(
        `✅ Copie de ${activeCopy.studentName} validée et enregistrée (${activeCopy.teacherScore}/${activeCopy.maxScore})`
      );
    } else {
      showToast(`⚠️ ${res.error || "Erreur lors de l'enregistrement de la note."}`);
    }
  };

  return (
    <TeacherShell>
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 text-white text-sm font-medium px-5 py-3 rounded-2xl shadow-xl max-w-md">
          {toast}
        </div>
      )}

      {/* Header */}
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900">🖼️ Copies papier &amp; Corrections IA</h1>
          <p className="text-slate-500 mt-1 text-sm">
            Annonce un dépôt de copie par classe avec ton corrigé officiel : l&apos;IA corrige selon ton barème et classe les copies par classe et par devoir.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setNewClassId(selectedClassId !== "all" ? selectedClassId : classes[0]?.id || "");
            setShowAnnounceModal(true);
          }}
          disabled={classes.length === 0}
          className="inline-flex items-center justify-center gap-2 bg-indigo-600 text-white font-bold px-5 py-2.5 rounded-xl hover:bg-indigo-700 transition-colors text-sm shadow-lg shadow-indigo-100 disabled:opacity-50"
        >
          📢 Annoncer un dépôt de copie
        </button>
      </div>

      {/* Class division tabs */}
      <div className="flex items-center gap-2 flex-wrap mb-6">
        <button
          type="button"
          onClick={() => {
            setSelectedClassId("all");
            setSelectedDropId("all");
          }}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            selectedClassId === "all"
              ? "bg-indigo-600 text-white shadow-sm"
              : "bg-white text-slate-600 border border-slate-200 hover:border-indigo-300"
          }`}
        >
          Toutes les classes ({copies.length})
        </button>
        {classes.map((cls) => {
          const count = copies.filter((c) => c.classId === cls.id).length;
          return (
            <button
              key={cls.id}
              type="button"
              onClick={() => {
                setSelectedClassId(cls.id);
                setSelectedDropId("all");
              }}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                selectedClassId === cls.id
                  ? "bg-indigo-600 text-white shadow-sm"
                  : "bg-white text-slate-600 border border-slate-200 hover:border-indigo-300"
              }`}
            >
              {cls.name} ({count} copie{count > 1 ? "s" : ""})
            </button>
          );
        })}
      </div>

      {/* Section 1: Announced Paper Copy Drops */}
      <div className="bg-white rounded-3xl border border-slate-100 p-6 shadow-sm mb-7">
        <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
          <div>
            <h2 className="font-extrabold text-slate-900 text-base">
              📢 Dépôts de copies annoncés ({photoDrops.length})
            </h2>
            <p className="text-xs text-slate-400">
              Clique sur un dépôt pour filtrer uniquement ses copies, ou mets à jour son corrigé de référence pour entraîner l&apos;IA.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setSelectedDropId("all")}
              className={`text-xs font-bold px-3 py-1.5 rounded-xl border ${
                selectedDropId === "all"
                  ? "bg-indigo-600 text-white border-indigo-600"
                  : "bg-slate-50 text-slate-600 border-slate-200 hover:border-indigo-300"
              }`}
            >
              Toutes les copies
            </button>
            <button
              type="button"
              onClick={() => setSelectedDropId("unassigned")}
              className={`text-xs font-bold px-3 py-1.5 rounded-xl border ${
                selectedDropId === "unassigned"
                  ? "bg-indigo-600 text-white border-indigo-600"
                  : "bg-slate-50 text-slate-600 border-slate-200 hover:border-indigo-300"
              }`}
            >
              Copies libres
            </button>
          </div>
        </div>

        {photoDrops.length === 0 ? (
          <div className="bg-slate-50 border border-dashed border-slate-200 rounded-2xl p-6 text-center text-xs text-slate-500">
            Aucun dépôt de copie papier annoncé pour cette classe. Clique sur <strong>« 📢 Annoncer un dépôt de copie »</strong> pour ouvrir un espace de dépôt avec ton corrigé IA !
          </div>
        ) : (
          <div className="space-y-3">
            {photoDrops.map((drop) => {
              const cls = classes.find((c) => c.id === drop.classId);
              const receivedCount = copies.filter((c) => c.assignmentId === drop.id).length;
              const isSelected = selectedDropId === drop.id;
              const isEditingCorr = editingCorrectionId === drop.id;

              return (
                <div
                  key={drop.id}
                  className={`rounded-2xl border p-4 transition-all ${
                    isSelected
                      ? "bg-indigo-50/60 border-indigo-400"
                      : "bg-slate-50/70 border-slate-200"
                  }`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <button
                      type="button"
                      onClick={() => setSelectedDropId(isSelected ? "all" : drop.id)}
                      className="text-left flex-1 min-w-[200px]"
                    >
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className="text-[11px] font-bold bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-md">
                          {cls?.name || "Classe"}
                        </span>
                        <span className="text-[11px] font-bold bg-white border border-slate-200 text-slate-700 px-2 py-0.5 rounded-md">
                          📥 {receivedCount} / {drop.totalStudents} copie(s)
                        </span>
                        <span
                          className={`text-[11px] font-semibold px-2 py-0.5 rounded-md ${
                            drop.referenceCorrection
                              ? "bg-emerald-100 text-emerald-800"
                              : "bg-amber-100 text-amber-800"
                          }`}
                        >
                          {drop.referenceCorrection ? "✓ Corrigé IA configuré" : "⚠️ Aucun corrigé IA"}
                        </span>
                      </div>
                      <div className="font-bold text-slate-900 text-sm">{drop.title}</div>
                    </button>

                    <div className="flex items-center gap-2 flex-wrap">
                      <button
                        type="button"
                        onClick={() => toggleAssignmentVisibility(drop.id)}
                        className={`text-xs font-bold px-2.5 py-1.5 rounded-xl transition-colors ${
                          drop.isVisible
                            ? "bg-emerald-100 text-emerald-800 hover:bg-rose-100 hover:text-rose-800"
                            : "bg-slate-200 text-slate-700 hover:bg-emerald-100 hover:text-emerald-800"
                        }`}
                      >
                        {drop.isVisible ? "👁️ Visible élèves" : "🙈 Masqué"}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (isEditingCorr) {
                            setEditingCorrectionId(null);
                          } else {
                            setEditingCorrectionId(drop.id);
                            setEditingCorrectionText(drop.referenceCorrection || "");
                          }
                        }}
                        className="text-xs font-bold bg-white border border-indigo-200 text-indigo-700 hover:bg-indigo-50 px-3 py-1.5 rounded-xl"
                      >
                        {isEditingCorr ? "Fermer corrigé" : "✏️ Corrigé IA"}
                      </button>
                    </div>
                  </div>

                  {isEditingCorr && (
                    <div className="mt-4 pt-4 border-t border-indigo-200 space-y-3">
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <label className="text-xs font-bold text-indigo-900">
                          Corrigé officiel &amp; barème de référence (l&apos;IA note chaque copie élève à partir de ce texte)
                        </label>
                        <label className="cursor-pointer text-xs font-bold bg-violet-100 text-violet-800 hover:bg-violet-200 px-3 py-1.5 rounded-lg">
                          {ocrLoading ? "⏳ Lecture photo…" : "📸 Scanner mon corrigé papier"}
                          <input
                            type="file"
                            accept="image/*"
                            disabled={ocrLoading}
                            className="hidden"
                            onChange={(e) => {
                              const f = e.target.files?.[0];
                              if (f) {
                                extractCorrectionFromPhoto(f, (txt) =>
                                  setEditingCorrectionText((prev) =>
                                    prev ? `${prev}\n${txt}` : txt
                                  )
                                );
                              }
                              e.target.value = "";
                            }}
                          />
                        </label>
                      </div>
                      <textarea
                        rows={5}
                        value={editingCorrectionText}
                        onChange={(e) => setEditingCorrectionText(e.target.value)}
                        placeholder="ex : Q1 (6 pts) : n_i = C * V_A = 0,020 mol. Q2 (8 pts) : v(t) = (1/V)*(dx/dt)..."
                        className="w-full border border-indigo-200 rounded-xl px-3.5 py-2.5 text-xs font-mono text-slate-900 bg-white outline-none focus:border-indigo-500"
                      />
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => setEditingCorrectionId(null)}
                          className="text-xs font-semibold text-slate-500 px-3 py-2 rounded-xl border border-slate-200 bg-white"
                        >
                          Annuler
                        </button>
                        <button
                          type="button"
                          disabled={savingCorrection}
                          onClick={() => handleSaveReferenceCorrection(drop.id)}
                          className="text-xs font-bold bg-emerald-600 text-white px-4 py-2 rounded-xl hover:bg-emerald-700 disabled:opacity-60"
                        >
                          {savingCorrection ? "⏳ Enregistrement…" : "💾 Enregistrer le corrigé IA"}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Section 2: Organized Copy Inbox */}
      {visibleCopies.length === 0 ? (
        <div className="bg-white rounded-3xl border border-slate-100 p-12 text-center text-sm text-slate-500">
          Aucune copie reçue pour cette sélection pour le moment.
        </div>
      ) : (
        <div className="grid lg:grid-cols-12 gap-6">
          {/* Left list of copies */}
          <div className="lg:col-span-4 space-y-3 max-h-[680px] overflow-y-auto pr-1">
            <div className="text-xs font-bold uppercase tracking-wider text-slate-400 px-1">
              Copies reçues ({visibleCopies.length})
            </div>
            {visibleCopies.map((copy) => {
              const cls = classes.find((c) => c.id === copy.classId);
              const isSelected = activeCopy?.id === copy.id;
              return (
                <button
                  key={copy.id}
                  onClick={() => setActiveCopyId(copy.id)}
                  className={`w-full text-left rounded-2xl border p-4 transition-all ${
                    isSelected
                      ? "bg-indigo-50/70 border-indigo-400 shadow-sm"
                      : "bg-white border-slate-100 hover:border-indigo-200"
                  }`}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-md">
                      {cls?.name || "Classe"}
                    </span>
                    <span
                      className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                        copy.status === "published"
                          ? "bg-emerald-100 text-emerald-700"
                          : "bg-amber-100 text-amber-800"
                      }`}
                    >
                      {copy.status === "published" ? "✓ Publiée" : "À valider"}
                    </span>
                  </div>
                  <div className="font-bold text-slate-900 text-sm">{copy.studentName}</div>
                  <div className="text-xs text-slate-500 truncate mt-0.5">{copy.assignmentTitle}</div>
                  <div className="flex items-center justify-between mt-3 text-xs">
                    <span className="text-slate-400">{copy.submittedAt}</span>
                    <span className="font-extrabold text-slate-800">
                      Note : {copy.teacherScore}/{copy.maxScore}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Right: Detailed AI transcription & Teacher adjustment */}
          {activeCopy && (
            <div className="lg:col-span-8 bg-white rounded-3xl border border-slate-100 p-6 shadow-sm space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
                <div>
                  <h2 className="text-lg font-extrabold text-slate-900">
                    {activeCopy.studentName} — {activeCopy.assignmentTitle}
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Soumis : {activeCopy.submittedAt} · Confiance OCR :{" "}
                    <strong
                      className={
                        activeCopy.confidence === "Haute"
                          ? "text-emerald-600"
                          : "text-amber-600"
                      }
                    >
                      {activeCopy.confidence}
                    </strong>
                  </p>
                </div>
                <div className="bg-slate-50 border border-slate-200 rounded-2xl px-4 py-2 text-right">
                  <div className="text-[11px] text-slate-400">Pré-note IA</div>
                  <div className="text-xl font-extrabold text-indigo-600">
                    {activeCopy.aiScore} / {activeCopy.maxScore}
                  </div>
                </div>
              </div>

              {/* Line-by-line transcription */}
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">
                  Transcription &amp; analyse étape par étape
                </h3>
                <div className="space-y-3">
                  {activeCopy.transcription.map((line) => {
                    const styles =
                      line.verdict === "correct"
                        ? "bg-emerald-50/70 border-emerald-200"
                        : line.verdict === "error"
                        ? "bg-rose-50/70 border-rose-200"
                        : line.verdict === "uncertain"
                        ? "bg-amber-50 border-amber-300"
                        : "bg-amber-50/60 border-amber-200";
                    const icon =
                      line.verdict === "correct"
                        ? "✅"
                        : line.verdict === "error"
                        ? "❌"
                        : line.verdict === "uncertain"
                        ? "🔎"
                        : "⚠️";
                    return (
                      <div key={line.step} className={`rounded-2xl border p-4 ${styles}`}>
                        <div className="flex items-start gap-3">
                          <span className="text-base mt-0.5">{icon}</span>
                          <div className="flex-1 min-w-0">
                            <div className="text-xs font-bold text-slate-500 mb-1">
                              Étape {line.step}
                            </div>
                            <div className="text-sm text-slate-900 bg-white/80 rounded-xl px-3 py-2 border border-black/5 mb-2">
                              <MathText text={line.latex} />
                            </div>
                            <div className="text-xs text-slate-700 leading-relaxed">
                              <MathText text={line.note} />
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Teacher override & comment */}
              <div className="bg-slate-50 rounded-2xl p-5 border border-slate-100 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                  <div className="w-40">
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">
                      Note finale (/ {activeCopy.maxScore})
                    </label>
                    <input
                      type="number"
                      step="0.5"
                      min={0}
                      max={activeCopy.maxScore}
                      value={activeCopy.teacherScore}
                      onChange={(e) =>
                        updateCopy(activeCopy.id, { teacherScore: Number(e.target.value) })
                      }
                      className="w-full border border-slate-200 rounded-xl px-3.5 py-2 text-base font-extrabold text-slate-900 bg-white outline-none focus:border-indigo-400"
                    />
                  </div>
                  <div className="flex-1">
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">
                      Appréciation enseignant (visible par l&apos;élève)
                    </label>
                    <textarea
                      rows={2}
                      value={activeCopy.teacherComment}
                      onChange={(e) =>
                        updateCopy(activeCopy.id, { teacherComment: e.target.value })
                      }
                      className="w-full border border-slate-200 rounded-xl px-3.5 py-2 text-sm text-slate-900 bg-white outline-none focus:border-indigo-400"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2">
                  <span className="text-xs text-slate-500">
                    La note finale est enregistrée et mise à jour sur la fiche de l&apos;élève.
                  </span>
                  <button
                    onClick={handlePublishGrade}
                    className="bg-emerald-600 text-white font-bold px-6 py-2.5 rounded-xl hover:bg-emerald-700 transition-colors text-sm shadow-md shadow-emerald-100 whitespace-nowrap"
                  >
                    {activeCopy.status === "published"
                      ? "✓ Mettre à jour la note"
                      : "✅ Valider & publier"}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Modal: Announce a new Paper Copy Drop */}
      {showAnnounceModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-7 shadow-2xl border border-slate-100 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-extrabold text-slate-900">📢 Annoncer un dépôt de copie papier</h3>
              <button
                type="button"
                onClick={() => setShowAnnounceModal(false)}
                className="text-slate-400 hover:text-slate-600 text-xl"
              >
                ×
              </button>
            </div>
            <p className="text-xs text-slate-500 mb-4">
              Tes élèves verront cet espace de dépôt dans <strong>Photo &amp; correction</strong>. L&apos;IA utilisera ton corrigé ci-dessous pour pré-noter chaque copie sur 20 avant validation.
            </p>
            <form onSubmit={handleAnnounceSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">Classe destinataire</label>
                <select
                  value={newClassId}
                  onChange={(e) => setNewClassId(e.target.value)}
                  className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-900 bg-white outline-none focus:border-indigo-400"
                >
                  {classes.map((cls) => (
                    <option key={cls.id} value={cls.id}>
                      {cls.name} ({cls.level} · {cls.students.length} élèves)
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Titre du devoir papier à rendre
                </label>
                <input
                  type="text"
                  required
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="ex : DS n°2 — Cinétique chimique & Titrage (copie papier)"
                  className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-900 bg-white outline-none focus:border-indigo-400"
                />
              </div>
              <div>
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <label className="text-xs font-bold text-slate-700">
                    Corrigé officiel &amp; barème pour l&apos;IA (/ 20)
                  </label>
                  <label className="cursor-pointer text-[11px] font-bold bg-violet-100 text-violet-800 hover:bg-violet-200 px-2.5 py-1 rounded-lg">
                    {ocrLoading ? "⏳ Lecture…" : "📸 Photo de mon corrigé"}
                    <input
                      type="file"
                      accept="image/*"
                      disabled={ocrLoading}
                      className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) {
                          extractCorrectionFromPhoto(f, (txt) =>
                            setNewCorrection((prev) => (prev ? `${prev}\n${txt}` : txt))
                          );
                        }
                        e.target.value = "";
                      }}
                    />
                  </label>
                </div>
                <textarea
                  rows={5}
                  value={newCorrection}
                  onChange={(e) => setNewCorrection(e.target.value)}
                  placeholder="Colle ou scanne ton corrigé détaillé + les points par question (tu pourras aussi le modifier plus tard)…"
                  className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs font-mono text-slate-900 bg-white outline-none focus:border-indigo-400"
                />
              </div>
              <label className="flex items-center gap-2.5 cursor-pointer bg-slate-50 border border-slate-200 rounded-xl p-3">
                <input
                  type="checkbox"
                  checked={newVisible}
                  onChange={(e) => setNewVisible(e.target.checked)}
                  className="w-4 h-4 accent-indigo-600"
                />
                <span className="text-xs font-semibold text-slate-700">
                  👁️ Rendre immédiatement visible aux élèves de la classe
                </span>
              </label>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAnnounceModal(false)}
                  className="flex-1 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-50"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={announcing}
                  className="flex-1 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-bold hover:bg-indigo-700 disabled:opacity-60"
                >
                  {announcing ? "⏳ Publication…" : "📢 Publier le dépôt"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </TeacherShell>
  );
}
