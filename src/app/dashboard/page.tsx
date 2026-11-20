"use client";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  fetchStudentDashboardData,
  joinClassWithCode,
  type StudentDashboardPayload,
} from "@/lib/db";
import { CURRICULUM_EXERCISES } from "@/lib/curriculum-bank";

const statusStyles: Record<string, { bg: string; text: string; label: string }> = {
  acquired: { bg: "bg-emerald-100", text: "text-emerald-700", label: "Acquis" },
  developing: { bg: "bg-amber-100", text: "text-amber-700", label: "En cours" },
  needs_review: { bg: "bg-rose-100", text: "text-rose-700", label: "À retravailler" },
  not_started: { bg: "bg-slate-100", text: "text-slate-600", label: "Non commencé" },
};

export default function DashboardPage() {
  const { user, logout } = useAuth();
  const router = useRouter();

  const [data, setData] = useState<StudentDashboardPayload>({
    enrolledClasses: [],
    assignments: [],
    mastery: [],
    allConcepts: [],
    recentSubmissions: [],
    fromDatabase: false,
  });
  const [loadingData, setLoadingData] = useState(true);
  const [classCodeInput, setClassCodeInput] = useState("");
  const [joinMessage, setJoinMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [joining, setJoining] = useState(false);

  useEffect(() => {
    if (user && user.role !== "student") {
      if (user.role === "teacher") router.replace("/teacher/dashboard");
      else if (user.role === "org_admin") router.replace("/org/dashboard");
      else router.replace("/parent/dashboard");
      return;
    }
    if (user?.id) {
      fetchStudentDashboardData(user.id).then((res) => {
        setData(res);
        setLoadingData(false);
      });
    } else {
      setLoadingData(false);
    }
  }, [user, router]);

  const handleJoinClass = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!classCodeInput.trim()) return;
    setJoining(true);
    setJoinMessage(null);
    const res = await joinClassWithCode(classCodeInput.trim());
    setJoining(false);
    if (!res.ok) {
      setJoinMessage({ ok: false, text: res.error || "Code classe invalide." });
      return;
    }
    setJoinMessage({
      ok: true,
      text: `✅ Tu as rejoint la classe « ${res.className} » !`,
    });
    setClassCodeInput("");
    if (user?.id) {
      const updated = await fetchStudentDashboardData(user.id);
      setData(updated);
    }
  };

  const handleLogout = async () => {
    await logout();
    router.push("/auth/login");
  };

  const displayName = user ? `${user.firstName} ${user.lastName}`.trim() : "Élève";
  const initials = user ? (user.firstName?.[0] ?? "E") + (user.lastName?.[0] ?? "") : "EL";
  const level = user?.level || "Terminale";

  const acquiredCount = data.mastery.filter((m) => m.status === "acquired").length;
  const totalSubmissions = data.recentSubmissions.length;
  const avgPrecision = totalSubmissions
    ? Math.round(
        (data.recentSubmissions.reduce(
          (acc, s) => acc + (s.maxScore > 0 ? s.score / s.maxScore : 0),
          0
        ) /
          totalSubmissions) *
          100
      )
    : 0;

  // Adaptive recommendations derived ONLY from real Supabase concept_mastery data
  const weakOrDeveloping = [...data.mastery]
    .filter((m) => m.status === "needs_review" || m.status === "developing")
    .sort((a, b) => a.masteryScore - b.masteryScore)
    .slice(0, 3);

  const adaptiveRecommendations = weakOrDeveloping
    .map((m) => {
      const ex = CURRICULUM_EXERCISES.find((e) => e.conceptCodes.includes(m.conceptCode));
      return ex ? { mastery: m, exercise: ex } : null;
    })
    .filter(Boolean) as {
    mastery: (typeof data.mastery)[number];
    exercise: (typeof CURRICULUM_EXERCISES)[number];
  }[];

  const navItems = [
    { icon: "🏠", label: "Tableau de bord", href: "/dashboard", active: true },
    { icon: "📚", label: "Exercices & cours", href: "/exercises", active: false },
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
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center text-white font-bold text-sm">
              S
            </div>
            <div>
              <span className="font-bold text-slate-900 block leading-tight">SPC Platform</span>
              <span className="text-[11px] font-medium text-indigo-600">Espace Élève</span>
            </div>
          </div>
        </div>
        <nav className="flex-1 p-4 space-y-1">
          {navItems.map((item) => (
            <Link
              key={item.label}
              href={item.href}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                item.active
                  ? "bg-indigo-50 text-indigo-700 font-semibold"
                  : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
              }`}
            >
              <span className="text-base">{item.icon}</span>
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="p-4 border-t border-slate-100 space-y-1">
          <div className="flex items-center gap-3 px-4 py-3">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-pink-400 to-violet-500 flex items-center justify-center text-white text-xs font-bold uppercase shrink-0">
              {initials}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-slate-900 truncate">{displayName}</p>
              <p className="text-xs text-slate-400">{level} · Physique-Chimie</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium text-rose-500 hover:bg-rose-50 transition-all w-full"
          >
            <span>🚪</span> Se déconnecter
          </button>
        </div>
      </aside>

      {/* MAIN */}
      <main className="flex-1 lg:ml-64 p-6 lg:p-10">
        {/* Header */}
        <div className="mb-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-extrabold text-slate-900">
              Bonjour {user?.firstName || "Élève"} 👋
            </h1>
            <p className="text-slate-500 mt-1 text-sm">
              {data.enrolledClasses.length > 0
                ? `Classe(s) : ${data.enrolledClasses.map((c) => c.name).join(", ")}`
                : `${level} · Prêt à t'entraîner en Physique-Chimie ?`}
            </p>
          </div>
          <div className="flex gap-2.5">
            <Link
              href="/photo"
              className="inline-flex items-center gap-1.5 bg-white border border-slate-200 text-slate-700 font-semibold px-4 py-2.5 rounded-xl hover:border-indigo-300 text-sm"
            >
              📸 Photo copie
            </Link>
            <Link
              href="/exercises"
              className="inline-flex items-center gap-2 bg-indigo-600 text-white font-semibold px-5 py-2.5 rounded-xl hover:bg-indigo-700 transition-colors text-sm shadow-md shadow-indigo-100"
            >
              Pratiquer maintenant →
            </Link>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {[
            { label: "Exercices soumis", value: String(totalSubmissions), icon: "📝", color: "text-indigo-600" },
            {
              label: "Compétences acquises",
              value: data.mastery.length > 0 ? `${acquiredCount} / ${data.mastery.length}` : "0",
              icon: "✅",
              color: "text-emerald-600",
            },
            { label: "Précision récente", value: totalSubmissions ? `${avgPrecision}%` : "—", icon: "🎯", color: "text-orange-600" },
            { label: "Mes classes", value: String(data.enrolledClasses.length), icon: "🏫", color: "text-violet-600" },
          ].map((s) => (
            <div key={s.label} className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm">
              <div className="text-2xl mb-2">{s.icon}</div>
              <div className={`text-2xl font-extrabold ${s.color}`}>{s.value}</div>
              <div className="text-xs text-slate-500 mt-1">{s.label}</div>
            </div>
          ))}
        </div>

        {/* Join a class anytime by code */}
        <div className="bg-white rounded-3xl border border-slate-100 p-5 mb-8 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="text-sm font-bold text-slate-900">🏫 Rejoindre la classe de ton professeur</div>
            <div className="text-xs text-slate-500">
              Entre le code fourni par ton enseignant (ex : <code className="font-mono bg-slate-100 px-1 rounded">PHY-2026-TS1</code>) pour recevoir ses devoirs.
            </div>
            {joinMessage && (
              <div className={`text-xs font-semibold mt-1.5 ${joinMessage.ok ? "text-emerald-600" : "text-rose-600"}`}>
                {joinMessage.text}
              </div>
            )}
          </div>
          <form onSubmit={handleJoinClass} className="flex gap-2 shrink-0">
            <input
              type="text"
              value={classCodeInput}
              onChange={(e) => setClassCodeInput(e.target.value.toUpperCase())}
              placeholder="CODE CLASSE"
              className="w-40 border border-slate-200 rounded-xl px-3.5 py-2 text-xs font-mono font-bold text-slate-900 bg-white placeholder:text-slate-400 outline-none focus:border-indigo-400"
            />
            <button
              type="submit"
              disabled={joining}
              className="bg-indigo-600 text-white text-xs font-bold px-4 py-2 rounded-xl hover:bg-indigo-700 disabled:opacity-60"
            >
              {joining ? "…" : "Rejoindre"}
            </button>
          </form>
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Left: Class assignments + Recommended exercises */}
          <div className="lg:col-span-2 space-y-6">
            {data.assignments.length > 0 && (
              <div>
                <h2 className="text-lg font-bold text-slate-900 mb-3">📌 Devoirs de ta classe</h2>
                <div className="space-y-3">
                  {data.assignments.map((asg) => (
                    <div
                      key={asg.id}
                      className="bg-indigo-50/70 border border-indigo-200 rounded-2xl p-5 flex items-center justify-between gap-4"
                    >
                      <div>
                        <div className="text-xs font-bold text-indigo-700 mb-1 flex items-center gap-2 flex-wrap">
                          <span>{asg.className} · {asg.mode}</span>
                          <span
                            className={`text-[10px] px-2 py-0.5 rounded-full ${
                              asg.allowRetry
                                ? "bg-emerald-100 text-emerald-700"
                                : "bg-amber-100 text-amber-800"
                            }`}
                          >
                            {asg.allowRetry ? "🔄 Réessais autorisés" : "🔒 1 seul essai"}
                          </span>
                          {!asg.allowHints && (
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-rose-100 text-rose-700">
                              🚫 Sans indices
                            </span>
                          )}
                          {asg.timeLimitMinutes && (
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-violet-100 text-violet-700">
                              ⏱️ {asg.timeLimitMinutes} min
                            </span>
                          )}
                        </div>
                        <div className="font-bold text-slate-900">{asg.title}</div>
                      </div>
                      <Link
                        href={
                          asg.targetExerciseId
                            ? `/exercises/${asg.targetExerciseId}?assignmentId=${asg.id}`
                            : "/exercises"
                        }
                        className="bg-indigo-600 text-white text-xs font-bold px-4 py-2 rounded-xl hover:bg-indigo-700 whitespace-nowrap"
                      >
                        Ouvrir →
                      </Link>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div>
              <h2 className="text-lg font-bold text-slate-900 mb-3">
                Recommandations adaptatives
              </h2>
              {adaptiveRecommendations.length === 0 ? (
                <div className="bg-white border border-slate-100 rounded-2xl p-6 text-center shadow-xs">
                  <div className="text-2xl mb-2">🎯</div>
                  <p className="text-sm font-semibold text-slate-800 mb-1">
                    Aucune recommandation pour le moment
                  </p>
                  <p className="text-xs text-slate-500 max-w-md mx-auto mb-4">
                    Dès que tu fais un exercice ou un devoir de classe, le moteur adaptatif détecte tes erreurs et te propose ici des exercices ciblés sur tes vraies lacunes.
                  </p>
                  <Link
                    href="/exercises"
                    className="inline-flex items-center gap-1.5 bg-indigo-600 text-white text-xs font-bold px-4 py-2.5 rounded-xl hover:bg-indigo-700"
                  >
                    Parcourir les exercices ({level}) →
                  </Link>
                </div>
              ) : (
                <div className="space-y-3">
                  {adaptiveRecommendations.map(({ mastery: m, exercise: ex }) => (
                    <div
                      key={`${m.conceptCode}-${ex.id}`}
                      className={`border rounded-2xl p-5 flex items-center justify-between gap-4 shadow-xs transition-all ${
                        m.status === "needs_review"
                          ? "bg-rose-50/70 border-rose-200"
                          : "bg-amber-50/70 border-amber-200"
                      }`}
                    >
                      <div>
                        <div className="text-xs font-bold text-rose-700 mb-1">
                          {m.status === "needs_review"
                            ? `⚠️ Lacune détectée : ${m.conceptLabel} (${m.masteryScore}%)`
                            : `🔁 À consolider : ${m.conceptLabel} (${m.masteryScore}%)`}
                        </div>
                        <div className="font-bold text-slate-900">{ex.title}</div>
                        <div className="text-xs text-slate-500">
                          {ex.domain} · {ex.chapter} · {ex.difficulty}
                        </div>
                      </div>
                      <Link
                        href={`/exercises/${ex.id}`}
                        className="bg-white border border-slate-200 text-indigo-700 text-xs font-bold px-4 py-2.5 rounded-xl hover:border-indigo-300 transition-colors whitespace-nowrap"
                      >
                        Travailler →
                      </Link>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Right: Real Mastery Map */}
          <div>
            <h2 className="text-lg font-bold text-slate-900 mb-3">Ma carte de maîtrise</h2>
            <div className="bg-white border border-slate-100 rounded-2xl p-5 space-y-3 shadow-xs">
              {loadingData ? (
                <p className="text-xs text-slate-400">Chargement de tes progrès…</p>
              ) : data.mastery.length === 0 ? (
                <div className="text-center py-4 space-y-3">
                  <div className="text-3xl">🗺️</div>
                  <p className="text-xs text-slate-500 leading-relaxed">
                    Fais ton premier exercice pour voir ta carte de maîtrise se remplir en temps réel !
                  </p>
                  <Link
                    href="/exercises/ohm-001"
                    className="inline-block bg-indigo-600 text-white text-xs font-bold px-4 py-2 rounded-xl hover:bg-indigo-700"
                  >
                    Lancer mon premier exercice →
                  </Link>
                </div>
              ) : (
                data.mastery.map((skill) => {
                  const s = statusStyles[skill.status] || statusStyles.developing;
                  return (
                    <div key={skill.conceptCode} className="flex items-center gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-slate-800 truncate">
                          {skill.conceptLabel}
                        </div>
                        <div className="mt-1.5 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${
                              skill.status === "acquired"
                                ? "bg-emerald-500"
                                : skill.status === "developing"
                                ? "bg-amber-400"
                                : "bg-rose-400"
                            }`}
                            style={{ width: `${skill.masteryScore}%` }}
                          />
                        </div>
                      </div>
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full whitespace-nowrap ${s.bg} ${s.text}`}>
                        {skill.masteryScore}%
                      </span>
                    </div>
                  );
                })
              )}
              <Link
                href="/progress"
                className="block text-center text-xs text-indigo-600 font-bold pt-2 hover:underline"
              >
                Voir toute ma progression →
              </Link>
            </div>
          </div>
        </div>

        {/* Real Recent Submissions */}
        <div className="mt-8">
          <h2 className="text-lg font-bold text-slate-900 mb-3">Activité récente</h2>
          <div className="bg-white border border-slate-100 rounded-2xl divide-y divide-slate-50 shadow-xs">
            {data.recentSubmissions.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-400">
                Tes exercices terminés apparaîtront ici automatiquement avec ton score et tes erreurs détectées.
              </div>
            ) : (
              data.recentSubmissions.map((sub) => (
                <div key={sub.id} className="px-5 py-4 flex items-center gap-4">
                  <span className="text-xl">
                    {sub.status === "correct" ? "✅" : sub.status === "partially_correct" ? "⚠️" : "❌"}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-slate-900 truncate">{sub.exerciseTitle}</div>
                    {sub.errorSummary && (
                      <div className="text-xs text-rose-500 font-mono mt-0.5">{sub.errorSummary}</div>
                    )}
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-bold text-slate-700">
                      {sub.score.toFixed(1)} / {sub.maxScore}
                    </div>
                    <div className="text-[11px] text-slate-400">
                      {new Date(sub.createdAt).toLocaleDateString("fr-FR")}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
