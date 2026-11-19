"use client";
import { useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { useTeacherStore } from "@/lib/teacher-store";
import { TeacherShell } from "@/components/TeacherShell";

function heatColor(pct: number) {
  if (pct >= 75) return "bg-emerald-500";
  if (pct >= 50) return "bg-amber-400";
  return "bg-rose-400";
}

export default function TeacherDashboard() {
  const { user } = useAuth();
  const { classes, selectedClassId, setSelectedClassId, resolveAlert, copies, assignments } =
    useTeacherStore();
  const [toast, setToast] = useState<string | null>(null);

  const visibleClasses =
    selectedClassId === "all" ? classes : classes.filter((c) => c.id === selectedClassId);
  const activeClass = classes.find((c) => c.id === selectedClassId);

  const allStudents = visibleClasses.flatMap((c) =>
    c.students.map((s) => ({ ...s, className: c.name, classLevel: c.level, classId: c.id }))
  );

  const allAlerts = visibleClasses.flatMap((c) =>
    c.alerts
      .filter((a) => !a.resolved)
      .map((a) => ({ ...a, className: c.name, classId: c.id }))
  );

  // Aggregate skill mastery across visible classes
  const skillAccumulator: Record<string, { sum: number; count: number }> = {};
  visibleClasses.forEach((cls) => {
    cls.students.forEach((stu) => {
      Object.entries(stu.skills).forEach(([skill, score]) => {
        if (!skillAccumulator[skill]) skillAccumulator[skill] = { sum: 0, count: 0 };
        skillAccumulator[skill].sum += score;
        skillAccumulator[skill].count += 1;
      });
    });
  });

  const skillSummary = Object.entries(skillAccumulator)
    .map(([skill, { sum, count }]) => ({ skill, pct: Math.round(sum / count) }))
    .sort((a, b) => a.pct - b.pct)
    .slice(0, 6);

  const pendingCopies = copies.filter(
    (c) => c.status === "to_review" && (selectedClassId === "all" || c.classId === selectedClassId)
  ).length;

  const activeAssignments = assignments.filter(
    (a) => selectedClassId === "all" || a.classId === selectedClassId
  ).length;

  const strugglingCount = allStudents.filter((s) => s.status === "struggling").length;
  const avgAccuracy = allStudents.length
    ? Math.round(allStudents.reduce((acc, s) => acc + s.accuracy, 0) / allStudents.length)
    : 0;

  const handleAlertAction = (classId: string, alertId: string, actionText: string) => {
    resolveAlert(classId, alertId);
    setToast(`✅ Action effectuée : ${actionText}`);
    setTimeout(() => setToast(null), 3500);
  };

  return (
    <TeacherShell>
      {/* Toast notification */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 text-white text-sm font-medium px-5 py-3 rounded-2xl shadow-xl">
          {toast}
        </div>
      )}

      {/* Header */}
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900">
            Bonjour {user?.firstName || "Enseignant"} 👋
          </h1>
          <p className="text-slate-500 mt-1 text-sm">
            {activeClass
              ? `${activeClass.name} · ${activeClass.level} · ${activeClass.students.length} élèves · Code : ${activeClass.inviteCode}`
              : `Vue globale sur ${classes.length} classes · ${allStudents.length} élèves · ${user?.school || "Établissement"}`}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/teacher/classes"
            className="inline-flex items-center gap-2 bg-white border border-slate-200 text-slate-700 font-semibold px-4 py-2.5 rounded-xl hover:border-indigo-300 hover:text-indigo-600 transition-colors text-sm"
          >
            🏫 Gérer mes classes
          </Link>
          <Link
            href="/teacher/create"
            className="inline-flex items-center gap-2 bg-indigo-600 text-white font-semibold px-5 py-2.5 rounded-xl hover:bg-indigo-700 transition-colors text-sm shadow-lg shadow-indigo-100"
          >
            ✨ Créer un exercice IA
          </Link>
        </div>
      </div>

      {/* Multi-class quick switcher pills */}
      <div className="flex items-center gap-2 flex-wrap mb-7">
        <button
          onClick={() => setSelectedClassId("all")}
          className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
            selectedClassId === "all"
              ? "bg-indigo-600 text-white shadow-md shadow-indigo-100"
              : "bg-white text-slate-600 border border-slate-200 hover:border-indigo-300"
          }`}
        >
          🌐 Toutes ({classes.length})
        </button>
        {classes.map((cls) => (
          <button
            key={cls.id}
            onClick={() => setSelectedClassId(cls.id)}
            className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all flex items-center gap-2 ${
              selectedClassId === cls.id
                ? "bg-indigo-600 text-white shadow-md shadow-indigo-100"
                : "bg-white text-slate-600 border border-slate-200 hover:border-indigo-300"
            }`}
          >
            <span>{cls.name}</span>
            <span
              className={`text-xs px-1.5 py-0.5 rounded-md ${
                selectedClassId === cls.id ? "bg-white/20 text-white" : "bg-slate-100 text-slate-500"
              }`}
            >
              {cls.students.length}
            </span>
          </button>
        ))}
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {[
          { label: "Élèves suivis", value: String(allStudents.length), sub: `dans ${visibleClasses.length} classe(s)`, icon: "👥", color: "text-indigo-600", bg: "bg-indigo-50" },
          { label: "Précision moyenne", value: `${avgAccuracy}%`, sub: "sur les exercices", icon: "🎯", color: "text-emerald-600", bg: "bg-emerald-50" },
          { label: "Copies à valider", value: String(pendingCopies), sub: `${activeAssignments} devoir(s) actif(s)`, icon: "🖼️", color: "text-orange-600", bg: "bg-orange-50" },
          { label: "Élèves en difficulté", value: String(strugglingCount), sub: "remédiation conseillée", icon: "⚠️", color: "text-rose-600", bg: "bg-rose-50" },
        ].map((s) => (
          <div key={s.label} className={`${s.bg} rounded-2xl p-5 border border-white shadow-xs`}>
            <div className="text-2xl mb-2">{s.icon}</div>
            <div className={`text-2xl font-extrabold ${s.color}`}>{s.value}</div>
            <div className="text-xs font-semibold text-slate-700 mt-1">{s.label}</div>
            <div className="text-[11px] text-slate-500">{s.sub}</div>
          </div>
        ))}
      </div>

      {/* Multi-class cards when viewing ALL classes */}
      {selectedClassId === "all" && (
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-slate-900">🏫 Aperçu par classe</h2>
            <Link href="/teacher/classes" className="text-sm text-indigo-600 font-semibold hover:underline">
              Gérer & inviter →
            </Link>
          </div>
          <div className="grid md:grid-cols-3 gap-4">
            {classes.map((cls) => {
              const clsAvg = cls.students.length
                ? Math.round(cls.students.reduce((a, s) => a + s.accuracy, 0) / cls.students.length)
                : 0;
              const clsStruggling = cls.students.filter((s) => s.status === "struggling").length;
              return (
                <div
                  key={cls.id}
                  onClick={() => setSelectedClassId(cls.id)}
                  className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm hover:shadow-md hover:border-indigo-200 transition-all cursor-pointer"
                >
                  <div className="flex items-center justify-between mb-3">
                    <span className={`text-xs font-bold text-white px-2.5 py-1 rounded-lg bg-gradient-to-r ${cls.color}`}>
                      {cls.level}
                    </span>
                    <span className="text-xs font-mono text-slate-400 bg-slate-50 px-2 py-0.5 rounded-md">
                      {cls.inviteCode}
                    </span>
                  </div>
                  <h3 className="font-bold text-slate-900 text-base mb-1">{cls.name}</h3>
                  <p className="text-xs text-slate-500 mb-4">
                    {cls.students.length} élèves · {clsStruggling} en difficulté
                  </p>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="text-slate-500">Maîtrise moyenne</span>
                    <span className="font-bold text-slate-800">{clsAvg}%</span>
                  </div>
                  <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full ${heatColor(clsAvg)}`} style={{ width: `${clsAvg}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Alerts */}
      {allAlerts.length > 0 && (
        <div className="space-y-3 mb-8">
          <h2 className="text-lg font-bold text-slate-900">🔔 Alertes pédagogiques</h2>
          {allAlerts.map((a) => {
            const clsStyle =
              a.severity === "high"
                ? "bg-rose-50 border-rose-200 text-rose-800"
                : a.severity === "medium"
                ? "bg-amber-50 border-amber-200 text-amber-800"
                : "bg-indigo-50 border-indigo-200 text-indigo-800";
            return (
              <div key={a.id} className={`${clsStyle} border rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3`}>
                <div className="flex items-center gap-2.5 flex-wrap">
                  <span className="text-xs font-bold bg-white/80 px-2 py-0.5 rounded-lg border border-current/15">
                    {a.className}
                  </span>
                  <p className="text-sm font-medium">{a.text}</p>
                </div>
                {a.action === "Valider les copies" ? (
                  <Link
                    href="/teacher/grading"
                    className="shrink-0 text-xs font-bold bg-white px-3.5 py-2 rounded-xl border border-current/20 hover:bg-slate-50 transition-colors whitespace-nowrap"
                  >
                    {a.action} →
                  </Link>
                ) : (
                  <button
                    onClick={() => handleAlertAction(a.classId, a.id, `${a.action} (${a.className})`)}
                    className="shrink-0 text-xs font-bold bg-white px-3.5 py-2 rounded-xl border border-current/20 hover:bg-slate-50 transition-colors whitespace-nowrap"
                  >
                    {a.action}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Skill heatmap + Quick actions */}
      <div className="grid lg:grid-cols-5 gap-6 mb-8">
        <div className="lg:col-span-3 bg-white border border-slate-100 rounded-2xl p-6 shadow-sm">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-base font-bold text-slate-900">
              Compétences prioritaires {activeClass ? `— ${activeClass.name}` : "— toutes classes"}
            </h2>
            <Link href="/teacher/results" className="text-xs font-semibold text-indigo-600 hover:underline">
              Heatmap complète →
            </Link>
          </div>
          {skillSummary.length === 0 ? (
            <p className="text-sm text-slate-400">Aucun élève encore dans cette classe.</p>
          ) : (
            <div className="space-y-3">
              {skillSummary.map((s) => (
                <div key={s.skill} className="flex items-center gap-4">
                  <div className="w-44 text-sm text-slate-700 truncate shrink-0">{s.skill}</div>
                  <div className="flex-1 h-4 bg-slate-100 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full transition-all ${heatColor(s.pct)}`} style={{ width: `${s.pct}%` }} />
                  </div>
                  <div className="w-10 text-sm font-bold text-slate-700 text-right">{s.pct}%</div>
                </div>
              ))}
            </div>
          )}
          <div className="flex items-center gap-4 mt-5 text-xs text-slate-400">
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-emerald-500 inline-block" />≥ 75% Acquis</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-amber-400 inline-block" />50–74% En cours</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-rose-400 inline-block" />{"<"} 50% Lacune</span>
          </div>
        </div>

        {/* Quick actions panel */}
        <div className="lg:col-span-2 bg-white border border-slate-100 rounded-2xl p-6 shadow-sm flex flex-col justify-between">
          <div>
            <h2 className="text-base font-bold text-slate-900 mb-4">Actions rapides</h2>
            <div className="space-y-2.5">
              {[
                { icon: "✨", title: "Générer un exercice avec l'IA", desc: "Décrivez le sujet, l'IA rédige & vérifie", href: "/teacher/create" },
                { icon: "🖼️", title: `Corriger ${pendingCopies} copie(s) manuscrite(s)`, desc: "Pré-notation IA prête à valider", href: "/teacher/grading" },
                { icon: "📚", title: "Assigner un devoir", desc: "À une classe entière ou un groupe", href: "/teacher/exercises" },
                { icon: "📊", title: "Voir la matrice élèves × compétences", desc: "Remédiation ciblée en 1 clic", href: "/teacher/results" },
              ].map((act) => (
                <Link
                  key={act.href}
                  href={act.href}
                  className="flex items-center gap-3 p-3 rounded-xl border border-slate-100 hover:border-indigo-200 hover:bg-indigo-50/40 transition-all"
                >
                  <span className="text-xl">{act.icon}</span>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-semibold text-slate-900 truncate">{act.title}</div>
                    <div className="text-xs text-slate-500 truncate">{act.desc}</div>
                  </div>
                  <span className="text-slate-400 text-sm">→</span>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Student table */}
      <div className="bg-white border border-slate-100 rounded-2xl shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <h2 className="font-bold text-slate-900">
            Élèves ({allStudents.length})
          </h2>
          <Link href="/teacher/results" className="text-sm text-indigo-600 font-semibold hover:underline">
            Détails par compétence →
          </Link>
        </div>
        {allStudents.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-500">
            Aucun élève dans cette classe pour le moment.{" "}
            <Link href="/teacher/classes" className="text-indigo-600 font-semibold hover:underline">
              Ajouter ou inviter des élèves →
            </Link>
          </div>
        ) : (
          <div className="divide-y divide-slate-50">
            {allStudents.map((s) => (
              <div key={s.id} className="px-6 py-4 flex items-center gap-4">
                <div className="w-9 h-9 rounded-full bg-gradient-to-br from-indigo-400 to-violet-500 flex items-center justify-center text-white text-xs font-bold shrink-0">
                  {s.name[0]}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-slate-900 truncate">{s.name}</div>
                  <div className="text-xs text-slate-400">{s.className} · {s.lastActive}</div>
                </div>
                <div className="text-center hidden sm:block">
                  <div className="text-sm font-bold text-slate-700">{s.accuracy}%</div>
                  <div className="text-xs text-slate-400">précision</div>
                </div>
                <div className="hidden md:block text-center min-w-[140px]">
                  <div className="text-[11px] text-slate-400">Point à travailler</div>
                  <div className="text-xs font-semibold text-rose-600 truncate">{s.weakSkill}</div>
                </div>
                <span
                  className={`text-xs font-semibold px-2.5 py-1 rounded-full whitespace-nowrap ${
                    s.status === "top"
                      ? "bg-emerald-100 text-emerald-700"
                      : s.status === "struggling"
                      ? "bg-rose-100 text-rose-700"
                      : "bg-slate-100 text-slate-600"
                  }`}
                >
                  {s.status === "top" ? "⭐ Excellent" : s.status === "struggling" ? "⚠️ Difficultés" : "✅ Actif"}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </TeacherShell>
  );
}
