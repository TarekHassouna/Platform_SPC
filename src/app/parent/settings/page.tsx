"use client";
import { useCallback, useEffect, useState } from "react";
import { ParentShell } from "@/components/ParentShell";
import { useAuth } from "@/lib/auth-context";
import {
  fetchParentChildrenDashboards,
  linkParentToChild,
  unlinkParentChild,
  type ParentChildSnapshot,
} from "@/lib/db";
import { openPrintableParentReport } from "@/lib/parent-report";

const inputCls =
  "w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-900 bg-white placeholder:text-slate-400 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100";

export default function ParentSettingsPage() {
  const { user, updateProfile } = useAuth();

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");

  const [childrenList, setChildrenList] = useState<ParentChildSnapshot[]>([]);
  const [newChildEmail, setNewChildEmail] = useState("");
  const [newChildName, setNewChildName] = useState("");
  const [newChildLevel, setNewChildLevel] = useState("Terminale");
  const [linking, setLinking] = useState(false);

  const [savedToast, setSavedToast] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setSavedToast(msg);
    setTimeout(() => setSavedToast(null), 3500);
  };

  const loadChildren = useCallback(async () => {
    if (!user?.id) return;
    const list = await fetchParentChildrenDashboards(user.id);
    setChildrenList(list);
  }, [user?.id]);

  useEffect(() => {
    if (user) {
      setFirstName(user.firstName || "");
      setLastName(user.lastName || "");
      setEmail(user.email || "");
    }
    loadChildren();
  }, [user, loadChildren]);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    await updateProfile({ firstName, lastName, email });
    showToast("✅ Profil parent mis à jour !");
  };

  const handleAddChild = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newChildEmail.trim()) return;
    setLinking(true);
    const res = await linkParentToChild({
      childEmail: newChildEmail.trim(),
      childName: newChildName.trim() || undefined,
      childLevel: newChildLevel,
    });
    setLinking(false);
    if (!res.ok) {
      showToast(`⚠️ ${res.error || "Erreur lors du rattachement."}`);
      return;
    }
    setNewChildEmail("");
    setNewChildName("");
    showToast(
      res.linked
        ? `✅ ${res.childName || "Enfant"} est déjà rattaché et validé.`
        : "⏳ Demande de liaison envoyée à l'administrateur pour validation."
    );
    await loadChildren();
  };

  const handleUnlink = async (linkId: string, name: string) => {
    const ok = await unlinkParentChild(linkId);
    if (ok) {
      setChildrenList((prev) => prev.filter((c) => c.linkId !== linkId));
      showToast(`Lien supprimé pour ${name}.`);
    }
  };

  const linkedChildrenCount = childrenList.filter((c) => c.linked).length;

  const handlePrintReport = () => {
    const res = openPrintableParentReport({
      parentName: `${firstName} ${lastName}`.trim() || "Parent",
      parentEmail: email,
      children: childrenList,
    });
    if (!res.ok) {
      showToast(`⚠️ ${res.error || "Impossible de générer le bilan."}`);
    }
  };

  return (
    <ParentShell>
      {savedToast && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 text-white text-sm font-medium px-5 py-3 rounded-2xl shadow-xl">
          {savedToast}
        </div>
      )}

      <div className="mb-8">
        <h1 className="text-2xl font-extrabold text-slate-900">⚙️ Paramètres &amp; Enfants rattachés</h1>
        <p className="text-slate-500 mt-1 text-sm">
          Gérez vos coordonnées, suivez vos demandes de rattachement et imprimez le bilan pédagogique de votre enfant.
        </p>
      </div>

      <div className="space-y-6 max-w-3xl">
        {/* Parent Account */}
        <form
          onSubmit={handleSaveProfile}
          className="bg-white rounded-3xl border border-slate-100 p-6 shadow-sm space-y-4"
        >
          <h2 className="font-bold text-slate-900 text-base">Informations du compte parent</h2>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">Prénom</label>
              <input
                type="text"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                className={inputCls}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">Nom</label>
              <input
                type="text"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                className={inputCls}
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">Adresse e-mail</label>
            <input
              type="email"
              value={email}
              disabled
              className={`${inputCls} bg-slate-50 text-slate-500 cursor-not-allowed`}
            />
          </div>
          <div className="flex justify-end">
            <button
              type="submit"
              className="bg-indigo-600 text-white font-bold px-6 py-2.5 rounded-xl hover:bg-indigo-700 transition-colors text-xs"
            >
              Enregistrer mon profil
            </button>
          </div>
        </form>

        {/* Linked Children Management */}
        <div className="bg-white rounded-3xl border border-slate-100 p-6 shadow-sm space-y-4">
          <h2 className="font-bold text-slate-900 text-base">
            👨‍👩‍👧 Enfants rattachés ({childrenList.length})
          </h2>

          {childrenList.length === 0 ? (
            <p className="text-xs text-slate-400">
              Aucun enfant rattaché pour le moment. Utilisez le formulaire ci-dessous avec l&apos;adresse e-mail de votre enfant.
            </p>
          ) : (
            <div className="space-y-2.5">
              {childrenList.map((c) => (
                <div
                  key={c.linkId}
                  className="bg-slate-50 border border-slate-200 rounded-2xl p-4 flex items-center justify-between gap-3 flex-wrap"
                >
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-sm text-slate-900">{c.childName}</span>
                      <span
                        className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                          c.linked
                            ? "bg-emerald-100 text-emerald-700"
                            : c.status === "rejected"
                            ? "bg-rose-100 text-rose-700"
                            : "bg-amber-100 text-amber-800"
                        }`}
                      >
                        {c.linked
                          ? "● Validé par l'admin"
                          : c.status === "rejected"
                          ? "❌ Refusé par l'admin"
                          : "⏳ En attente admin"}
                      </span>
                    </div>
                    <div className="text-xs text-slate-500 mt-0.5">
                      {c.childEmail || "Pas d'e-mail"} · {c.childLevel}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleUnlink(c.linkId, c.childName)}
                    className="text-xs font-semibold text-rose-600 hover:bg-rose-50 px-3 py-1.5 rounded-xl border border-rose-200"
                  >
                    Retirer
                  </button>
                </div>
              ))}
            </div>
          )}

          <form onSubmit={handleAddChild} className="pt-3 border-t border-slate-100 space-y-3">
            <div className="text-xs font-bold text-slate-700">
              Demander le rattachement d&apos;un élève (validation administrateur requise)
            </div>
            <div className="grid sm:grid-cols-3 gap-3">
              <input
                type="email"
                required
                value={newChildEmail}
                onChange={(e) => setNewChildEmail(e.target.value)}
                placeholder="E-mail élève *"
                className={inputCls}
              />
              <input
                type="text"
                value={newChildName}
                onChange={(e) => setNewChildName(e.target.value)}
                placeholder="Prénom (optionnel)"
                className={inputCls}
              />
              <select
                value={newChildLevel}
                onChange={(e) => setNewChildLevel(e.target.value)}
                className={inputCls}
              >
                <option value="Seconde">Seconde</option>
                <option value="Première">Première</option>
                <option value="Terminale">Terminale</option>
              </select>
            </div>
            <div className="flex justify-end">
              <button
                type="submit"
                disabled={linking}
                className="bg-emerald-600 text-white font-bold px-5 py-2.5 rounded-xl hover:bg-emerald-700 text-xs disabled:opacity-60"
              >
                {linking ? "⏳ Envoi…" : "📩 Envoyer la demande à l'admin"}
              </button>
            </div>
          </form>
        </div>

        {/* Printable Parent Progress Report (PDF / Print) */}
        <div className="bg-white rounded-3xl border border-slate-100 p-6 shadow-sm space-y-3">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <h2 className="font-bold text-slate-900 text-base">
              📄 Bilan pédagogique &amp; Confidentialité
            </h2>
            <span className="text-xs font-bold bg-emerald-50 text-emerald-700 px-2.5 py-1 rounded-full">
              {linkedChildrenCount > 0
                ? `${linkedChildrenCount} enfant(s) prêt(s)`
                : "En attente de liaison"}
            </span>
          </div>
          <p className="text-xs text-slate-500 leading-relaxed">
            Générez un bilan clair et lisible regroupant les notes, devoirs et résultats de votre enfant en Physique-Chimie (prêt à imprimer ou enregistrer en PDF). Les discussions privées avec le Tuteur IA restent confidentielles à l&apos;élève.
          </p>
          <div className="flex items-center gap-3 flex-wrap pt-1">
            <button
              type="button"
              disabled={linkedChildrenCount === 0}
              onClick={handlePrintReport}
              className="text-xs font-bold bg-indigo-600 text-white px-5 py-2.5 rounded-xl hover:bg-indigo-700 transition-colors shadow-sm disabled:opacity-40 disabled:cursor-not-allowed"
            >
              🖨️ Imprimer / Télécharger le bilan PDF
            </button>
            {linkedChildrenCount === 0 && (
              <span className="text-[11px] text-amber-700">
                Disponible dès qu&apos;une liaison élève est validée par l&apos;administrateur.
              </span>
            )}
          </div>
        </div>
      </div>
    </ParentShell>
  );
}
