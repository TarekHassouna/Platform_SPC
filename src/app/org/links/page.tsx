"use client";
import { useMemo, useState } from "react";
import { useOrgStore } from "@/lib/org-store";
import { OrgShell } from "@/components/OrgShell";

const inputCls =
  "w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 bg-white outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100";

export default function OrgLinksPage() {
  const {
    users,
    parentLinks,
    loading,
    error,
    reloadAll,
    reviewParentLink,
    createParentLink,
  } = useOrgStore();

  const [selectedParentId, setSelectedParentId] = useState("");
  const [selectedStudentId, setSelectedStudentId] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "pending" | "linked" | "rejected">("all");
  const [creating, setCreating] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 4000);
  };

  const parents = useMemo(() => users.filter((u) => u.role === "parent"), [users]);
  const students = useMemo(() => users.filter((u) => u.role === "student"), [users]);

  const filteredLinks = useMemo(() => {
    return parentLinks.filter((l) => {
      if (statusFilter === "pending") {
        return l.status === "pending_admin" || l.status === "pending";
      }
      if (statusFilter === "linked") return l.status === "linked";
      if (statusFilter === "rejected") return l.status === "rejected" || l.status === "revoked";
      return true;
    });
  }, [parentLinks, statusFilter]);

  const handleManualCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedParentId || !selectedStudentId) return;
    setCreating(true);
    const res = await createParentLink(selectedParentId, selectedStudentId);
    setCreating(false);
    if (!res.ok) {
      showToast(`⚠️ ${res.error || "Impossible de créer cette liaison."}`);
      return;
    }
    showToast("✅ Liaison Parent ↔ Élève créée et validée !");
    setSelectedParentId("");
    setSelectedStudentId("");
  };

  const handleAction = async (
    linkId: string,
    action: "approve" | "reject" | "delete",
    label: string
  ) => {
    setBusyId(linkId);
    const res = await reviewParentLink(linkId, action);
    setBusyId(null);
    if (!res.ok) {
      showToast(`⚠️ ${res.error || "Erreur"}`);
      return;
    }
    showToast(
      action === "approve"
        ? `✅ Liaison validée : ${label}`
        : action === "reject"
        ? `❌ Liaison refusée : ${label}`
        : `🗑️ Liaison supprimée : ${label}`
    );
  };

  const pendingCount = parentLinks.filter(
    (l) => l.status === "pending_admin" || l.status === "pending"
  ).length;
  const linkedCount = parentLinks.filter((l) => l.status === "linked").length;

  return (
    <OrgShell>
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 text-white text-sm font-medium px-5 py-3 rounded-2xl shadow-xl">
          {toast}
        </div>
      )}

      <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900">
            👨‍👩‍👧 Liaisons Parent ↔ Élève
          </h1>
          <p className="text-slate-500 mt-1 text-sm">
            Aucun parent ne peut consulter les données d&apos;un élève sans votre accord explicite.
          </p>
        </div>
        <button
          type="button"
          onClick={() => reloadAll()}
          className="border border-slate-200 bg-white text-slate-700 font-semibold px-4 py-2.5 rounded-xl hover:border-indigo-300 text-xs self-start"
        >
          🔄 Actualiser
        </button>
      </div>

      {error && (
        <div className="mb-5 bg-rose-50 border border-rose-200 text-rose-800 rounded-2xl p-4 text-xs font-semibold">
          ⚠️ {error}
        </div>
      )}

      {/* Manual Admin Link Creation */}
      <form
        onSubmit={handleManualCreate}
        className="bg-white rounded-3xl border border-indigo-200 p-6 mb-7 shadow-sm space-y-4"
      >
        <div>
          <h2 className="font-extrabold text-slate-900 text-base">
            🔗 Lier manuellement un Parent à un Élève
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Créez directement une liaison validée entre un compte parent et un compte élève existants.
          </p>
        </div>
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Compte Parent ({parents.length})
            </label>
            <select
              required
              value={selectedParentId}
              onChange={(e) => setSelectedParentId(e.target.value)}
              className={inputCls}
            >
              <option value="">Choisir un parent…</option>
              {parents.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.firstName} {p.lastName} ({p.email})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Compte Élève ({students.length})
            </label>
            <select
              required
              value={selectedStudentId}
              onChange={(e) => setSelectedStudentId(e.target.value)}
              className={inputCls}
            >
              <option value="">Choisir un élève…</option>
              {students.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.firstName} {s.lastName} — {s.level || "Lycée"} ({s.email})
                </option>
              ))}
            </select>
          </div>
        </div>
        <button
          type="submit"
          disabled={creating || !selectedParentId || !selectedStudentId}
          className="bg-indigo-600 text-white font-bold px-5 py-2.5 rounded-xl text-xs hover:bg-indigo-700 disabled:opacity-50"
        >
          {creating ? "Création…" : "✅ Créer et valider la liaison"}
        </button>
      </form>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 flex-wrap mb-4">
        {[
          { id: "all" as const, label: `Toutes (${parentLinks.length})` },
          { id: "pending" as const, label: `⏳ En attente (${pendingCount})` },
          { id: "linked" as const, label: `✅ Validées (${linkedCount})` },
          { id: "rejected" as const, label: "❌ Refusées" },
        ].map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setStatusFilter(t.id)}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
              statusFilter === t.id
                ? "bg-slate-900 text-white"
                : "bg-white border border-slate-200 text-slate-600 hover:border-indigo-300"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Links List */}
      <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-10 text-center text-xs text-slate-400">Chargement des liaisons…</div>
        ) : filteredLinks.length === 0 ? (
          <div className="p-10 text-center text-xs text-slate-500">
            Aucune liaison dans cette catégorie.
          </div>
        ) : (
          <div className="divide-y divide-slate-50">
            {filteredLinks.map((l) => {
              const isPending = l.status === "pending_admin" || l.status === "pending";
              const isLinked = l.status === "linked";
              const pairLabel = `${l.parentName} ↔ ${l.studentName}`;
              return (
                <div
                  key={l.id}
                  className="px-6 py-4 flex flex-col lg:flex-row lg:items-center justify-between gap-3"
                >
                  <div className="min-w-0 space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-bold text-violet-800">
                        👪 {l.parentName}
                      </span>
                      <span className="text-xs text-slate-400">({l.parentEmail})</span>
                      <span className="text-xs font-bold text-slate-400">→</span>
                      <span className="text-sm font-bold text-slate-900">
                        🎓 {l.studentName}
                      </span>
                      <span className="text-xs text-slate-500">({l.studentEmail})</span>
                      <span
                        className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full ${
                          isLinked
                            ? "bg-emerald-100 text-emerald-700"
                            : isPending
                            ? "bg-amber-100 text-amber-800"
                            : "bg-rose-100 text-rose-700"
                        }`}
                      >
                        {isLinked
                          ? "✅ Validée"
                          : isPending
                          ? "⏳ En attente"
                          : "❌ Refusée"}
                      </span>
                    </div>
                    <div className="text-xs text-slate-400 flex items-center gap-2 flex-wrap">
                      <span>Niveau : {l.studentLevel}</span>
                      <span>·</span>
                      <span>Demandé le {new Date(l.createdAt).toLocaleDateString("fr-FR")}</span>
                      {!l.studentAccountExists && (
                        <span className="text-[11px] font-semibold bg-amber-50 text-amber-800 border border-amber-200 px-2 py-0.5 rounded-lg">
                          ⚠️ Aucun compte élève trouvé pour cet e-mail
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap shrink-0">
                    {!isLinked && (
                      <button
                        type="button"
                        disabled={busyId === l.id || !l.studentAccountExists}
                        onClick={() => handleAction(l.id, "approve", pairLabel)}
                        className="bg-emerald-600 text-white text-xs font-bold px-3.5 py-1.5 rounded-xl hover:bg-emerald-700 disabled:opacity-40"
                      >
                        ✅ Accepter
                      </button>
                    )}
                    {l.status !== "rejected" && (
                      <button
                        type="button"
                        disabled={busyId === l.id}
                        onClick={() => handleAction(l.id, "reject", pairLabel)}
                        className="border border-amber-200 bg-amber-50 text-amber-800 text-xs font-bold px-3 py-1.5 rounded-xl hover:bg-amber-100 disabled:opacity-50"
                      >
                        {isLinked ? "⛔ Révoquer" : "❌ Refuser"}
                      </button>
                    )}
                    <button
                      type="button"
                      disabled={busyId === l.id}
                      onClick={() => handleAction(l.id, "delete", pairLabel)}
                      className="border border-rose-200 text-rose-600 text-xs font-bold px-3 py-1.5 rounded-xl hover:bg-rose-50 disabled:opacity-50"
                    >
                      🗑️ Supprimer
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </OrgShell>
  );
}
