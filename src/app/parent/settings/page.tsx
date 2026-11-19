"use client";
import { useState, useEffect } from "react";
import { ParentShell } from "@/components/ParentShell";
import { useAuth } from "@/lib/auth-context";

const inputCls =
  "w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-900 bg-white placeholder:text-slate-400 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100";

export default function ParentSettingsPage() {
  const { user, updateProfile } = useAuth();

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [childName, setChildName] = useState("");
  const [childLevel, setChildLevel] = useState("Terminale");

  const [weeklyReport, setWeeklyReport] = useState(true);
  const [weaknessAlert, setWeaknessAlert] = useState(true);
  const [photoRetention, setPhotoRetention] = useState("90");
  const [savedToast, setSavedToast] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      setFirstName(user.firstName || "");
      setLastName(user.lastName || "");
      setEmail(user.email || "");
      setChildName(user.childName || "Amira");
      setChildLevel(user.childLevel || "Terminale");
    }
  }, [user]);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    updateProfile({ firstName, lastName, email, childName, childLevel });
    setSavedToast("✅ Paramètres enregistrés !");
    setTimeout(() => setSavedToast(null), 3000);
  };

  return (
    <ParentShell>
      {savedToast && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 text-white text-sm font-medium px-5 py-3 rounded-2xl shadow-xl">
          {savedToast}
        </div>
      )}

      <div className="mb-8">
        <h1 className="text-2xl font-extrabold text-slate-900">⚙️ Paramètres &amp; RGPD</h1>
        <p className="text-slate-500 mt-1 text-sm">
          Modifiez vos coordonnées, les informations de votre enfant, vos préférences de suivi et la protection des données.
        </p>
      </div>

      <form onSubmit={handleSave} className="space-y-6 max-w-3xl">
        {/* Account & Child Info */}
        <div className="bg-white rounded-3xl border border-slate-100 p-6 shadow-sm space-y-4">
          <h2 className="font-bold text-slate-900 text-base">Informations du compte</h2>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">Prénom</label>
              <input type="text" value={firstName} onChange={(e) => setFirstName(e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">Nom</label>
              <input type="text" value={lastName} onChange={(e) => setLastName(e.target.value)} className={inputCls} />
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">Adresse e-mail</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={inputCls} />
          </div>

          <hr className="border-slate-100 my-2" />
          <h3 className="font-bold text-slate-900 text-sm">Enfant rattaché</h3>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">Prénom de l&apos;enfant</label>
              <input type="text" value={childName} onChange={(e) => setChildName(e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">Niveau scolaire</label>
              <select value={childLevel} onChange={(e) => setChildLevel(e.target.value)} className={inputCls}>
                <option value="Seconde">Seconde</option>
                <option value="Première">Première</option>
                <option value="Terminale">Terminale</option>
              </select>
            </div>
          </div>
        </div>

        {/* Notifications */}
        <div className="bg-white rounded-3xl border border-slate-100 p-6 shadow-sm space-y-4">
          <h2 className="font-bold text-slate-900 text-base">Notifications par e-mail</h2>
          <label className="flex items-center justify-between gap-4 cursor-pointer">
            <div>
              <div className="text-sm font-semibold text-slate-800">Résumé hebdomadaire (chaque dimanche)</div>
              <div className="text-xs text-slate-500">Temps de travail, compétences acquises et prochaines révisions</div>
            </div>
            <input
              type="checkbox"
              checked={weeklyReport}
              onChange={(e) => setWeeklyReport(e.target.checked)}
              className="w-5 h-5 accent-indigo-600"
            />
          </label>
          <label className="flex items-center justify-between gap-4 cursor-pointer pt-2 border-t border-slate-50">
            <div>
              <div className="text-sm font-semibold text-slate-800">Alertes de lacunes récurrentes</div>
              <div className="text-xs text-slate-500">Être prévenu si une compétence bloque plusieurs fois de suite</div>
            </div>
            <input
              type="checkbox"
              checked={weaknessAlert}
              onChange={(e) => setWeaknessAlert(e.target.checked)}
              className="w-5 h-5 accent-indigo-600"
            />
          </label>
        </div>

        {/* GDPR & Minor Privacy (Vision Doc §14) */}
        <div className="bg-white rounded-3xl border border-slate-100 p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-bold text-slate-900 text-base">🛡️ Protection des données (RGPD Mineurs)</h2>
            <span className="text-xs font-bold bg-emerald-50 text-emerald-700 px-2.5 py-1 rounded-full">
              Consentement parental actif
            </span>
          </div>
          <p className="text-xs text-slate-500 leading-relaxed">
            Les photos de copies de votre enfant sont stockées dans un espace privé chiffré, accessibles uniquement par liens temporaires et jamais utilisées pour entraîner des modèles d&apos;IA.
          </p>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50 rounded-2xl p-4">
            <div>
              <div className="text-sm font-semibold text-slate-800">Suppression automatique des photos</div>
              <div className="text-xs text-slate-500">Délai maximal de conservation des feuilles photographiées</div>
            </div>
            <select
              value={photoRetention}
              onChange={(e) => setPhotoRetention(e.target.value)}
              className="border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-900 bg-white"
            >
              <option value="30">30 jours</option>
              <option value="90">90 jours (recommandé)</option>
            </select>
          </div>
          <div className="flex flex-wrap gap-3 pt-1">
            <button
              type="button"
              onClick={() => {
                setSavedToast("📦 Export RGPD des données envoyé à votre adresse e-mail.");
                setTimeout(() => setSavedToast(null), 3500);
              }}
              className="text-xs font-semibold border border-slate-200 text-slate-700 px-4 py-2 rounded-xl hover:bg-slate-50"
            >
              Exporter les données (RGPD)
            </button>
          </div>
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            className="bg-indigo-600 text-white font-bold px-8 py-3 rounded-xl hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-100 text-sm"
          >
            Enregistrer les modifications
          </button>
        </div>
      </form>
    </ParentShell>
  );
}
