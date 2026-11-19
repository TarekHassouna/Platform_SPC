"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";

type TutorMode = "guide" | "explain" | "quiz";

interface Message {
  id: string;
  role: "ai" | "user";
  text: string;
  formula?: string;
  hintStep?: string;
  suggestedFollowUp?: string[];
}

const CHAPTERS = [
  { id: "ohm", domain: "Électricité", title: "Loi d'Ohm & circuits", level: "Seconde / Terminale" },
  { id: "newton", domain: "Mécanique", title: "Lois de Newton & chute libre", level: "Terminale" },
  { id: "ph", domain: "Chimie", title: "Acido-basicité & titrages", level: "Terminale" },
  { id: "avancement", domain: "Chimie", title: "Tableau d'avancement", level: "Première" },
  { id: "unites", domain: "Métrologie", title: "Conversions & chiffres significatifs", level: "Tous niveaux" },
];

const QUICK_PROMPTS: Record<string, string[]> = {
  ohm: [
    "Je confonds toujours U = R·I et I = R/U",
    "Comment convertir 250 mA en A ?",
    "Donne-moi un exercice rapide sur la loi d'Ohm",
  ],
  newton: [
    "Comment projeter le poids sur un axe incliné ?",
    "Pourquoi la vitesse limite existe avec frottements ?",
    "Aide-moi étape par étape sur la 2e loi de Newton",
  ],
  ph: [
    "Comment repérer l'équivalence sur une courbe pH ?",
    "Quelle est la différence entre acide fort et acide faible ?",
  ],
  avancement: [
    "Comment trouver le réactif limitant sans me tromper ?",
    "Pourquoi on divise par le coefficient stœchiométrique ?",
  ],
  unites: [
    "Règle simple pour les chiffres significatifs",
    "Comment écrire 0,0045 en notation scientifique ?",
  ],
};

function generateTutorReply(input: string, mode: TutorMode, chapterTitle: string): Message {
  const lower = input.toLowerCase();

  if (lower.includes("ma") || lower.includes("convert") || lower.includes("unité")) {
    return {
      id: `m-${Date.now()}`,
      role: "ai",
      text:
        mode === "guide"
          ? "Très bonne question ! Le préfixe « milli » (m) signifie un millième (10⁻³). Avant que je fasse le calcul, à ton avis : 250 mA est-il plus grand ou plus petit que 1 A ?"
          : "Le préfixe « milli » (m) correspond à 10⁻³. Pour passer de mA à A, on divise par 1000 : 250 mA = 250 × 10⁻³ A = 0,25 A.",
      formula: "1 mA = 10⁻³ A   ⇔   I(A) = I(mA) / 1000",
      hintStep: mode === "guide" ? "Indice : divise 250 par 1000." : undefined,
      suggestedFollowUp: ["C'est plus petit, donc 0,25 A ?", "Et pour convertir des grammes en kg ?"],
    };
  }

  if (lower.includes("ohm") || lower.includes("r/u") || lower.includes("u =")) {
    return {
      id: `m-${Date.now()}`,
      role: "ai",
      text:
        mode === "guide"
          ? "Astuce pour ne plus jamais inverser ! Pars toujours de la formule de base U = R × I. Si tu veux isoler I, par quoi dois-tu diviser les deux côtés de l'équation ?"
          : "La loi d'Ohm relie la tension U (en V), la résistance R (en Ω) et l'intensité I (en A) par U = R × I. En divisant par R des deux côtés, on obtient I = U / R.",
      formula: "U = R · I   ⇒   I = U / R   et   R = U / I",
      hintStep: mode === "guide" ? "Vérifie aussi les unités : V / Ω = A !" : undefined,
      suggestedFollowUp: ["On divise par R, donc I = U/R !", "Donne-moi un mini-test"],
    };
  }

  if (lower.includes("newton") || lower.includes("frottement") || lower.includes("poids")) {
    return {
      id: `m-${Date.now()}`,
      role: "ai",
      text:
        mode === "guide"
          ? "Pour appliquer la 2e loi de Newton sans erreur, on suit 3 réflexes : 1) Système et référentiel, 2) Bilan des forces, 3) Projection sur les axes. Quelles sont les deux forces qui s'exercent sur une bille qui tombe dans un fluide ?"
          : "Lors d'une chute avec frottement f = k·v, la force de frottement augmente avec la vitesse jusqu'à compenser exactement le poids P = m·g. L'accélération devient alors nulle : la vitesse reste constante (v_lim = m·g/k).",
      formula: "ΣF = m·a   ⇒   m·g − k·v = m·(dv/dt)",
      suggestedFollowUp: ["Le poids P et la force de frottement f", "Comment trouver v_lim ?"],
    };
  }

  return {
    id: `m-${Date.now()}`,
    role: "ai",
    text:
      mode === "guide"
        ? `Super question sur « ${chapterTitle} » ! Pour bien t'aider sans te donner la réponse toute faite : quelle est la première grandeur ou formule que tu identifies dans ton énoncé ?`
        : `Voici le point clé pour « ${chapterTitle} » : commence toujours par écrire la relation littérale avec les lettres, vérifie les unités SI (kg, m, s, A, V), puis fais l'application numérique avec le bon nombre de chiffres significatifs.`,
    suggestedFollowUp: ["Montre-moi un exemple", "Je veux un exercice d'entraînement"],
  };
}

export default function StudentTutorPage() {
  const { user, logout } = useAuth();
  const router = useRouter();

  const [selectedChapter, setSelectedChapter] = useState(CHAPTERS[0]);
  const [mode, setMode] = useState<TutorMode>("guide");
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      role: "ai",
      text: "Bonjour ! Je suis ton tuteur IA de Physique-Chimie. Je m'appuie sur le programme officiel du lycée français : je te guide étape par étape pour que tu comprennes vraiment (pas juste te donner la réponse). Sur quoi veux-tu travailler ?",
      suggestedFollowUp: QUICK_PROMPTS.ohm,
    },
  ]);

  const sendMessage = (textOverride?: string) => {
    const content = (textOverride ?? input).trim();
    if (!content) return;
    const userMsg: Message = { id: `u-${Date.now()}`, role: "user", text: content };
    const aiReply = generateTutorReply(content, mode, selectedChapter.title);
    setMessages((prev) => [...prev, userMsg, aiReply]);
    setInput("");
  };

  const handleSelectChapter = (ch: typeof CHAPTERS[0]) => {
    setSelectedChapter(ch);
    setMessages([
      {
        id: `ch-${ch.id}-${Date.now()}`,
        role: "ai",
        text: `On passe au chapitre « ${ch.title} » (${ch.domain}). Pose-moi ta question, envoie une photo de ton brouillon, ou clique sur une suggestion ci-dessous !`,
        suggestedFollowUp: QUICK_PROMPTS[ch.id] || [],
      },
    ]);
  };

  const handleLogout = () => {
    logout();
    router.push("/auth/login");
  };

  const initials = user ? (user.firstName?.[0] ?? "E") + (user.lastName?.[0] ?? "") : "EL";

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Top bar */}
      <header className="bg-white border-b border-slate-100 px-6 py-3 flex items-center gap-4 sticky top-0 z-20">
        <Link href="/dashboard" className="text-slate-500 hover:text-slate-800 text-sm font-medium">
          ← Tableau de bord
        </Link>
        <span className="text-slate-200">|</span>
        <div className="flex items-center gap-2">
          <span className="text-lg">🤖</span>
          <span className="font-bold text-slate-900 text-sm">Tuteur IA Physique-Chimie</span>
          <span className="text-[11px] font-semibold bg-emerald-50 text-emerald-600 px-2 py-0.5 rounded-full">
            ● Programme officiel
          </span>
        </div>
        <div className="ml-auto flex items-center gap-3">
          <Link
            href="/photo"
            className="hidden sm:inline-flex items-center gap-1.5 text-xs font-semibold bg-indigo-50 text-indigo-700 px-3 py-1.5 rounded-xl hover:bg-indigo-100"
          >
            📸 Photo d&apos;une copie
          </Link>
          <div className="w-7 h-7 rounded-full bg-gradient-to-br from-pink-400 to-violet-500 flex items-center justify-center text-white text-xs font-bold uppercase">
            {initials}
          </div>
          <button
            onClick={handleLogout}
            className="text-xs font-medium text-rose-500 hover:text-rose-700"
          >
            🚪 Déconnexion
          </button>
        </div>
      </header>

      <div className="flex-1 max-w-6xl w-full mx-auto p-4 lg:p-6 grid lg:grid-cols-12 gap-6">
        {/* Left: Chapters & Teaching Mode */}
        <aside className="lg:col-span-4 space-y-5">
          {/* Teaching Mode selector */}
          <div className="bg-white rounded-3xl border border-slate-100 p-5 shadow-sm">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">
              Approche pédagogique
            </h2>
            <div className="grid grid-cols-3 gap-2">
              {[
                { id: "guide" as TutorMode, label: "Guidé", icon: "🧭", desc: "Indices d'abord" },
                { id: "explain" as TutorMode, label: "Cours", icon: "📖", desc: "Explication claire" },
                { id: "quiz" as TutorMode, label: "Quiz", icon: "⚡", desc: "Questions rapides" },
              ].map((m) => (
                <button
                  key={m.id}
                  onClick={() => setMode(m.id)}
                  className={`rounded-2xl p-2.5 border text-center transition-all ${
                    mode === m.id
                      ? "bg-indigo-50 border-indigo-400 text-indigo-700 ring-2 ring-indigo-100"
                      : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  <div className="text-lg">{m.icon}</div>
                  <div className="text-xs font-bold mt-0.5">{m.label}</div>
                  <div className="text-[10px] text-slate-400">{m.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Chapters grounded context */}
          <div className="bg-white rounded-3xl border border-slate-100 p-5 shadow-sm">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">
              Chapitre de référence
            </h2>
            <div className="space-y-2">
              {CHAPTERS.map((ch) => (
                <button
                  key={ch.id}
                  onClick={() => handleSelectChapter(ch)}
                  className={`w-full text-left px-3.5 py-3 rounded-2xl border transition-all ${
                    selectedChapter.id === ch.id
                      ? "bg-indigo-50 border-indigo-300"
                      : "bg-slate-50/50 border-slate-100 hover:border-slate-200"
                  }`}
                >
                  <div className="text-[11px] font-bold text-indigo-600">{ch.domain}</div>
                  <div className="text-sm font-bold text-slate-900">{ch.title}</div>
                  <div className="text-[11px] text-slate-400">{ch.level}</div>
                </button>
              ))}
            </div>
          </div>
        </aside>

        {/* Right: Chat workspace */}
        <section className="lg:col-span-8 bg-white rounded-3xl border border-slate-100 shadow-sm flex flex-col h-[76vh]">
          {/* Chat header */}
          <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
            <div>
              <div className="text-sm font-extrabold text-slate-900">{selectedChapter.title}</div>
              <div className="text-xs text-slate-400">
                Mode {mode === "guide" ? "Guidé (indices progressifs)" : mode === "explain" ? "Explication de cours" : "Quiz rapide"}
              </div>
            </div>
            <Link
              href="/exercises"
              className="text-xs font-bold bg-indigo-50 text-indigo-700 px-3.5 py-2 rounded-xl hover:bg-indigo-100"
            >
              Pratiquer ce chapitre →
            </Link>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            {messages.map((msg) => (
              <div key={msg.id} className={`flex flex-col ${msg.role === "user" ? "items-end" : "items-start"}`}>
                <div
                  className={`max-w-[85%] rounded-2xl px-4 py-3.5 text-sm leading-relaxed ${
                    msg.role === "user"
                      ? "bg-indigo-600 text-white"
                      : "bg-slate-50 border border-slate-100 text-slate-800"
                  }`}
                >
                  <p>{msg.text}</p>
                  {msg.formula && (
                    <div className="mt-3 bg-white border border-indigo-100 rounded-xl px-3.5 py-2 font-mono text-xs text-indigo-700 font-bold">
                      {msg.formula}
                    </div>
                  )}
                  {msg.hintStep && (
                    <div className="mt-2.5 text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-xl px-3 py-1.5">
                      💡 {msg.hintStep}
                    </div>
                  )}
                </div>

                {msg.suggestedFollowUp && msg.suggestedFollowUp.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-2 max-w-[85%]">
                    {msg.suggestedFollowUp.map((s) => (
                      <button
                        key={s}
                        onClick={() => sendMessage(s)}
                        className="text-xs font-medium bg-white border border-indigo-200 text-indigo-700 hover:bg-indigo-50 px-3 py-1.5 rounded-full transition-colors"
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Input bar */}
          <div className="p-4 border-t border-slate-100">
            <div className="flex items-center gap-2">
              <Link
                href="/photo"
                title="Envoyer une photo de ton travail"
                className="w-11 h-11 rounded-xl border border-slate-200 flex items-center justify-center text-lg hover:bg-slate-50 shrink-0"
              >
                📸
              </Link>
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && sendMessage()}
                placeholder="Pose ta question ou écris ton étape de calcul…"
                className="flex-1 border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-900 bg-white placeholder:text-slate-400 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
              />
              <button
                onClick={() => sendMessage()}
                className="bg-indigo-600 text-white font-bold px-5 py-3 rounded-xl hover:bg-indigo-700 transition-colors text-sm shrink-0"
              >
                Envoyer →
              </button>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
