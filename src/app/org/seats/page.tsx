"use client";
import { useState } from "react";
import { useOrgStore } from "@/lib/org-store";
import { OrgShell } from "@/components/OrgShell";

export default function OrgSeatsPage() {
  const { seatsPurchased, seats, assignSeat, revokeSeat, purchaseSeats, unitPriceForSeats } =
    useOrgStore();

  const [studentName, setStudentName] = useState("");
  const [studentEmail, setStudentEmail] = useState("");
  const [className, setClassName] = useState("Terminale Spé 1");
  const [level, setLevel] = useState<"Seconde" | "Première" | "Terminale">("Terminale");
  const [addSeatsCount, setAddSeatsCount] = useState(20);
  const [toast, setToast] = useState<string | null>(null);

  const freeSeats = Math.max(seatsPurchased - seats.length, 0);
  const newTotal = seatsPurchased + addSeatsCount;
  const newUnitPrice = unitPriceForSeats(newTotal);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3500);
  };

  const handleAssign = (e: React.FormEvent) => {
    e.preventDefault();
    if (!studentName.trim()) return;
    const ok = assignSeat(studentName, studentEmail, className, level);
    if (!ok) {
      showToast("⚠️ Tous vos sièges sont utilisés. Achetez des sièges supplémentaires ci-dessous.");
      return;
    }
    showToast(`✅ Siège attribué à ${studentName}`);
    setStudentName("");
    setStudentEmail("");
  };

  return (
    <OrgShell>
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 text-white text-sm font-medium px-5 py-3 rounded-2xl shadow-xl">
          {toast}
        </div>
      )}

      <div className="mb-8">
        <h1 className="text-2xl font-extrabold text-slate-900">🎟️ Gestion des sièges élèves</h1>
        <p className="text-slate-500 mt-1 text-sm">
          Attribuez ou libérez des licences élèves, importez des listes ou augmentez votre volume avec tarifs dégressifs.
        </p>
      </div>

      {/* Top stats + buy more seats */}
      <div className="grid lg:grid-cols-12 gap-6 mb-8">
        <div className="lg:col-span-5 bg-white rounded-3xl border border-slate-100 p-6 shadow-sm space-y-4">
          <h2 className="font-bold text-slate-900">Solde de licences</h2>
          <div className="grid grid-cols-3 gap-3 text-center">
            <div className="bg-indigo-50 rounded-2xl p-3">
              <div className="text-2xl font-extrabold text-indigo-600">{seatsPurchased}</div>
              <div className="text-[11px] text-slate-500">Achetés</div>
            </div>
            <div className="bg-emerald-50 rounded-2xl p-3">
              <div className="text-2xl font-extrabold text-emerald-600">{seats.length}</div>
              <div className="text-[11px] text-slate-500">Attribués</div>
            </div>
            <div className="bg-amber-50 rounded-2xl p-3">
              <div className="text-2xl font-extrabold text-amber-600">{freeSeats}</div>
              <div className="text-[11px] text-slate-500">Libres</div>
            </div>
          </div>

          <hr className="border-slate-100" />
          <h3 className="font-bold text-slate-900 text-sm">Ajouter des sièges (tarif dégressif)</h3>
          <div className="flex items-center gap-3">
            <input
              type="number"
              min={5}
              max={250}
              step={5}
              value={addSeatsCount}
              onChange={(e) => setAddSeatsCount(Math.max(1, Number(e.target.value)))}
              className="w-24 border border-slate-200 rounded-xl px-3 py-2 text-sm font-bold text-slate-900 bg-white outline-none focus:border-indigo-400"
            />
            <div className="flex-1 text-xs text-slate-600">
              Nouveau total : <strong>{newTotal} sièges</strong> →{" "}
              <strong className="text-indigo-600">
                {newUnitPrice ? `${newUnitPrice} € / élève` : "Sur devis (300+)"}
              </strong>
            </div>
          </div>
          <button
            onClick={() => {
              purchaseSeats(addSeatsCount);
              showToast(`✅ +${addSeatsCount} sièges ajoutés à votre établissement !`);
            }}
            className="w-full bg-indigo-600 text-white font-bold py-2.5 rounded-xl text-sm hover:bg-indigo-700 transition-colors"
          >
            Ajouter +{addSeatsCount} sièges ({newUnitPrice ? `${addSeatsCount * newUnitPrice} €` : "Devis"})
          </button>

          {/* Pricing tiers table from Vision Doc §12.2 */}
          <div className="text-[11px] text-slate-400 grid grid-cols-5 gap-1 text-center pt-1">
            {[
              { r: "1–29", p: "7€" },
              { r: "30–59", p: "6€" },
              { r: "60–149", p: "5€" },
              { r: "150–299", p: "4€" },
              { r: "300+", p: "Devis" },
            ].map((t) => (
              <div key={t.r} className="bg-slate-50 rounded-lg py-1.5">
                <div className="font-bold text-slate-700">{t.p}</div>
                <div>{t.r}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Assign Seat Form */}
        <div className="lg:col-span-7 bg-white rounded-3xl border border-slate-100 p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold text-slate-900">Attribuer un siège à un élève</h2>
            <label className="cursor-pointer text-xs font-bold text-indigo-600 bg-indigo-50 px-3 py-1.5 rounded-xl hover:bg-indigo-100">
              📄 Import CSV en lot
              <input
                type="file"
                accept=".csv"
                className="hidden"
                onChange={() => showToast("📥 Fichier CSV validé — prêt à importer les comptes élèves.")}
              />
            </label>
          </div>
          <form onSubmit={handleAssign} className="space-y-4">
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">Nom de l&apos;élève</label>
                <input
                  type="text"
                  required
                  value={studentName}
                  onChange={(e) => setStudentName(e.target.value)}
                  placeholder="ex : Rayan Khelil"
                  className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-900 bg-white placeholder:text-slate-400 outline-none focus:border-indigo-400"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">E-mail élève</label>
                <input
                  type="email"
                  value={studentEmail}
                  onChange={(e) => setStudentEmail(e.target.value)}
                  placeholder="rayan.k@lycee.edu"
                  className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-900 bg-white placeholder:text-slate-400 outline-none focus:border-indigo-400"
                />
              </div>
            </div>
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">Classe</label>
                <input
                  type="text"
                  value={className}
                  onChange={(e) => setClassName(e.target.value)}
                  className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-900 bg-white outline-none focus:border-indigo-400"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">Niveau</label>
                <select
                  value={level}
                  onChange={(e) => setLevel(e.target.value as "Seconde" | "Première" | "Terminale")}
                  className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-900 bg-white outline-none focus:border-indigo-400"
                >
                  <option value="Seconde">Seconde</option>
                  <option value="Première">Première</option>
                  <option value="Terminale">Terminale</option>
                </select>
              </div>
            </div>
            <button
              type="submit"
              className="bg-emerald-600 text-white font-bold px-6 py-2.5 rounded-xl text-sm hover:bg-emerald-700 shadow-sm"
            >
              ✅ Attribuer 1 siège
            </button>
          </form>
        </div>
      </div>

      {/* Assigned seats list */}
      <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100">
          <h2 className="font-bold text-slate-900">Sièges attribués ({seats.length})</h2>
        </div>
        <div className="divide-y divide-slate-50">
          {seats.map((s) => (
            <div key={s.id} className="px-6 py-3.5 flex items-center gap-4">
              <div className="w-8 h-8 rounded-full bg-indigo-50 text-indigo-700 font-bold text-xs flex items-center justify-center shrink-0">
                {s.studentName[0]}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold text-slate-900 truncate">{s.studentName}</div>
                <div className="text-xs text-slate-400 truncate">{s.studentEmail}</div>
              </div>
              <span className="text-xs font-semibold bg-slate-100 text-slate-600 px-2.5 py-1 rounded-lg hidden sm:inline-block">
                {s.className}
              </span>
              <span className="text-xs text-slate-400 hidden md:inline-block">{s.assignedAt}</span>
              <button
                onClick={() => {
                  revokeSeat(s.id);
                  showToast(`Siège de ${s.studentName} libéré.`);
                }}
                className="text-xs font-semibold text-rose-500 hover:text-rose-700"
              >
                Libérer
              </button>
            </div>
          ))}
        </div>
      </div>
    </OrgShell>
  );
}
