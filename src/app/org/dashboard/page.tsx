"use client";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { useOrgStore } from "@/lib/org-store";
import { OrgShell } from "@/components/OrgShell";

const LEVEL_ANALYTICS = [
  { level: "Terminale Spé", classes: 2, activeStudents: 54, avgMastery: 74, exercisesWeek: 312, topGap: "Conversion d'unités" },
  { level: "Première Spé", classes: 2, activeStudents: 48, avgMastery: 66, exercisesWeek: 245, topGap: "Tableau d'avancement" },
  { level: "Seconde", classes: 2, activeStudents: 32, avgMastery: 71, exercisesWeek: 188, topGap: "Notation scientifique" },
];

export default function OrgDashboardPage() {
  const { user } = useAuth();
  const { orgName, seatsPurchased, seats, teachers } = useOrgStore();

  const schoolTitle = user?.school || orgName;
  const totalClasses = teachers.reduce((acc, t) => acc + t.classesCount, 0);
  const usedSeats = Math.max(seats.length, 58); // institutional realistic metric combined with seat roster
  const displayedUsed = Math.min(usedSeats, seatsPurchased);
  const freeSeats = Math.max(seatsPurchased - displayedUsed, 0);
  const seatPct = Math.round((displayedUsed / Math.max(seatsPurchased, 1)) * 100);

  return (
    <OrgShell>
      <div className="mb-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900">
            🏛️ {schoolTitle}
          </h1>
          <p className="text-slate-500 mt-1 text-sm">
            Tableau de bord direction &amp; chef de département Physique-Chimie · Bonjour {user?.firstName || "Admin"}
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          <Link
            href="/org/teachers"
            className="bg-white border border-slate-200 text-slate-700 font-semibold px-4 py-2.5 rounded-xl hover:border-indigo-300 text-sm"
          >
            + Inviter un enseignant
          </Link>
          <Link
            href="/org/seats"
            className="bg-indigo-600 text-white font-semibold px-4 py-2.5 rounded-xl hover:bg-indigo-700 shadow-lg shadow-indigo-100 text-sm"
          >
            🎟️ Gérer les sièges
          </Link>
        </div>
      </div>

      {/* Institutional KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {[
          { label: "Enseignants", value: String(teachers.length), sub: `${totalClasses} classes actives`, icon: "👨‍🏫", color: "text-indigo-600", bg: "bg-indigo-50" },
          { label: "Sièges utilisés", value: `${displayedUsed} / ${seatsPurchased}`, sub: `${freeSeats} siège(s) libre(s)`, icon: "🎟️", color: "text-violet-600", bg: "bg-violet-50" },
          { label: "Maîtrise moyenne", value: "70%", sub: "+6% ce mois-ci", icon: "📈", color: "text-emerald-600", bg: "bg-emerald-50" },
          { label: "Exercices / semaine", value: "745", sub: "tous niveaux confondus", icon: "⚡", color: "text-orange-600", bg: "bg-orange-50" },
        ].map((k) => (
          <div key={k.label} className={`${k.bg} rounded-2xl p-5 border border-white shadow-xs`}>
            <div className="text-2xl mb-2">{k.icon}</div>
            <div className={`text-2xl font-extrabold ${k.color}`}>{k.value}</div>
            <div className="text-xs font-semibold text-slate-700 mt-1">{k.label}</div>
            <div className="text-[11px] text-slate-500">{k.sub}</div>
          </div>
        ))}
      </div>

      {/* Seat utilization + Privacy compliance banner */}
      <div className="grid lg:grid-cols-3 gap-6 mb-8">
        <div className="lg:col-span-2 bg-white rounded-3xl border border-slate-100 p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold text-slate-900">Rapports par niveau scolaire</h2>
            <span className="text-xs text-slate-400">Données agrégées établissement</span>
          </div>
          <div className="space-y-4">
            {LEVEL_ANALYTICS.map((row) => (
              <div key={row.level} className="bg-slate-50 rounded-2xl p-4 border border-slate-100">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
                  <div>
                    <span className="font-bold text-slate-900 text-sm">{row.level}</span>
                    <span className="text-xs text-slate-500 ml-2">
                      {row.classes} classes · {row.activeStudents} élèves actifs · {row.exercisesWeek} ex./sem.
                    </span>
                  </div>
                  <span className="text-xs font-bold bg-rose-50 text-rose-600 px-2.5 py-0.5 rounded-full">
                    Point faible : {row.topGap}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex-1 h-2.5 bg-slate-200 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${
                        row.avgMastery >= 72 ? "bg-emerald-500" : "bg-amber-400"
                      }`}
                      style={{ width: `${row.avgMastery}%` }}
                    />
                  </div>
                  <span className="text-xs font-extrabold text-slate-700 w-10 text-right">{row.avgMastery}%</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-5">
          {/* Seat meter */}
          <div className="bg-white rounded-3xl border border-slate-100 p-6 shadow-sm">
            <h2 className="font-bold text-slate-900 text-sm mb-3">🎟️ Consommation des sièges</h2>
            <div className="flex items-end justify-between mb-2">
              <div className="text-3xl font-extrabold text-indigo-600">{seatPct}%</div>
              <div className="text-xs text-slate-500">
                {displayedUsed} utilisés · <strong>{freeSeats} libres</strong>
              </div>
            </div>
            <div className="h-3 bg-slate-100 rounded-full overflow-hidden mb-4">
              <div className="h-full bg-gradient-to-r from-indigo-500 to-violet-600 rounded-full" style={{ width: `${seatPct}%` }} />
            </div>
            <Link
              href="/org/seats"
              className="block text-center text-xs font-bold bg-indigo-50 text-indigo-700 py-2.5 rounded-xl hover:bg-indigo-100"
            >
              Acheter ou attribuer des sièges →
            </Link>
          </div>

          {/* Privacy rule callout (Vision Doc §11.3) */}
          <div className="bg-emerald-50 border border-emerald-200 rounded-3xl p-5">
            <div className="text-xs font-extrabold text-emerald-800 mb-1.5">
              🛡️ Respect de la vie privée (RGPD)
            </div>
            <p className="text-xs text-emerald-700 leading-relaxed">
              En tant qu&apos;administrateur établissement, vous consultez les statistiques agrégées par niveau et par classe. Les conversations privées entre un élève et le Tuteur IA ne sont jamais exposées ici.
            </p>
          </div>
        </div>
      </div>

      {/* Teachers snapshot */}
      <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <h2 className="font-bold text-slate-900">Équipe pédagogique ({teachers.length})</h2>
          <Link href="/org/teachers" className="text-xs font-bold text-indigo-600 hover:underline">
            Gérer les enseignants →
          </Link>
        </div>
        <div className="divide-y divide-slate-50">
          {teachers.map((t) => (
            <div key={t.id} className="px-6 py-4 flex items-center gap-4">
              <div className="w-9 h-9 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-xs font-bold shrink-0">
                {t.name[0]}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-bold text-slate-900">{t.name}</div>
                <div className="text-xs text-slate-400">{t.email}</div>
              </div>
              <div className="hidden sm:flex gap-1.5">
                {t.levels.map((lvl) => (
                  <span key={lvl} className="text-[11px] font-semibold bg-slate-100 text-slate-600 px-2 py-0.5 rounded-lg">
                    {lvl}
                  </span>
                ))}
              </div>
              <div className="text-right text-xs text-slate-600 hidden md:block">
                <strong>{t.classesCount}</strong> classes · <strong>{t.studentsCount}</strong> él.
              </div>
              <span
                className={`text-xs font-bold px-2.5 py-1 rounded-full ${
                  t.status === "active"
                    ? "bg-emerald-100 text-emerald-700"
                    : "bg-amber-100 text-amber-800"
                }`}
              >
                {t.status === "active" ? "Actif" : "Invité"}
              </span>
            </div>
          ))}
        </div>
      </div>
    </OrgShell>
  );
}
