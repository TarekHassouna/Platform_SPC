"use client";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { ParentShell } from "@/components/ParentShell";

const weeklyActivity = [
  { day: "Lun", sessions: 2, correct: 8 },
  { day: "Mar", sessions: 0, correct: 0 },
  { day: "Mer", sessions: 3, correct: 15 },
  { day: "Jeu", sessions: 1, correct: 4 },
  { day: "Ven", sessions: 2, correct: 10 },
  { day: "Sam", sessions: 0, correct: 0 },
  { day: "Dim", sessions: 1, correct: 7 },
];

const skillSummary = [
  { name: "Loi d'Ohm", score: 92, status: "acquired" },
  { name: "Résistances en parallèle", score: 61, status: "developing" },
  { name: "Conversion d'unités", score: 34, status: "weak" },
  { name: "Lois de Newton", score: 88, status: "acquired" },
];

const recentSessions = [
  { date: "Aujourd'hui 20h", duration: "25 min", exercises: 8, score: "72%", topic: "Électricité" },
  { date: "Hier 19h30", duration: "15 min", exercises: 5, score: "60%", topic: "Métrologie" },
  { date: "Il y a 2 jours", duration: "30 min", exercises: 12, score: "83%", topic: "Mécanique" },
];

export default function ParentDashboard() {
  const { user } = useAuth();
  const childName = user?.childName || "Amira";
  const childLevel = user?.childLevel || "Terminale";
  const childInitials = childName[0]?.toUpperCase() ?? "A";
  const maxSessions = Math.max(...weeklyActivity.map((d) => d.sessions), 1);

  return (
    <ParentShell>
      <div className="mb-8">
        <h1 className="text-2xl font-extrabold text-slate-900">Bonjour {user?.firstName || "Parent"} 👋</h1>
        <p className="text-slate-500 mt-1">
          Voici le suivi de <strong className="text-slate-700">{childName}</strong> cette semaine.
        </p>
      </div>

      {/* Child card */}
      <div className="bg-gradient-to-br from-indigo-600 to-violet-700 text-white rounded-3xl p-6 mb-8 flex items-center gap-5 shadow-xl shadow-indigo-100">
        <div className="w-16 h-16 rounded-2xl bg-white/20 flex items-center justify-center text-3xl font-extrabold shrink-0">
          {childInitials}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-xl font-extrabold">{childName}</div>
          <div className="text-indigo-200 text-sm">{childLevel} · Physique-Chimie Spécialité</div>
          <div className="mt-2 flex items-center gap-2.5 flex-wrap">
            <span className="bg-white/20 text-white text-xs font-semibold px-3 py-1 rounded-full">🔥 5 jours de suite</span>
            <span className="bg-white/20 text-white text-xs font-semibold px-3 py-1 rounded-full">📚 24 exercices cette semaine</span>
            <span className="bg-white/20 text-white text-xs font-semibold px-3 py-1 rounded-full">🎯 72% de précision</span>
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6 mb-8">
        <div className="lg:col-span-2 bg-white border border-slate-100 rounded-2xl p-6 shadow-sm">
          <h2 className="font-bold text-slate-900 mb-5">Activité de la semaine</h2>
          <div className="flex items-end gap-3 h-32">
            {weeklyActivity.map((d) => (
              <div key={d.day} className="flex-1 flex flex-col items-center gap-1 h-full justify-end">
                <div className="text-xs font-bold text-slate-600">{d.sessions > 0 ? `${d.sessions}` : ""}</div>
                <div
                  className="w-full rounded-t-lg transition-all"
                  style={{
                    height: `${(d.sessions / maxSessions) * 85}%`,
                    minHeight: d.sessions > 0 ? "10px" : "4px",
                    background: d.sessions > 0 ? "linear-gradient(to top, #6366f1, #8b5cf6)" : "#f1f5f9",
                  }}
                />
                <div className="text-xs text-slate-400">{d.day}</div>
              </div>
            ))}
          </div>
          <div className="mt-4 flex flex-wrap gap-6 text-sm text-slate-500">
            <span>📅 <strong className="text-slate-700">5</strong> jours actifs</span>
            <span>📝 <strong className="text-slate-700">44</strong> exercices au total</span>
            <span>⏱ <strong className="text-slate-700">~1h45</strong> de travail</span>
          </div>
        </div>

        <div className="bg-white border border-slate-100 rounded-2xl p-6 shadow-sm">
          <h2 className="font-bold text-slate-900 mb-4">Compétences clés</h2>
          <div className="space-y-3">
            {skillSummary.map((s) => (
              <div key={s.name}>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-slate-700 font-medium truncate pr-2">{s.name}</span>
                  <span className={`font-bold ${s.status === "acquired" ? "text-emerald-600" : s.status === "developing" ? "text-amber-600" : "text-rose-600"}`}>
                    {s.score}%
                  </span>
                </div>
                <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full ${s.status === "acquired" ? "bg-emerald-500" : s.status === "developing" ? "bg-amber-400" : "bg-rose-400"}`}
                    style={{ width: `${s.score}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
          <div className="mt-4 p-3 bg-rose-50 rounded-xl border border-rose-100 text-xs text-rose-700">
            ⚠️ <strong>Lacune détectée :</strong> conversion d&apos;unités (34%). C&apos;est un point fréquent au bac.
          </div>
        </div>
      </div>

      {/* Recent sessions */}
      <div className="bg-white border border-slate-100 rounded-2xl shadow-sm overflow-hidden mb-8">
        <div className="px-6 py-4 border-b border-slate-100">
          <h2 className="font-bold text-slate-900">Sessions récentes</h2>
        </div>
        <div className="divide-y divide-slate-50">
          {recentSessions.map((s, i) => (
            <div key={i} className="px-6 py-4 flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center text-xl shrink-0">
                {s.topic === "Électricité" ? "⚡" : s.topic === "Métrologie" ? "📏" : "🔧"}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold text-slate-900">{s.topic}</div>
                <div className="text-xs text-slate-400">{s.date} · {s.duration}</div>
              </div>
              <div className="text-center hidden sm:block">
                <div className="text-sm font-bold text-slate-700">{s.exercises} exercices</div>
                <div className="text-xs text-slate-400">résolus</div>
              </div>
              <div
                className={`text-sm font-bold px-3 py-1 rounded-xl ${
                  parseInt(s.score) >= 80
                    ? "bg-emerald-50 text-emerald-700"
                    : parseInt(s.score) >= 60
                    ? "bg-amber-50 text-amber-700"
                    : "bg-rose-50 text-rose-700"
                }`}
              >
                {s.score}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Subscription quick card */}
      <div className="bg-white border border-slate-100 rounded-2xl p-6 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="font-bold text-slate-900 mb-1">💳 Abonnement Individuel</div>
          <div className="text-sm text-slate-500">
            Renouvellement le <strong className="text-slate-700">18 décembre 2026</strong> · €7/mois
          </div>
        </div>
        <Link
          href="/parent/subscription"
          className="text-center text-sm font-semibold bg-indigo-50 text-indigo-700 px-4 py-2.5 rounded-xl hover:bg-indigo-100 transition-colors"
        >
          Gérer l&apos;abonnement →
        </Link>
      </div>
    </ParentShell>
  );
}
