"use client";
import { useState } from "react";
import { useOrgStore } from "@/lib/org-store";
import { OrgShell } from "@/components/OrgShell";

export default function OrgTeachersPage() {
  const { teachers, inviteTeacher } = useOrgStore();
  const [showInvite, setShowInvite] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [levels, setLevels] = useState<string[]>(["Terminale"]);
  const [toast, setToast] = useState<string | null>(null);

  const toggleLevel = (lvl: string) => {
    setLevels((prev) =>
      prev.includes(lvl) ? prev.filter((l) => l !== lvl) : [...prev, lvl]
    );
  };

  const handleInvite = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim()) return;
    inviteTeacher(name, email, levels);
    setToast(`✉️ Invitation envoyée à ${name} (${email})`);
    setName("");
    setEmail("");
    setShowInvite(false);
    setTimeout(() => setToast(null), 3500);
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
          <h1 className="text-2xl font-extrabold text-slate-900">👨‍🏫 Enseignants &amp; classes</h1>
          <p className="text-slate-500 mt-1 text-sm">
            Invitez vos professeurs de Physique-Chimie et suivez l&apos;adoption par classe.
          </p>
        </div>
        <button
          onClick={() => setShowInvite(!showInvite)}
          className="bg-indigo-600 text-white font-semibold px-5 py-2.5 rounded-xl hover:bg-indigo-700 text-sm shadow-lg shadow-indigo-100"
        >
          ➕ Inviter un enseignant
        </button>
      </div>

      {showInvite && (
        <form onSubmit={handleInvite} className="bg-white rounded-3xl border border-indigo-200 p-6 mb-8 shadow-sm space-y-4">
          <h2 className="font-bold text-slate-900">Envoyer une invitation enseignant</h2>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">Nom complet</label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="ex : Claire Dubois"
                className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-900 bg-white placeholder:text-slate-400 outline-none focus:border-indigo-400"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">E-mail professionnel</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="c.dubois@lycee.edu"
                className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-900 bg-white placeholder:text-slate-400 outline-none focus:border-indigo-400"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-2">Niveaux enseignés</label>
            <div className="flex gap-4">
              {["Seconde", "Première", "Terminale"].map((lvl) => (
                <label key={lvl} className="flex items-center gap-1.5 cursor-pointer text-sm text-slate-700">
                  <input
                    type="checkbox"
                    checked={levels.includes(lvl)}
                    onChange={() => toggleLevel(lvl)}
                    className="w-4 h-4 accent-indigo-600"
                  />
                  {lvl}
                </label>
              ))}
            </div>
          </div>
          <div className="flex gap-3">
            <button type="submit" className="bg-indigo-600 text-white font-bold px-6 py-2.5 rounded-xl text-sm hover:bg-indigo-700">
              Envoyer l&apos;invitation
            </button>
            <button
              type="button"
              onClick={() => setShowInvite(false)}
              className="border border-slate-200 text-slate-600 font-semibold px-5 py-2.5 rounded-xl text-sm hover:bg-slate-50"
            >
              Annuler
            </button>
          </div>
        </form>
      )}

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
        {teachers.map((t) => (
          <div key={t.id} className="bg-white rounded-3xl border border-slate-100 p-6 shadow-sm flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-4">
                <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white font-bold flex items-center justify-center text-base">
                  {t.name[0]}
                </div>
                <span
                  className={`text-xs font-bold px-2.5 py-1 rounded-full ${
                    t.status === "active"
                      ? "bg-emerald-100 text-emerald-700"
                      : "bg-amber-100 text-amber-800"
                  }`}
                >
                  {t.status === "active" ? "● Actif" : "En attente"}
                </span>
              </div>
              <h3 className="font-bold text-slate-900 text-base">{t.name}</h3>
              <p className="text-xs text-slate-400 mb-3">{t.email}</p>
              <div className="flex flex-wrap gap-1.5 mb-4">
                {t.levels.map((lvl) => (
                  <span key={lvl} className="text-[11px] font-semibold bg-indigo-50 text-indigo-700 px-2.5 py-0.5 rounded-lg">
                    {lvl}
                  </span>
                ))}
              </div>
            </div>
            <div className="pt-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
              <span><strong>{t.classesCount}</strong> classes · <strong>{t.studentsCount}</strong> élèves</span>
              <span>{t.lastActive}</span>
            </div>
          </div>
        ))}
      </div>
    </OrgShell>
  );
}
