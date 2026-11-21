"use client";
import { useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { useOrgStore } from "@/lib/org-store";
import { OrgShell } from "@/components/OrgShell";

const ROLE_BADGE: Record<string, { label: string; cls: string }> = {
  student: { label: "🎓 Élève", cls: "bg-emerald-50 text-emerald-700" },
  teacher: { label: "👨‍🏫 Enseignant / Tuteur", cls: "bg-indigo-50 text-indigo-700" },
  parent: { label: "👪 Parent", cls: "bg-violet-50 text-violet-700" },
  org_admin: { label: "🏛️ Admin", cls: "bg-slate-100 text-slate-700" },
  platform_admin: { label: "🏛️ Admin", cls: "bg-slate-100 text-slate-700" },
};

export default function OrgDashboardPage() {
  const { user } = useAuth();
  const {
    orgName,
    orgInviteCode,
    users,
    parentLinks,
    loading,
    error,
    pendingUsersCount,
    pendingLinksCount,
    studentsCount,
    teachersCount,
    parentsCount,
    reloadAll,
    approveUser,
    rejectUser,
    reviewParentLink,
  } = useOrgStore();

  const [busyId, setBusyId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3500);
  };

  const pendingUsers = users.filter((u) => u.accountStatus === "pending");
  const pendingLinks = parentLinks.filter(
    (l) => l.status === "pending_admin" || l.status === "pending"
  );
  const approvedLinksCount = parentLinks.filter((l) => l.status === "linked").length;
  const schoolTitle = user?.school || orgName;

  const handleUserAction = async (userId: string, name: string, action: "approve" | "reject") => {
    setBusyId(userId);
    const res = action === "approve" ? await approveUser(userId) : await rejectUser(userId);
    setBusyId(null);
    if (!res.ok) {
      showToast(`⚠️ ${res.error || "Erreur"}`);
    } else {
      showToast(
        action === "approve"
          ? `✅ Compte de ${name} accepté et activé !`
          : `❌ Compte de ${name} refusé.`
      );
    }
  };

  const handleLinkAction = async (
    linkId: string,
    parentName: string,
    studentName: string,
    action: "approve" | "reject"
  ) => {
    setBusyId(linkId);
    const res = await reviewParentLink(linkId, action);
    setBusyId(null);
    if (!res.ok) {
      showToast(`⚠️ ${res.error || "Action impossible."}`);
    } else {
      showToast(
        action === "approve"
          ? `✅ Liaison validée : ${parentName} ↔ ${studentName}`
          : `❌ Demande de liaison refusée (${parentName}).`
      );
    }
  };

  return (
    <OrgShell>
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 text-white text-sm font-medium px-5 py-3 rounded-2xl shadow-xl">
          {toast}
        </div>
      )}

      <div className="mb-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900">🏛️ {schoolTitle}</h1>
          <p className="text-slate-500 mt-1 text-sm">
            Administration de la plateforme · Bonjour {user?.firstName || "Admin"}
            {orgInviteCode && (
              <span className="ml-2 font-mono text-xs bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-md">
                Code : {orgInviteCode}
              </span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            type="button"
            onClick={() => reloadAll()}
            className="bg-white border border-slate-200 text-slate-700 font-semibold px-4 py-2.5 rounded-xl hover:border-indigo-300 text-xs"
          >
            🔄 Actualiser
          </button>
          <Link
            href="/org/links"
            className="bg-white border border-slate-200 text-slate-700 font-semibold px-4 py-2.5 rounded-xl hover:border-indigo-300 text-xs"
          >
            👨‍👩‍👧 Liaisons Parents
          </Link>
          <Link
            href="/org/users?create=1"
            className="bg-indigo-600 text-white font-bold px-4 py-2.5 rounded-xl hover:bg-indigo-700 shadow-lg shadow-indigo-100 text-xs"
          >
            + Créer un compte
          </Link>
        </div>
      </div>

      {error && (
        <div className="mb-6 bg-rose-50 border border-rose-200 text-rose-800 rounded-2xl p-4 text-xs font-semibold">
          ⚠️ Impossible de charger les données d&apos;administration : {error}
        </div>
      )}

      {/* Live KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {[
          {
            label: "Validations en attente",
            value: String(pendingUsersCount + pendingLinksCount),
            sub: `${pendingUsersCount} compte(s) · ${pendingLinksCount} liaison(s)`,
            icon: "⏳",
            color: pendingUsersCount + pendingLinksCount > 0 ? "text-amber-700" : "text-emerald-600",
            bg: pendingUsersCount + pendingLinksCount > 0 ? "bg-amber-50" : "bg-emerald-50",
          },
          {
            label: "Élèves",
            value: String(studentsCount),
            sub: `${users.filter((u) => u.role === "student" && u.accountStatus === "approved").length} validé(s)`,
            icon: "🎓",
            color: "text-emerald-600",
            bg: "bg-emerald-50",
          },
          {
            label: "Enseignants / Tuteurs",
            value: String(teachersCount),
            sub: `${users.filter((u) => u.role === "teacher" && u.accountStatus === "approved").length} validé(s)`,
            icon: "👨‍🏫",
            color: "text-indigo-600",
            bg: "bg-indigo-50",
          },
          {
            label: "Parents & Liaisons",
            value: String(parentsCount),
            sub: `${approvedLinksCount} liaison(s) active(s)`,
            icon: "👪",
            color: "text-violet-600",
            bg: "bg-violet-50",
          },
        ].map((k) => (
          <div key={k.label} className={`${k.bg} rounded-2xl p-5 border border-white shadow-xs`}>
            <div className="text-2xl mb-2">{k.icon}</div>
            <div className={`text-2xl font-extrabold ${k.color}`}>{loading ? "…" : k.value}</div>
            <div className="text-xs font-semibold text-slate-700 mt-1">{k.label}</div>
            <div className="text-[11px] text-slate-500">{k.sub}</div>
          </div>
        ))}
      </div>

      {/* Pending Account Approvals Queue */}
      <div className="grid lg:grid-cols-2 gap-6 mb-8">
        <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between gap-2">
            <div>
              <h2 className="font-bold text-slate-900">
                ⏳ Comptes en attente de validation ({pendingUsers.length})
              </h2>
              <p className="text-xs text-slate-400">
                Nouvelles inscriptions Élèves, Enseignants et Parents
              </p>
            </div>
            <Link href="/org/users" className="text-xs font-bold text-indigo-600 hover:underline">
              Tout gérer →
            </Link>
          </div>

          {loading ? (
            <div className="p-8 text-center text-xs text-slate-400">Chargement…</div>
          ) : pendingUsers.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-500">
              ✅ Aucune demande de compte en attente.
            </div>
          ) : (
            <div className="divide-y divide-slate-50 max-h-96 overflow-y-auto">
              {pendingUsers.map((u) => {
                const fullName = `${u.firstName} ${u.lastName}`.trim() || u.email;
                const badge = ROLE_BADGE[u.role] || ROLE_BADGE.student;
                return (
                  <div
                    key={u.id}
                    className="px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-bold text-slate-900 truncate">
                          {fullName}
                        </span>
                        <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${badge.cls}`}>
                          {badge.label}
                        </span>
                        {u.level && (
                          <span className="text-[11px] font-semibold bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">
                            {u.level}
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-slate-400 truncate mt-0.5">
                        {u.email} · {new Date(u.createdAt).toLocaleDateString("fr-FR")}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        disabled={busyId === u.id}
                        onClick={() => handleUserAction(u.id, fullName, "approve")}
                        className="bg-emerald-600 text-white text-xs font-bold px-3.5 py-1.5 rounded-xl hover:bg-emerald-700 disabled:opacity-50"
                      >
                        ✅ Accepter
                      </button>
                      <button
                        type="button"
                        disabled={busyId === u.id}
                        onClick={() => handleUserAction(u.id, fullName, "reject")}
                        className="border border-rose-200 text-rose-600 text-xs font-bold px-3 py-1.5 rounded-xl hover:bg-rose-50 disabled:opacity-50"
                      >
                        ❌ Refuser
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Pending Parent <-> Student Links Queue */}
        <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between gap-2">
            <div>
              <h2 className="font-bold text-slate-900">
                👨‍👩‍👧 Demandes de liaison Parent ↔ Élève ({pendingLinks.length})
              </h2>
              <p className="text-xs text-slate-400">
                Un parent ne voit les résultats d&apos;un élève qu&apos;après votre validation
              </p>
            </div>
            <Link href="/org/links" className="text-xs font-bold text-indigo-600 hover:underline">
              Tout gérer →
            </Link>
          </div>

          {loading ? (
            <div className="p-8 text-center text-xs text-slate-400">Chargement…</div>
          ) : pendingLinks.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-500">
              ✅ Aucune demande de liaison parent-élève en attente.
            </div>
          ) : (
            <div className="divide-y divide-slate-50 max-h-96 overflow-y-auto">
              {pendingLinks.map((l) => (
                <div key={l.id} className="px-6 py-4 space-y-2.5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 text-xs space-y-1">
                      <div>
                        <span className="font-bold text-violet-700">👪 {l.parentName}</span>{" "}
                        <span className="text-slate-400">({l.parentEmail})</span>
                      </div>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-slate-400">demande accès à</span>
                        <span className="font-bold text-slate-900">🎓 {l.studentName}</span>
                        <span className="text-slate-500">({l.studentEmail})</span>
                      </div>
                      {!l.studentAccountExists && (
                        <div className="inline-block text-[11px] font-semibold bg-amber-50 text-amber-800 border border-amber-200 px-2 py-0.5 rounded-lg">
                          ⚠️ Aucun compte élève trouvé pour cet e-mail
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={busyId === l.id || !l.studentAccountExists}
                      onClick={() =>
                        handleLinkAction(l.id, l.parentName, l.studentName, "approve")
                      }
                      className="bg-emerald-600 text-white text-xs font-bold px-3.5 py-1.5 rounded-xl hover:bg-emerald-700 disabled:opacity-40"
                    >
                      ✅ Valider la liaison
                    </button>
                    <button
                      type="button"
                      disabled={busyId === l.id}
                      onClick={() =>
                        handleLinkAction(l.id, l.parentName, l.studentName, "reject")
                      }
                      className="border border-rose-200 text-rose-600 text-xs font-bold px-3 py-1.5 rounded-xl hover:bg-rose-50 disabled:opacity-50"
                    >
                      ❌ Refuser
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Quick navigation cards */}
      <div className="grid sm:grid-cols-3 gap-4">
        <Link
          href="/org/users?role=student"
          className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm hover:border-indigo-300 transition-all"
        >
          <div className="text-xl mb-1.5">🎓</div>
          <div className="font-bold text-slate-900 text-sm">Gérer les Élèves</div>
          <div className="text-xs text-slate-500 mt-0.5">
            Créer, modifier, valider ou supprimer les comptes élèves
          </div>
        </Link>
        <Link
          href="/org/users?role=teacher"
          className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm hover:border-indigo-300 transition-all"
        >
          <div className="text-xl mb-1.5">👨‍🏫</div>
          <div className="font-bold text-slate-900 text-sm">Gérer les Enseignants / Tuteurs</div>
          <div className="text-xs text-slate-500 mt-0.5">
            Ajouter, éditer, valider ou retirer un professeur ou tuteur
          </div>
        </Link>
        <Link
          href="/org/users?role=parent"
          className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm hover:border-indigo-300 transition-all"
        >
          <div className="text-xl mb-1.5">👪</div>
          <div className="font-bold text-slate-900 text-sm">Gérer les Parents</div>
          <div className="text-xs text-slate-500 mt-0.5">
            Valider les comptes parents et contrôler leurs accès élèves
          </div>
        </Link>
      </div>
    </OrgShell>
  );
}
