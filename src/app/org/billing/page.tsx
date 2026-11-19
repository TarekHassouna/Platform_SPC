"use client";
import { useState } from "react";
import { useOrgStore } from "@/lib/org-store";
import { OrgShell } from "@/components/OrgShell";

export default function OrgBillingPage() {
  const { orgName, seatsPurchased, billingCycle, setBillingCycle, invoices, unitPriceForSeats } =
    useOrgStore();
  const [toast, setToast] = useState<string | null>(null);

  const unitPrice = unitPriceForSeats(seatsPurchased) ?? 4;
  const totalCost = seatsPurchased * unitPrice;

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3500);
  };

  return (
    <OrgShell>
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 text-white text-sm font-medium px-5 py-3 rounded-2xl shadow-xl">
          {toast}
        </div>
      )}

      <div className="mb-8">
        <h1 className="text-2xl font-extrabold text-slate-900">💳 Facturation, contrat &amp; RGPD</h1>
        <p className="text-slate-500 mt-1 text-sm">
          Licence établissement pour <strong>{orgName}</strong> · Factures TVA UE gérées par Paddle · DPA scolaire RGPD inclus.
        </p>
      </div>

      {/* Contract Summary */}
      <div className="bg-white rounded-3xl border border-slate-100 p-7 shadow-sm mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-slate-100">
          <div>
            <span className="text-xs font-bold bg-indigo-50 text-indigo-700 px-2.5 py-1 rounded-full">
              Plan Établissement
            </span>
            <h2 className="text-2xl font-extrabold text-slate-900 mt-2">
              {totalCost} € <span className="text-sm font-semibold text-slate-400">/ {billingCycle === "yearly" ? "an (licence scolaire)" : "mois"}</span>
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              {seatsPurchased} sièges × {unitPrice} € · Renouvellement le 1er septembre 2027 · Paiement par virement ou carte (Paddle)
            </p>
          </div>
          <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-xl self-start">
            <button
              onClick={() => setBillingCycle("yearly")}
              className={`px-3.5 py-2 rounded-lg text-xs font-bold transition-all ${
                billingCycle === "yearly" ? "bg-white text-indigo-700 shadow-xs" : "text-slate-500"
              }`}
            >
              Annuel (Recommandé)
            </button>
            <button
              onClick={() => setBillingCycle("monthly")}
              className={`px-3.5 py-2 rounded-lg text-xs font-bold transition-all ${
                billingCycle === "monthly" ? "bg-white text-indigo-700 shadow-xs" : "text-slate-500"
              }`}
            >
              Mensuel
            </button>
          </div>
        </div>

        {/* DPA / GDPR School Documents */}
        <div className="pt-5 grid sm:grid-cols-2 gap-4">
          <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-4 flex items-center justify-between gap-3">
            <div>
              <div className="text-sm font-bold text-emerald-900">📜 Accord de traitement des données (DPA)</div>
              <div className="text-xs text-emerald-700">Conforme RGPD &amp; protection des mineurs · Signé</div>
            </div>
            <button
              onClick={() => showToast("📄 DPA_SPC_Platform_RGPD.pdf téléchargé")}
              className="text-xs font-bold bg-white text-emerald-700 border border-emerald-200 px-3 py-2 rounded-xl hover:bg-emerald-100 shrink-0"
            >
              PDF ↓
            </button>
          </div>
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 flex items-center justify-between gap-3">
            <div>
              <div className="text-sm font-bold text-slate-900">🏫 Bon de commande / Devis administratif</div>
              <div className="text-xs text-slate-500">Pour service comptable ou intendance lycée</div>
            </div>
            <button
              onClick={() => showToast("📄 Devis_Etablissement_2026.pdf généré")}
              className="text-xs font-bold bg-white text-slate-700 border border-slate-200 px-3 py-2 rounded-xl hover:bg-slate-100 shrink-0"
            >
              Générer ↓
            </button>
          </div>
        </div>
      </div>

      {/* Invoices */}
      <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100">
          <h2 className="font-bold text-slate-900">Factures de l&apos;établissement ({invoices.length})</h2>
        </div>
        <div className="divide-y divide-slate-50">
          {invoices.map((inv) => (
            <div key={inv.id} className="px-6 py-4 flex items-center gap-4">
              <div className="flex-1 min-w-0">
                <div className="text-sm font-bold text-slate-900">{inv.description}</div>
                <div className="text-xs text-slate-400 font-mono">
                  {inv.id} · {inv.date}
                </div>
              </div>
              <span className="text-xs font-bold bg-emerald-50 text-emerald-700 px-2.5 py-1 rounded-full">
                {inv.status}
              </span>
              <div className="text-sm font-extrabold text-slate-800 w-24 text-right">{inv.amount}</div>
              <button
                onClick={() => showToast(`📄 Facture ${inv.id}.pdf téléchargée`)}
                className="text-xs font-semibold text-indigo-600 hover:underline whitespace-nowrap"
              >
                PDF ↓
              </button>
            </div>
          ))}
        </div>
      </div>
    </OrgShell>
  );
}
