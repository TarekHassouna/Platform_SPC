"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { fetchStudentDashboardData, type MasteryRow } from "@/lib/db";
import { CURRICULUM_EXERCISES } from "@/lib/curriculum-bank";

const DEFAULT_CONCEPTS: { code: string; label: string; domain: string; exerciseId: string }[] = [
  { code: "loi_ohm", label: "Loi d'Ohm (U = R · I)", domain: "Électricité", exerciseId: "ohm-001" },
  { code: "conversion_unites", label: "Conversion d'unités SI (mA ↔ A, g ↔ kg)", domain: "Métrologie", exerciseId: "puissance-001" },
  { code: "chiffres_significatifs", label: "Chiffres significatifs", domain: "Métrologie", exerciseId: "masse-vol-001" },
  { code: "tableau_avancement", label: "Tableau d'avancement & réactif limitant", domain: "Chimie", exerciseId: "avancement-001" },
  { code: "acido_basicite", label: "Titrages acido-basiques", domain: "Chimie", exerciseId: "titrage-001" },
  { code: "lois_newton", label: "Deuxième loi de Newton", domain: "Mécanique", exerciseId: "newton-001" },
  { code: "chute_libre", label: "Chute libre & frottements visqueux", domain: "Mécanique", exerciseId: "frottements-001" },
];

const DOMAIN_META: Record<string, { icon: string; color: string; bg: string }> = {
  Électricité: { icon: "⚡", color: "from-indigo-500 to-blue-500", bg: "bg-indigo-50" },
  Mécanique: { icon: "🔧", color: "from-emerald-500 to-teal-500", bg: "bg-emerald-50" },
  Métrologie: { icon: "📏", color: "from-orange-500 to-amber-500", bg: "bg-orange-50" },
  Chimie: { icon: "🧪", color: "from-pink-500 to-rose-500", bg: "bg-pink-50" },
};

const statusColors: Record<string, string> = {
  acquired: "bg-emerald-500",
  developing: "bg-amber-400",
  needs_review: "bg-rose-400",
  not_started: "bg-slate-200",
};

const statusLabels: Record<string, { text: string; cls: string }> = {
  acquired: { text: "Acquis", cls: "bg-emerald-100 text-emerald-700" },
  developing: { text: "En cours", cls: "bg-amber-100 text-amber-700" },
  needs_review: { text: "À retravailler", cls: "bg-rose-100 text-rose-700" },
  not_started: { text: "À découvrir", cls: "bg-slate-100 text-slate-500" },
};

export default function ProgressPage() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const [masteryRows, setMasteryRows] = useState<MasteryRow[]>([]);

  useEffect(() => {
    if (user?.id) {
      fetchStudentDashboardData(user.id).then((d) => setMasteryRows(d.mastery));
    }
  }, [user?.id]);

  const handleLogout = async () => {
    await logout();
    router.push("/auth/login");
  };

  const initials = user ? (user.firstName?.[0] ?? "E") + (user.lastName?.[0] ?? "") : "EL";

  // Merge DB mastery rows with full curriculum list
  const merged = DEFAULT_CONCEPTS.map((c) => {
    const dbRow = masteryRows.find((m) => m.conceptCode === c.code);
    return {
      code: c.code,
      label: dbRow?.conceptLabel || c.label,
      domain: dbRow?.domain || c.domain,
      score: dbRow?.masteryScore ?? 0,
      status: dbRow?.status ?? ("not_started" as const),
      attempts: dbRow?.attempts ?? 0,
      nextReviewAt: dbRow?.nextReviewAt ?? null,
      exerciseId:
        CURRICULUM_EXERCISES.find((e) => e.conceptCodes.includes(c.code))?.id || c.exerciseId,
    };
  });

  const groupedDomains = Array.from(new Set(merged.map((m) => m.domain))).map((domain) => ({
    name: domain,
    meta: DOMAIN_META[domain] || DOMAIN_META.Électricité,
    skills: merged.filter((m) => m.domain === domain),
  }));

  const acquired = merged.filter((s) => s.status === "acquired").length;
  const developing = merged.filter((s) => s.status === "developing").length;
  const needsReview = merged.filter((s) => s.status === "needs_review").length;
  const overall = Math.round(merged.reduce((acc, s) => acc + s.score, 0) / merged.length);

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="bg-white border-b border-slate-100 px-6 py-3 flex items-center gap-4 sticky top-0 z-20">
        <Link href="/dashboard" className="text-slate-500 hover:text-slate-800 transition-colors text-sm font-medium">
          ← Tableau de bord
        </Link>
        <span className="text-slate-200">|</span>
        <span className="text-sm font-bold text-slate-800">🗺️ Ma progression</span>
        <div className="ml-auto flex items-center gap-3">
          <div className="w-7 h-7 rounded-full bg-gradient-to-br from-pink-400 to-violet-500 flex items-center justify-center text-white text-xs font-bold uppercase">
            {initials}
          </div>
          <button
            onClick={handleLogout}
            className="text-xs font-medium text-rose-500 hover:text-rose-700 transition-colors flex items-center gap-1"
          >
            🚪 Déconnexion
          </button>
        </div>
      </div>

      <div className="max-w-5xl mx-auto p-6 lg:p-10">
        <div className="mb-8">
          <h1 className="text-3xl font-extrabold text-slate-900 mb-1">Carte de maîtrise</h1>
          <p className="text-slate-500 text-sm">
            {user?.level || "Lycée"} · Physique-Chimie · Mise à jour automatique après chaque exercice (révision espacée incluse)
          </p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
          {[
            { label: "Maîtrise globale", value: `${overall}%`, color: "text-indigo-600", bg: "bg-indigo-50" },
            { label: "Acquis", value: `${acquired} / ${merged.length}`, color: "text-emerald-600", bg: "bg-emerald-50" },
            { label: "En cours", value: String(developing), color: "text-amber-600", bg: "bg-amber-50" },
            { label: "À retravailler", value: String(needsReview), color: "text-rose-600", bg: "bg-rose-50" },
          ].map((s) => (
            <div key={s.label} className={`${s.bg} rounded-2xl p-5 border border-white`}>
              <div className={`text-3xl font-extrabold ${s.color}`}>{s.value}</div>
              <div className="text-xs font-semibold text-slate-600 mt-1">{s.label}</div>
            </div>
          ))}
        </div>

        <div className="space-y-6">
          {groupedDomains.map((domain) => {
            const domainScore = Math.round(
              domain.skills.reduce((a, s) => a + s.score, 0) / domain.skills.length
            );
            return (
              <div key={domain.name} className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
                <div className={`${domain.meta.bg} px-7 py-5 flex items-center justify-between`}>
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-10 h-10 rounded-xl bg-gradient-to-br ${domain.meta.color} flex items-center justify-center text-xl shadow-sm`}
                    >
                      {domain.meta.icon}
                    </div>
                    <div>
                      <h2 className="font-bold text-slate-900 text-lg">{domain.name}</h2>
                      <p className="text-xs text-slate-500">{domain.skills.length} compétence(s)</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-extrabold text-slate-900">{domainScore}%</div>
                    <div className="text-xs text-slate-400">maîtrise</div>
                  </div>
                </div>

                <div className="divide-y divide-slate-50">
                  {domain.skills.map((skill) => {
                    const lbl = statusLabels[skill.status] || statusLabels.not_started;
                    return (
                      <div key={skill.code} className="px-7 py-4 flex items-center gap-5">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-2 gap-2">
                            <span className="text-sm font-semibold text-slate-800">{skill.label}</span>
                            <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full whitespace-nowrap ${lbl.cls}`}>
                              {lbl.text}
                            </span>
                          </div>
                          <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all ${statusColors[skill.status]}`}
                              style={{ width: `${skill.score}%` }}
                            />
                          </div>
                          <div className="flex items-center gap-3 text-xs text-slate-400 mt-1">
                            <span>{skill.score} / 100</span>
                            <span>· {skill.attempts} essai(s)</span>
                            {skill.nextReviewAt && (
                              <span>
                                · Prochaine révision :{" "}
                                {new Date(skill.nextReviewAt).toLocaleDateString("fr-FR")}
                              </span>
                            )}
                          </div>
                        </div>
                        <Link
                          href={`/exercises/${skill.exerciseId}`}
                          className="shrink-0 text-xs font-bold text-indigo-600 bg-indigo-50 px-3.5 py-2 rounded-xl hover:bg-indigo-100 transition-colors whitespace-nowrap"
                        >
                          Pratiquer →
                        </Link>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
