import type { Metadata } from "next";
import Link from "next/link";
import { BrandLogo } from "@/components/BrandLogo";

export const metadata: Metadata = {
  title: "Politique de confidentialité — Platform SPC",
  description:
    "Politique de protection des données personnelles (RGPD) de la plateforme pédagogique Platform SPC.",
};

export default function PrivacyPolicyPage() {
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
              RGPD &amp; Protection des mineurs
            </span>
            <h1 className="text-3xl font-extrabold text-slate-900">
              Politique de confidentialité
            </h1>
            <p className="text-xs text-slate-400 mt-1">
              Dernière mise à jour : 21 novembre 2026
            </p>
          </div>

          <section className="space-y-2 text-sm text-slate-600 leading-relaxed">
            <h2 className="text-lg font-bold text-slate-900">1. Objet de la plateforme</h2>
            <p>
              <strong>Platform SPC</strong> est un espace pédagogique dédié à l&apos;apprentissage
              de la Physique-Chimie (Seconde, Première, Terminale). La plateforme est strictement
              éducative : elle ne diffuse aucune publicité et ne revend ni ne partage aucune donnée
              personnelle à des tiers commerciaux.
            </p>
          </section>

          <section className="space-y-2 text-sm text-slate-600 leading-relaxed">
            <h2 className="text-lg font-bold text-slate-900">2. Données collectées</h2>
            <ul className="list-disc pl-5 space-y-1.5">
              <li>
                <strong>Données de compte :</strong> prénom, nom, adresse e-mail, rôle (élève,
                enseignant ou parent) et niveau scolaire.
              </li>
              <li>
                <strong>Connexion avec Google (OAuth) :</strong> lorsque vous choisissez de vous
                connecter avec Google, nous recevons uniquement votre nom et votre adresse e-mail
                afin de vous authentifier. Nous n&apos;accédons à aucun autre service Google
                (Drive, Gmail, contacts, etc.).
              </li>
              <li>
                <strong>Données pédagogiques :</strong> réponses aux exercices, notes, devoirs de
                classe, progression par chapitre et photos de copies déposées par l&apos;élève.
              </li>
            </ul>
          </section>

          <section className="space-y-2 text-sm text-slate-600 leading-relaxed">
            <h2 className="text-lg font-bold text-slate-900">
              3. Validation des comptes &amp; Contrôle d&apos;accès
            </h2>
            <p>
              Afin de protéger les élèves mineurs, toute nouvelle inscription (élève, enseignant ou
              parent) est vérifiée et validée par l&apos;administrateur avant l&apos;ouverture de
              l&apos;accès. De même, aucun compte parent ne peut consulter les résultats d&apos;un
              élève sans validation explicite de la liaison par l&apos;administrateur.
            </p>
          </section>

          <section className="space-y-2 text-sm text-slate-600 leading-relaxed">
            <h2 className="text-lg font-bold text-slate-900">
              4. Confidentialité du Tuteur IA &amp; Photos de copies
            </h2>
            <p>
              Les conversations entre un élève et le Tuteur IA restent strictement privées à
              l&apos;élève : elles ne sont ni affichées aux parents ni incluses dans les bilans
              pédagogiques. Les photos de copies manuscrites sont stockées dans un espace privé
              sécurisé et accessibles uniquement à l&apos;élève concerné et à son enseignant.
            </p>
          </section>

          <section className="space-y-2 text-sm text-slate-600 leading-relaxed">
            <h2 className="text-lg font-bold text-slate-900">
              5. Vos droits (accès, rectification, suppression)
            </h2>
            <p>
              Conformément au Règlement Général sur la Protection des Données (RGPD), chaque
              utilisateur (ou représentant légal d&apos;un élève mineur) peut demander l&apos;accès,
              la rectification ou la suppression définitive de son compte et de ses données
              pédagogiques auprès de l&apos;administration de l&apos;établissement.
            </p>
          </section>

          <div className="pt-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500 flex-wrap gap-3">
            <Link href="/terms" className="text-indigo-600 font-semibold hover:underline">
              Consulter les Conditions Générales d&apos;Utilisation (CGU) →
            </Link>
            <Link href="/auth/login" className="text-slate-600 hover:text-indigo-600">
              Accéder à la connexion
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
