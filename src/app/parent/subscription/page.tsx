"use client";
import { useState } from "react";
import { ParentShell } from "@/components/ParentShell";
import { useAuth } from "@/lib/auth-context";

const INVOICES = [
  { id: "INV-2026-11", date: "18 nov. 2026", amount: "7,00 €", status: "Payée", plan: "Individuel Mensuel" },
  { id: "INV-2026-10", date: "18 oct. 2026", amount: "7,00 €", status: "Payée", plan: "Individuel Mensuel" },
  { id: "INV-2026-09", date: "18 sept. 2026", amount: "0,00 €", status: "Essai gratuit", plan: "Essai 14 jours" },
];

export default function ParentSubscriptionPage() {
  const { user } = useAuth();
  const [billingCycle, setBillingCycle] = useState<"monthly" | "yearly">("monthly");
  const [canceled, setCanceled] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3500);
  };

  return (
    <ParentShell>
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 text-white text-sm font-medium px-5 py-3 rounded-2xl shadow-xl">
          {toast}
        </div>
      )}

      <div className="mb-8">
        <h1 className="text-2xl font-extrabold text-slate-900">💳 Abonnement &amp; factures</h1>
        <p className="text-slate-500 mt-1 text-sm">
          Gérez le forfait de <strong>{user?.childName || "votre enfant"}</strong>, suivez le quota IA mensuel et téléchargez vos factures (TVA gérée via Paddle).
        </p>
      </div>

      {/* Current Plan Banner */}
      <div className="bg-white rounded-3xl border border-slate-100 p-7 shadow-sm mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-100">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-bold bg-emerald-100 text-emerald-700 px-2.5 py-0.5 rounded-full">
                {canceled ? "Résiliation programmée" : "● Actif"}
              </span>
              <span className="text-xs text-slate-400">Facturation via Paddle (Merchant of Record)</span>
            </div>
            <h2 className="text-xl font-extrabold text-slate-900">
              Forfait Individuel — {billingCycle === "monthly" ? "7 € / mois" : "69 € / an (2 mois offerts)"}
            </h2>
            <p className="text-sm text-slate-500 mt-1">
              Prochain renouvellement : <strong className="text-slate-700">18 décembre 2026</strong> · Carte Visa •••• 4242
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                const next = billingCycle === "monthly" ? "yearly" : "monthly";
                setBillingCycle(next);
                showToast(
                  next === "yearly"
                    ? "✅ Passage au forfait annuel (69 €/an — économisez 15 €/an)"
                    : "✅ Passage au forfait mensuel (7 €/mois)"
                );
              }}
              className="bg-indigo-600 text-white font-bold text-xs px-4 py-2.5 rounded-xl hover:bg-indigo-700 transition-colors"
            >
              {billingCycle === "monthly" ? "Passer à l'annuel (-18%)" : "Revenir au mensuel"}
            </button>
            <button
              onClick={() => {
                setCanceled(!canceled);
                showToast(
                  !canceled
                    ? "Abonnement annulé à la fin de la période en cours."
                    : "✅ Renouvellement réactivé !"
                );
              }}
              className="border border-slate-200 text-slate-600 font-semibold text-xs px-4 py-2.5 rounded-xl hover:bg-slate-50"
            >
              {canceled ? "Réactiver" : "Suspendre"}
            </button>
          </div>
        </div>

        {/* Fair-use AI allowance meters (Vision Doc §12.3) */}
        <div className="pt-6 grid sm:grid-cols-3 gap-5">
          <div>
            <div className="flex justify-between text-xs font-semibold mb-1.5">
              <span className="text-slate-700">📸 Corrections photo (ce mois)</span>
              <span className="text-indigo-600">11 / 30</span>
            </div>
            <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
              <div className="h-full bg-indigo-500 rounded-full" style={{ width: "37%" }} />
            </div>
            <p className="text-[11px] text-slate-400 mt-1">Réinitialisé le 18 déc.</p>
          </div>
          <div>
            <div className="flex justify-between text-xs font-semibold mb-1.5">
              <span className="text-slate-700">💬 Messages Tuteur IA</span>
              <span className="text-emerald-600">68 / 250</span>
            </div>
            <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
              <div className="h-full bg-emerald-500 rounded-full" style={{ width: "27%" }} />
            </div>
            <p className="text-[11px] text-slate-400 mt-1">Usage raisonnable garanti</p>
          </div>
          <div>
            <div className="flex justify-between text-xs font-semibold mb-1.5">
              <span className="text-slate-700">⚡ Exercices corrigés (code)</span>
              <span className="text-emerald-600">Illimité</span>
            </div>
            <div className="h-2 bg-emerald-100 rounded-full overflow-hidden">
              <div className="h-full bg-emerald-500 rounded-full w-full" />
            </div>
            <p className="text-[11px] text-slate-400 mt-1">SymPy + Pint : aucun plafond</p>
          </div>
        </div>
      </div>

      {/* Invoices */}
      <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <h2 className="font-bold text-slate-900">Historique des factures</h2>
          <span className="text-xs text-slate-400">TVA UE incluse</span>
        </div>
        <div className="divide-y divide-slate-50">
          {INVOICES.map((inv) => (
            <div key={inv.id} className="px-6 py-4 flex items-center gap-4">
              <div className="flex-1 min-w-0">
                <div className="text-sm font-bold text-slate-900">{inv.plan}</div>
                <div className="text-xs text-slate-400 font-mono">
                  {inv.id} · {inv.date}
                </div>
              </div>
              <span className="text-xs font-bold bg-emerald-50 text-emerald-700 px-2.5 py-1 rounded-full">
                {inv.status}
              </span>
              <div className="text-sm font-extrabold text-slate-800 w-20 text-right">{inv.amount}</div>
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
    </ParentShell>
  );
}
