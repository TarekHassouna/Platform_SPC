import type { Metadata } from "next";
import Link from "next/link";
import { BrandLogo } from "@/components/BrandLogo";

export const metadata: Metadata = {
  title: "Conditions Générales d'Utilisation (CGU) — Platform SPC",
  description:
    "Conditions générales d'utilisation de l'espace pédagogique Platform SPC.",
};

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="bg-white border-b border-slate-100 px-6 py-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5 font-extrabold text-slate-900">
            <BrandLogo size="sm" />
            <span>Platform SPC</span>
          </Link>
          <Link
            href="/"
            className="text-xs font-semibold text-indigo-600 hover:underline"
          >
            ← Retour à l&apos;accueil
          </Link>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-12">
        <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-8 sm:p-10 space-y-7">
          <div>
            <span className="inline-block text-xs font-bold bg-indigo-50 text-indigo-700 px-3 py-1 rounded-full mb-3">
              Cadre d&apos;utilisation scolaire
            </span>
            <h1 className="text-3xl font-extrabold text-slate-900">
              Conditions Générales d&apos;Utilisation (CGU)
            </h1>
            <p className="text-xs text-slate-400 mt-1">
              Dernière mise à jour : 21 novembre 2026
            </p>
          </div>

          <section className="space-y-2 text-sm text-slate-600 leading-relaxed">
            <h2 className="text-lg font-bold text-slate-900">1. Accès et validation des comptes</h2>
            <p>
              L&apos;accès à <strong>Platform SPC</strong> est réservé aux élèves, enseignants et
              parents autorisés par l&apos;établissement. Toute demande d&apos;inscription est
              soumise à la validation préalable de l&apos;administrateur. Les identifiants de
              connexion sont strictement personnels et ne doivent pas être partagés.
            </p>
          </section>

          <section className="space-y-2 text-sm text-slate-600 leading-relaxed">
            <h2 className="text-lg font-bold text-slate-900">2. Usage pédagogique responsable</h2>
            <p>
              Les outils d&apos;aide (correction automatique, analyse de copies manuscrites, tuteur
              IA) ont pour objectif d&apos;aider l&apos;élève à comprendre ses erreurs et à
              progresser en Physique-Chimie. L&apos;utilisateur s&apos;engage à utiliser la
              plateforme dans le respect des consignes de ses enseignants et à ne pas tenter de
              contourner les contrôles d&apos;accès ou limites techniques.
            </p>
          </section>

          <section className="space-y-2 text-sm text-slate-600 leading-relaxed">
            <h2 className="text-lg font-bold text-slate-900">3. Espace Parent</h2>
            <p>
              Les parents disposent d&apos;un accès en lecture seule aux devoirs, notes et bilans
              pédagogiques de leur enfant après validation de la liaison par l&apos;administrateur.
              Pour préserver l&apos;autonomie d&apos;apprentissage, les échanges privés avec le
              Tuteur IA ne sont pas visibles depuis l&apos;espace parent.
            </p>
          </section>

          <section className="space-y-2 text-sm text-slate-600 leading-relaxed">
            <h2 className="text-lg font-bold text-slate-900">4. Suspension et suppression</h2>
            <p>
              L&apos;administration se réserve le droit de suspendre ou supprimer tout compte en cas
              d&apos;utilisation abusive ou non conforme au règlement intérieur de
              l&apos;établissement.
            </p>
          </section>

          <div className="pt-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500 flex-wrap gap-3">
            <Link href="/privacy" className="text-indigo-600 font-semibold hover:underline">
              Consulter la Politique de confidentialité (RGPD) →
            </Link>
            <Link href="/auth/signup" className="text-slate-600 hover:text-indigo-600">
              Retour à l&apos;inscription
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
