"use client";
import { useEffect, useMemo, useState } from "react";
import { useTeacherStore, type StudentAttemptRecord } from "@/lib/teacher-store";
import { TeacherShell } from "@/components/TeacherShell";

function cellStyle(score: number) {
  if (score >= 80) return "bg-emerald-100 text-emerald-800 border-emerald-200";
  if (score >= 60) return "bg-lime-100 text-lime-800 border-lime-200";
  if (score >= 45) return "bg-amber-100 text-amber-800 border-amber-200";
  return "bg-rose-100 text-rose-800 border-rose-200 font-bold";
}

const COLS_PER_PAGE = 4;

export default function TeacherResultsPage() {
  const {
    classes,
    selectedClassId,
    setSelectedClassId,
    updateStudentAttemptGrade,
  } = useTeacherStore();

  const [remediatedSkills, setRemediatedSkills] = useState<string[]>([]);
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const [selectedExercise, setSelectedExercise] = useState<string>("");
  const [studentSearch, setStudentSearch] = useState("");
  const [colPage, setColPage] = useState(0);

  // Inline grade editing state keyed by submission id
  const [openAttemptId, setOpenAttemptId] = useState<string | null>(null);
  const [draftScore, setDraftScore] = useState<string>("");
  const [draftComment, setDraftComment] = useState<string>("");
  const [savingGrade, setSavingGrade] = useState(false);
  const [gradeNotice, setGradeNotice] = useState<{ ok: boolean; text: string } | null>(null);

  const activeClass = classes.find((c) => c.id === selectedClassId) || classes[0];

  const allSkills = activeClass?.skills || [];
  const totalPages = Math.max(1, Math.ceil(allSkills.length / COLS_PER_PAGE));

  // Reset pagination when class changes
  useEffect(() => {
    setColPage(0);
    setSelectedExercise("");
    setSelectedStudentId(null);
    setOpenAttemptId(null);
    setGradeNotice(null);
  }, [activeClass?.id]);

  // Visible columns in heatmap: either the 1 chosen exercise OR a compact paginated window of 4 columns
  const visibleSkills = useMemo(() => {
    if (selectedExercise && allSkills.includes(selectedExercise)) {
      return [selectedExercise];
    }
    const safePage = Math.min(colPage, totalPages - 1);
    return allSkills.slice(safePage * COLS_PER_PAGE, (safePage + 1) * COLS_PER_PAGE);
  }, [allSkills, selectedExercise, colPage, totalPages]);

  const filteredStudents = useMemo(() => {
    const list = activeClass?.students || [];
    if (!studentSearch.trim()) return list;
    const q = studentSearch.toLowerCase();
    return list.filter(
      (s) => s.name.toLowerCase().includes(q) || s.email.toLowerCase().includes(q)
    );
  }, [activeClass?.students, studentSearch]);

  const selectedStudent = activeClass?.students.find((s) => s.id === selectedStudentId) || null;

  // All distinct exercise titles attempted in this class (for the correction selector)
  const attemptedExercises = useMemo(() => {
    const set = new Set<string>();
    (activeClass?.students || []).forEach((s) => {
      s.recentAttempts.forEach((a) => set.add(a.exerciseTitle));
    });
    return Array.from(set);
  }, [activeClass?.students]);

  // Attempts to display in the Correction Panel: ONLY for the exercise chosen by the teacher!
  const chosenCorrectionRows = useMemo(() => {
    if (!activeClass || !selectedExercise) return [];
    const targetStudents = selectedStudent
      ? [selectedStudent]
      : activeClass.students;

    const rows: { studentId: string; studentName: string; studentEmail: string; attempt: StudentAttemptRecord }[] = [];
    targetStudents.forEach((stu) => {
      stu.recentAttempts
        .filter((a) => a.exerciseTitle === selectedExercise)
        .forEach((attempt) => {
          rows.push({
            studentId: stu.id,
            studentName: stu.name,
            studentEmail: stu.email,
            attempt,
          });
        });
    });
    return rows;
  }, [activeClass, selectedExercise, selectedStudent]);

  const handleRemediation = (skill: string) => {
    if (!activeClass) return;
    setRemediatedSkills((prev) => [...prev, `${activeClass.id}-${skill}`]);
  };

  const openEditorForAttempt = (att: StudentAttemptRecord) => {
    if (openAttemptId === att.id) {
      setOpenAttemptId(null);
      return;
    }
    setOpenAttemptId(att.id);
    setDraftScore(String(att.score));
    setDraftComment(att.feedbackSummary || "");
    setGradeNotice(null);
  };

  const handleSaveGrade = async (studentId: string, att: StudentAttemptRecord) => {
    const parsed = parseFloat(draftScore.replace(",", "."));
    if (!Number.isFinite(parsed) || parsed < 0 || parsed > att.maxScore) {
      setGradeNotice({
        ok: false,
        text: `Entre une note valide entre 0 et ${att.maxScore}.`,
      });
      return;
    }
    setSavingGrade(true);
    setGradeNotice(null);
    const res = await updateStudentAttemptGrade({
      studentId,
      submissionId: att.id,
      evaluationResultId: att.evaluationResultId,
      newScore: parsed,
      maxScore: att.maxScore,
      teacherComment: draftComment,
    });
    setSavingGrade(false);
    if (res.ok) {
      setGradeNotice({
        ok: true,
        text: `✅ Note mise à jour (${parsed.toFixed(2)} / ${att.maxScore}) et enregistrée !`,
      });
    } else {
      setGradeNotice({
        ok: false,
        text: res.error || "Impossible d'enregistrer la note.",
      });
    }
  };

  const handleExportGradebookCsv = () => {
    if (!activeClass) return;
    const esc = (v: string | number) => {
      const s = String(v ?? "");
      if (/[;"\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
      return s;
    };

    // Build headers: Student info + every skill/exercise column + overall accuracy
    const cols = allSkills;
    const headers = [
      "Élève",
      "E-mail",
      "Classe",
      ...cols,
      "Moyenne (%)",
      "Exercices rendus",
    ];

    const dataRows = activeClass.students.map((stu) => {
      const perCol = cols.map((colName) => {
        // Prefer exact best raw score (e.g., 16,5/20) from recentAttempts if present
        const matching = stu.recentAttempts.filter((a) => a.exerciseTitle === colName);
        if (matching.length > 0) {
          const best = matching.reduce((b, cur) =>
            cur.maxScore > 0 && cur.score / cur.maxScore > (b.maxScore > 0 ? b.score / b.maxScore : -1)
              ? cur
              : b
          );
          return `${best.score.toFixed(1).replace(".", ",")}/${best.maxScore}`;
        }
        const pct = stu.skills[colName];
        if (typeof pct === "number" && pct >= 0) return `${pct}%`;
        return "";
      });

      return [
        stu.name,
        stu.email,
        activeClass.name,
        ...perCol,
        stu.recentAttempts.length > 0 ? `${stu.accuracy}%` : "",
        String(stu.recentAttempts.length),
      ];
    });

    // Class averages summary row
    const avgRow = [
      "MOYENNE DE LA CLASSE",
      "",
      activeClass.level,
      ...cols.map((colName) => {
        const vals = activeClass.students
          .map((s) => s.skills[colName])
          .filter((v): v is number => typeof v === "number" && v >= 0);
        if (vals.length === 0) return "";
        return `${Math.round(vals.reduce((a, b) => a + b, 0) / vals.length)}%`;
      }),
      activeClass.students.length > 0
        ? `${Math.round(
            activeClass.students.reduce((a, s) => a + s.accuracy, 0) / activeClass.students.length
          )}%`
        : "",
      "",
    ];

    const csvLines = [headers, ...dataRows, avgRow].map((row) => row.map(esc).join(";"));
    const csvContent = "\uFEFF" + csvLines.join("\r\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const safeClass = activeClass.name.replace(/[^a-zA-Z0-9_-]/g, "_");
    a.href = url;
    a.download = `notes_${safeClass}_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    setGradeNotice({
      ok: true,
      text: `📥 Relevé de notes exporté pour ${activeClass.name} (${activeClass.students.length} élève(s)).`,
    });
  };

  return (
    <TeacherShell>
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900">📊 Résultats, Corrections &amp; Notes</h1>
          <p className="text-slate-500 mt-1 text-sm">
            Choisis un exercice pour inspecter uniquement ses copies et modifier les notes de tes élèves librement.
          </p>
        </div>
        {activeClass && activeClass.students.length > 0 && (
          <button
            type="button"
            onClick={handleExportGradebookCsv}
            className="bg-emerald-600 text-white font-bold px-4 py-2.5 rounded-xl hover:bg-emerald-700 text-xs shadow-sm whitespace-nowrap self-start sm:self-auto"
          >
            📥 Exporter Excel / CSV
          </button>
        )}
      </div>

      {/* Class tabs */}
      <div className="flex items-center gap-2 flex-wrap mb-5">
        {classes.map((cls) => (
          <button
            key={cls.id}
            onClick={() => setSelectedClassId(cls.id)}
            className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
              activeClass?.id === cls.id
                ? "bg-indigo-600 text-white shadow-md shadow-indigo-100"
                : "bg-white text-slate-600 border border-slate-200 hover:border-indigo-300"
            }`}
          >
            {cls.name} ({cls.students.length} él.)
          </button>
        ))}
      </div>

      {!activeClass || activeClass.students.length === 0 ? (
        <div className="bg-white rounded-3xl border border-slate-100 p-10 text-center text-sm text-slate-500">
          Aucun élève dans cette classe pour afficher les résultats.
        </div>
      ) : (
        <>
          {/* Compact Controls Bar (prevents huge horizontal tables when there are 20+ exercises) */}
          <div className="bg-white rounded-2xl border border-slate-100 p-4 mb-5 shadow-xs flex flex-col md:flex-row items-stretch md:items-center gap-3">
            <div className="flex-1 flex flex-col sm:flex-row gap-2.5">
              <select
                value={selectedExercise}
                onChange={(e) => {
                  setSelectedExercise(e.target.value);
                  setOpenAttemptId(null);
                  setGradeNotice(null);
                }}
                className="flex-1 border border-slate-200 rounded-xl px-3.5 py-2 text-xs font-bold text-slate-800 bg-white outline-none focus:border-indigo-400"
              >
                <option value="">
                  📋 Tous les exercices ({allSkills.length} — vue compacte {COLS_PER_PAGE}/page)
                </option>
                {allSkills.map((sk) => (
                  <option key={sk} value={sk}>
                    🎯 Uniquement : {sk}
                  </option>
                ))}
              </select>

              <input
                type="text"
                value={studentSearch}
                onChange={(e) => setStudentSearch(e.target.value)}
                placeholder="Rechercher un élève…"
                className="sm:w-56 border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-slate-900 bg-white placeholder:text-slate-400 outline-none focus:border-indigo-400"
              />
            </div>

            {!selectedExercise && totalPages > 1 && (
              <div className="flex items-center gap-2 shrink-0 self-end md:self-auto">
                <button
                  type="button"
                  disabled={colPage === 0}
                  onClick={() => setColPage((p) => Math.max(0, p - 1))}
                  className="px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-40"
                >
                  ←
                </button>
                <span className="text-xs font-semibold text-slate-500 whitespace-nowrap">
                  Page {colPage + 1} / {totalPages}
                </span>
                <button
                  type="button"
                  disabled={colPage >= totalPages - 1}
                  onClick={() => setColPage((p) => Math.min(totalPages - 1, p + 1))}
                  className="px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-40"
                >
                  →
                </button>
              </div>
            )}
          </div>

          {/* Compact Heatmap Table */}
          <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden mb-7">
            <div className="px-6 py-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h2 className="font-bold text-slate-900">
                  Matrice Élèves × Exercices — {activeClass.name}
                </h2>
                <p className="text-xs text-slate-400">
                  Clique sur un exercice (colonne ou note) pour afficher uniquement sa correction et modifier la note
                </p>
              </div>
              <div className="flex items-center gap-3 text-xs text-slate-500">
                <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-emerald-200 inline-block" />≥ 80%</span>
                <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-amber-200 inline-block" />45–79%</span>
                <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-rose-200 inline-block" />{"<"} 45%</span>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50/80 border-b border-slate-100">
                    <th className="py-3.5 px-5 text-xs font-bold text-slate-500 uppercase tracking-wider sticky left-0 bg-slate-50">
                      Élève
                    </th>
                    {visibleSkills.map((skill) => (
                      <th key={skill} className="py-3.5 px-3 text-xs font-bold text-slate-600 text-center min-w-[140px]">
                        <button
                          type="button"
                          onClick={() =>
                            setSelectedExercise((prev) => (prev === skill ? "" : skill))
                          }
                          title="Cliquer pour ouvrir les copies de cet exercice"
                          className={`hover:text-indigo-600 transition-colors leading-snug ${
                            selectedExercise === skill ? "text-indigo-700 underline" : ""
                          }`}
                        >
                          {skill}
                        </button>
                      </th>
                    ))}
                    <th className="py-3.5 px-4 text-xs font-bold text-slate-500 text-center">Moyenne</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {filteredStudents.map((stu) => (
                    <tr
                      key={stu.id}
                      className={`hover:bg-indigo-50/30 transition-colors ${
                        selectedStudentId === stu.id ? "bg-indigo-50/40" : ""
                      }`}
                    >
                      <td
                        onClick={() =>
                          setSelectedStudentId((prev) => (prev === stu.id ? null : stu.id))
                        }
                        className="py-3.5 px-5 font-semibold text-sm text-slate-900 whitespace-nowrap sticky left-0 bg-white cursor-pointer"
                      >
                        <div className="flex items-center gap-2.5">
                          <div className="w-7 h-7 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-xs font-bold">
                            {stu.name[0]}
                          </div>
                          <div>
                            <div>{stu.name}</div>
                            <div className="text-[10px] font-normal text-slate-400">
                              {stu.exercisesDone} soumission(s)
                            </div>
                          </div>
                        </div>
                      </td>
                      {visibleSkills.map((skill) => {
                        const val = stu.skills[skill];
                        return (
                          <td key={skill} className="py-2.5 px-2 text-center">
                            {val === undefined ? (
                              <span className="inline-block w-14 py-1.5 rounded-xl text-xs border bg-slate-50 text-slate-400 border-slate-200">
                                —
                              </span>
                            ) : (
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedStudentId(stu.id);
                                  setSelectedExercise(skill);
                                  setOpenAttemptId(null);
                                  setGradeNotice(null);
                                }}
                                title="Voir la copie de cet exercice et modifier la note"
                                className={`inline-block w-16 py-1.5 rounded-xl text-xs border transition-transform hover:scale-105 cursor-pointer ${cellStyle(val)}`}
                              >
                                {val}%
                              </button>
                            )}
                          </td>
                        );
                      })}
                      <td className="py-3.5 px-4 text-center font-extrabold text-sm text-slate-800">
                        {stu.exercisesDone > 0 ? `${stu.accuracy}%` : "—"}
                      </td>
                    </tr>
                  ))}

                  {/* 1-click remediation row */}
                  <tr className="bg-slate-50/90 border-t-2 border-slate-200">
                    <td className="py-4 px-5 text-xs font-extrabold text-slate-700 uppercase sticky left-0 bg-slate-50">
                      Action remédiation
                    </td>
                    {visibleSkills.map((skill) => {
                      const evaluatedStudents = activeClass.students.filter(
                        (s) => s.skills[skill] !== undefined
                      );
                      const strugglingStudents = evaluatedStudents.filter(
                        (s) => (s.skills[skill] ?? 100) < 55
                      );
                      const sent = remediatedSkills.includes(`${activeClass.id}-${skill}`);
                      return (
                        <td key={skill} className="py-3 px-2 text-center">
                          {evaluatedStudents.length === 0 ? (
                            <span className="text-[11px] text-slate-400">Non évalué</span>
                          ) : strugglingStudents.length > 0 ? (
                            <button
                              onClick={() => handleRemediation(skill)}
                              disabled={sent}
                              className={`text-[11px] font-bold px-2.5 py-1.5 rounded-xl transition-all whitespace-nowrap ${
                                sent
                                  ? "bg-emerald-100 text-emerald-700"
                                  : "bg-rose-600 text-white hover:bg-rose-700 shadow-xs"
                              }`}
                            >
                              {sent
                                ? "✓ Envoyé"
                                : `🎯 Cibler (${strugglingStudents.length})`}
                            </button>
                          ) : (
                            <span className="text-[11px] text-emerald-600 font-semibold">✓ Classe OK</span>
                          )}
                        </td>
                      );
                    })}
                    <td />
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Focused Correction & Manual Grade Editor Panel (shows ONLY the exercise you choose!) */}
          <div className="bg-white rounded-3xl border border-indigo-200 p-6 shadow-sm space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-lg font-extrabold text-slate-900">
                  📝 Correction &amp; Modification de note
                </h3>
                <p className="text-xs text-slate-500">
                  Sélectionne un exercice précis ci-dessous (ou clique sur une note dans le tableau) pour voir uniquement ses copies et changer les notes.
                </p>
              </div>
              {selectedStudent && (
                <div className="flex items-center gap-2 bg-indigo-50 text-indigo-800 px-3 py-1.5 rounded-xl text-xs font-bold self-start sm:self-auto">
                  <span>Élève : {selectedStudent.name}</span>
                  <button
                    type="button"
                    onClick={() => setSelectedStudentId(null)}
                    className="text-indigo-500 hover:text-indigo-900"
                  >
                    × Tous
                  </button>
                </div>
              )}
            </div>

            {/* Exercise picker pills (compact) */}
            {attemptedExercises.length === 0 ? (
              <div className="bg-slate-50 rounded-2xl p-6 text-center text-xs text-slate-500">
                Aucune copie soumise pour le moment dans cette classe.
              </div>
            ) : (
              <>
                <div className="flex flex-col sm:flex-row gap-2.5 items-stretch sm:items-center">
                  <select
                    value={selectedExercise}
                    onChange={(e) => {
                      setSelectedExercise(e.target.value);
                      setOpenAttemptId(null);
                      setGradeNotice(null);
                    }}
                    className="flex-1 border border-indigo-200 rounded-xl px-4 py-2.5 text-sm font-bold text-slate-900 bg-indigo-50/40 outline-none focus:border-indigo-500"
                  >
                    <option value="">— Choisis l&apos;exercice dont tu veux voir la correction —</option>
                    {attemptedExercises.map((title) => (
                      <option key={title} value={title}>
                        {title}
                      </option>
                    ))}
                  </select>
                  {selectedExercise && (
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedExercise("");
                        setOpenAttemptId(null);
                      }}
                      className="text-xs font-semibold text-slate-500 hover:text-slate-800 px-3 py-2 rounded-xl border border-slate-200"
                    >
                      Réinitialiser
                    </button>
                  )}
                </div>

                {gradeNotice && (
                  <div
                    className={`rounded-2xl px-4 py-3 text-xs font-semibold border ${
                      gradeNotice.ok
                        ? "bg-emerald-50 border-emerald-200 text-emerald-800"
                        : "bg-rose-50 border-rose-200 text-rose-700"
                    }`}
                  >
                    {gradeNotice.text}
                  </div>
                )}

                {!selectedExercise ? (
                  <div className="bg-slate-50 rounded-2xl p-6 text-center text-xs text-slate-500">
                    👆 Sélectionne un exercice dans le menu ci-dessus (ou clique sur une note dans la heatmap) pour afficher uniquement sa correction sans encombrer la page.
                  </div>
                ) : chosenCorrectionRows.length === 0 ? (
                  <div className="bg-slate-50 rounded-2xl p-6 text-center text-xs text-slate-500">
                    Aucune tentative trouvée pour « {selectedExercise} » avec ce filtre élève.
                  </div>
                ) : (
                  <div className="space-y-3 max-h-[520px] overflow-y-auto pr-1">
                    {chosenCorrectionRows.map(({ studentId, studentName, attempt }) => {
                      const isOpen = openAttemptId === attempt.id;
                      return (
                        <div
                          key={attempt.id}
                          className={`rounded-2xl border transition-all ${
                            isOpen
                              ? "border-indigo-300 bg-indigo-50/30"
                              : "border-slate-200 bg-slate-50/60"
                          }`}
                        >
                          {/* Compact summary row */}
                          <div className="p-4 flex flex-wrap items-center justify-between gap-3">
                            <div>
                              <div className="font-bold text-sm text-slate-900">
                                {studentName} · <span className="text-indigo-700">{attempt.exerciseTitle}</span>
                              </div>
                              <div className="text-[11px] text-slate-400">
                                Soumis le {attempt.submittedAt}
                                {attempt.feedbackSummary && (
                                  <span className="ml-2 text-slate-600">· {attempt.feedbackSummary}</span>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-2.5">
                              <span
                                className={`text-xs font-extrabold px-3 py-1 rounded-xl border ${cellStyle(attempt.pct)}`}
                              >
                                {attempt.score.toFixed(2)} / {attempt.maxScore} ({attempt.pct}%)
                              </span>
                              <button
                                type="button"
                                onClick={() => openEditorForAttempt(attempt)}
                                className="text-xs font-bold bg-indigo-600 text-white px-3.5 py-1.5 rounded-xl hover:bg-indigo-700 transition-colors"
                              >
                                {isOpen ? "Fermer" : "✏️ Voir copie & noter"}
                              </button>
                            </div>
                          </div>

                          {/* Expanded student answers + Manual Grade Override */}
                          {isOpen && (
                            <div className="px-4 pb-4 pt-3 border-t border-indigo-100 space-y-4 bg-white rounded-b-2xl">
                              <div>
                                <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2">
                                  Réponses envoyées par {studentName}
                                </div>
                                {Object.keys(attempt.answers).length === 0 ? (
                                  <p className="text-xs text-slate-400 italic">
                                    Aucune réponse saisie dans cette tentative.
                                  </p>
                                ) : (
                                  <div className="space-y-1.5">
                                    {Object.entries(attempt.answers).map(([qKey, ans]) => (
                                      <div
                                        key={qKey}
                                        className="bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-slate-800 flex gap-2"
                                      >
                                        <span className="font-mono font-bold text-indigo-600 uppercase shrink-0">
                                          {qKey} :
                                        </span>
                                        <span className="font-mono break-words">
                                          {ans || "(vide)"}
                                        </span>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>

                              {/* Manual Grade Override Form */}
                              <div className="bg-amber-50/70 border border-amber-200 rounded-2xl p-4 space-y-3">
                                <div className="text-xs font-extrabold text-amber-900">
                                  ✏️ Modifier la note manuellement (Professeur)
                                </div>
                                <div className="flex flex-wrap items-center gap-3">
                                  <div className="flex items-center gap-1.5">
                                    <input
                                      type="number"
                                      step="0.25"
                                      min={0}
                                      max={attempt.maxScore}
                                      value={draftScore}
                                      onChange={(e) => setDraftScore(e.target.value)}
                                      className="w-24 border border-amber-300 rounded-xl px-3 py-2 text-sm font-extrabold text-slate-900 bg-white outline-none focus:border-indigo-500 text-center"
                                    />
                                    <span className="text-sm font-bold text-slate-600">
                                      / {attempt.maxScore}
                                    </span>
                                  </div>
                                  <div className="flex gap-1.5">
                                    {[
                                      { label: "0%", val: 0 },
                                      { label: "50%", val: Number((attempt.maxScore * 0.5).toFixed(2)) },
                                      { label: "75%", val: Number((attempt.maxScore * 0.75).toFixed(2)) },
                                      { label: "100%", val: attempt.maxScore },
                                    ].map((preset) => (
                                      <button
                                        key={preset.label}
                                        type="button"
                                        onClick={() => setDraftScore(String(preset.val))}
                                        className="text-[11px] font-bold bg-white border border-amber-200 text-amber-900 hover:bg-amber-100 px-2.5 py-1.5 rounded-lg"
                                      >
                                        {preset.label}
                                      </button>
                                    ))}
                                  </div>
                                </div>

                                <div>
                                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                                    Commentaire du professeur (visible dans le suivi)
                                  </label>
                                  <input
                                    type="text"
                                    value={draftComment}
                                    onChange={(e) => setDraftComment(e.target.value)}
                                    placeholder="ex : Bonne démarche sur Q1 et Q2, points accordés manuellement."
                                    className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 bg-white outline-none focus:border-indigo-400"
                                  />
                                </div>

                                <div className="flex justify-end">
                                  <button
                                    type="button"
                                    disabled={savingGrade}
                                    onClick={() => handleSaveGrade(studentId, attempt)}
                                    className="bg-emerald-600 text-white text-xs font-bold px-5 py-2.5 rounded-xl hover:bg-emerald-700 disabled:opacity-60 shadow-sm"
                                  >
                                    {savingGrade ? "⏳ Enregistrement…" : "💾 Enregistrer la nouvelle note"}
                                  </button>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </>
            )}
          </div>
        </>
      )}
    </TeacherShell>
  );
}
