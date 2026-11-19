"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { ParentShell } from "@/components/ParentShell";
import {
  fetchParentChildDashboard,
  type MasteryRow,
  type SubmissionHistoryRow,
} from "@/lib/db";

export default function ParentDashboard() {
  const { user } = useAuth();
  const [linked, setLinked] = useState(false);
  const [childName, setChildName] = useState(user?.childName || "votre enfant");
  const [childLevel, setChildLevel] = useState(user?.childLevel || "Lycée");
  const [childEmail, setChildEmail] = useState(user?.childEmail || "");
  const [mastery, setMastery] = useState<MasteryRow[]>([]);
  const [recentSubmissions, setRecentSubmissions] = useState<SubmissionHistoryRow[]>([]);

  useEffect(() => {
    if (user?.childName) setChildName(user.childName);
    if (user?.childLevel) setChildLevel(user.childLevel);
    if (user?.childEmail) setChildEmail(user.childEmail);

    if (user?.id) {
      fetchParentChildDashboard(user.id).then((res) => {
        setLinked(res.linked);
        if (res.childName) setChildName(res.childName);
        if (res.childLevel) setChildLevel(res.childLevel);
        if (res.childEmail) setChildEmail(res.childEmail);
        setMastery(res.mastery);
        setRecentSubmissions(res.recentSubmissions);
      });
    }
  }, [user]);

  const childInitials = childName[0]?.toUpperCase() ?? "E";
  const acquiredCount = mastery.filter((m) => m.status === "acquired").length;
  const avgPrecision = recentSubmissions.length
    ? Math.round(
        (recentSubmissions.reduce(
          (acc, s) => acc + (s.maxScore > 0 ? s.score / s.maxScore : 0),
          0
        ) /
          recentSubmissions.length) *
          100
      )
    : 0;
  const weakest = [...mastery].sort((a, b) => a.masteryScore - b.masteryScore)[0];

  return (
    <ParentShell>
      <div className="mb-8">
        <h1 className="text-2xl font-extrabold text-slate-900">
          Bonjour {user?.firstName || "Parent"} 👋
        </h1>
        <p className="text-slate-500 mt-1 text-sm">
          Voici le suivi en Physique-Chimie de <strong className="text-slate-700">{childName}</strong>.
        </p>
      </div>

      {/* Child card */}
      <div className="bg-gradient-to-br from-indigo-600 to-violet-700 text-white rounded-3xl p-6 mb-8 flex flex-col sm:flex-row sm:items-center gap-5 shadow-xl shadow-indigo-100">
        <div className="w-16 h-16 rounded-2xl bg-white/20 flex items-center justify-center text-3xl font-extrabold shrink-0">
          {childInitials}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2.5 flex-wrap">
            <span className="text-xl font-extrabold">{childName}</span>
            <span className="text-xs font-bold bg-white/20 px-2.5 py-0.5 rounded-full">
              {linked ? "● Compte élève lié" : "⏳ En attente d'inscription élève"}
            </span>
          </div>
          <div className="text-indigo-200 text-sm mt-0.5">
            {childLevel} · Physique-Chimie {childEmail ? `· ${childEmail}` : ""}
          </div>
          <div className="mt-3 flex items-center gap-2.5 flex-wrap">
            <span className="bg-white/20 text-white text-xs font-semibold px-3 py-1 rounded-full">
              📝 {recentSubmissions.length} exercice(s) soumis
            </span>
            <span className="bg-white/20 text-white text-xs font-semibold px-3 py-1 rounded-full">
              ✅ {acquiredCount} compétence(s) acquise(s)
            </span>
            <span className="bg-white/20 text-white text-xs font-semibold px-3 py-1 rounded-full">
              🎯 {recentSubmissions.length ? `${avgPrecision}% de réussite` : "En attente d'activité"}
            </span>
          </div>
        </div>
      </div>

      {!linked && (
        <div className="mb-8 bg-amber-50 border border-amber-200 rounded-2xl p-5 text-sm text-amber-900">
          <strong>Liaison automatique SQL :</strong> dès que {childName} crée son compte élève avec l&apos;e-mail{" "}
          <code className="font-mono bg-white px-1.5 py-0.5 rounded">
            {childEmail || "configuré dans Paramètres"}
          </code>
          , ses résultats et sa carte de maîtrise apparaîtront ici automatiquement.
        </div>
      )}

      <div className="grid lg:grid-cols-2 gap-6 mb-8">
        {/* Skills mastery */}
        <div className="bg-white border border-slate-100 rounded-2xl p-6 shadow-sm">
          <h2 className="font-bold text-slate-900 mb-4">Compétences clés</h2>
          {mastery.length === 0 ? (
            <p className="text-xs text-slate-400">
              Aucune compétence évaluée pour le moment. Les scores apparaîtront dès les premiers exercices.
            </p>
          ) : (
            <div className="space-y-3">
              {mastery.map((s) => (
                <div key={s.conceptCode}>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-slate-700 font-medium truncate pr-2">{s.conceptLabel}</span>
                    <span
                      className={`font-bold ${
                        s.status === "acquired"
                          ? "text-emerald-600"
                          : s.status === "developing"
                          ? "text-amber-600"
                          : "text-rose-600"
                      }`}
                    >
                      {s.masteryScore}%
                    </span>
                  </div>
                  <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${
                        s.status === "acquired"
                          ? "bg-emerald-500"
                          : s.status === "developing"
                          ? "bg-amber-400"
                          : "bg-rose-400"
                      }`}
                      style={{ width: `${s.masteryScore}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
          {weakest && weakest.masteryScore < 60 && (
            <div className="mt-4 p-3 bg-rose-50 rounded-xl border border-rose-100 text-xs text-rose-700">
              ⚠️ <strong>Point à renforcer :</strong> {weakest.conceptLabel} ({weakest.masteryScore}%).
            </div>
          )}
        </div>

        {/* Recent submissions */}
        <div className="bg-white border border-slate-100 rounded-2xl shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100">
            <h2 className="font-bold text-slate-900">Derniers exercices réalisés</h2>
          </div>
          {recentSubmissions.length === 0 ? (
            <div className="p-6 text-xs text-slate-400">
              Aucun exercice soumis pour l&apos;instant.
            </div>
          ) : (
            <div className="divide-y divide-slate-50">
              {recentSubmissions.map((s) => (
                <div key={s.id} className="px-6 py-3.5 flex items-center gap-3">
                  <span className="text-lg">
                    {s.status === "correct" ? "✅" : s.status === "partially_correct" ? "⚠️" : "❌"}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-slate-900 truncate">{s.exerciseTitle}</div>
                    <div className="text-xs text-slate-400">
                      {new Date(s.createdAt).toLocaleDateString("fr-FR")}
                    </div>
                  </div>
                  <div className="text-sm font-bold text-slate-700">
                    {s.score.toFixed(1)} / {s.maxScore}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Settings / GDPR quick link */}
      <div className="bg-white border border-slate-100 rounded-2xl p-6 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="font-bold text-slate-900 mb-1">🛡️ Paramètres de suivi &amp; RGPD</div>
          <div className="text-sm text-slate-500">
            Gérez les résumés par e-mail, le compte de {childName} et la conservation des photos.
          </div>
        </div>
        <Link
          href="/parent/settings"
          className="text-center text-sm font-semibold bg-indigo-50 text-indigo-700 px-4 py-2.5 rounded-xl hover:bg-indigo-100 transition-colors"
        >
          Ouvrir les paramètres →
        </Link>
      </div>
    </ParentShell>
  );
}
