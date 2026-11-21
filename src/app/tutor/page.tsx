"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { MathText } from "@/components/MathText";

interface PhotoHandoffContext {
  fileName: string;
  exerciseStatement: string;
}

type TutorMode = "guide" | "explain" | "quiz";

interface Message {
  id: string;
  role: "assistant" | "user";
  content: string;
  suggestedFollowUp?: string[];
}

const CHAPTERS = [
  { id: "ohm", domain: "Électricité", title: "Loi d'Ohm & circuits", level: "Seconde / Terminale", exerciseId: "ohm-001" },
  { id: "newton", domain: "Mécanique", title: "Lois de Newton & chute libre", level: "Terminale", exerciseId: "frottements-001" },
  { id: "ph", domain: "Chimie", title: "Acido-basicité & titrages", level: "Terminale", exerciseId: "titrage-001" },
  { id: "avancement", domain: "Chimie", title: "Tableau d'avancement", level: "Première", exerciseId: "avancement-001" },
  { id: "unites", domain: "Métrologie", title: "Conversions & chiffres significatifs", level: "Tous niveaux", exerciseId: "puissance-001" },
];

const QUICK_PROMPTS: Record<string, string[]> = {
  ohm: [
    "Je confonds toujours U = R·I et I = R/U",
    "Comment convertir 250 mA en A ?",
    "Donne-moi un exercice rapide sur la loi d'Ohm",
  ],
  newton: [
    "Pourquoi la vitesse limite existe avec frottements ?",
    "Aide-moi étape par étape sur la 2e loi de Newton",
  ],
  ph: [
    "Comment utiliser la relation à l'équivalence d'un titrage ?",
    "Quelle est la différence entre acide fort et acide faible ?",
  ],
  avancement: [
    "Comment trouver le réactif limitant sans me tromper ?",
    "Pourquoi on divise par le coefficient stœchiométrique ?",
  ],
  unites: [
    "Règle simple pour les chiffres significatifs",
    "Comment convertir 72 km/h en m/s ?",
  ],
};

export default function StudentTutorPage() {
  const { user, logout } = useAuth();
  const router = useRouter();

  const [selectedChapter, setSelectedChapter] = useState(CHAPTERS[0]);
  const [mode, setMode] = useState<TutorMode>("guide");
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [quotaInfo, setQuotaInfo] = useState<{ remaining: number; limit: number } | null>(null);
  const [providerBadge, setProviderBadge] = useState<string | null>(null);
  const [photoContext, setPhotoContext] = useState<PhotoHandoffContext | null>(null);
  const [showPhotoText, setShowPhotoText] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      role: "assistant",
      content:
        "Bonjour ! Je suis ton tuteur IA de Physique-Chimie. Je m'appuie sur le programme officiel : je te guide étape par étape pour que tu comprennes vraiment. Sur quoi veux-tu travailler ?",
      suggestedFollowUp: QUICK_PROMPTS.ohm,
    },
  ]);

  // Restore exact conversation when continuing from /photo ("Continuer cette discussion avec le Tuteur IA")
  useEffect(() => {
    try {
      const raw = window.sessionStorage.getItem("spc_tutor_handoff");
      if (!raw) return;
      const handoff = JSON.parse(raw);
      window.sessionStorage.removeItem("spc_tutor_handoff");
      if (!handoff || !handoff.exerciseStatement) return;

      setPhotoContext({
        fileName: String(handoff.fileName || "photo_copie.jpg"),
        exerciseStatement: String(handoff.exerciseStatement),
      });

      const assistantContent = [
        handoff.summary ? `**Bilan :** ${handoff.summary}` : "",
        handoff.tutorReply ? String(handoff.tutorReply) : "",
      ]
        .filter(Boolean)
        .join("\n\n");

      setMessages([
        {
          id: `photo-u-${Date.now()}`,
          role: "user",
          content: `📸 Photo envoyée (${handoff.fileName || "copie"}) :\n${handoff.studentQuestion || "Peux-tu m'aider sur cette photo ?"}`,
        },
        {
          id: `photo-a-${Date.now() + 1}`,
          role: "assistant",
          content:
            assistantContent ||
            "J'ai bien chargé l'énoncé et ta copie depuis ta photo. Quelle question ou étape veux-tu approfondir ?",
          suggestedFollowUp: [
            "📐 Fais-moi un schéma explicatif de cet exercice",
            "Explique-moi la première étape plus simplement",
            "Vérifie ma proposition de calcul",
          ],
        },
      ]);
    } catch {
      // ignore invalid session payload
    }
  }, []);

  const sendMessage = async (textOverride?: string) => {
    const content = (textOverride ?? input).trim();
    if (!content || loading) return;

    const userMsg: Message = { id: `u-${Date.now()}`, role: "user", content };
    const nextHistory = [...messages, userMsg];
    setMessages(nextHistory);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch("/api/tutor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: user?.id,
          chapterTitle: photoContext
            ? `Photo élève (${photoContext.fileName})`
            : `${selectedChapter.domain} — ${selectedChapter.title}`,
          exerciseStatement: photoContext?.exerciseStatement,
          mode,
          messages: nextHistory.map((m) => ({ role: m.role, content: m.content })),
        }),
      });
      const data = await res.json();
      if (data.quota) setQuotaInfo({ remaining: data.quota.remaining, limit: data.quota.limit });
      if (data.provider) setProviderBadge(data.provider);

      setMessages((prev) => [
        ...prev,
        {
          id: `a-${Date.now()}`,
          role: "assistant",
          content: data.reply || data.error || "Impossible de répondre pour le moment.",
        },
      ]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: `e-${Date.now()}`,
          role: "assistant",
          content: "Erreur réseau — vérifie ta connexion et réessaie.",
        },
      ]);
    }
    setLoading(false);
  };

  const handleSelectChapter = (ch: typeof CHAPTERS[0]) => {
    setPhotoContext(null);
    setShowPhotoText(false);
    setSelectedChapter(ch);
    setMessages([
      {
        id: `ch-${ch.id}-${Date.now()}`,
        role: "assistant",
        content: `On passe au chapitre « ${ch.title} » (${ch.domain}). Pose-moi ta question ou clique sur une suggestion ci-dessous !`,
        suggestedFollowUp: QUICK_PROMPTS[ch.id] || [],
      },
    ]);
  };

  const handleLogout = async () => {
    await logout();
    router.push("/auth/login");
  };

  const initials = user ? (user.firstName?.[0] ?? "E") + (user.lastName?.[0] ?? "") : "EL";

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <header className="bg-white border-b border-slate-100 px-6 py-3 flex items-center gap-4 sticky top-0 z-20">
        <Link href="/dashboard" className="text-slate-500 hover:text-slate-800 text-sm font-medium">
          ← Tableau de bord
        </Link>
        <span className="text-slate-200">|</span>
        <div className="flex items-center gap-2">
          <span className="text-lg">🤖</span>
          <span className="font-bold text-slate-900 text-sm">Tuteur IA Physique-Chimie</span>
          {quotaInfo && (
            <span className="text-[11px] font-semibold bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">
              {quotaInfo.remaining}/{quotaInfo.limit} msg restants aujourd&apos;hui
            </span>
          )}
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
          <button onClick={handleLogout} className="text-xs font-medium text-rose-500 hover:text-rose-700">
            🚪 Déconnexion
          </button>
        </div>
      </header>

      <div className="flex-1 max-w-6xl w-full mx-auto p-4 lg:p-6 grid lg:grid-cols-12 gap-6">
        <aside className="lg:col-span-4 space-y-5">
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

        <section className="lg:col-span-8 bg-white rounded-3xl border border-slate-100 shadow-sm flex flex-col h-[76vh]">
          <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between gap-2">
            <div>
              <div className="text-sm font-extrabold text-slate-900">
                {photoContext ? `📸 Discussion sur ta photo (${photoContext.fileName})` : selectedChapter.title}
              </div>
              <div className="text-xs text-slate-400">
                Mode {mode === "guide" ? "Guidé (indices progressifs)" : mode === "explain" ? "Explication de cours" : "Quiz rapide"}
              </div>
            </div>
            {photoContext ? (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowPhotoText((v) => !v)}
                  className="text-xs font-bold bg-violet-50 text-violet-700 px-3 py-2 rounded-xl hover:bg-violet-100 whitespace-nowrap"
                >
                  {showPhotoText ? "Masquer l'énoncé" : "📄 Voir texte photo"}
                </button>
                <button
                  type="button"
                  onClick={() => handleSelectChapter(selectedChapter)}
                  className="text-xs font-semibold border border-slate-200 text-slate-600 px-3 py-2 rounded-xl hover:bg-slate-50 whitespace-nowrap"
                >
                  Nouvelle discussion
                </button>
              </div>
            ) : (
              <Link
                href={`/exercises/${selectedChapter.exerciseId}`}
                className="text-xs font-bold bg-indigo-50 text-indigo-700 px-3.5 py-2 rounded-xl hover:bg-indigo-100 whitespace-nowrap"
              >
                Pratiquer ce chapitre →
              </Link>
            )}
          </div>

          {photoContext && showPhotoText && (
            <div className="px-6 py-3 bg-violet-50/70 border-b border-violet-100 text-xs text-violet-950 max-h-36 overflow-y-auto whitespace-pre-line font-mono">
              {photoContext.exerciseStatement}
            </div>
          )}

          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            {messages.map((msg) => (
              <div key={msg.id} className={`flex flex-col ${msg.role === "user" ? "items-end" : "items-start"}`}>
                <div
                  className={`max-w-[85%] rounded-2xl px-4 py-3.5 text-sm leading-relaxed whitespace-pre-line ${
                    msg.role === "user"
                      ? "bg-indigo-600 text-white"
                      : "bg-slate-50 border border-slate-100 text-slate-800"
                  }`}
                >
                  <MathText text={msg.content} />
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
            {loading && <div className="text-xs text-slate-400 italic">Le tuteur réfléchit…</div>}
          </div>

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
                disabled={loading}
                className="bg-indigo-600 text-white font-bold px-5 py-3 rounded-xl hover:bg-indigo-700 transition-colors text-sm shrink-0 disabled:opacity-50"
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
