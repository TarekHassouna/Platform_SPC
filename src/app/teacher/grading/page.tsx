"use client";
import { useState } from "react";
import { useTeacherStore } from "@/lib/teacher-store";
import { TeacherShell } from "@/components/TeacherShell";

export default function TeacherGradingPage() {
  const { classes, selectedClassId, copies, updateCopy, updateStudentAttemptGrade } =
    useTeacherStore();

  const visibleCopies = copies.filter(
    (c) => selectedClassId === "all" || c.classId === selectedClassId
  );

  const [activeCopyId, setActiveCopyId] = useState<string>(visibleCopies[0]?.id || "");
  const [toast, setToast] = useState<string | null>(null);

  const activeCopy =
    visibleCopies.find((c) => c.id === activeCopyId) || visibleCopies[0] || null;

  const handlePublish = async () => {
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
      setToast(
        `✅ Copie de ${activeCopy.studentName} validée et note enregistrée dans Supabase (${activeCopy.teacherScore}/${activeCopy.maxScore})`
      );
    } else {
      setToast(`⚠️ ${res.error || "Erreur lors de l'enregistrement de la note."}`);
    }
    setTimeout(() => setToast(null), 4000);
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
          <h1 className="text-2xl font-extrabold text-slate-900">🖼️ Correction de copies manuscrites</h1>
          <p className="text-slate-500 mt-1 text-sm">
            Importez une pile de copies photographiées : l&apos;IA transcrit, pré-note selon le barème et signale les lignes incertaines. Vous gardez toujours le dernier mot.
          </p>
        </div>
        <label className="cursor-pointer inline-flex items-center gap-2 bg-indigo-600 text-white font-semibold px-5 py-2.5 rounded-xl hover:bg-indigo-700 transition-colors text-sm shadow-lg shadow-indigo-100">
          📸 Importer des copies
          <input
            type="file"
            multiple
            accept="image/*,.pdf"
            className="hidden"
            onChange={() => {
              setToast("📤 Copies reçues — transcription IA et pré-correction en cours…");
              setTimeout(() => setToast(null), 3500);
            }}
          />
        </label>
      </div>

      {visibleCopies.length === 0 ? (
        <div className="bg-white rounded-3xl border border-slate-100 p-12 text-center text-sm text-slate-500">
          Aucune copie à corriger pour cette classe pour le moment.
        </div>
      ) : (
        <div className="grid lg:grid-cols-12 gap-6">
          {/* Left list of copies */}
          <div className="lg:col-span-4 space-y-3">
            <div className="text-xs font-bold uppercase tracking-wider text-slate-400 px-1">
              File de copies ({visibleCopies.length})
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
                      Pré-note : {copy.teacherScore}/{copy.maxScore}
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
                            <div className="font-mono text-sm text-slate-900 bg-white/80 rounded-xl px-3 py-2 border border-black/5 mb-2">
                              {line.latex}
                            </div>
                            <div className="text-xs text-slate-700 leading-relaxed">{line.note}</div>
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
                    Les erreurs détectées mettront automatiquement à jour la carte de maîtrise de l&apos;élève.
                  </span>
                  <button
                    onClick={handlePublish}
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
    </TeacherShell>
  );
}
