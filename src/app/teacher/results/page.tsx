"use client";
import { useState } from "react";
import { useTeacherStore } from "@/lib/teacher-store";
import { TeacherShell } from "@/components/TeacherShell";

function cellStyle(score: number) {
  if (score >= 80) return "bg-emerald-100 text-emerald-800 border-emerald-200";
  if (score >= 60) return "bg-lime-100 text-lime-800 border-lime-200";
  if (score >= 45) return "bg-amber-100 text-amber-800 border-amber-200";
  return "bg-rose-100 text-rose-800 border-rose-200 font-bold";
}

export default function TeacherResultsPage() {
  const { classes, selectedClassId, setSelectedClassId } = useTeacherStore();
  const [remediatedSkills, setRemediatedSkills] = useState<string[]>([]);
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);

  // Pick a concrete class for the heatmap matrix (default to first class if "all")
  const activeClass =
    classes.find((c) => c.id === selectedClassId) || classes[0];

  const handleRemediation = (skill: string, count: number) => {
    setRemediatedSkills((prev) => [...prev, `${activeClass.id}-${skill}`]);
    setTimeout(() => {
      // keep badge visible
    }, 3000);
    void count;
  };

  const selectedStudent = activeClass?.students.find((s) => s.id === selectedStudentId);

  return (
    <TeacherShell>
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900">📊 Résultats &amp; Heatmap par compétence</h1>
          <p className="text-slate-500 mt-1 text-sm">
            Visualisez en un coup d&apos;œil où chaque élève bloque et envoyez une remédiation ciblée en 1 clic.
          </p>
        </div>
      </div>

      {/* Class tabs */}
      <div className="flex items-center gap-2 flex-wrap mb-6">
        {classes.map((cls) => (
          <button
            key={cls.id}
            onClick={() => {
              setSelectedClassId(cls.id);
              setSelectedStudentId(null);
            }}
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
          Aucun élève dans cette classe pour afficher la heatmap.
        </div>
      ) : (
        <>
          {/* Heatmap Table */}
          <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden mb-8">
            <div className="px-6 py-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h2 className="font-bold text-slate-900">
                  Matrice Élèves × Compétences — {activeClass.name}
                </h2>
                <p className="text-xs text-slate-400">Cliquez sur un élève pour voir le détail de ses lacunes</p>
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
                    {activeClass.skills.map((skill) => (
                      <th key={skill} className="py-3.5 px-3 text-xs font-bold text-slate-600 text-center min-w-[110px]">
                        {skill}
                      </th>
                    ))}
                    <th className="py-3.5 px-4 text-xs font-bold text-slate-500 text-center">Moyenne</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {activeClass.students.map((stu) => (
                    <tr
                      key={stu.id}
                      onClick={() => setSelectedStudentId(stu.id === selectedStudentId ? null : stu.id)}
                      className={`hover:bg-indigo-50/30 transition-colors cursor-pointer ${
                        selectedStudentId === stu.id ? "bg-indigo-50/50" : ""
                      }`}
                    >
                      <td className="py-3.5 px-5 font-semibold text-sm text-slate-900 whitespace-nowrap sticky left-0 bg-white">
                        <div className="flex items-center gap-2.5">
                          <div className="w-7 h-7 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-xs font-bold">
                            {stu.name[0]}
                          </div>
                          <span>{stu.name}</span>
                        </div>
                      </td>
                      {activeClass.skills.map((skill) => {
                        const val = stu.skills[skill];
                        return (
                          <td key={skill} className="py-2.5 px-2 text-center">
                            {val === undefined ? (
                              <span className="inline-block w-14 py-1.5 rounded-xl text-xs border bg-slate-50 text-slate-400 border-slate-200">
                                —
                              </span>
                            ) : (
                              <span
                                className={`inline-block w-14 py-1.5 rounded-xl text-xs border ${cellStyle(val)}`}
                              >
                                {val}%
                              </span>
                            )}
                          </td>
                        );
                      })}
                      <td className="py-3.5 px-4 text-center font-extrabold text-sm text-slate-800">
                        {stu.exercisesDone > 0 ? `${stu.accuracy}%` : "—"}
                      </td>
                    </tr>
                  ))}

                  {/* Class average + 1-click remediation row */}
                  <tr className="bg-slate-50/90 border-t-2 border-slate-200">
                    <td className="py-4 px-5 text-xs font-extrabold text-slate-700 uppercase sticky left-0 bg-slate-50">
                      Action remédiation
                    </td>
                    {activeClass.skills.map((skill) => {
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
                              onClick={() => handleRemediation(skill, strugglingStudents.length)}
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

          {/* Selected student detail card */}
          {selectedStudent && (
            <div className="bg-white rounded-3xl border border-indigo-200 p-6 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-lg font-extrabold text-slate-900">
                    Fiche rapide — {selectedStudent.name}
                  </h3>
                  <p className="text-xs text-slate-500">
                    {selectedStudent.email} · {selectedStudent.exercisesDone} exercices résolus · Dernière activité : {selectedStudent.lastActive}
                  </p>
                </div>
                <button
                  onClick={() => setSelectedStudentId(null)}
                  className="text-xs font-semibold text-slate-400 hover:text-slate-700"
                >
                  Fermer ×
                </button>
              </div>
              <div className="grid sm:grid-cols-3 gap-3">
                {Object.entries(selectedStudent.skills).map(([sk, val]) => (
                  <div key={sk} className="bg-slate-50 rounded-2xl p-3.5 border border-slate-100">
                    <div className="flex justify-between text-xs font-semibold mb-1.5">
                      <span className="text-slate-700">{sk}</span>
                      <span className={val < 50 ? "text-rose-600" : val < 75 ? "text-amber-600" : "text-emerald-600"}>
                        {val}%
                      </span>
                    </div>
                    <div className="h-1.5 bg-slate-200 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${
                          val < 50 ? "bg-rose-500" : val < 75 ? "bg-amber-400" : "bg-emerald-500"
                        }`}
                        style={{ width: `${val}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </TeacherShell>
  );
}
