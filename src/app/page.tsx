import Link from "next/link";

const features = [
  {
    icon: "🧠",
    title: "IA qui comprend tes erreurs",
    desc: "Pas seulement juste ou faux — l'IA explique précisément où tu t'es trompé et pourquoi.",
    color: "from-violet-500 to-indigo-500",
    bg: "bg-violet-50",
  },
  {
    icon: "✍️",
    title: "Correction de copies manuscrites",
    desc: "Prends en photo ta feuille — l'IA lit, corrige et annote ton travail étape par étape.",
    color: "from-pink-500 to-rose-500",
    bg: "bg-pink-50",
  },
  {
    icon: "🗺️",
    title: "Carte de maîtrise personnelle",
    desc: "Vois exactement quelles compétences sont acquises, en cours ou à retravailler.",
    color: "from-emerald-500 to-teal-500",
    bg: "bg-emerald-50",
  },
  {
    icon: "🎯",
    title: "Exercices adaptés à toi",
    desc: "Le système choisit les exercices selon tes lacunes, jamais au hasard.",
    color: "from-orange-500 to-amber-500",
    bg: "bg-orange-50",
  },
  {
    icon: "📐",
    title: "Correction intelligente",
    desc: "I = U/R, U/R = I, et 0,6 A ou 600 mA — toutes les formes correctes sont acceptées.",
    color: "from-cyan-500 to-blue-500",
    bg: "bg-cyan-50",
  },
  {
    icon: "👨‍🏫",
    title: "Outils enseignants",
    desc: "Créez des exercices en minutes, assignez-les et voyez les lacunes de toute la classe.",
    color: "from-purple-500 to-violet-500",
    bg: "bg-purple-50",
  },
];

const stats = [
  { value: "≥ 95%", label: "Précision de correction", color: "text-indigo-600" },
  { value: "30–50", label: "Exercices vérifiés au lancement", color: "text-pink-600" },
  { value: "3 niveaux", label: "Seconde · Première · Terminale", color: "text-emerald-600" },
  { value: "100%", label: "Conforme au programme français", color: "text-orange-600" },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white">
      {/* NAV */}
      <nav className="fixed top-0 inset-x-0 z-50 bg-white/80 backdrop-blur border-b border-slate-100">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center text-white font-bold text-sm">
              S
            </div>
            <span className="font-bold text-slate-900 text-lg">SPC Platform</span>
          </div>
          <div className="hidden md:flex items-center gap-8 text-sm font-medium text-slate-600">
            <a href="#fonctionnalites" className="hover:text-indigo-600 transition-colors">Fonctionnalités</a>
            <a href="#tarifs" className="hover:text-indigo-600 transition-colors">Tarifs</a>
            <a href="#enseignants" className="hover:text-indigo-600 transition-colors">Enseignants</a>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/auth/login" className="text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors">
              Connexion
            </Link>
            <Link
              href="/auth/signup"
              className="text-sm font-medium bg-indigo-600 text-white px-4 py-2 rounded-xl hover:bg-indigo-700 transition-colors"
            >
              Commencer gratuitement
            </Link>
          </div>
        </div>
      </nav>

      {/* HERO */}
      <section className="pt-32 pb-24 px-6 bg-gradient-to-b from-slate-50 to-white">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 bg-indigo-50 text-indigo-700 text-sm font-medium px-4 py-2 rounded-full mb-6">
            <span className="w-2 h-2 bg-indigo-500 rounded-full animate-pulse" />
            Physique-Chimie · Lycée français · IA
          </div>
          <h1 className="text-5xl md:text-6xl font-extrabold text-slate-900 leading-tight mb-6">
            Un tuteur IA qui{" "}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-500 to-violet-600">
              comprend tes erreurs
            </span>
            <br />et t'apprend à les corriger
          </h1>
          <p className="text-xl text-slate-500 max-w-2xl mx-auto mb-10 leading-relaxed">
            Plus qu'une plateforme d'exercices — un vrai tuteur qui explique <strong className="text-slate-700">pourquoi</strong> ta réponse est fausse, quelle compétence t'a manqué, et quoi pratiquer ensuite.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/auth/signup"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-indigo-600 text-white font-semibold px-8 py-4 rounded-2xl hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200 hover:shadow-indigo-300 text-lg"
            >
              Essayer gratuitement →
            </Link>
            <Link
              href="/dashboard"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-white text-slate-700 font-semibold px-8 py-4 rounded-2xl border border-slate-200 hover:border-slate-300 transition-all text-lg"
            >
              Voir la démo
            </Link>
          </div>
        </div>

        {/* Hero mockup */}
        <div className="max-w-4xl mx-auto mt-16">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-100 overflow-hidden">
            <div className="bg-slate-800 px-6 py-3 flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-red-400" />
              <div className="w-3 h-3 rounded-full bg-yellow-400" />
              <div className="w-3 h-3 rounded-full bg-green-400" />
              <span className="ml-4 text-slate-400 text-xs font-mono">spc-platform.fr/exercice/ohm-001</span>
            </div>
            <div className="p-8 grid md:grid-cols-2 gap-6">
              <div>
                <div className="text-xs font-semibold text-indigo-500 uppercase tracking-wider mb-3">Exercice · Loi d'Ohm</div>
                <div className="bg-slate-50 rounded-2xl p-5 mb-4">
                  <p className="text-slate-700 text-sm leading-relaxed">
                    Un conducteur ohmique de résistance <strong>R = 47 Ω</strong> est soumis à une tension <strong>U = 12 V</strong>.
                    <br /><br />
                    1. Exprimer I en fonction de U et R.<br />
                    2. Calculer I en A avec 2 chiffres significatifs.
                  </p>
                </div>
                <div className="space-y-3">
                  <div>
                    <label className="text-xs font-medium text-slate-500 mb-1 block">Ta réponse (expression)</label>
                    <div className="flex items-center bg-indigo-50 border border-indigo-200 rounded-xl px-4 py-3 text-indigo-700 font-mono text-sm">
                      I = R/U
                      <span className="ml-auto text-red-500">✗</span>
                    </div>
                  </div>
                </div>
              </div>
              <div>
                <div className="text-xs font-semibold text-rose-500 uppercase tracking-wider mb-3">Correction IA</div>
                <div className="bg-rose-50 border border-rose-100 rounded-2xl p-5 text-sm text-slate-700 leading-relaxed mb-4">
                  <div className="flex items-start gap-2 mb-3">
                    <span className="text-rose-500 mt-0.5">⚠️</span>
                    <span><strong>Formule inversée</strong> — tu as écrit R/U au lieu de U/R.</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="text-indigo-500 mt-0.5">💡</span>
                    <span>La loi d'Ohm s'écrit U = R·I, donc I = <strong>U/R</strong>.</span>
                  </div>
                </div>
                <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-4 text-sm">
                  <div className="text-emerald-700 font-semibold mb-2">Exercices suggérés :</div>
                  <div className="space-y-2">
                    {["Rearrangement algébrique d'Ohm (×3)", "Conversion mA ↔ A (×5)"].map((ex) => (
                      <div key={ex} className="flex items-center gap-2 text-slate-600">
                        <span className="w-5 h-5 bg-emerald-200 rounded-full flex items-center justify-center text-xs">→</span>
                        {ex}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* STATS */}
      <section className="py-16 px-6 bg-white border-y border-slate-100">
        <div className="max-w-5xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-8">
          {stats.map((s) => (
            <div key={s.label} className="text-center">
              <div className={`text-3xl font-extrabold ${s.color} mb-1`}>{s.value}</div>
              <div className="text-sm text-slate-500">{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* FEATURES */}
      <section id="fonctionnalites" className="py-24 px-6 bg-slate-50">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-extrabold text-slate-900 mb-4">
              Tout ce qu'un bon prof fait — en permanence
            </h2>
            <p className="text-lg text-slate-500 max-w-2xl mx-auto">
              La plateforme ne teste pas ce que tu sais déjà. Elle t'enseigne ce que tu ne maîtrises pas encore.
            </p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((f) => (
              <div key={f.title} className={`${f.bg} rounded-3xl p-7 border border-white shadow-sm hover:shadow-md transition-shadow`}>
                <div className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${f.color} flex items-center justify-center text-2xl mb-4 shadow-lg`}>
                  {f.icon}
                </div>
                <h3 className="font-bold text-slate-900 text-lg mb-2">{f.title}</h3>
                <p className="text-slate-600 text-sm leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* PRICING */}
      <section id="tarifs" className="py-24 px-6 bg-white">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-extrabold text-slate-900 mb-4">Tarifs simples</h2>
            <p className="text-lg text-slate-500">Commencez gratuitement, sans carte bancaire.</p>
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                name: "Individuel",
                price: "€7",
                per: "/mois",
                desc: "Pour un élève, payé par un parent ou l'élève.",
                features: ["Tous les exercices SPC", "Tuteur IA illimité", "Correction de photos (30/mois)", "Carte de maîtrise personnelle", "Résumé de progression parents"],
                cta: "Commencer",
                highlight: false,
              },
              {
                name: "Établissement",
                price: "€5",
                per: "/élève/mois",
                desc: "Pour lycées, centres de soutien, profs privés.",
                features: ["Tout l'offre Individuel", "Tableau de bord enseignant", "Création d'exercices IA", "Correction de copies en lot", "Heatmap de compétences par classe", "Gestion des sièges & factures"],
                cta: "Contacter l'équipe",
                highlight: true,
              },
              {
                name: "Entreprise",
                price: "Sur devis",
                per: "",
                desc: "Réseaux d'établissements, contenus personnalisés.",
                features: ["Tout l'offre Établissement", "Contrat personnalisé", "Contenu sur mesure", "Intégration EcoleDirecte / GAR", "Support dédié & onboarding"],
                cta: "Nous contacter",
                highlight: false,
              },
            ].map((p) => (
              <div
                key={p.name}
                className={`rounded-3xl p-8 border flex flex-col ${
                  p.highlight
                    ? "bg-indigo-600 border-indigo-600 text-white shadow-2xl shadow-indigo-200 scale-105"
                    : "bg-white border-slate-200"
                }`}
              >
                <div className={`text-sm font-semibold uppercase tracking-wider mb-4 ${p.highlight ? "text-indigo-200" : "text-slate-400"}`}>
                  {p.name}
                </div>
                <div className="mb-2">
                  <span className="text-4xl font-extrabold">{p.price}</span>
                  <span className={`text-sm ${p.highlight ? "text-indigo-200" : "text-slate-400"}`}>{p.per}</span>
                </div>
                <p className={`text-sm mb-6 ${p.highlight ? "text-indigo-100" : "text-slate-500"}`}>{p.desc}</p>
                <ul className="space-y-3 mb-8 flex-1">
                  {p.features.map((f) => (
                    <li key={f} className={`flex items-start gap-2 text-sm ${p.highlight ? "text-indigo-100" : "text-slate-600"}`}>
                      <span className={`mt-0.5 ${p.highlight ? "text-indigo-200" : "text-indigo-500"}`}>✓</span>
                      {f}
                    </li>
                  ))}
                </ul>
                <Link
                  href="/auth/signup"
                  className={`text-center font-semibold py-3 rounded-xl transition-all ${
                    p.highlight
                      ? "bg-white text-indigo-600 hover:bg-indigo-50"
                      : "bg-indigo-600 text-white hover:bg-indigo-700"
                  }`}
                >
                  {p.cta}
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA FOOTER */}
      <section className="py-24 px-6 bg-gradient-to-br from-indigo-600 to-violet-700 text-white text-center">
        <div className="max-w-2xl mx-auto">
          <h2 className="text-4xl font-extrabold mb-4">Prêt à progresser en physique-chimie ?</h2>
          <p className="text-indigo-100 text-lg mb-10">Rejoins des élèves qui comprennent enfin pourquoi ils se trompent.</p>
          <Link
            href="/auth/signup"
            className="inline-flex items-center gap-2 bg-white text-indigo-600 font-bold px-10 py-4 rounded-2xl text-lg hover:bg-indigo-50 transition-all shadow-xl"
          >
            Commencer gratuitement →
          </Link>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="py-10 px-6 bg-slate-900 text-slate-400 text-center text-sm">
        <div className="flex items-center justify-center gap-2 mb-3">
          <div className="w-6 h-6 rounded-md bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center text-white font-bold text-xs">S</div>
          <span className="font-semibold text-white">SPC Platform</span>
        </div>
        <p>© 2026 Platform SPC — Physique-Chimie avec IA · Données protégées · RGPD conforme</p>
      </footer>
    </div>
  );
}
