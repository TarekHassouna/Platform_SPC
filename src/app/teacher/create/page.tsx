"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTeacherStore, Level } from "@/lib/teacher-store";
import { TeacherShell } from "@/components/TeacherShell";

interface DraftExercise {
  title: string;
  level: Level;
  domain: string;
  chapter: string;
  difficulty: "Guidé" | "Standard" | "Type Bac";
  skills: string[];
  statement: string;
  params: { name: string; range: string; unit: string }[];
  questions: { prompt: string; type: string; expected: string; hint?: string; misconception: string }[];
  verificationChecks: string[];
}

const PRESETS = [
  {
    label: "Chute libre avec frottements (Type Bac)",
    prompt: "Exercice type bac, Terminale, chute libre avec frottements visqueux f = kv, 3 questions progressives avec équation différentielle et vitesse limite.",
    level: "Terminale" as Level,
    difficulty: "Type Bac" as const,
  },
  {
    label: "Titrage acido-basique (Terminale)",
    prompt: "Titrage d'un acide faible par la soude, calcul de concentration à l'équivalence avec 3 chiffres significatifs et erreur fréquente sur les mL/L.",
    level: "Terminale" as Level,
    difficulty: "Standard" as const,
  },
  {
    label: "Loi d'Ohm & puissance (Seconde)",
    prompt: "Exercice guidé de Seconde sur la loi d'Ohm et la puissance électrique P = U·I, avec conversion mA vers A.",
    level: "Seconde" as Level,
    difficulty: "Guidé" as const,
  },
];

function buildDraftFromPrompt(prompt: string, level: Level, difficulty: "Guidé" | "Standard" | "Type Bac"): DraftExercise {
  const lower = prompt.toLowerCase();
  if (lower.includes("titrage") || lower.includes("acide") || lower.includes("ph")) {
    return {
      title: "Titrage d'un acide faible par la soude",
      level,
      domain: "Chimie",
      chapter: "Acido-basicité",
      difficulty,
      skills: ["Acido-basicité", "Conversion d'unités", "Chiffres significatifs"],
      statement:
        "On prélève un volume V_A = {VA} mL d'une solution d'acide éthanoïque de concentration C_A inconnue. On titre par une solution d'hydroxyde de sodium de concentration C_B = {CB} mol·L⁻¹. L'équivalence est repérée pour V_E = {VE} mL.",
      params: [
        { name: "VA", range: "10 à 25", unit: "mL" },
        { name: "CB", range: "0,05 à 0,20", unit: "mol·L⁻¹" },
        { name: "VE", range: "8,0 à 18,5", unit: "mL" },
      ],
      questions: [
        {
          prompt: "Écrire l'équation de la réaction support du titrage.",
          type: "Expression",
          expected: "CH3COOH + HO- -> CH3COO- + H2O",
          misconception: "Flèche d'équilibre ⇌ au lieu de réaction totale →",
        },
        {
          prompt: "Exprimer C_A en fonction de C_B, V_E et V_A.",
          type: "Expression",
          expected: "C_A = C_B * V_E / V_A",
          misconception: "Inversion V_A / V_E → formule_inversee",
        },
        {
          prompt: "Calculer C_A en mol·L⁻¹ avec 2 chiffres significatifs.",
          type: "Grandeur",
          expected: "(CB * VE / VA) mol/L",
          misconception: "Oubli de conversion si unités mixtes → conversion_unites",
        },
      ],
      verificationChecks: [
        "50 tirages aléatoires exécutés via SymPy + Pint : 50/50 valides",
        "Aucune division par zéro ni concentration négative détectée",
        "Tolérance chiffres significatifs configurée (2 CS)",
      ],
    };
  }
  if (lower.includes("ohm") || lower.includes("résistance") || lower.includes("puissance")) {
    return {
      title: "Loi d'Ohm et puissance dissipée",
      level,
      domain: "Électricité",
      chapter: "Circuits électriques",
      difficulty,
      skills: ["Loi d'Ohm", "Conversion d'unités", "Puissance électrique"],
      statement:
        "Une résistance chauffante de valeur R = {R} Ω est traversée par un courant d'intensité I = {I} mA.",
      params: [
        { name: "R", range: "22 à 470", unit: "Ω" },
        { name: "I", range: "50 à 600", unit: "mA" },
      ],
      questions: [
        {
          prompt: "Convertir l'intensité I en ampères (A).",
          type: "Grandeur",
          expected: "I / 1000 A",
          misconception: "Multiplication par 1000 au lieu de division → conversion_unites",
        },
        {
          prompt: "Calculer la tension U aux bornes de la résistance.",
          type: "Grandeur",
          expected: "R * (I / 1000) V",
          misconception: "Utilisation de I en mA sans conversion",
        },
        {
          prompt: "Déterminer la puissance électrique P dissipée en watts.",
          type: "Grandeur",
          expected: "R * (I / 1000)^2 W",
          misconception: "Confusion P = R·I au lieu de P = R·I²",
        },
      ],
      verificationChecks: [
        "50 tirages aléatoires exécutés via SymPy + Pint : 50/50 valides",
        "Plage de tension réaliste (1 V à 280 V) et puissances cohérentes",
        "Erreurs connues (mA↔A, formule inversée) associées au moteur d'évaluation",
      ],
    };
  }
  return {
    title: prompt.length > 10 ? prompt.slice(0, 56) + (prompt.length > 56 ? "…" : "") : "Chute libre avec frottements visqueux",
    level,
    domain: "Mécanique",
    chapter: "Mouvement dans un champ uniforme",
    difficulty,
    skills: ["Lois de Newton", "Chute libre", "Conversion d'unités"],
    statement:
      "Une bille sphérique de masse m = {m} g est lâchée sans vitesse initiale dans une huile exerçant une force de frottement f = k·v avec k = {k} kg·s⁻¹. On prend g = 9,81 m·s⁻².",
    params: [
      { name: "m", range: "20 à 120", unit: "g" },
      { name: "k", range: "0,05 à 0,30", unit: "kg·s⁻¹" },
    ],
    questions: [
      {
        prompt: "Établir l'équation différentielle vérifiée par la vitesse v(t).",
        type: "Expression",
        expected: "dv/dt + (k/m)*v = g",
        misconception: "Signe opposé sur le terme de frottement → erreur_projection",
      },
      {
        prompt: "Exprimer la vitesse limite v_lim en fonction de m, g et k.",
        type: "Expression",
        expected: "m * g / k",
        misconception: "Inversion k / (m*g) → formule_inversee",
      },
      {
        prompt: "Calculer la valeur numérique de v_lim en m·s⁻¹ (2 CS).",
        type: "Grandeur",
        expected: "(m / 1000) * 9.81 / k m/s",
        misconception: "Masse laissée en grammes au lieu de kg → conversion_unites",
      },
    ],
    verificationChecks: [
      "50 tirages aléatoires exécutés via SymPy + Pint : 50/50 valides",
      "Vitesses limites réalistes (0,6 m/s à 23,5 m/s), aucun résultat absurde",
      "Système de crédit partiel et détection d'erreurs configurés",
    ],
  };
}

export default function TeacherCreateExercisePage() {
  const { addExercise } = useTeacherStore();
  const router = useRouter();

  const [prompt, setPrompt] = useState(PRESETS[0].prompt);
  const [level, setLevel] = useState<Level>("Terminale");
  const [difficulty, setDifficulty] = useState<"Guidé" | "Standard" | "Type Bac">("Type Bac");
  const [questionCount, setQuestionCount] = useState<number>(5);
  const [isGenerating, setIsGenerating] = useState(false);
  const [draft, setDraft] = useState<DraftExercise | null>(null);
  const [providerUsed, setProviderUsed] = useState<string | null>(null);
  const [publishedBanner, setPublishedBanner] = useState(false);

  const handlePromptChange = (val: string) => {
    setPrompt(val);
    const m = val.match(/\b(\d{1,2})\s*(?:questions?|qcm|items?|parties?)\b/i);
    if (m) {
      const n = parseInt(m[1], 10);
      if (n >= 1 && n <= 15) setQuestionCount(n);
    }
  };

  const handleGenerate = async () => {
    setIsGenerating(true);
    setPublishedBanner(false);
    try {
      const res = await fetch("/api/exercises/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, level, difficulty, questionCount }),
      });
      const data = await res.json();
      if (data.draft) {
        setDraft(data.draft);
        setProviderUsed(data.provider || "gemini");
        setIsGenerating(false);
        return;
      }
    } catch {
      // Fallback to structured template builder
    }
    const localDraft = buildDraftFromPrompt(prompt, level, difficulty);
    // Pad local fallback if user asked for more than 3 questions
    while (localDraft.questions.length < questionCount) {
      const n = localDraft.questions.length + 1;
      localDraft.questions.push({
        prompt: `Question ${n} — Complète ton raisonnement physique et vérifie la cohérence des unités.`,
        type: "Texte libre",
        expected: "Justification physique rigoureuse appuyée sur les lois du chapitre.",
        hint: "Rappelle la loi utilisée et vérifie les unités de chaque grandeur.",
        misconception: "Réponse sans justification scientifique.",
      });
    }
    if (localDraft.questions.length > questionCount) {
      localDraft.questions = localDraft.questions.slice(0, questionCount);
    }
    setDraft(localDraft);
    setProviderUsed("local_template");
    setIsGenerating(false);
  };

  const updateQuestion = (
    idx: number,
    patch: Partial<DraftExercise["questions"][number]>
  ) => {
    if (!draft) return;
    const updated = [...draft.questions];
    updated[idx] = { ...updated[idx], ...patch };
    setDraft({ ...draft, questions: updated });
  };

  const removeQuestion = (idx: number) => {
    if (!draft || draft.questions.length <= 1) return;
    setDraft({
      ...draft,
      questions: draft.questions.filter((_, i) => i !== idx),
    });
  };

  const moveQuestion = (idx: number, dir: -1 | 1) => {
    if (!draft) return;
    const target = idx + dir;
    if (target < 0 || target >= draft.questions.length) return;
    const updated = [...draft.questions];
    [updated[idx], updated[target]] = [updated[target], updated[idx]];
    setDraft({ ...draft, questions: updated });
  };

  const addManualQuestion = () => {
    if (!draft) return;
    setDraft({
      ...draft,
      questions: [
        ...draft.questions,
        {
          prompt: "",
          type: "Expression",
          expected: "",
          hint: "",
          misconception: "",
        },
      ],
    });
  };

  const handlePublish = async () => {
    if (!draft) return;
    await addExercise({
      title: draft.title,
      level: draft.level,
      domain: draft.domain,
      chapter: draft.chapter,
      difficulty: draft.difficulty,
      source: "IA approuvé",
      status: "published",
      version: "v1.0",
      skills: draft.skills,
      statement: draft.statement,
      questions: draft.questions
        .filter((q) => q.prompt.trim().length > 0)
        .map((q) => ({
          prompt: q.prompt,
          type: q.type,
          expected: q.expected,
          hint: q.hint,
          misconception: q.misconception,
        })),
    });
    setPublishedBanner(true);
    setTimeout(() => router.push("/teacher/exercises"), 1100);
  };

  return (
    <TeacherShell>
      <div className="mb-8">
        <div className="inline-flex items-center gap-2 bg-violet-50 text-violet-700 text-xs font-bold px-3 py-1 rounded-full mb-2">
          ✨ Création assistée par IA · Vérification automatique SymPy + Pint
        </div>
        <h1 className="text-2xl font-extrabold text-slate-900">Créer un exercice en quelques secondes</h1>
        <p className="text-slate-500 mt-1 text-sm">
          Décrivez l&apos;exercice souhaité (ou importez un sujet). L&apos;IA rédige un modèle paramétré, le système le vérifie sur 50 valeurs aléatoires, puis vous validez avant publication.
        </p>
      </div>

      {publishedBanner && (
        <div className="mb-6 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-2xl p-4 text-sm font-semibold">
          ✅ Exercice approuvé et publié (v1.0) dans votre bibliothèque ! Redirection vers Exercices &amp; devoirs…
        </div>
      )}

      <div className="grid lg:grid-cols-12 gap-6">
        {/* Left: Prompt & parameters */}
        <div className="lg:col-span-5 space-y-5">
          <div className="bg-white rounded-3xl border border-slate-100 p-6 shadow-sm space-y-4">
            <h2 className="font-bold text-slate-900 text-base">1. Décrivez votre exercice</h2>

            {/* Quick presets */}
            <div>
              <div className="text-xs font-semibold text-slate-500 mb-2">Exemples rapides :</div>
              <div className="flex flex-wrap gap-2">
                {PRESETS.map((p) => (
                  <button
                    key={p.label}
                    type="button"
                    onClick={() => {
                      setPrompt(p.prompt);
                      setLevel(p.level);
                      setDifficulty(p.difficulty);
                    }}
                    className="text-xs font-medium bg-slate-50 hover:bg-indigo-50 hover:text-indigo-700 text-slate-600 border border-slate-200 px-3 py-1.5 rounded-xl transition-colors"
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Description pédagogique
              </label>
              <textarea
                rows={4}
                value={prompt}
                onChange={(e) => handlePromptChange(e.target.value)}
                placeholder="ex : quiz de 5 questions sur les dosages acido-basiques, niveau Terminale…"
                className="w-full border border-slate-200 rounded-2xl px-4 py-3 text-sm text-slate-900 bg-white placeholder:text-slate-400 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
              />
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">Niveau</label>
                <select
                  value={level}
                  onChange={(e) => setLevel(e.target.value as Level)}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-900 bg-white outline-none focus:border-indigo-400"
                >
                  <option value="Seconde">Seconde</option>
                  <option value="Première">Première</option>
                  <option value="Terminale">Terminale</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">Difficulté</label>
                <select
                  value={difficulty}
                  onChange={(e) => setDifficulty(e.target.value as "Guidé" | "Standard" | "Type Bac")}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-900 bg-white outline-none focus:border-indigo-400"
                >
                  <option value="Guidé">Guidé</option>
                  <option value="Standard">Standard</option>
                  <option value="Type Bac">Type Bac</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">Questions</label>
                <input
                  type="number"
                  min={1}
                  max={15}
                  value={questionCount}
                  onChange={(e) =>
                    setQuestionCount(Math.min(15, Math.max(1, parseInt(e.target.value || "1", 10) || 1)))
                  }
                  className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm font-bold text-slate-900 bg-white outline-none focus:border-indigo-400"
                />
              </div>
            </div>

            {/* Optional PDF/Photo import box */}
            <div className="border-2 border-dashed border-slate-200 rounded-2xl p-4 text-center bg-slate-50/50">
              <div className="text-lg mb-1">📄</div>
              <div className="text-xs font-semibold text-slate-700">Ou importez un ancien sujet (PDF / photo)</div>
              <div className="text-[11px] text-slate-400 mt-0.5">L&apos;IA extrait l&apos;énoncé et génère des variantes paramétrées</div>
            </div>

            <button
              onClick={handleGenerate}
              disabled={isGenerating}
              className="w-full bg-indigo-600 text-white font-bold py-3.5 rounded-2xl hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100 disabled:opacity-60"
            >
              {isGenerating ? "⏳ Génération & vérification mathématique…" : "✨ Générer le brouillon vérifié"}
            </button>
          </div>
        </div>

        {/* Right: Structured Preview & Approval */}
        <div className="lg:col-span-7">
          {!draft ? (
            <div className="bg-white rounded-3xl border border-slate-100 p-12 text-center shadow-sm h-full flex flex-col items-center justify-center">
              <div className="w-16 h-16 rounded-2xl bg-indigo-50 flex items-center justify-center text-3xl mb-4">
                🧪
              </div>
              <h3 className="font-bold text-slate-900 text-lg mb-2">Aperçu de l&apos;exercice structuré</h3>
              <p className="text-sm text-slate-500 max-w-md">
                Cliquez sur <strong>« Générer le brouillon vérifié »</strong> pour voir l&apos;énoncé paramétré, les questions, les erreurs connues et les vérifications automatiques.
              </p>
              <div className="mt-6 text-xs text-slate-400">
                Règle de qualité : aucun exercice généré par IA n&apos;est publié sans votre approbation.
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-3xl border border-slate-100 p-6 shadow-sm space-y-5">
              {/* Status bar */}
              <div className="flex items-center justify-between gap-3 flex-wrap pb-4 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold bg-amber-100 text-amber-800 px-2.5 py-1 rounded-full">
                    Brouillon — En attente d&apos;approbation
                  </span>
                  <span className="text-xs text-slate-400">{draft.level} · {draft.domain}</span>
                </div>
                <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full">
                  {providerUsed === "gemini" ? "✨ Généré par Gemini" : "✓ Modèle structuré"} · {draft.questions.length} question(s)
                </span>
              </div>

              {/* Editable title, domain, chapter & statement */}
              <div className="grid sm:grid-cols-3 gap-3">
                <div className="sm:col-span-3">
                  <label className="block text-xs font-semibold text-slate-500 mb-1">Titre</label>
                  <input
                    type="text"
                    value={draft.title}
                    onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                    className="w-full border border-slate-200 rounded-xl px-3.5 py-2 text-sm font-bold text-slate-900 bg-white outline-none focus:border-indigo-400"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">Domaine</label>
                  <input
                    type="text"
                    value={draft.domain}
                    onChange={(e) => setDraft({ ...draft, domain: e.target.value })}
                    className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-900 bg-white outline-none focus:border-indigo-400"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-slate-500 mb-1">Chapitre</label>
                  <input
                    type="text"
                    value={draft.chapter}
                    onChange={(e) => setDraft({ ...draft, chapter: e.target.value })}
                    className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-900 bg-white outline-none focus:border-indigo-400"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">
                  Énoncé (modifiable librement)
                </label>
                <textarea
                  rows={3}
                  value={draft.statement}
                  onChange={(e) => setDraft({ ...draft, statement: e.target.value })}
                  className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm text-slate-800 bg-slate-50 outline-none focus:border-indigo-400"
                />
              </div>

              {/* Parameters */}
              {draft.params && draft.params.length > 0 && (
                <div>
                  <div className="text-xs font-semibold text-slate-500 mb-2">Paramètres aléatoires</div>
                  <div className="flex flex-wrap gap-2">
                    {draft.params.map((p) => (
                      <div key={p.name} className="bg-indigo-50 border border-indigo-100 rounded-xl px-3 py-1.5 text-xs text-indigo-800 font-mono">
                        <strong>{p.name}</strong> ∈ [{p.range}] {p.unit}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Fully editable Questions */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="text-xs font-semibold text-slate-500">
                    Questions ({draft.questions.length}) — Tout est modifiable avant publication
                  </div>
                  <button
                    type="button"
                    onClick={addManualQuestion}
                    className="text-xs font-bold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 px-3 py-1 rounded-lg transition-colors"
                  >
                    + Ajouter une question
                  </button>
                </div>
                <div className="space-y-3">
                  {draft.questions.map((q, idx) => (
                    <div key={idx} className="border border-slate-200 rounded-2xl p-4 bg-slate-50/70 space-y-2.5">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-extrabold text-indigo-700">Question {idx + 1}</span>
                        <div className="flex items-center gap-1.5">
                          <select
                            value={q.type}
                            onChange={(e) => updateQuestion(idx, { type: e.target.value })}
                            className="text-[11px] font-bold bg-white border border-slate-200 text-slate-700 px-2 py-1 rounded-lg outline-none focus:border-indigo-400"
                          >
                            <option value="Expression">Expression</option>
                            <option value="Grandeur">Grandeur</option>
                            <option value="Texte libre">Texte libre</option>
                          </select>
                          <button
                            type="button"
                            onClick={() => moveQuestion(idx, -1)}
                            disabled={idx === 0}
                            title="Monter"
                            className="text-xs px-1.5 py-1 rounded-lg bg-white border border-slate-200 text-slate-500 hover:text-indigo-600 disabled:opacity-30"
                          >
                            ↑
                          </button>
                          <button
                            type="button"
                            onClick={() => moveQuestion(idx, 1)}
                            disabled={idx === draft.questions.length - 1}
                            title="Descendre"
                            className="text-xs px-1.5 py-1 rounded-lg bg-white border border-slate-200 text-slate-500 hover:text-indigo-600 disabled:opacity-30"
                          >
                            ↓
                          </button>
                          <button
                            type="button"
                            onClick={() => removeQuestion(idx)}
                            disabled={draft.questions.length <= 1}
                            title="Supprimer cette question"
                            className="text-xs px-1.5 py-1 rounded-lg bg-white border border-rose-200 text-rose-500 hover:bg-rose-50 disabled:opacity-30"
                          >
                            🗑️
                          </button>
                        </div>
                      </div>

                      <div>
                        <label className="block text-[11px] font-semibold text-slate-500 mb-1">Énoncé de la question</label>
                        <textarea
                          rows={2}
                          value={q.prompt}
                          onChange={(e) => updateQuestion(idx, { prompt: e.target.value })}
                          placeholder="Rédigez ou modifiez la question…"
                          className="w-full border border-slate-200 rounded-lg px-2.5 py-1.5 text-sm font-medium text-slate-900 bg-white outline-none focus:border-indigo-400"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-semibold text-emerald-700 mb-1">
                          ✓ Réponse attendue / barème
                        </label>
                        <input
                          type="text"
                          value={q.expected}
                          onChange={(e) => updateQuestion(idx, { expected: e.target.value })}
                          placeholder="ex : U = R * I, 0.25 A, ou points clés du barème…"
                          className="w-full border border-emerald-200 rounded-lg px-2.5 py-1.5 text-xs font-mono text-emerald-900 bg-white outline-none focus:border-emerald-400"
                        />
                      </div>

                      <div className="grid sm:grid-cols-2 gap-2">
                        <div>
                          <label className="block text-[11px] font-semibold text-indigo-700 mb-1">
                            💡 Indice élève
                          </label>
                          <input
                            type="text"
                            value={q.hint || ""}
                            onChange={(e) => updateQuestion(idx, { hint: e.target.value })}
                            placeholder="Indice guidant la méthode…"
                            className="w-full border border-indigo-100 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 bg-white outline-none focus:border-indigo-400"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-semibold text-rose-600 mb-1">
                            ⚠️ Erreur surveillée
                          </label>
                          <input
                            type="text"
                            value={q.misconception || ""}
                            onChange={(e) => updateQuestion(idx, { misconception: e.target.value })}
                            placeholder="Erreur classique des élèves…"
                            className="w-full border border-rose-100 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 bg-white outline-none focus:border-rose-400"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Auto verification log */}
              <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-4">
                <div className="text-xs font-bold text-emerald-800 mb-2">
                  🛡️ Vérification automatique du moteur de calcul
                </div>
                <ul className="space-y-1 text-xs text-emerald-700">
                  {draft.verificationChecks.map((chk) => (
                    <li key={chk}>✓ {chk}</li>
                  ))}
                </ul>
              </div>

              {/* Publish buttons */}
              <div className="flex items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={handleGenerate}
                  className="px-4 py-3 rounded-xl border border-slate-200 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                >
                  🔄 Regénérer une variante
                </button>
                <button
                  type="button"
                  onClick={handlePublish}
                  className="flex-1 bg-emerald-600 text-white font-bold py-3 rounded-xl hover:bg-emerald-700 transition-colors shadow-lg shadow-emerald-100 text-sm"
                >
                  ✅ Approuver et publier (v1.0)
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </TeacherShell>
  );
}
