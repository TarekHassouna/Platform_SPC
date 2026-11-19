import Link from "next/link";

const domains = [
  {
    name: "Électricité",
    color: "from-indigo-500 to-blue-500",
    bg: "bg-indigo-50",
    icon: "⚡",
    skills: [
      { name: "Loi d'Ohm", score: 92, status: "acquired" },
      { name: "Résistances en série", score: 78, status: "acquired" },
      { name: "Résistances en parallèle", score: 61, status: "developing" },
      { name: "Puissance électrique", score: 45, status: "developing" },
      { name: "Énergie électrique", score: 20, status: "weak" },
    ],
  },
  {
    name: "Mécanique",
    color: "from-emerald-500 to-teal-500",
    bg: "bg-emerald-50",
    icon: "🔧",
    skills: [
      { name: "Lois de Newton", score: 88, status: "acquired" },
      { name: "Chute libre", score: 55, status: "developing" },
      { name: "Chute avec frottements", score: 30, status: "weak" },
      { name: "Énergie mécanique", score: 15, status: "weak" },
    ],
  },
  {
    name: "Métrologie",
    color: "from-orange-500 to-amber-500",
    bg: "bg-orange-50",
    icon: "📏",
    skills: [
      { name: "Conversion d'unités", score: 34, status: "weak" },
      { name: "Notation scientifique", score: 28, status: "weak" },
      { name: "Chiffres significatifs", score: 55, status: "developing" },
    ],
  },
  {
    name: "Chimie",
    color: "from-pink-500 to-rose-500",
    bg: "bg-pink-50",
    icon: "🧪",
    skills: [
      { name: "Tableau d'avancement", score: 72, status: "developing" },
      { name: "pH et acido-basicité", score: 40, status: "developing" },
      { name: "Réactions d'oxydoréduction", score: 10, status: "weak" },
    ],
  },
];

const statusColors: Record<string, string> = {
  acquired: "bg-emerald-500",
  developing: "bg-amber-400",
  weak: "bg-rose-400",
};

const statusLabels: Record<string, { text: string; cls: string }> = {
  acquired: { text: "Acquis", cls: "bg-emerald-100 text-emerald-700" },
  developing: { text: "En cours", cls: "bg-amber-100 text-amber-700" },
  weak: { text: "À retravailler", cls: "bg-rose-100 text-rose-700" },
};

export default function ProgressPage() {
  const totalSkills = domains.flatMap((d) => d.skills).length;
  const acquired = domains.flatMap((d) => d.skills).filter((s) => s.status === "acquired").length;
  const developing = domains.flatMap((d) => d.skills).filter((s) => s.status === "developing").length;
  const weak = domains.flatMap((d) => d.skills).filter((s) => s.status === "weak").length;
  const overall = Math.round(domains.flatMap((d) => d.skills).reduce((acc, s) => acc + s.score, 0) / totalSkills);

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="bg-white border-b border-slate-100 px-6 py-3 flex items-center gap-4">
        <Link href="/dashboard" className="text-slate-400 hover:text-slate-700 transition-colors text-sm">
          ← Tableau de bord
        </Link>
        <span className="text-slate-300">|</span>
        <span className="text-sm font-semibold text-slate-700">Ma progression</span>
        <div className="ml-auto flex items-center gap-3">
          <div className="w-7 h-7 rounded-full bg-gradient-to-br from-pink-400 to-violet-500 flex items-center justify-center text-white text-xs font-bold">A</div>
          <Link
            href="/auth/login"
            className="text-xs font-medium text-rose-500 hover:text-rose-700 transition-colors flex items-center gap-1"
          >
            🚪 Déconnexion
          </Link>
        </div>
      </div>

      <div className="max-w-5xl mx-auto p-6 lg:p-10">
        <div className="mb-10">
          <h1 className="text-3xl font-extrabold text-slate-900 mb-1">Carte de maîtrise</h1>
          <p className="text-slate-500">Terminale · Physique-Chimie · Spécialité</p>
        </div>

        {/* Summary */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
          {[
            { label: "Maîtrise globale", value: `${overall}%`, color: "text-indigo-600", bg: "bg-indigo-50" },
            { label: "Acquis", value: `${acquired} / ${totalSkills}`, color: "text-emerald-600", bg: "bg-emerald-50" },
            { label: "En cours", value: developing, color: "text-amber-600", bg: "bg-amber-50" },
            { label: "À retravailler", value: weak, color: "text-rose-600", bg: "bg-rose-50" },
          ].map((s) => (
            <div key={s.label} className={`${s.bg} rounded-2xl p-5 border border-white`}>
              <div className={`text-3xl font-extrabold ${s.color}`}>{s.value}</div>
              <div className="text-sm text-slate-500 mt-1">{s.label}</div>
            </div>
          ))}
        </div>

        {/* Domains */}
        <div className="space-y-6">
          {domains.map((domain) => {
            const domainScore = Math.round(domain.skills.reduce((a, s) => a + s.score, 0) / domain.skills.length);
            return (
              <div key={domain.name} className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
                {/* Domain header */}
                <div className={`${domain.bg} px-7 py-5 flex items-center justify-between`}>
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${domain.color} flex items-center justify-center text-xl shadow-sm`}>
                      {domain.icon}
                    </div>
                    <div>
                      <h2 className="font-bold text-slate-900 text-lg">{domain.name}</h2>
                      <p className="text-sm text-slate-500">{domain.skills.length} compétences</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-extrabold text-slate-900">{domainScore}%</div>
                    <div className="text-xs text-slate-400">maîtrise</div>
                  </div>
                </div>

                {/* Skills list */}
                <div className="divide-y divide-slate-50">
                  {domain.skills.map((skill) => {
                    const lbl = statusLabels[skill.status];
                    return (
                      <div key={skill.name} className="px-7 py-4 flex items-center gap-5">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-sm font-semibold text-slate-800">{skill.name}</span>
                            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${lbl.cls}`}>{lbl.text}</span>
                          </div>
                          <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all ${statusColors[skill.status]}`}
                              style={{ width: `${skill.score}%` }}
                            />
                          </div>
                          <div className="text-xs text-slate-400 mt-1">{skill.score} / 100</div>
                        </div>
                        {skill.status !== "acquired" && (
                          <Link
                            href="/exercises"
                            className="shrink-0 text-xs font-semibold text-indigo-600 bg-indigo-50 px-3 py-1.5 rounded-xl hover:bg-indigo-100 transition-colors whitespace-nowrap"
                          >
                            Pratiquer →
                          </Link>
                        )}
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
