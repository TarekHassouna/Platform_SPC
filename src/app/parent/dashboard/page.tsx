"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { ParentShell } from "@/components/ParentShell";
import {
  fetchParentChildrenDashboards,
  linkParentToChild,
  type ParentChildSnapshot,
} from "@/lib/db";
import { openPrintableParentReport } from "@/lib/parent-report";

export default function ParentDashboard() {
  const { user } = useAuth();
  const [childrenList, setChildrenList] = useState<ParentChildSnapshot[]>([]);
  const [selectedLinkId, setSelectedLinkId] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [hwTab, setHwTab] = useState<"todo" | "done">("todo");

  // Link child by email form
  const [showLinkForm, setShowLinkForm] = useState(false);
  const [linkEmail, setLinkEmail] = useState("");
  const [linkName, setLinkName] = useState("");
  const [linkLevel, setLinkLevel] = useState("Terminale");
  const [linking, setLinking] = useState(false);
  const [linkMsg, setLinkMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const loadChildren = useCallback(async () => {
    if (!user?.id) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const list = await fetchParentChildrenDashboards(user.id);
    setChildrenList(list);
    if (list.length > 0) {
      setSelectedLinkId((prev) =>
        list.some((c) => c.linkId === prev) ? prev : list[0].linkId
      );
    }
    setLoading(false);
  }, [user?.id]);

  useEffect(() => {
    loadChildren();
  }, [loadChildren]);

  const activeChild =
    childrenList.find((c) => c.linkId === selectedLinkId) || childrenList[0] || null;

  // Build unified REAL mastery per exercise/chapter from child's submissions + evaluated concept_mastery
  const realSkills = useMemo(() => {
    if (!activeChild) return [];
    const byEx = new Map<string, { label: string; sumPct: number; count: number }>();
    activeChild.recentSubmissions.forEach((s) => {
      const pct = s.maxScore > 0 ? Math.round((s.score / s.maxScore) * 100) : 0;
      const prev = byEx.get(s.exerciseTitle);
      if (!prev) {
        byEx.set(s.exerciseTitle, { label: s.exerciseTitle, sumPct: pct, count: 1 });
      } else {
        prev.sumPct += pct;
        prev.count += 1;
      }
    });

    const items: {
      key: string;
      label: string;
      score: number;
      attempts: number;
      status: "acquired" | "developing" | "needs_review";
    }[] = [];

    byEx.forEach((v) => {
      const avg = Math.round(v.sumPct / v.count);
      items.push({
        key: `ex-${v.label}`,
        label: v.label,
        score: avg,
        attempts: v.count,
        status: avg >= 80 ? "acquired" : avg >= 45 ? "developing" : "needs_review",
      });
    });

    activeChild.mastery
      .filter((m) => m.attempts > 0)
      .forEach((m) => {
        items.push({
          key: `c-${m.conceptCode}`,
          label: m.conceptLabel,
          score: m.masteryScore,
          attempts: m.attempts,
          status:
            m.status === "acquired"
              ? "acquired"
              : m.status === "developing"
              ? "developing"
              : "needs_review",
        });
      });

    return items.sort((a, b) => a.score - b.score);
  }, [activeChild]);

  const handleLinkChild = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!linkEmail.trim()) return;
    setLinking(true);
    setLinkMsg(null);
    const res = await linkParentToChild({
      childEmail: linkEmail.trim(),
      childName: linkName.trim() || undefined,
      childLevel: linkLevel,
    });
    setLinking(false);
    if (!res.ok) {
      setLinkMsg({ ok: false, text: res.error || "Impossible de rattacher cet enfant." });
      return;
    }
    setLinkMsg({
      ok: true,
      text: res.linked
        ? `✅ Le compte de ${res.childName || linkEmail} est déjà lié et validé.`
        : `⏳ Demande de liaison envoyée à l'administrateur pour ${linkEmail}. Vous aurez accès aux résultats dès sa validation.`,
    });
    setLinkEmail("");
    setLinkName("");
    setShowLinkForm(false);
    await loadChildren();
  };

  const acquiredCount = realSkills.filter((s) => s.status === "acquired").length;
  const subCount = activeChild?.recentSubmissions.length || 0;
  const avgPrecision = subCount
    ? Math.round(
        ((activeChild?.recentSubmissions.reduce(
          (acc, s) => acc + (s.maxScore > 0 ? s.score / s.maxScore : 0),
          0
        ) || 0) /
          subCount) *
          100
      )
    : 0;
  const weakest = realSkills[0];

  const todoAssignments = (activeChild?.assignments || []).filter((a) => !a.completed);
  const doneAssignments = (activeChild?.assignments || []).filter((a) => a.completed);
  const visibleAssignments = hwTab === "todo" ? todoAssignments : doneAssignments;

  return (
    <ParentShell>
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900">
            Bonjour {user?.firstName || "Parent"} 👋
          </h1>
          <p className="text-slate-500 mt-1 text-sm">
            {activeChild
              ? `Suivi réel en Physique-Chimie de ${activeChild.childName}.`
              : "Rattachez le compte élève de votre enfant pour suivre ses devoirs et ses progrès."}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {activeChild?.linked && (
            <button
              type="button"
              onClick={() =>
                openPrintableParentReport({
                  parentName: `${user?.firstName || ""} ${user?.lastName || ""}`.trim() || "Parent",
                  parentEmail: user?.email || "",
                  children: [activeChild],
                })
              }
              className="text-xs font-bold border border-indigo-200 bg-indigo-50 text-indigo-700 px-3.5 py-2.5 rounded-xl hover:bg-indigo-100"
            >
              🖨️ Bilan PDF
            </button>
          )}
          <button
            type="button"
            onClick={() => loadChildren()}
            className="text-xs font-semibold border border-slate-200 bg-white text-slate-600 px-3.5 py-2.5 rounded-xl hover:border-indigo-300"
          >
            🔄 Actualiser
          </button>
          <button
            type="button"
            onClick={() => {
              setShowLinkForm((v) => !v);
              setLinkMsg(null);
            }}
            className="text-xs font-bold bg-indigo-600 text-white px-4 py-2.5 rounded-xl hover:bg-indigo-700 shadow-sm"
          >
            {showLinkForm ? "Fermer" : "+ Rattacher un enfant"}
          </button>
        </div>
      </div>

      {linkMsg && (
        <div
          className={`mb-5 rounded-2xl px-4 py-3 text-xs font-semibold border ${
            linkMsg.ok
              ? "bg-emerald-50 border-emerald-200 text-emerald-800"
              : "bg-rose-50 border-rose-200 text-rose-700"
          }`}
        >
          {linkMsg.text}
        </div>
      )}

      {/* Link Child by Email Form (auto-open if no children linked yet) */}
      {(showLinkForm || (!loading && childrenList.length === 0)) && (
        <form
          onSubmit={handleLinkChild}
          className="mb-7 bg-white rounded-3xl border border-indigo-200 p-6 shadow-sm space-y-4"
        >
          <div>
            <h2 className="font-extrabold text-slate-900 text-base">
              🔗 Demander le rattachement d&apos;un élève
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Indiquez l&apos;adresse e-mail du compte élève de votre enfant : votre demande sera transmise à <strong>l&apos;administrateur</strong> pour validation avant l&apos;ouverture de l&apos;accès.
            </p>
          </div>
          <div className="grid sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                E-mail du compte élève *
              </label>
              <input
                type="email"
                required
                value={linkEmail}
                onChange={(e) => setLinkEmail(e.target.value)}
                placeholder="ex : prenom.nom@gmail.com"
                className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-900 bg-white placeholder:text-slate-400 outline-none focus:border-indigo-400"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Prénom (optionnel)
              </label>
              <input
                type="text"
                value={linkName}
                onChange={(e) => setLinkName(e.target.value)}
                placeholder="ex : Sami"
                className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-900 bg-white placeholder:text-slate-400 outline-none focus:border-indigo-400"
              />
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <label className="text-xs font-semibold text-slate-600">Niveau :</label>
              <select
                value={linkLevel}
                onChange={(e) => setLinkLevel(e.target.value)}
                className="border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-semibold text-slate-800 bg-white"
              >
                <option value="Seconde">Seconde</option>
                <option value="Première">Première</option>
                <option value="Terminale">Terminale</option>
              </select>
            </div>
            <button
              type="submit"
              disabled={linking}
              className="bg-indigo-600 text-white font-bold text-xs px-5 py-2.5 rounded-xl hover:bg-indigo-700 disabled:opacity-60"
            >
              {linking ? "⏳ Envoi en cours…" : "📩 Demander la liaison à l'admin"}
            </button>
          </div>
        </form>
      )}

      {/* Multi-child tabs */}
      {childrenList.length > 1 && (
        <div className="flex items-center gap-2 flex-wrap mb-5">
          {childrenList.map((ch) => (
            <button
              key={ch.linkId}
              type="button"
              onClick={() => setSelectedLinkId(ch.linkId)}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                activeChild?.linkId === ch.linkId
                  ? "bg-indigo-600 text-white shadow-sm"
                  : "bg-white text-slate-600 border border-slate-200 hover:border-indigo-300"
              }`}
            >
              {ch.childName} {ch.linked ? "●" : "⏳"}
            </button>
          ))}
        </div>
      )}

      {loading ? (
        <div className="bg-white rounded-3xl border border-slate-100 p-10 text-center text-sm text-slate-400">
          Chargement du suivi de votre enfant…
        </div>
      ) : activeChild ? (
        <>
          {/* Active Child Hero Card */}
          <div className="bg-gradient-to-br from-indigo-600 to-violet-700 text-white rounded-3xl p-6 mb-7 flex flex-col sm:flex-row sm:items-center gap-5 shadow-xl shadow-indigo-100">
            <div className="w-16 h-16 rounded-2xl bg-white/20 flex items-center justify-center text-3xl font-extrabold shrink-0">
              {(activeChild.childName[0] || "E").toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2.5 flex-wrap">
                <span className="text-xl font-extrabold">{activeChild.childName}</span>
                <span
                  className={`text-xs font-bold px-2.5 py-0.5 rounded-full ${
                    activeChild.linked
                      ? "bg-emerald-400/25 text-emerald-100"
                      : activeChild.status === "rejected"
                      ? "bg-rose-400/30 text-rose-100"
                      : "bg-amber-400/25 text-amber-100"
                  }`}
                >
                  {activeChild.linked
                    ? "● Liaison validée"
                    : activeChild.status === "rejected"
                    ? "❌ Demande refusée par l'admin"
                    : "⏳ En attente de validation admin"}
                </span>
              </div>
              <div className="text-indigo-200 text-sm mt-0.5 flex flex-wrap gap-2 items-center">
                <span>{activeChild.childLevel} · Physique-Chimie</span>
                {activeChild.childEmail && <span>· {activeChild.childEmail}</span>}
                {activeChild.linked && activeChild.enrolledClasses.length > 0 && (
                  <span className="bg-white/15 text-white text-xs font-semibold px-2.5 py-0.5 rounded-full">
                    🏫 {activeChild.enrolledClasses.map((c) => c.name).join(", ")}
                  </span>
                )}
              </div>
              {activeChild.linked && (
                <div className="mt-3 flex items-center gap-2.5 flex-wrap">
                  <span className="bg-white/20 text-white text-xs font-semibold px-3 py-1 rounded-full">
                    📝 {subCount} exercice(s) soumis
                  </span>
                  <span className="bg-white/20 text-white text-xs font-semibold px-3 py-1 rounded-full">
                    ✅ {acquiredCount} / {realSkills.length} acquis
                  </span>
                  <span className="bg-white/20 text-white text-xs font-semibold px-3 py-1 rounded-full">
                    🎯 {subCount > 0 ? `${avgPrecision}% de réussite` : "En attente d'activité"}
                  </span>
                  {activeChild.assignments.length > 0 && (
                    <span className="bg-white/20 text-white text-xs font-semibold px-3 py-1 rounded-full">
                      📌 {todoAssignments.length} devoir(s) restant(s)
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>

          {!activeChild.linked && (
            <div
              className={`mb-7 rounded-2xl p-5 text-sm space-y-2 border ${
                activeChild.status === "rejected"
                  ? "bg-rose-50 border-rose-200 text-rose-900"
                  : "bg-amber-50 border-amber-200 text-amber-900"
              }`}
            >
              {activeChild.status === "rejected" ? (
                <>
                  <div>
                    <strong>❌ Liaison refusée par l&apos;administrateur :</strong> la demande pour{" "}
                    <code className="font-mono bg-white px-1.5 py-0.5 rounded">
                      {activeChild.childEmail || "non renseignée"}
                    </code>{" "}
                    n&apos;a pas été approuvée.
                  </div>
                  <p className="text-xs text-rose-800">
                    Vérifiez l&apos;adresse e-mail de votre enfant ou contactez l&apos;administration de l&apos;établissement.
                  </p>
                </>
              ) : (
                <>
                  <div>
                    <strong>⏳ En attente de validation par l&apos;administrateur :</strong> votre demande de liaison avec{" "}
                    <code className="font-mono bg-white px-1.5 py-0.5 rounded">
                      {activeChild.childEmail || "non renseignée"}
                    </code>{" "}
                    a bien été enregistrée.
                  </div>
                  <p className="text-xs text-amber-800">
                    Pour la sécurité des élèves, aucun résultat n&apos;est affiché tant que l&apos;administrateur n&apos;a pas vérifié et accepté cette liaison. Cliquez sur <strong>« 🔄 Actualiser »</strong> après validation.
                  </p>
                </>
              )}
            </div>
          )}

          {/* Class Homeworks (Read-Only for Parent: À faire vs Déjà faits) */}
          {activeChild.linked && activeChild.assignments.length > 0 && (
            <div className="bg-white border border-slate-100 rounded-3xl p-6 shadow-sm mb-7">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
                <div>
                  <h2 className="font-extrabold text-slate-900 text-base">
                    📌 Devoirs donnés par l&apos;enseignant
                  </h2>
                  <p className="text-xs text-slate-400">
                    Vérifiez en un coup d&apos;œil les devoirs encore à faire et les notes déjà obtenues
                  </p>
                </div>
                <div className="inline-flex bg-slate-100 p-1 rounded-xl self-start sm:self-auto">
                  <button
                    type="button"
                    onClick={() => setHwTab("todo")}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                      hwTab === "todo"
                        ? "bg-indigo-600 text-white"
                        : "text-slate-600 hover:text-indigo-700"
                    }`}
                  >
                    ⏳ À faire ({todoAssignments.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setHwTab("done")}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                      hwTab === "done"
                        ? "bg-emerald-600 text-white"
                        : "text-slate-600 hover:text-emerald-700"
                    }`}
                  >
                    ✅ Déjà faits ({doneAssignments.length})
                  </button>
                </div>
              </div>

              {visibleAssignments.length === 0 ? (
                <div className="bg-slate-50 rounded-2xl p-4 text-center text-xs font-semibold text-slate-500">
                  {hwTab === "todo"
                    ? `🎉 ${activeChild.childName} est à jour sur tous ses devoirs !`
                    : "Aucun devoir encore rendu pour le moment."}
                </div>
              ) : (
                <div className="grid sm:grid-cols-2 gap-3 max-h-60 overflow-y-auto pr-1">
                  {visibleAssignments.map((a) => {
                    const pct =
                      a.bestScore !== undefined && a.maxScore
                        ? Math.round((a.bestScore / a.maxScore) * 100)
                        : null;
                    return (
                      <div
                        key={a.id}
                        className={`rounded-2xl p-4 border flex items-center justify-between gap-3 ${
                          a.completed
                            ? "bg-emerald-50/50 border-emerald-200"
                            : "bg-slate-50 border-slate-200"
                        }`}
                      >
                        <div className="min-w-0">
                          <div className="text-[11px] font-bold text-indigo-600">
                            {a.className} · {a.submissionType === "photo_copy" ? "📸 Copie papier" : a.mode}
                          </div>
                          <div className="text-sm font-bold text-slate-900 truncate mt-0.5">{a.title}</div>
                        </div>
                        {a.completed && pct !== null ? (
                          <span className="text-xs font-extrabold bg-emerald-100 text-emerald-800 px-2.5 py-1 rounded-xl shrink-0">
                            {a.bestScore?.toFixed(1)}/{a.maxScore} ({pct}%)
                          </span>
                        ) : (
                          <span className="text-[11px] font-bold bg-amber-100 text-amber-800 px-2.5 py-1 rounded-xl shrink-0">
                            ⏳ À faire
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Mastery + Recent Submissions (only visible once approved by Admin) */}
          {activeChild.linked && (
          <div className="grid lg:grid-cols-2 gap-6 mb-7">
            {/* Real Mastery */}
            <div className="bg-white border border-slate-100 rounded-3xl p-6 shadow-sm">
              <h2 className="font-bold text-slate-900 mb-4">📊 Maîtrise par exercice &amp; chapitre</h2>
              {realSkills.length === 0 ? (
                <p className="text-xs text-slate-400">
                  Aucun exercice évalué pour le moment. Les scores réels apparaîtront ici dès que {activeChild.childName} soumettra un exercice ou une copie.
                </p>
              ) : (
                <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
                  {realSkills.map((s) => (
                    <div key={s.key}>
                      <div className="flex justify-between text-xs mb-1 gap-2">
                        <span className="text-slate-700 font-semibold truncate">{s.label}</span>
                        <span
                          className={`font-bold shrink-0 ${
                            s.status === "acquired"
                              ? "text-emerald-600"
                              : s.status === "developing"
                              ? "text-amber-600"
                              : "text-rose-600"
                          }`}
                        >
                          {s.score}% ({s.attempts} ess.)
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
                          style={{ width: `${s.score}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {weakest && weakest.score < 60 && (
                <div className="mt-4 p-3 bg-rose-50 rounded-xl border border-rose-100 text-xs text-rose-700">
                  ⚠️ <strong>Point à renforcer :</strong> {weakest.label} ({weakest.score}%).
                </div>
              )}
            </div>

            {/* Real Recent Submissions */}
            <div className="bg-white border border-slate-100 rounded-3xl shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-100">
                <h2 className="font-bold text-slate-900">🕒 Derniers exercices &amp; notes</h2>
              </div>
              {activeChild.recentSubmissions.length === 0 ? (
                <div className="p-6 text-xs text-slate-400">
                  Aucun exercice soumis pour l&apos;instant.
                </div>
              ) : (
                <div className="divide-y divide-slate-50 max-h-80 overflow-y-auto">
                  {activeChild.recentSubmissions.map((s) => {
                    const pct = s.maxScore > 0 ? Math.round((s.score / s.maxScore) * 100) : 0;
                    return (
                      <div key={s.id} className="px-6 py-3.5 flex items-center gap-3">
                        <span className="text-lg">
                          {pct >= 80 ? "✅" : pct >= 45 ? "⚠️" : "❌"}
                        </span>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-semibold text-slate-900 truncate">
                            {s.exerciseTitle}
                          </div>
                          <div className="text-xs text-slate-400 truncate">
                            {new Date(s.createdAt).toLocaleString("fr-FR")}
                            {s.errorSummary && (
                              <span className="ml-1.5 text-slate-600">· {s.errorSummary}</span>
                            )}
                          </div>
                        </div>
                        <div className="text-xs font-extrabold text-slate-800 whitespace-nowrap">
                          {s.score.toFixed(1)} / {s.maxScore} ({pct}%)
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
          )}
        </>
      ) : null}

      {/* Settings / GDPR quick link */}
      <div className="bg-white border border-slate-100 rounded-2xl p-6 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="font-bold text-slate-900 mb-1">🛡️ Confidentialité &amp; gestion des enfants</div>
          <div className="text-xs text-slate-500">
            Les discussions privées avec le Tuteur IA restent confidentielles pour l&apos;élève. Gérez les comptes rattachés et vos données dans les paramètres.
          </div>
        </div>
        <Link
          href="/parent/settings"
          className="text-center text-xs font-bold bg-indigo-50 text-indigo-700 px-4 py-2.5 rounded-xl hover:bg-indigo-100 transition-colors whitespace-nowrap"
        >
          Ouvrir les paramètres →
        </Link>
      </div>
    </ParentShell>
  );
}
