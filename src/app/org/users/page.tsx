"use client";
import { Suspense, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { useOrgStore } from "@/lib/org-store";
import { OrgShell } from "@/components/OrgShell";
import type { AdminUserRecord } from "@/lib/db";

const inputCls =
  "w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 bg-white placeholder:text-slate-400 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100";

const ROLE_META: Record<string, { label: string; icon: string; cls: string }> = {
  student: { label: "Élève", icon: "🎓", cls: "bg-emerald-50 text-emerald-700" },
  teacher: { label: "Enseignant / Tuteur", icon: "👨‍🏫", cls: "bg-indigo-50 text-indigo-700" },
  parent: { label: "Parent", icon: "👪", cls: "bg-violet-50 text-violet-700" },
  org_admin: { label: "Administrateur", icon: "🏛️", cls: "bg-slate-100 text-slate-700" },
  platform_admin: { label: "Administrateur", icon: "🏛️", cls: "bg-slate-100 text-slate-700" },
};

const STATUS_META: Record<string, { label: string; cls: string }> = {
  pending: { label: "⏳ En attente", cls: "bg-amber-100 text-amber-800" },
  approved: { label: "✅ Validé", cls: "bg-emerald-100 text-emerald-700" },
  rejected: { label: "❌ Refusé", cls: "bg-rose-100 text-rose-700" },
};

function OrgUsersContent() {
  const searchParams = useSearchParams();
  const initialRole = searchParams.get("role") || "all";
  const initialCreate = searchParams.get("create") === "1";

  const { user: currentUser } = useAuth();
  const {
    users,
    loading,
    error,
    reloadAll,
    createUser,
    updateUser,
    approveUser,
    rejectUser,
    deleteUser,
  } = useOrgStore();

  const [roleFilter, setRoleFilter] = useState<string>(initialRole);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [toast, setToast] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  // Create form state
  const [showCreate, setShowCreate] = useState(initialCreate);
  const [creating, setCreating] = useState(false);
  const [createForm, setCreateForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    password: "",
    role: (initialRole === "teacher" || initialRole === "parent" || initialRole === "student"
      ? initialRole
      : "student") as "student" | "teacher" | "parent" | "org_admin",
    level: "Terminale",
  });

  // Edit modal state
  const [editingUser, setEditingUser] = useState<AdminUserRecord | null>(null);
  const [editForm, setEditForm] = useState({
    firstName: "",
    lastName: "",
    role: "student" as "student" | "teacher" | "parent" | "org_admin",
    level: "Terminale",
    accountStatus: "approved" as "pending" | "approved" | "rejected",
  });
  const [savingEdit, setSavingEdit] = useState(false);

  // Delete confirmation state
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 4000);
  };

  const filteredUsers = useMemo(() => {
    const q = search.trim().toLowerCase();
    return users.filter((u) => {
      if (roleFilter !== "all") {
        if (roleFilter === "org_admin") {
          if (u.role !== "org_admin" && u.role !== "platform_admin") return false;
        } else if (u.role !== roleFilter) {
          return false;
        }
      }
      if (statusFilter !== "all" && u.accountStatus !== statusFilter) return false;
      if (q) {
        const hay = `${u.firstName} ${u.lastName} ${u.email} ${u.level || ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [users, roleFilter, statusFilter, search]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (createForm.password.length < 8) {
      showToast("⚠️ Le mot de passe doit contenir au moins 8 caractères.");
      return;
    }
    setCreating(true);
    const res = await createUser({
      firstName: createForm.firstName.trim(),
      lastName: createForm.lastName.trim(),
      email: createForm.email.trim().toLowerCase(),
      password: createForm.password,
      role: createForm.role,
      level: createForm.role === "student" ? createForm.level : undefined,
    });
    setCreating(false);
    if (!res.ok) {
      showToast(`⚠️ ${res.error || "Erreur lors de la création."}`);
      return;
    }
    showToast(
      res.warning
        ? `⚠️ ${res.warning}`
        : `✅ Compte créé et validé pour ${createForm.firstName} ${createForm.lastName} !`
    );
    setCreateForm({
      firstName: "",
      lastName: "",
      email: "",
      password: "",
      role: "student",
      level: "Terminale",
    });
    setShowCreate(false);
  };

  const openEdit = (u: AdminUserRecord) => {
    setEditingUser(u);
    setEditForm({
      firstName: u.firstName,
      lastName: u.lastName,
      role: u.role === "platform_admin" ? "org_admin" : u.role,
      level: u.level || "Terminale",
      accountStatus: u.accountStatus,
    });
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;
    setSavingEdit(true);
    const res = await updateUser({
      userId: editingUser.id,
      firstName: editForm.firstName.trim(),
      lastName: editForm.lastName.trim(),
      role: editForm.role,
      level: editForm.role === "student" ? editForm.level : "",
      accountStatus: editForm.accountStatus,
    });
    setSavingEdit(false);
    if (!res.ok) {
      showToast(`⚠️ ${res.error || "Erreur lors de la modification."}`);
      return;
    }
    showToast(`✅ Compte de ${editForm.firstName} ${editForm.lastName} mis à jour.`);
    setEditingUser(null);
  };

  const handleQuickStatus = async (u: AdminUserRecord, next: "approved" | "rejected") => {
    setBusyId(u.id);
    const res = next === "approved" ? await approveUser(u.id) : await rejectUser(u.id);
    setBusyId(null);
    if (!res.ok) {
      showToast(`⚠️ ${res.error || "Erreur"}`);
    } else {
      showToast(
        next === "approved"
          ? `✅ ${u.firstName} ${u.lastName} accepté !`
          : `❌ ${u.firstName} ${u.lastName} refusé.`
      );
    }
  };

  const handleDelete = async (u: AdminUserRecord) => {
    setBusyId(u.id);
    const res = await deleteUser(u.id);
    setBusyId(null);
    setConfirmDeleteId(null);
    if (!res.ok) {
      showToast(`⚠️ ${res.error || "Suppression impossible."}`);
    } else {
      showToast(`🗑️ Compte de ${u.firstName} ${u.lastName} supprimé.`);
    }
  };

  const counts = {
    all: users.length,
    student: users.filter((u) => u.role === "student").length,
    teacher: users.filter((u) => u.role === "teacher").length,
    parent: users.filter((u) => u.role === "parent").length,
    org_admin: users.filter((u) => u.role === "org_admin" || u.role === "platform_admin").length,
    pending: users.filter((u) => u.accountStatus === "pending").length,
  };

  return (
    <OrgShell>
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 text-white text-sm font-medium px-5 py-3 rounded-2xl shadow-xl">
          {toast}
        </div>
      )}

      {/* Header */}
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900">
            👥 Gestion des utilisateurs (CRUD)
          </h1>
          <p className="text-slate-500 mt-1 text-sm">
            Créez, validez, modifiez ou supprimez les comptes Élèves, Enseignants / Tuteurs et Parents.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => reloadAll()}
            className="border border-slate-200 bg-white text-slate-700 font-semibold px-3.5 py-2.5 rounded-xl hover:border-indigo-300 text-xs"
          >
            🔄 Actualiser
          </button>
          <button
            type="button"
            onClick={() => setShowCreate((v) => !v)}
            className="bg-indigo-600 text-white font-bold px-4 py-2.5 rounded-xl hover:bg-indigo-700 shadow-lg shadow-indigo-100 text-xs"
          >
            {showCreate ? "Fermer" : "➕ Créer un compte"}
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-5 bg-rose-50 border border-rose-200 text-rose-800 rounded-2xl p-4 text-xs font-semibold">
          ⚠️ {error}
        </div>
      )}

      {/* CREATE User Form */}
      {showCreate && (
        <form
          onSubmit={handleCreate}
          className="bg-white rounded-3xl border border-indigo-200 p-6 mb-7 shadow-sm space-y-4"
        >
          <div>
            <h2 className="font-extrabold text-slate-900 text-base">
              ➕ Créer un nouveau compte (validé automatiquement)
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Un compte créé directement par l&apos;administrateur est actif immédiatement.
            </p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Prénom *</label>
              <input
                type="text"
                required
                value={createForm.firstName}
                onChange={(e) => setCreateForm((f) => ({ ...f, firstName: e.target.value }))}
                placeholder="Prénom"
                className={inputCls}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Nom *</label>
              <input
                type="text"
                required
                value={createForm.lastName}
                onChange={(e) => setCreateForm((f) => ({ ...f, lastName: e.target.value }))}
                placeholder="Nom"
                className={inputCls}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Rôle *</label>
              <select
                value={createForm.role}
                onChange={(e) =>
                  setCreateForm((f) => ({
                    ...f,
                    role: e.target.value as "student" | "teacher" | "parent" | "org_admin",
                  }))
                }
                className={inputCls}
              >
                <option value="student">🎓 Élève</option>
                <option value="teacher">👨‍🏫 Enseignant / Tuteur</option>
                <option value="parent">👪 Parent</option>
                <option value="org_admin">🏛️ Administrateur</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Adresse e-mail *</label>
              <input
                type="email"
                required
                value={createForm.email}
                onChange={(e) => setCreateForm((f) => ({ ...f, email: e.target.value }))}
                placeholder="utilisateur@exemple.com"
                className={inputCls}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Mot de passe initial *
              </label>
              <input
                type="text"
                required
                minLength={8}
                value={createForm.password}
                onChange={(e) => setCreateForm((f) => ({ ...f, password: e.target.value }))}
                placeholder="Min. 8 caractères"
                className={inputCls}
              />
            </div>
            {createForm.role === "student" && (
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Niveau</label>
                <select
                  value={createForm.level}
                  onChange={(e) => setCreateForm((f) => ({ ...f, level: e.target.value }))}
                  className={inputCls}
                >
                  <option value="Seconde">Seconde</option>
                  <option value="Première">Première</option>
                  <option value="Terminale">Terminale</option>
                </select>
              </div>
            )}
          </div>
          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={creating}
              className="bg-emerald-600 text-white font-bold px-5 py-2.5 rounded-xl text-xs hover:bg-emerald-700 disabled:opacity-60"
            >
              {creating ? "Création…" : "✅ Créer et activer le compte"}
            </button>
            <button
              type="button"
              onClick={() => setShowCreate(false)}
              className="border border-slate-200 text-slate-600 font-semibold px-4 py-2.5 rounded-xl text-xs hover:bg-slate-50"
            >
              Annuler
            </button>
          </div>
        </form>
      )}

      {/* Filters Bar */}
      <div className="bg-white rounded-3xl border border-slate-100 p-4 mb-6 shadow-sm space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          {[
            { id: "all", label: `Tous (${counts.all})` },
            { id: "student", label: `🎓 Élèves (${counts.student})` },
            { id: "teacher", label: `👨‍🏫 Enseignants / Tuteurs (${counts.teacher})` },
            { id: "parent", label: `👪 Parents (${counts.parent})` },
            { id: "org_admin", label: `🏛️ Admins (${counts.org_admin})` },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setRoleFilter(tab.id)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
                roleFilter === tab.id
                  ? "bg-indigo-600 text-white shadow-xs"
                  : "bg-slate-50 text-slate-600 hover:bg-slate-100"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="🔍 Rechercher par nom, prénom, e-mail ou niveau…"
            className="flex-1 border border-slate-200 rounded-xl px-4 py-2 text-xs text-slate-900 bg-white placeholder:text-slate-400 outline-none focus:border-indigo-400"
          />
          <div className="flex items-center gap-1.5 flex-wrap">
            {[
              { id: "all", label: "Tous statuts" },
              { id: "pending", label: `⏳ En attente (${counts.pending})` },
              { id: "approved", label: "✅ Validés" },
              { id: "rejected", label: "❌ Refusés" },
            ].map((st) => (
              <button
                key={st.id}
                type="button"
                onClick={() => setStatusFilter(st.id)}
                className={`px-3 py-1.5 rounded-xl text-[11px] font-bold transition-all ${
                  statusFilter === st.id
                    ? "bg-slate-900 text-white"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                {st.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Users Table */}
      <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <h2 className="font-bold text-slate-900 text-sm">
            Liste des comptes ({filteredUsers.length})
          </h2>
        </div>

        {loading ? (
          <div className="p-10 text-center text-xs text-slate-400">
            Chargement des comptes…
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="p-10 text-center text-xs text-slate-500">
            Aucun utilisateur ne correspond à ces filtres.
          </div>
        ) : (
          <div className="divide-y divide-slate-50">
            {filteredUsers.map((u) => {
              const roleMeta = ROLE_META[u.role] || ROLE_META.student;
              const statusMeta = STATUS_META[u.accountStatus] || STATUS_META.approved;
              const isSelf = currentUser?.id === u.id;
              const fullName = `${u.firstName} ${u.lastName}`.trim() || u.email;
              return (
                <div
                  key={u.id}
                  className="px-6 py-4 flex flex-col lg:flex-row lg:items-center justify-between gap-3 hover:bg-slate-50/50 transition-colors"
                >
                  <div className="flex items-center gap-3.5 min-w-0">
                    <div className="w-10 h-10 rounded-2xl bg-indigo-50 text-indigo-700 font-bold text-xs flex items-center justify-center uppercase shrink-0">
                      {(u.firstName?.[0] || "U") + (u.lastName?.[0] || "")}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-bold text-slate-900 truncate">
                          {fullName}
                        </span>
                        {isSelf && (
                          <span className="text-[10px] font-bold bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full">
                            Vous
                          </span>
                        )}
                        <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full ${roleMeta.cls}`}>
                          {roleMeta.icon} {roleMeta.label}
                        </span>
                        {u.level && (
                          <span className="text-[11px] font-semibold bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">
                            {u.level}
                          </span>
                        )}
                        <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full ${statusMeta.cls}`}>
                          {statusMeta.label}
                        </span>
                      </div>
                      <div className="text-xs text-slate-400 truncate mt-0.5">
                        {u.email} · Inscrit le {new Date(u.createdAt).toLocaleDateString("fr-FR")}
                      </div>
                    </div>
                  </div>

                  {/* CRUD Action Buttons */}
                  <div className="flex items-center gap-2 flex-wrap shrink-0">
                    {u.accountStatus !== "approved" && (
                      <button
                        type="button"
                        disabled={busyId === u.id}
                        onClick={() => handleQuickStatus(u, "approved")}
                        className="bg-emerald-600 text-white text-xs font-bold px-3 py-1.5 rounded-xl hover:bg-emerald-700 disabled:opacity-50"
                      >
                        ✅ Accepter
                      </button>
                    )}
                    {!isSelf && u.accountStatus !== "rejected" && (
                      <button
                        type="button"
                        disabled={busyId === u.id}
                        onClick={() => handleQuickStatus(u, "rejected")}
                        className="border border-amber-200 text-amber-800 bg-amber-50 text-xs font-bold px-3 py-1.5 rounded-xl hover:bg-amber-100 disabled:opacity-50"
                      >
                        {u.accountStatus === "pending" ? "❌ Refuser" : "⛔ Bloquer"}
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => openEdit(u)}
                      className="border border-slate-200 bg-white text-slate-700 text-xs font-bold px-3 py-1.5 rounded-xl hover:border-indigo-300"
                    >
                      ✏️ Modifier
                    </button>
                    {!isSelf &&
                      (confirmDeleteId === u.id ? (
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            disabled={busyId === u.id}
                            onClick={() => handleDelete(u)}
                            className="bg-rose-600 text-white text-xs font-bold px-3 py-1.5 rounded-xl hover:bg-rose-700"
                          >
                            Confirmer
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteId(null)}
                            className="border border-slate-200 text-slate-600 text-xs font-semibold px-2.5 py-1.5 rounded-xl"
                          >
                            Annuler
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteId(u.id)}
                          className="border border-rose-200 text-rose-600 text-xs font-bold px-3 py-1.5 rounded-xl hover:bg-rose-50"
                        >
                          🗑️ Supprimer
                        </button>
                      ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* EDIT Modal */}
      {editingUser && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <form
            onSubmit={handleSaveEdit}
            className="bg-white rounded-3xl border border-slate-100 shadow-2xl max-w-md w-full p-6 space-y-4"
          >
            <div className="flex items-center justify-between">
              <h3 className="font-extrabold text-slate-900 text-lg">✏️ Modifier le compte</h3>
              <button
                type="button"
                onClick={() => setEditingUser(null)}
                className="text-slate-400 hover:text-slate-700 text-lg font-bold"
              >
                ✕
              </button>
            </div>
            <div className="text-xs text-slate-400">{editingUser.email}</div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Prénom</label>
                <input
                  type="text"
                  required
                  value={editForm.firstName}
                  onChange={(e) => setEditForm((f) => ({ ...f, firstName: e.target.value }))}
                  className={inputCls}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Nom</label>
                <input
                  type="text"
                  value={editForm.lastName}
                  onChange={(e) => setEditForm((f) => ({ ...f, lastName: e.target.value }))}
                  className={inputCls}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Rôle</label>
                <select
                  value={editForm.role}
                  onChange={(e) =>
                    setEditForm((f) => ({
                      ...f,
                      role: e.target.value as "student" | "teacher" | "parent" | "org_admin",
                    }))
                  }
                  className={inputCls}
                >
                  <option value="student">🎓 Élève</option>
                  <option value="teacher">👨‍🏫 Enseignant / Tuteur</option>
                  <option value="parent">👪 Parent</option>
                  <option value="org_admin">🏛️ Administrateur</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Statut</label>
                <select
                  value={editForm.accountStatus}
                  onChange={(e) =>
                    setEditForm((f) => ({
                      ...f,
                      accountStatus: e.target.value as "pending" | "approved" | "rejected",
                    }))
                  }
                  className={inputCls}
                >
                  <option value="approved">✅ Validé</option>
                  <option value="pending">⏳ En attente</option>
                  <option value="rejected">❌ Refusé</option>
                </select>
              </div>
            </div>

            {editForm.role === "student" && (
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Niveau scolaire
                </label>
                <select
                  value={editForm.level}
                  onChange={(e) => setEditForm((f) => ({ ...f, level: e.target.value }))}
                  className={inputCls}
                >
                  <option value="Seconde">Seconde</option>
                  <option value="Première">Première</option>
                  <option value="Terminale">Terminale</option>
                </select>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setEditingUser(null)}
                className="border border-slate-200 text-slate-600 font-semibold px-4 py-2 rounded-xl text-xs"
              >
                Annuler
              </button>
              <button
                type="submit"
                disabled={savingEdit}
                className="bg-indigo-600 text-white font-bold px-5 py-2 rounded-xl text-xs hover:bg-indigo-700 disabled:opacity-60"
              >
                {savingEdit ? "Enregistrement…" : "Enregistrer"}
              </button>
            </div>
          </form>
        </div>
      )}
    </OrgShell>
  );
}

export default function OrgUsersPage() {
  return (
    <Suspense fallback={<div className="p-10 text-center text-sm text-slate-400">Chargement…</div>}>
      <OrgUsersContent />
    </Suspense>
  );
}
