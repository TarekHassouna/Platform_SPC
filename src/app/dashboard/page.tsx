"use client";
import { useAuth } from "@/lib/auth-context";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import Link from "next/link";

const masterySkills = [
  { name: "Loi d'Ohm", status: "acquired", score: 92 },
  { name: "Résistances en série / parallèle", status: "developing", score: 61 },
  { name: "Conversion d'unités", status: "weak", score: 34 },
  { name: "Lois de Newton", status: "acquired", score: 88 },
  { name: "Chute libre", status: "developing", score: 55 },
  { name: "Notation scientifique", status: "weak", score: 28 },
];

const recommended = [
  { title: "Conversion mA ↔ A", type: "Exercice ciblé", count: 5, color: "bg-rose-50 border-rose-100", badge: "⚠️ Lacune détectée" },
  { title: "Résistances en dérivation", type: "Exercice standard", count: 3, color: "bg-amber-50 border-amber-100", badge: "🔁 À retravailler" },
  { title: "Loi d'Ohm — révision", type: "Révision espacée", count: 2, color: "bg-indigo-50 border-indigo-100", badge: "📅 Échéance aujourd'hui" },
];

const statusStyles: Record<string, { bg: string; text: string; label: string }> = {
  acquired: { bg: "bg-emerald-100", text: "text-emerald-700", label: "Acquis" },
  developing: { bg: "bg-amber-100", text: "text-amber-700", label: "En cours" },
  weak: { bg: "bg-rose-100", text: "text-rose-700", label: "À retravailler" },
};

export default function DashboardPage() {
  const { user, logout } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (user && user.role !== "student") {
      if (user.role === "teacher") router.replace("/teacher/dashboard");
      else if (user.role === "org_admin") router.replace("/org/dashboard");
      else router.replace("/parent/dashboard");
    }
  }, [user, router]);

  const displayName = user ? `${user.firstName} ${user.lastName}`.trim() : "Élève";
  const initials = user ? (user.firstName[0] ?? "") + (user.lastName?.[0] ?? "") : "?";
  const level = user?.level || "Terminale";

  const handleLogout = () => { logout(); router.push("/auth/login"); };

  const navItems = [
    { icon: "🏠", label: "Tableau de bord", href: "/dashboard", active: true },
    { icon: "📚", label: "Exercices", href: "/exercises", active: false },
    { icon: "🗺️", label: "Ma progression", href: "/progress", active: false },
    { icon: "💬", label: "Tuteur IA", href: "/tutor", active: false },
    { icon: "📸", label: "Photo & correction", href: "/photo", active: false },
  ];

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* SIDEBAR */}
      <aside className="hidden lg:flex flex-col w-64 bg-white border-r border-slate-100 fixed inset-y-0">
        <div className="p-6 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center text-white font-bold text-sm">S</div>
            <span className="font-bold text-slate-900">SPC Platform</span>
          </div>
        </div>
        <nav className="flex-1 p-4 space-y-1">
          {navItems.map((item) => (
            <Link key={item.label} href={item.href}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${item.active ? "bg-indigo-50 text-indigo-700" : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"}`}>
              <span className="text-base">{item.icon}</span>
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="p-4 border-t border-slate-100 space-y-1">
          <div className="flex items-center gap-3 px-4 py-3">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-pink-400 to-violet-500 flex items-center justify-center text-white text-sm font-bold uppercase">
              {initials}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-slate-900 truncate">{displayName}</p>
              <p className="text-xs text-slate-400">{level} — Plan individuel</p>
            </div>
          </div>
          <button onClick={handleLogout}
            className="flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium text-rose-500 hover:bg-rose-50 transition-all w-full">
            <span className="text-base">🚪</span>
            Se déconnecter
          </button>
        </div>
      </aside>

      {/* MAIN */}
      <main className="flex-1 lg:ml-64 p-6 lg:p-10">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-extrabold text-slate-900">
              Bonjour {user?.firstName || "..."} 👋
            </h1>
            <p className="text-slate-500 mt-1">Tu as 3 exercices de révision à faire aujourd'hui.</p>
          </div>
          <Link href="/exercises"
            className="hidden sm:inline-flex items-center gap-2 bg-indigo-600 text-white font-semibold px-5 py-2.5 rounded-xl hover:bg-indigo-700 transition-colors text-sm">
            Pratiquer maintenant →
          </Link>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {[
            { label: "Exercices cette semaine", value: "24", icon: "📝", color: "text-indigo-600" },
            { label: "Compétences acquises", value: "7 / 18", icon: "✅", color: "text-emerald-600" },
            { label: "Précision globale", value: "72%", icon: "🎯", color: "text-orange-600" },
            { label: "Série en cours", value: "5 jours", icon: "🔥", color: "text-rose-600" },
          ].map((s) => (
            <div key={s.label} className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm">
              <div className="text-2xl mb-2">{s.icon}</div>
              <div className={`text-2xl font-extrabold ${s.color}`}>{s.value}</div>
              <div className="text-xs text-slate-500 mt-1">{s.label}</div>
            </div>
          ))}
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Recommended */}
          <div className="lg:col-span-2">
            <h2 className="text-lg font-bold text-slate-900 mb-4">Recommandé pour toi</h2>
            <div className="space-y-3">
              {recommended.map((r) => (
                <div key={r.title} className={`${r.color} border rounded-2xl p-5 flex items-center justify-between`}>
                  <div>
                    <div className="text-xs font-semibold text-slate-500 mb-1">{r.badge}</div>
                    <div className="font-bold text-slate-900">{r.title}</div>
                    <div className="text-sm text-slate-500">{r.type} · {r.count} exercices</div>
                  </div>
                  <Link href="/exercises"
                    className="bg-white border border-slate-200 text-slate-700 text-sm font-semibold px-4 py-2 rounded-xl hover:border-indigo-300 hover:text-indigo-600 transition-all whitespace-nowrap">
                    Commencer →
                  </Link>
                </div>
              ))}
            </div>
          </div>

          {/* Mastery */}
          <div>
            <h2 className="text-lg font-bold text-slate-900 mb-4">Carte de maîtrise</h2>
            <div className="bg-white border border-slate-100 rounded-2xl p-5 space-y-3">
              {masterySkills.map((skill) => {
                const s = statusStyles[skill.status];
                return (
                  <div key={skill.name} className="flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-slate-800 truncate">{skill.name}</div>
                      <div className="mt-1.5 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                        <div className={`h-full rounded-full ${skill.status === "acquired" ? "bg-emerald-500" : skill.status === "developing" ? "bg-amber-400" : "bg-rose-400"}`}
                          style={{ width: `${skill.score}%` }} />
                      </div>
                    </div>
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full whitespace-nowrap ${s.bg} ${s.text}`}>{s.label}</span>
                  </div>
                );
              })}
              <Link href="/progress" className="block text-center text-sm text-indigo-600 font-medium mt-2 hover:underline">
                Voir toutes les compétences →
              </Link>
            </div>
          </div>
        </div>

        {/* Recent activity */}
        <div className="mt-8">
          <h2 className="text-lg font-bold text-slate-900 mb-4">Activité récente</h2>
          <div className="bg-white border border-slate-100 rounded-2xl divide-y divide-slate-50">
            {[
              { exercise: "Loi d'Ohm — calcul de I", score: "8/10", status: "✅", time: "il y a 2h", error: null },
              { exercise: "Conversion mA en A", score: "3/10", status: "❌", time: "il y a 3h", error: "Erreur de conversion × 1000" },
              { exercise: "Résistances en série", score: "9/10", status: "✅", time: "hier", error: null },
              { exercise: "Chute libre sans frottements", score: "5/10", status: "⚠️", time: "hier", error: "Formule correcte, unité manquante" },
            ].map((a, i) => (
              <div key={i} className="px-5 py-4 flex items-center gap-4">
                <span className="text-xl">{a.status}</span>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-slate-900 truncate">{a.exercise}</div>
                  {a.error && <div className="text-xs text-slate-400 mt-0.5">{a.error}</div>}
                </div>
                <div className="text-right">
                  <div className="text-sm font-bold text-slate-700">{a.score}</div>
                  <div className="text-xs text-slate-400">{a.time}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
