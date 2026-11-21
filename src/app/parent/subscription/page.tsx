"use client";
import Link from "next/link";
import { ParentShell } from "@/components/ParentShell";

export default function ParentSubscriptionPage() {
  return (
    <ParentShell>
      <div className="max-w-2xl bg-white rounded-3xl border border-slate-100 p-8 shadow-sm space-y-4">
        <div className="text-3xl">🎓</div>
        <h1 className="text-2xl font-extrabold text-slate-900">Accès scolaire gratuit</h1>
        <p className="text-sm text-slate-600 leading-relaxed">
          Cette plateforme de Physique-Chimie est mise à disposition par votre enseignant — aucun abonnement ni carte bancaire n&apos;est requis pour suivre les progrès de votre enfant.
        </p>
        <Link
          href="/parent/dashboard"
          className="inline-block bg-indigo-600 text-white text-xs font-bold px-5 py-3 rounded-xl hover:bg-indigo-700"
        >
          ← Retour au suivi de mon enfant
        </Link>
      </div>
    </ParentShell>
  );
}
