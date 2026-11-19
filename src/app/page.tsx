"use client";
import { useState } from "react";
import Link from "next/link";

type DemoScenario = "wrong_formula" | "unit_conversion" | "handwritten";
type AudienceTab = "students" | "teachers" | "parents" | "schools";

const DEMO_SCENARIOS: Record<
  DemoScenario,
  {
    pill: string;
    studentInput: string;
    inputType: string;
    badge: string;
    badgeCls: string;
    score: string;
    errorTag?: string;
    engineNote: string;
    tutorExplanation: string;
    nextSteps: string[];
  }
> = {
  wrong_formula: {
    pill: "I = R / U",
    studentInput: "I = R / U",
    inputType: "Expression littérale",
    badge: "Erreur identifiée",
    badgeCls: "bg-rose-100 text-rose-700",
    score: "0 / 1 · Crédit partiel actif",
    errorTag: "formule_inversee",
    engineNote: "SymPy détecte l'inversion exacte de la relation U = R·I.",
    tutorExplanation:
      "Tu connais la loi d'Ohm, mais tu as inversé la fraction ! Pars de U = R × I : pour isoler I, on divise les deux côtés par R, ce qui donne I = U / R.",
    nextSteps: [
      "3 exercices rapides d'isolation algébrique",
      "Révision espacée programmée dans 3 jours",
    ],
  },
  unit_conversion: {
    pill: "260 mA",
    studentInput: "260 mA",
    inputType: "Grandeur + unité",
    badge: "Accepté automatiquement ✓",
    badgeCls: "bg-emerald-100 text-emerald-700",
    score: "100% · Équivalence validée",
    engineNote: "Pint convertit 260 mA → 0,26 A et valide les 2 chiffres significatifs.",
    tutorExplanation:
      "Bravo ! Même si le corrigé indique 0,26 A, ta réponse 260 mA représente exactement la même intensité avec la bonne précision.",
    nextSteps: [
      "Compétence « Conversion d'unités » : +12% maîtrise",
      "Passage au niveau Type Bac recommandé",
    ],
  },
  handwritten: {
    pill: "📸 Photo copie papier",
    studentInput: "Étape 1 : U = R·I ✓   |   Étape 2 : I = 12/47 = 0,255319 A",
    inputType: "Copie manuscrite photographiée",
    badge: "Crédit partiel 85%",
    badgeCls: "bg-amber-100 text-amber-800",
    score: "0,85 / 1 · Chiffres significatifs",
    errorTag: "chiffres_significatifs",
    engineNote: "Transcription confirmée par l'élève → vérifiée par le même moteur SymPy + Pint.",
    tutorExplanation:
      "Ta formule et ton calcul sur feuille sont parfaits ! Il manque juste l'arrondi à 2 chiffres significatifs demandé dans l'énoncé : écris 0,26 A.",
    nextSteps: [
      "Mini-atelier : arrondir aux chiffres significatifs",
      "Aucune double pénalité sur les questions suivantes",
    ],
  },
};

const AUDIENCE_DATA: Record<
  AudienceTab,
  {
    icon: string;
    label: string;
    headline: string;
    desc: string;
    points: { icon: string; title: string; text: string }[];
    cta: string;
    ctaHref: string;
    accent: string;
  }
> = {
  students: {
    icon: "🎓",
    label: "Élèves",
    headline: "Comprends enfin pourquoi tu perds des points au lycée",
    desc: "De la Seconde à la Terminale Spécialité : chaque erreur devient une explication claire en français et un entraînement ciblé jusqu'à la maîtrise.",
    points: [
      { icon: "⚡", title: "Correction flexible", text: "Virgule ou point, 0,26 A ou 260 mA, formes équivalentes : on évalue ta physique, pas ta frappe." },
      { icon: "🤖", title: "Tuteur IA qui guide", text: "Des indices progressifs avant la solution complète pour te faire réfléchir sans bloquer." },
      { icon: "📸", title: "Travail sur papier", text: "Modes « J'ai une question », « Corrige-moi » et « Note-moi » sur photo de ta vraie feuille." },
      { icon: "🗺️", title: "Carte de maîtrise", text: "Vois tes compétences acquises, fragiles et tes révisions espacées avant le Bac." },
    ],
    cta: "Commencer gratuitement →",
    ctaHref: "/auth/signup",
    accent: "from-indigo-600 to-violet-600",
  },
  teachers: {
    icon: "👨‍🏫",
    label: "Enseignants & Tuteurs",
    headline: "Gagnez des heures et voyez immédiatement où la classe bloque",
    desc: "Gérez plusieurs classes, créez des exercices type Bac vérifiés en quelques secondes et pré-corrigez des piles de copies manuscrites.",
    points: [
      { icon: "🏫", title: "Multi-classes intégré", text: "Créez autant de classes que nécessaire avec codes d'invitation uniques et suivis séparés." },
      { icon: "✨", title: "Création assistée par IA", text: "Décrivez un sujet : l'IA génère l'énoncé paramétré, vérifié sur 50 tirages avant votre validation." },
      { icon: "📊", title: "Heatmap élèves × compétences", text: "Repérez qu'une notion bloque 68% de la classe et envoyez une remédiation en 1 clic." },
      { icon: "🖼️", title: "Pré-correction de copies", text: "Photographiez vos DS, ajustez la note et le commentaire, puis publiez dans les profils." },
    ],
    cta: "Créer mon espace enseignant →",
    ctaHref: "/auth/signup",
    accent: "from-emerald-600 to-teal-600",
  },
  parents: {
    icon: "👪",
    label: "Parents",
    headline: "Un suivi simple et rassurant, sans devoir réviser la Terminale",
    desc: "Suivez la régularité de travail, les vraies lacunes corrigées et les progrès de votre enfant avec un résumé clair chaque semaine.",
    points: [
      { icon: "📈", title: "Résumé hebdomadaire lisible", text: "Temps travaillé, exercices réussis et compétences à renforcer en un coup d'œil." },
      { icon: "🔗", title: "Liaison automatique", text: "Indiquez l'e-mail de votre enfant : son compte se rattache automatiquement au vôtre." },
      { icon: "💳", title: "Plan individuel accessible", text: "Pas besoin de passer par une école — abonnement mensuel ou annuel sans engagement." },
      { icon: "🛡️", title: "RGPD Mineurs natif", text: "Photos privées supprimées automatiquement sous 30 ou 90 jours, jamais vendues." },
    ],
    cta: "Inscrire mon enfant →",
    ctaHref: "/auth/signup",
    accent: "from-pink-600 to-rose-600",
  },
  schools: {
    icon: "🏛️",
    label: "Établissements",
    headline: "Déployez une plateforme sérieuse à l'échelle du lycée",
    desc: "Administration centralisée des enseignants, licences élèves dégressives, rapports par niveau et conformité RGPD complète.",
    points: [
      { icon: "🎟️", title: "Gestion des sièges", text: "Achetez, attribuez ou libérez des licences élèves avec tarifs dégressifs par volume." },
      { icon: "📊", title: "Analytics par niveau", text: "Pilotez la progression Seconde, Première et Terminale sans exposer les chats privés des élèves." },
      { icon: "📜", title: "DPA & facturation UE", text: "Accord de traitement RGPD inclus et factures conformes TVA UE via Paddle." },
      { icon: "🔌", title: "Prêt pour grandir", text: "Architecture modulaire prévue pour accueillir les Mathématiques et intégrations ENT/GAR." },
    ],
    cta: "Créer un espace établissement →",
    ctaHref: "/auth/signup",
    accent: "from-slate-800 to-indigo-700",
  },
};

function getOrgUnitPrice(seats: number): number | null {
  if (seats >= 300) return null;
  if (seats >= 150) return 4;
  if (seats >= 60) return 5;
  if (seats >= 30) return 6;
  return 7;
}

export default function LandingPage() {
  const [demoKey, setDemoKey] = useState<DemoScenario>("wrong_formula");
  const [audience, setAudience] = useState<AudienceTab>("students");
  const [orgSeats, setOrgSeats] = useState<number>(80);

  const demo = DEMO_SCENARIOS[demoKey];
  const activeAudience = AUDIENCE_DATA[audience];
  const orgUnit = getOrgUnitPrice(orgSeats);

  return (
    <div className="min-h-screen bg-white text-slate-900 overflow-x-hidden">
      {/* STICKY GLASS NAV */}
      <header className="fixed top-0 inset-x-0 z-50 bg-white/85 backdrop-blur-md border-b border-slate-100">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between gap-4">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-600 to-violet-600 flex items-center justify-center text-white font-extrabold text-sm shadow-md shadow-indigo-200">
              S
            </div>
            <div className="leading-tight">
              <span className="font-extrabold text-slate-900 text-base block">SPC Platform</span>
              <span className="text-[10px] font-semibold text-indigo-600 uppercase tracking-wider">
                Physique-Chimie · IA
              </span>
            </div>
          </Link>

          <nav className="hidden md:flex items-center gap-7 text-sm font-medium text-slate-600">
            <a href="#difference" className="hover:text-indigo-600 transition-colors">Pourquoi nous</a>
            <a href="#espaces" className="hover:text-indigo-600 transition-colors">Pour qui ?</a>
            <a href="#fonctionnement" className="hover:text-indigo-600 transition-colors">Comment ça marche</a>
            <a href="#tarifs" className="hover:text-indigo-600 transition-colors">Tarifs</a>
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
              className="text-sm font-bold bg-indigo-600 text-white px-4 py-2.5 rounded-xl hover:bg-indigo-700 transition-all shadow-md shadow-indigo-200"
            >
              Essai gratuit
            </Link>
          </div>
        </div>
      </header>

      {/* HERO SECTION */}
      <section className="relative pt-28 pb-20 px-6 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-indigo-50 via-white to-white">
        <div className="max-w-7xl mx-auto grid lg:grid-cols-12 gap-12 items-center">
          {/* Left copy */}
          <div className="lg:col-span-6 text-center lg:text-left">
            <div className="inline-flex items-center gap-2 bg-white border border-indigo-100 shadow-xs text-indigo-700 text-xs font-bold px-3.5 py-1.5 rounded-full mb-6">
              <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
              Programme français · Seconde · Première · Terminale
            </div>

            <h1 className="text-4xl sm:text-5xl xl:text-6xl font-extrabold text-slate-900 tracking-tight leading-[1.08] mb-6">
              La plateforme qui{" "}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 via-violet-600 to-fuchsia-600">
                enseigne vraiment
              </span>
              , pas seulement qui note.
            </h1>

            <p className="text-lg text-slate-600 leading-relaxed mb-8 max-w-xl mx-auto lg:mx-0">
              Un tuteur IA de Physique-Chimie qui lit tes formules, tes unités et même{" "}
              <strong className="text-slate-800">tes photos de copies papier</strong>, t&apos;explique{" "}
              <strong className="text-slate-800">pourquoi</strong> tu t&apos;es trompé et te fait pratiquer jusqu&apos;à ce que tu maîtrises.
            </p>

            <div className="flex flex-col sm:flex-row items-center lg:items-start justify-center lg:justify-start gap-3.5 mb-8">
              <Link
                href="/auth/signup"
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-indigo-600 text-white font-bold px-7 py-4 rounded-2xl hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-200 text-base"
              >
                Créer un compte gratuit →
              </Link>
              <Link
                href="/auth/login"
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-white text-slate-700 font-bold px-7 py-4 rounded-2xl border border-slate-200 hover:border-indigo-300 hover:text-indigo-700 transition-all text-base"
              >
                Se connecter
              </Link>
            </div>

            <div className="flex flex-wrap items-center justify-center lg:justify-start gap-x-6 gap-y-2 text-xs font-semibold text-slate-500">
              <span className="flex items-center gap-1.5"><span className="text-emerald-500">✓</span> Sans carte bancaire</span>
              <span className="flex items-center gap-1.5"><span className="text-emerald-500">✓</span> Moteur SymPy + Pint</span>
              <span className="flex items-center gap-1.5"><span className="text-emerald-500">✓</span> RGPD Mineurs &amp; EU</span>
            </div>
          </div>

          {/* Right: Live Interactive Physics Evaluation Demo */}
          <div className="lg:col-span-6">
            <div className="bg-white rounded-3xl shadow-2xl shadow-indigo-100/80 border border-slate-200/80 overflow-hidden">
              {/* Browser Chrome */}
              <div className="bg-slate-900 px-5 py-3 flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-rose-400" />
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
                </div>
                <span className="text-[11px] font-mono text-slate-400">
                  Démo interactive · Loi d&apos;Ohm (R = 47 Ω, U = 12 V)
                </span>
                <span className="text-[10px] font-bold bg-indigo-500/20 text-indigo-300 px-2 py-0.5 rounded-full">
                  LIVE
                </span>
              </div>

              <div className="p-6 space-y-5">
                {/* Interactive test buttons */}
                <div>
                  <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2">
                    Clique sur une réponse d&apos;élève pour tester le moteur :
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    {(Object.keys(DEMO_SCENARIOS) as DemoScenario[]).map((key) => {
                      const item = DEMO_SCENARIOS[key];
                      const active = demoKey === key;
                      return (
                        <button
                          key={key}
                          onClick={() => setDemoKey(key)}
                          className={`px-3 py-2.5 rounded-xl text-xs font-bold border transition-all text-center ${
                            active
                              ? "bg-indigo-600 text-white border-indigo-600 shadow-md shadow-indigo-100"
                              : "bg-slate-50 text-slate-700 border-slate-200 hover:border-indigo-300"
                          }`}
                        >
                          {item.pill}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Selected student answer display */}
                <div key={demoKey} className="space-y-4 animate-fade-in">
                  <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100">
                    <div className="flex items-center justify-between text-[11px] text-slate-400 mb-1">
                      <span>{demo.inputType}</span>
                      <span className="font-mono font-bold text-slate-600">{demo.score}</span>
                    </div>
                    <div className="font-mono text-sm font-bold text-slate-900">
                      {demo.studentInput}
                    </div>
                  </div>

                  {/* Diagnosis + Explanation card */}
                  <div className="rounded-2xl border border-indigo-100 bg-gradient-to-br from-indigo-50/60 to-white p-5 space-y-3">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${demo.badgeCls}`}>
                        {demo.badge}
                      </span>
                      {demo.errorTag && (
                        <span className="text-[11px] font-mono font-bold bg-white border border-rose-200 text-rose-600 px-2.5 py-0.5 rounded-full">
                          {demo.errorTag}
                        </span>
                      )}
                    </div>

                    <p className="text-xs font-semibold text-indigo-700">
                      ⚙️ {demo.engineNote}
                    </p>

                    <div className="bg-white rounded-xl p-3.5 border border-slate-100 text-sm text-slate-700 leading-relaxed">
                      <span className="font-bold text-slate-900">🤖 Tuteur IA : </span>
                      {demo.tutorExplanation}
                    </div>

                    <div className="flex flex-wrap gap-2 pt-1">
                      {demo.nextSteps.map((step) => (
                        <span
                          key={step}
                          className="text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-100 px-2.5 py-1 rounded-lg"
                        >
                          → {step}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* METRICS BAR */}
      <section className="py-10 px-6 border-y border-slate-100 bg-slate-50/70">
        <div className="max-w-6xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
          {[
            { value: "≥ 95%", label: "Accord avec un prof de SPC", color: "text-indigo-600" },
            { value: "4 espaces", label: "Élève · Prof · Parent · Lycée", color: "text-violet-600" },
            { value: "SymPy + Pint", label: "Vérification par code, pas au hasard", color: "text-emerald-600" },
            { value: "100% FR", label: "Vocabulaire & barèmes du Bac", color: "text-orange-600" },
          ].map((m) => (
            <div key={m.label}>
              <div className={`text-2xl sm:text-3xl font-extrabold ${m.color}`}>{m.value}</div>
              <div className="text-xs sm:text-sm text-slate-500 mt-1 font-medium">{m.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* BEFORE / AFTER COMPARISON */}
      <section id="difference" className="py-24 px-6 bg-white">
        <div className="max-w-6xl mx-auto">
          <div className="text-center max-w-2xl mx-auto mb-14">
            <span className="text-xs font-extrabold uppercase tracking-wider text-indigo-600 bg-indigo-50 px-3 py-1 rounded-full">
              La différence
            </span>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 mt-4 mb-3">
              On commence là où les plateformes classiques s&apos;arrêtent
            </h2>
            <p className="text-slate-500 text-base">
              Une virgule, une unité équivalente ou un espace ne devrait jamais compter faux. Et une vraie erreur mérite une vraie explication.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            {/* Old way */}
            <div className="rounded-3xl border border-slate-200 bg-slate-50 p-8">
              <div className="flex items-center gap-2.5 mb-6">
                <span className="w-9 h-9 rounded-xl bg-slate-200 flex items-center justify-center text-lg">😕</span>
                <div>
                  <h3 className="font-extrabold text-slate-700 text-lg">Plateformes d&apos;exercices classiques</h3>
                  <p className="text-xs text-slate-400">Testent ce que l&apos;élève sait déjà</p>
                </div>
              </div>
              <ul className="space-y-3.5 text-sm text-slate-600">
                {[
                  "Compare du texte brut : un espace ou « 600 mA » au lieu de « 0,6 A » est marqué faux",
                  "Verdict binaire juste / faux sans nommer l'erreur",
                  "Aucune explication personnalisée ni remédiation sur les prérequis",
                  "Ignore complètement le travail sur papier (alors que le Bac est sur papier)",
                  "Création d'exercices rigide champ par champ pour les enseignants",
                  "Aucun abonnement direct pour un élève ou un parent",
                ].map((item) => (
                  <li key={item} className="flex items-start gap-2.5">
                    <span className="text-rose-400 font-bold mt-0.5">✕</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* New way */}
            <div className="rounded-3xl border-2 border-indigo-500 bg-gradient-to-br from-indigo-50/70 via-white to-violet-50/60 p-8 shadow-xl shadow-indigo-100/60">
              <div className="flex items-center gap-2.5 mb-6">
                <span className="w-9 h-9 rounded-xl bg-indigo-600 text-white flex items-center justify-center text-lg shadow-md">
                  ⚡
                </span>
                <div>
                  <h3 className="font-extrabold text-slate-900 text-lg">SPC Platform</h3>
                  <p className="text-xs text-indigo-600 font-semibold">Corrige comme un prof, accompagne comme un tuteur</p>
                </div>
              </div>
              <ul className="space-y-3.5 text-sm text-slate-800 font-medium">
                {[
                  "Évalue le sens physique : algèbre équivalente (SymPy), conversions d'unités (Pint) & chiffres significatifs",
                  "Crédit partiel, erreur nommée avec précision, sans jamais pénaliser deux fois la même faute",
                  "Tuteur IA guidé en français + parcours adaptatif ciblé et révisions espacées",
                  "Photo de copie manuscrite confirmée par l'élève et corrigée par le même moteur",
                  "Création d'exercices par IA vérifiés automatiquement + pré-correction de copies",
                  "Accessible aux élèves individuels, professeurs indépendants et lycées complets",
                ].map((item) => (
                  <li key={item} className="flex items-start gap-2.5">
                    <span className="text-emerald-600 font-bold mt-0.5">✓</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* 4-ROLE TABBED SHOWCASE */}
      <section id="espaces" className="py-24 px-6 bg-slate-50">
        <div className="max-w-6xl mx-auto">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <span className="text-xs font-extrabold uppercase tracking-wider text-violet-700 bg-violet-100 px-3 py-1 rounded-full">
              Un écosystème complet
            </span>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 mt-4 mb-3">
              Conçu pour chaque acteur de la réussite
            </h2>
            <p className="text-slate-500">
              Explorez l&apos;interface dédiée à votre rôle.
            </p>
          </div>

          {/* Tabs */}
          <div className="flex flex-wrap justify-center gap-2.5 mb-10">
            {(Object.keys(AUDIENCE_DATA) as AudienceTab[]).map((key) => {
              const item = AUDIENCE_DATA[key];
              const active = audience === key;
              return (
                <button
                  key={key}
                  onClick={() => setAudience(key)}
                  className={`px-5 py-3 rounded-2xl text-sm font-bold transition-all flex items-center gap-2 ${
                    active
                      ? "bg-indigo-600 text-white shadow-lg shadow-indigo-200"
                      : "bg-white text-slate-600 border border-slate-200 hover:border-indigo-300"
                  }`}
                >
                  <span>{item.icon}</span>
                  <span>{item.label}</span>
                </button>
              );
            })}
          </div>

          {/* Active role card */}
          <div
            key={audience}
            className="bg-white rounded-3xl border border-slate-100 shadow-xl p-8 lg:p-10 animate-fade-in"
          >
            <div className="grid lg:grid-cols-12 gap-8 items-center">
              <div className="lg:col-span-5">
                <div
                  className={`inline-flex items-center gap-2 text-white text-xs font-bold px-3.5 py-1.5 rounded-full bg-gradient-to-r ${activeAudience.accent} mb-4`}
                >
                  {activeAudience.icon} Espace {activeAudience.label}
                </div>
                <h3 className="text-2xl sm:text-3xl font-extrabold text-slate-900 leading-tight mb-4">
                  {activeAudience.headline}
                </h3>
                <p className="text-slate-600 text-sm sm:text-base leading-relaxed mb-7">
                  {activeAudience.desc}
                </p>
                <Link
                  href={activeAudience.ctaHref}
                  className={`inline-flex items-center gap-2 bg-gradient-to-r ${activeAudience.accent} text-white font-bold px-6 py-3.5 rounded-2xl shadow-lg hover:opacity-95 transition-opacity text-sm`}
                >
                  {activeAudience.cta}
                </Link>
              </div>

              <div className="lg:col-span-7 grid sm:grid-cols-2 gap-4">
                {activeAudience.points.map((pt) => (
                  <div
                    key={pt.title}
                    className="bg-slate-50 rounded-2xl p-5 border border-slate-100 hover:border-indigo-200 transition-colors"
                  >
                    <div className="text-2xl mb-2.5">{pt.icon}</div>
                    <h4 className="font-bold text-slate-900 text-sm mb-1">{pt.title}</h4>
                    <p className="text-xs text-slate-600 leading-relaxed">{pt.text}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 4-STEP JOURNEY */}
      <section id="fonctionnement" className="py-24 px-6 bg-white">
        <div className="max-w-6xl mx-auto">
          <div className="text-center max-w-2xl mx-auto mb-14">
            <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 mb-3">
              Comment une erreur devient un acquis durable
            </h2>
            <p className="text-slate-500">
              Un cycle pédagogique complet inspiré des meilleures pratiques d&apos;enseignement.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {[
              { step: "01", icon: "✍️", title: "Résous ou photographie", desc: "Tape ta formule avec éditeur d'équations ou prends en photo ta copie papier." },
              { step: "02", icon: "⚙️", title: "Vérification par code", desc: "SymPy & Pint valident le sens mathématique, les unités et les chiffres significatifs." },
              { step: "03", icon: "💬", title: "Explication personnelle", desc: "Le tuteur IA t'explique ton erreur précise en français et te guide étape par étape." },
              { step: "04", icon: "🔁", title: "Suivi & révision espacée", desc: "Des exercices ciblés renforcent la compétence, puis la revérifient quelques jours plus tard." },
            ].map((s) => (
              <div key={s.step} className="relative bg-slate-50 rounded-3xl p-6 border border-slate-100">
                <div className="flex items-center justify-between mb-4">
                  <span className="w-11 h-11 rounded-2xl bg-white border border-slate-200 flex items-center justify-center text-2xl shadow-xs">
                    {s.icon}
                  </span>
                  <span className="text-xs font-extrabold font-mono text-indigo-400">{s.step}</span>
                </div>
                <h3 className="font-bold text-slate-900 text-base mb-1.5">{s.title}</h3>
                <p className="text-xs text-slate-600 leading-relaxed">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* PRICING WITH INTERACTIVE VOLUME SLIDER */}
      <section id="tarifs" className="py-24 px-6 bg-slate-50">
        <div className="max-w-6xl mx-auto">
          <div className="text-center max-w-2xl mx-auto mb-14">
            <span className="text-xs font-extrabold uppercase tracking-wider text-emerald-700 bg-emerald-100 px-3 py-1 rounded-full">
              Tarifs transparents
            </span>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 mt-4 mb-3">
              Pour un élève seul comme pour tout un lycée
            </h2>
            <p className="text-slate-500">
              Essai gratuit sans carte bancaire. Facturation TVA UE gérée via Paddle.
            </p>
          </div>

          <div className="grid lg:grid-cols-3 gap-7 items-stretch">
            {/* Individual */}
            <div className="bg-white rounded-3xl p-8 border border-slate-200 flex flex-col">
              <div className="text-xs font-extrabold uppercase tracking-wider text-slate-400 mb-3">
                Individuel
              </div>
              <div className="flex items-baseline gap-1 mb-2">
                <span className="text-4xl font-extrabold text-slate-900">7 €</span>
                <span className="text-sm text-slate-400">/ mois</span>
              </div>
              <p className="text-xs text-slate-500 mb-6">
                Pour 1 élève (ou 69 €/an — 2 mois offerts). Compte parent inclus.
              </p>
              <ul className="space-y-3 text-sm text-slate-600 flex-1 mb-8">
                {[
                  "Exercices illimités (Seconde → Terminale)",
                  "Correction intelligente SymPy + Pint",
                  "Tuteur IA guidé en français",
                  "Correction de photos manuscrites (quota mensuel)",
                  "Carte de maîtrise & résumé parents",
                ].map((f) => (
                  <li key={f} className="flex items-start gap-2">
                    <span className="text-indigo-500 font-bold">✓</span>
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
              <Link
                href="/auth/signup"
                className="block text-center bg-slate-900 text-white font-bold py-3.5 rounded-xl hover:bg-slate-800 transition-colors text-sm"
              >
                Démarrer l&apos;essai gratuit
              </Link>
            </div>

            {/* Organization (with live seat slider!) */}
            <div className="bg-gradient-to-b from-indigo-600 to-violet-700 text-white rounded-3xl p-8 shadow-2xl shadow-indigo-200 flex flex-col relative">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-extrabold uppercase tracking-wider text-indigo-200">
                  Établissement &amp; Tuteurs
                </span>
                <span className="text-[11px] font-bold bg-white/20 px-2.5 py-0.5 rounded-full">
                  Dégressif
                </span>
              </div>

              <div className="flex items-baseline gap-1.5 mb-1">
                <span className="text-4xl font-extrabold">
                  {orgUnit ? `${orgUnit} €` : "Sur devis"}
                </span>
                {orgUnit && <span className="text-sm text-indigo-200">/ élève</span>}
              </div>
              <p className="text-xs text-indigo-100 mb-5">
                Estimez votre tarif selon le nombre d&apos;élèves :
              </p>

              {/* Volume slider */}
              <div className="bg-white/10 border border-white/15 rounded-2xl p-4 mb-6">
                <div className="flex justify-between text-xs font-bold mb-2">
                  <span>{orgSeats >= 300 ? "300+ élèves" : `${orgSeats} élèves`}</span>
                  <span className="text-indigo-200">
                    {orgUnit ? `Total : ${orgSeats * orgUnit} €` : "Tarif réseau"}
                  </span>
                </div>
                <input
                  type="range"
                  min={10}
                  max={300}
                  step={10}
                  value={orgSeats}
                  onChange={(e) => setOrgSeats(Number(e.target.value))}
                  className="w-full accent-white cursor-pointer"
                />
                <div className="flex justify-between text-[10px] text-indigo-200 mt-1">
                  <span>10 (7€)</span>
                  <span>30 (6€)</span>
                  <span>60 (5€)</span>
                  <span>150 (4€)</span>
                  <span>300+</span>
                </div>
              </div>

              <ul className="space-y-2.5 text-sm text-indigo-50 flex-1 mb-8">
                {[
                  "Tout le plan Individuel pour chaque élève",
                  "Multi-classes illimitées + codes d'invitation",
                  "Création d'exercices IA vérifiés + heatmap",
                  "Pré-correction de piles de copies papier",
                  "Portail Admin : sièges, factures & DPA RGPD",
                ].map((f) => (
                  <li key={f} className="flex items-start gap-2">
                    <span className="text-emerald-300 font-bold">✓</span>
                    <span>{f}</span>
                  </li>
                ))}
              </ul>

              <Link
                href="/auth/signup"
                className="block text-center bg-white text-indigo-700 font-extrabold py-3.5 rounded-xl hover:bg-indigo-50 transition-colors text-sm shadow-lg"
              >
                Créer un espace établissement →
              </Link>
            </div>

            {/* Enterprise */}
            <div className="bg-white rounded-3xl p-8 border border-slate-200 flex flex-col">
              <div className="text-xs font-extrabold uppercase tracking-wider text-slate-400 mb-3">
                Réseau &amp; Entreprise
              </div>
              <div className="flex items-baseline gap-1 mb-2">
                <span className="text-4xl font-extrabold text-slate-900">Sur devis</span>
              </div>
              <p className="text-xs text-slate-500 mb-6">
                Groupes scolaires, lycées français à l&apos;étranger (AEFE) et académies.
              </p>
              <ul className="space-y-3 text-sm text-slate-600 flex-1 mb-8">
                {[
                  "Plusieurs départements & établissements",
                  "Contenus et barèmes personnalisés",
                  "Intégration ENT (EcoleDirecte, GAR)",
                  "Accompagnement & formation des équipes",
                  "Support prioritaire & SLA dédié",
                ].map((f) => (
                  <li key={f} className="flex items-start gap-2">
                    <span className="text-indigo-500 font-bold">✓</span>
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
              <Link
                href="/auth/signup"
                className="block text-center border border-slate-300 text-slate-800 font-bold py-3.5 rounded-xl hover:border-indigo-400 hover:text-indigo-700 transition-colors text-sm"
              >
                Demander une démonstration
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* TRUST & FINAL CTA */}
      <section className="py-20 px-6 bg-slate-900 text-white">
        <div className="max-w-5xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 bg-white/10 text-indigo-200 text-xs font-bold px-3.5 py-1.5 rounded-full mb-5">
            🛡️ Sécurité &amp; RGPD dès la conception
          </div>
          <h2 className="text-3xl sm:text-4xl font-extrabold mb-4">
            Prêt à transformer l&apos;apprentissage de la Physique-Chimie ?
          </h2>
          <p className="text-slate-300 max-w-2xl mx-auto text-base mb-9 leading-relaxed">
            Données hébergées de façon sécurisée avec Row-Level Security, photos supprimées automatiquement, et contenu original aligné sur les programmes officiels.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3.5">
            <Link
              href="/auth/signup"
              className="w-full sm:w-auto bg-indigo-500 hover:bg-indigo-400 text-white font-extrabold px-8 py-4 rounded-2xl transition-colors shadow-xl text-base"
            >
              Commencer gratuitement →
            </Link>
            <Link
              href="/auth/login"
              className="w-full sm:w-auto bg-white/10 hover:bg-white/15 text-white font-bold px-8 py-4 rounded-2xl transition-colors text-base"
            >
              J&apos;ai déjà un compte
            </Link>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="py-10 px-6 bg-slate-950 text-slate-400 text-xs">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center text-white font-bold text-xs">
              S
            </div>
            <span className="font-bold text-white">SPC Platform</span>
            <span>· Physique-Chimie avec IA</span>
          </div>
          <div className="flex items-center gap-5">
            <Link href="/auth/login" className="hover:text-white transition-colors">Connexion</Link>
            <Link href="/auth/signup" className="hover:text-white transition-colors">Inscription</Link>
            <a href="#tarifs" className="hover:text-white transition-colors">Tarifs</a>
          </div>
          <div>© 2026 Platform SPC · RGPD conforme</div>
        </div>
      </footer>
    </div>
  );
}
