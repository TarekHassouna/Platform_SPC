"use client";
import { useState } from "react";
import Link from "next/link";

type ExampleTab = "formula" | "units" | "photo";

const EXAMPLES: Record<
  ExampleTab,
  {
    label: string;
    answer: string;
    status: string;
    statusCls: string;
    feedback: string;
    tip: string;
  }
> = {
  formula: {
    label: "I = R / U",
    answer: "I = R / U",
    status: "Erreur de formule",
    statusCls: "bg-rose-100 text-rose-700",
    feedback:
      "Tu as inversé la fraction. On part de la loi d'Ohm U = R × I, donc en divisant par R on obtient I = U / R.",
    tip: "Astuce : vérifie toujours l'unité (V / Ω = A).",
  },
  units: {
    label: "260 mA",
    answer: "260 mA",
    status: "Réponse acceptée ✓",
    statusCls: "bg-emerald-100 text-emerald-700",
    feedback:
      "Bravo ! 260 mA correspond bien à 0,26 A avec 2 chiffres significatifs. Toutes les unités équivalentes sont acceptées.",
    tip: "1 A = 1000 mA — conversion parfaitement maîtrisée.",
  },
  photo: {
    label: "📸 Photo feuille",
    answer: "Copie papier : U = R·I  ⇒  I = 12/47 = 0,2553 A",
    status: "Presque parfait (85%)",
    statusCls: "bg-amber-100 text-amber-800",
    feedback:
      "Ta démarche et ton calcul sur papier sont justes ! Il suffit d'arrondir à 2 chiffres significatifs : 0,26 A.",
    tip: "Tu peux photographier tes exercices faits sur cahier.",
  },
};

const LEVELS = [
  {
    name: "Seconde",
    tag: "Bases & Méthodologie",
    color: "from-sky-500 to-indigo-500",
    bg: "bg-sky-50",
    chapters: [
      "Loi d'Ohm & circuits électriques",
      "Masse volumique & concentration",
      "Notation scientifique & unités SI",
      "Réfraction & optique géométrique",
    ],
  },
  {
    name: "Première Spécialité",
    tag: "Approfondissement",
    color: "from-emerald-500 to-teal-500",
    bg: "bg-emerald-50",
    chapters: [
      "Tableau d'avancement & réactif limitant",
      "Réactions d'oxydoréduction",
      "Quantité de matière & titrages",
      "Forces, vecteurs & énergie mécanique",
    ],
  },
  {
    name: "Terminale Spécialité",
    tag: "Préparation au Bac",
    color: "from-violet-500 to-indigo-600",
    bg: "bg-violet-50",
    chapters: [
      "Lois de Newton & chute avec frottements",
      "Acido-basicité & titrages pH-métriques",
      "Circuits RC & électricité",
      "Sujets complets type Bac sur papier",
    ],
  },
];

export default function HomePage() {
  const [example, setExample] = useState<ExampleTab>("formula");
  const current = EXAMPLES[example];

  return (
    <div className="min-h-screen bg-white text-slate-900">
      {/* CLEAN EDUCATIONAL HEADER */}
      <header className="sticky top-0 z-40 bg-white/90 backdrop-blur border-b border-slate-100">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between gap-4">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-600 to-violet-600 flex items-center justify-center text-white font-extrabold text-sm shadow-sm">
              S
            </div>
            <div className="leading-tight">
              <span className="font-extrabold text-slate-900 text-base block">SPC Platform</span>
              <span className="text-[11px] font-medium text-slate-500">
                Physique-Chimie · Lycée
              </span>
            </div>
          </Link>

          <nav className="hidden md:flex items-center gap-7 text-sm font-medium text-slate-600">
            <a href="#niveaux" className="hover:text-indigo-600 transition-colors">Niveaux &amp; chapitres</a>
            <a href="#methode" className="hover:text-indigo-600 transition-colors">Comment travailler</a>
            <a href="#espaces" className="hover:text-indigo-600 transition-colors">Accès aux espaces</a>
          </nav>

          <div className="flex items-center gap-2.5">
            <Link
              href="/auth/login"
              className="text-sm font-semibold text-slate-700 hover:text-indigo-600 px-3.5 py-2 rounded-xl transition-colors"
            >
              Connexion
            </Link>
            <Link
              href="/auth/signup"
              className="text-sm font-bold bg-indigo-600 text-white px-4 py-2 rounded-xl hover:bg-indigo-700 transition-colors shadow-sm"
            >
              Créer un compte
            </Link>
          </div>
        </div>
      </header>

      {/* WELCOME HERO */}
      <section className="py-16 lg:py-24 px-6 bg-gradient-to-b from-indigo-50/70 via-white to-white">
        <div className="max-w-6xl mx-auto grid lg:grid-cols-12 gap-12 items-center">
          <div className="lg:col-span-6">
            <div className="inline-flex items-center gap-2 bg-white border border-indigo-100 text-indigo-700 text-xs font-bold px-3.5 py-1.5 rounded-full mb-5 shadow-xs">
              🧪 Espace de travail · Physique-Chimie
            </div>

            <h1 className="text-4xl sm:text-5xl font-extrabold text-slate-900 tracking-tight leading-tight mb-5">
              Ton espace pour{" "}
              <span className="text-indigo-600">comprendre et réussir</span> en Physique-Chimie
            </h1>

            <p className="text-base sm:text-lg text-slate-600 leading-relaxed mb-8">
              Fais tes exercices et devoirs en ligne ou sur papier, reçois une correction claire qui t&apos;explique{" "}
              <strong className="text-slate-800">pourquoi</strong> une réponse est fausse, et demande de l&apos;aide au tuteur IA dès que tu bloques.
            </p>

            <div className="flex flex-col sm:flex-row gap-3 mb-6">
              <Link
                href="/auth/login"
                className="inline-flex items-center justify-center gap-2 bg-indigo-600 text-white font-bold px-7 py-3.5 rounded-2xl hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100 text-base"
              >
                Accéder à mon espace →
              </Link>
              <Link
                href="/auth/signup"
                className="inline-flex items-center justify-center gap-2 bg-white text-slate-700 font-bold px-7 py-3.5 rounded-2xl border border-slate-200 hover:border-indigo-300 hover:text-indigo-700 transition-all text-base"
              >
                Rejoindre avec un code classe
              </Link>
            </div>

            <p className="text-xs text-slate-400">
              Tu as reçu un code classe de ton professeur (ex : <code className="font-mono text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded">PHY-2026-TS1</code>) ? Utilise-le lors de ton inscription pour rejoindre directement ta classe.
            </p>
          </div>

          {/* Interactive Student Example Card */}
          <div className="lg:col-span-6">
            <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xl shadow-indigo-100/50 overflow-hidden">
              <div className="bg-slate-50 border-b border-slate-100 px-6 py-3.5 flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs font-bold text-slate-700">
                  <span>⚡</span> Exemple : Loi d&apos;Ohm (R = 47 Ω, U = 12 V)
                </div>
                <span className="text-[11px] font-semibold text-indigo-600 bg-indigo-50 px-2.5 py-0.5 rounded-full">
                  Aperçu interactif
                </span>
              </div>

              <div className="p-6 space-y-4">
                <div>
                  <div className="text-xs font-semibold text-slate-500 mb-2">
                    Teste une réponse pour voir comment la correction t&apos;aide :
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    {(Object.keys(EXAMPLES) as ExampleTab[]).map((k) => (
                      <button
                        key={k}
                        onClick={() => setExample(k)}
                        className={`py-2 px-3 rounded-xl text-xs font-bold border transition-all ${
                          example === k
                            ? "bg-indigo-600 text-white border-indigo-600 shadow-sm"
                            : "bg-slate-50 text-slate-700 border-slate-200 hover:border-indigo-300"
                        }`}
                      >
                        {EXAMPLES[k].label}
                      </button>
                    ))}
                  </div>
                </div>

                <div key={example} className="space-y-3 animate-fade-in">
                  <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100 font-mono text-sm text-slate-800">
                    {current.answer}
                  </div>

                  <div className="rounded-2xl border border-indigo-100 bg-indigo-50/40 p-4 space-y-2.5">
                    <span className={`inline-block text-xs font-bold px-2.5 py-1 rounded-full ${current.statusCls}`}>
                      {current.status}
                    </span>
                    <p className="text-sm text-slate-700 leading-relaxed">{current.feedback}</p>
                    <div className="text-xs font-medium text-indigo-700 bg-white rounded-xl px-3 py-2 border border-indigo-100">
                      💡 {current.tip}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* LEVELS & CURRICULUM */}
      <section id="niveaux" className="py-20 px-6 bg-white border-t border-slate-100">
        <div className="max-w-6xl mx-auto">
          <div className="mb-12">
            <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 mb-2">
              Programme par niveau
            </h2>
            <p className="text-slate-500 text-sm sm:text-base">
              Des exercices adaptés au programme officiel de Seconde, Première et Terminale.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {LEVELS.map((lvl) => (
              <div
                key={lvl.name}
                className="bg-white rounded-3xl border border-slate-200/80 overflow-hidden shadow-xs hover:shadow-md transition-shadow flex flex-col"
              >
                <div className={`bg-gradient-to-r ${lvl.color} p-5 text-white`}>
                  <span className="text-[11px] font-bold uppercase tracking-wider bg-white/20 px-2.5 py-0.5 rounded-full">
                    {lvl.tag}
                  </span>
                  <h3 className="text-xl font-extrabold mt-2">{lvl.name}</h3>
                </div>
                <div className="p-6 flex-1 flex flex-col justify-between">
                  <ul className="space-y-2.5 text-sm text-slate-600 mb-6">
                    {lvl.chapters.map((ch) => (
                      <li key={ch} className="flex items-start gap-2">
                        <span className="text-indigo-500 mt-0.5">•</span>
                        <span>{ch}</span>
                      </li>
                    ))}
                  </ul>
                  <Link
                    href="/auth/login"
                    className="block text-center text-xs font-bold bg-slate-50 hover:bg-indigo-50 hover:text-indigo-700 text-slate-700 border border-slate-200 py-2.5 rounded-xl transition-colors"
                  >
                    Ouvrir les exercices →
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section id="methode" className="py-20 px-6 bg-slate-50 border-t border-slate-100">
        <div className="max-w-6xl mx-auto">
          <div className="mb-12">
            <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 mb-2">
              Comment utiliser la plateforme
            </h2>
            <p className="text-slate-500 text-sm sm:text-base">
              Une méthode simple pour progresser semaine après semaine.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {[
              { num: "1", icon: "📚", title: "Ouvre ton chapitre", desc: "Retrouve les exercices de ta classe ou entraîne-toi librement sur un thème du cours." },
              { num: "2", icon: "✍️", title: "Tape ou photographie", desc: "Écris ta réponse directement ou prends en photo ton travail fait sur feuille." },
              { num: "3", icon: "🤖", title: "Comprends tes erreurs", desc: "La correction précise l'erreur (formule, unité, chiffres significatifs) et le tuteur IA te guide." },
              { num: "4", icon: "🗺️", title: "Suis ta progression", desc: "Ta carte de maîtrise se met à jour et te propose des révisions ciblées avant les contrôles." },
            ].map((step) => (
              <div key={step.num} className="bg-white rounded-3xl border border-slate-100 p-6 shadow-xs">
                <div className="flex items-center justify-between mb-4">
                  <span className="w-11 h-11 rounded-2xl bg-indigo-50 flex items-center justify-center text-2xl">
                    {step.icon}
                  </span>
                  <span className="text-xs font-extrabold text-indigo-400">Étape {step.num}</span>
                </div>
                <h3 className="font-bold text-slate-900 text-base mb-1.5">{step.title}</h3>
                <p className="text-xs text-slate-600 leading-relaxed">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ROLE PORTALS ACCESS */}
      <section id="espaces" className="py-20 px-6 bg-white border-t border-slate-100">
        <div className="max-w-6xl mx-auto">
          <div className="mb-12">
            <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 mb-2">
              Accès par espace
            </h2>
            <p className="text-slate-500 text-sm sm:text-base">
              Connecte-toi pour retrouver automatiquement ton espace dédié.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {[
              {
                icon: "🎓",
                title: "Espace Élève",
                desc: "Exercices de la classe, tuteur IA, correction de photos manuscrites et carte de maîtrise personnelle.",
                bg: "bg-indigo-50/60 border-indigo-100",
                btn: "Connexion élève",
              },
              {
                icon: "👨‍🏫",
                title: "Espace Enseignant",
                desc: "Gestion de toutes tes classes, devoirs, création d'exercices assistée, heatmap et correction de copies.",
                bg: "bg-emerald-50/60 border-emerald-100",
                btn: "Connexion enseignant",
              },
              {
                icon: "👪",
                title: "Espace Parent",
                desc: "Suivi clair du travail hebdomadaire, des progrès et des points à renforcer avant les examens.",
                bg: "bg-amber-50/60 border-amber-100",
                btn: "Connexion parent",
              },
            ].map((card) => (
              <div key={card.title} className={`${card.bg} border rounded-3xl p-7 flex flex-col justify-between`}>
                <div>
                  <div className="text-3xl mb-4">{card.icon}</div>
                  <h3 className="font-extrabold text-slate-900 text-lg mb-2">{card.title}</h3>
                  <p className="text-sm text-slate-600 leading-relaxed mb-6">{card.desc}</p>
                </div>
                <Link
                  href="/auth/login"
                  className="inline-flex items-center justify-center bg-white border border-slate-200 text-slate-800 font-bold text-xs py-3 px-4 rounded-xl hover:border-indigo-300 hover:text-indigo-700 transition-colors"
                >
                  {card.btn} →
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* SIMPLE FOOTER */}
      <footer className="py-8 px-6 bg-slate-50 border-t border-slate-100 text-slate-500 text-xs">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-gradient-to-br from-indigo-600 to-violet-600 flex items-center justify-center text-white font-bold text-xs">
              S
            </div>
            <span className="font-bold text-slate-800">SPC Platform</span>
            <span>· Espace pédagogique de Physique-Chimie</span>
          </div>
          <div className="flex items-center gap-5 flex-wrap">
            <Link href="/auth/login" className="hover:text-indigo-600 transition-colors">Connexion</Link>
            <Link href="/auth/signup" className="hover:text-indigo-600 transition-colors">Inscription</Link>
            <Link href="/privacy" className="hover:text-indigo-600 transition-colors">Confidentialité (RGPD)</Link>
            <Link href="/terms" className="hover:text-indigo-600 transition-colors">CGU</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
