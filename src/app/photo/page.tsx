"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { uploadStudentPhoto, recordPhotoSubmission } from "@/lib/db";
import { MathText } from "@/components/MathText";

type PhotoMode = "question" | "correct" | "grade";

interface TranscribedLine {
  id: number;
  text: string;
  confidence: "high" | "medium" | "low";
}

interface PhotoAnalysis {
  mode: PhotoMode;
  hasStudentWork: boolean;
  status: "correct" | "partially_correct" | "incorrect" | "no_work";
  score: number | null;
  maxScore: number;
  errorCode: string | null;
  summary: string;
  tutorReply: string;
  rubricBreakdown?: { criterion: string; points: number; maxPoints: number; comment: string }[];
  steps: { lineId: number; verdict: "correct" | "error" | "partial" | "info"; comment: string }[];
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || "");
      resolve(result.includes(",") ? result.split(",")[1] : result);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

const VERDICT_STYLE: Record<string, { box: string; label: string }> = {
  correct: { box: "bg-emerald-50 border-emerald-200 text-emerald-900", label: "✅ Correct" },
  error: { box: "bg-rose-50 border-rose-200 text-rose-900", label: "❌ Erreur" },
  partial: { box: "bg-amber-50 border-amber-200 text-amber-900", label: "⚠️ Partiel" },
  info: { box: "bg-slate-50 border-slate-200 text-slate-800", label: "ℹ️ Énoncé / Info" },
};

const MODE_CONFIG: Record<
  PhotoMode,
  {
    icon: string;
    title: string;
    badge: string;
    desc: string;
    uploadTitle: string;
    uploadHint: string;
    uploadCta: string;
    confirmCta: string;
    step3Label: string;
    accentBorder: string;
    accentBg: string;
    accentBtn: string;
  }
> = {
  question: {
    icon: "❓",
    title: "« J'ai une question »",
    badge: "Non noté · Aide tuteur",
    desc: "Photographie un énoncé ou un brouillon + pose ta question : le tuteur t'explique la méthode sans te noter.",
    uploadTitle: "Importe la photo de ton énoncé ou de ton brouillon",
    uploadHint: "Idéal quand tu bloques sur une question d'exercice. Aucune note ne sera enregistrée.",
    uploadCta: "📷 Importer l'énoncé / le brouillon",
    confirmCta: "💬 Confirmer la lecture et poser ma question",
    step3Label: "3. Réponse du tuteur",
    accentBorder: "border-violet-300",
    accentBg: "bg-violet-50/40",
    accentBtn: "bg-violet-600 hover:bg-violet-700 shadow-violet-100",
  },
  correct: {
    icon: "✍️",
    title: "« Corrige-moi »",
    badge: "Correction détaillée · / 10",
    desc: "Photographie TA copie déjà rédigée : l'IA vérifie chaque ligne, pointe la première erreur et explique le corrigé.",
    uploadTitle: "Importe la photo de TA copie avec tes réponses rédigées",
    uploadHint: "Ta feuille doit contenir tes calculs ou réponses (un énoncé seul sans réponse ne peut pas être corrigé).",
    uploadCta: "📷 Photographier ma copie rédigée",
    confirmCta: "✍️ Confirmer la lecture et corriger ma copie",
    step3Label: "3. Correction détaillée",
    accentBorder: "border-indigo-300",
    accentBg: "bg-indigo-50/40",
    accentBtn: "bg-indigo-600 hover:bg-indigo-700 shadow-indigo-100",
  },
  grade: {
    icon: "🎓",
    title: "« Note-moi »",
    badge: "Barème Bac · / 20 · Transmis au prof",
    desc: "Soumets ta copie complète rédigée pour recevoir une note détaillée sur 20 et la transmettre à ton professeur.",
    uploadTitle: "Soumets ta copie complète rédigée (mode examen / 20)",
    uploadHint: "Notation par critères (formules, calculs, unités, rédaction) + envoi dans l'espace de ton professeur.",
    uploadCta: "📷 Soumettre ma copie à noter (/ 20)",
    confirmCta: "🎓 Confirmer la lecture et noter sur 20",
    step3Label: "3. Note & barème / 20",
    accentBorder: "border-emerald-300",
    accentBg: "bg-emerald-50/40",
    accentBtn: "bg-emerald-600 hover:bg-emerald-700 shadow-emerald-100",
  },
};

export default function PhotoSubmissionPage() {
  const { user, logout } = useAuth();
  const router = useRouter();

  const [mode, setMode] = useState<PhotoMode>("correct");
  const [step, setStep] = useState<"upload" | "confirm" | "result">("upload");
  const [lines, setLines] = useState<TranscribedLine[]>([]);
  const [studentQuestion, setStudentQuestion] = useState("");
  const [fileName, setFileName] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [storagePath, setStoragePath] = useState<string | null>(null);
  const [quotaInfo, setQuotaInfo] = useState<{ remaining: number; limit: number } | null>(null);
  const [uploading, setUploading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState<PhotoAnalysis | null>(null);
  const [savedToDb, setSavedToDb] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const cfg = MODE_CONFIG[mode];

  const resetAll = () => {
    setStep("upload");
    setLines([]);
    setAnalysis(null);
    setSavedToDb(false);
    setStoragePath(null);
    setFileName(null);
    setPreviewUrl(null);
    setErrorMsg(null);
  };

  const runTranscription = async (file: File) => {
    setErrorMsg(null);
    setUploading(true);
    setAnalysis(null);
    setSavedToDb(false);
    try {
      setFileName(file.name);
      setPreviewUrl(URL.createObjectURL(file));
      if (user?.id) {
        const up = await uploadStudentPhoto(user.id, file);
        if (up.path) setStoragePath(up.path);
      }
      const imageBase64 = await fileToBase64(file);
      const mimeType = file.type || "image/jpeg";

      const res = await fetch("/api/vision/transcribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: user?.id,
          imageBase64,
          mimeType,
          mode,
          questionText: studentQuestion,
        }),
      });
      const data = await res.json();
      if (data.quota) setQuotaInfo({ remaining: data.quota.remaining, limit: data.quota.limit });
      if (!res.ok) {
        setErrorMsg(data.error || "Erreur lors de la lecture de la photo.");
        setUploading(false);
        return;
      }
      setLines(data.lines || []);
      setStep("confirm");
    } catch {
      setErrorMsg("Impossible d'analyser l'image pour le moment.");
    }
    setUploading(false);
  };

  const confirmAndAnalyze = async (overrideMode?: PhotoMode) => {
    const activeMode = overrideMode || mode;
    if (overrideMode) setMode(overrideMode);
    setErrorMsg(null);
    setAnalyzing(true);
    setSavedToDb(false);
    let result: PhotoAnalysis | null = null;
    try {
      const res = await fetch("/api/vision/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: activeMode,
          questionText: studentQuestion,
          lines: lines.map((l) => ({ id: l.id, text: l.text })),
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.analysis) {
        setErrorMsg(data.error || "L'analyse n'a pas abouti. Réessaie.");
        setAnalyzing(false);
        return;
      }
      result = data.analysis;
      setAnalysis(result);
    } catch {
      setErrorMsg("Erreur réseau pendant l'analyse.");
      setAnalyzing(false);
      return;
    }

    // ONLY record a graded copy in Supabase if:
    // 1) mode is 'correct' or 'grade' (NOT 'question' tutor help), AND
    // 2) the photo actually contains student answers (hasStudentWork === true)!
    if (
      user?.id &&
      result &&
      activeMode !== "question" &&
      result.hasStudentWork &&
      result.score !== null
    ) {
      const saved = await recordPhotoSubmission({
        studentId: user.id,
        fileName: fileName || "copie_manuscrite.jpg",
        storagePath,
        mode: activeMode,
        lines,
        analysis: {
          status:
            result.status === "no_work" ? "incorrect" : result.status,
          score: result.score,
          maxScore: result.maxScore,
          summary: result.summary,
          errorCode: result.errorCode || undefined,
          steps: result.steps,
        },
      });
      setSavedToDb(saved.ok);
    }
    setAnalyzing(false);
    setStep("result");
  };

  const handleLogout = async () => {
    await logout();
    router.push("/auth/login");
  };

  const continueInTutor = () => {
    if (!analysis) {
      router.push("/tutor");
      return;
    }
    const transcribedText = lines
      .filter((l) => l.text.trim())
      .map((l, idx) => `Ligne ${idx + 1} : ${l.text}`)
      .join("\n");

    const handoff = {
      fileName: fileName || "photo_copie.jpg",
      mode: analysis.mode,
      exerciseStatement: transcribedText,
      studentQuestion:
        studentQuestion.trim() ||
        (analysis.mode === "question"
          ? "Peux-tu m'aider à comprendre cet exercice ?"
          : "Peux-tu m'expliquer la correction de ma copie ?"),
      summary: analysis.summary,
      tutorReply: analysis.tutorReply,
      steps: analysis.steps,
      createdAt: Date.now(),
    };
    try {
      window.sessionStorage.setItem("spc_tutor_handoff", JSON.stringify(handoff));
    } catch {
      // ignore storage quota
    }
    router.push("/tutor?from=photo");
  };

  const initials = user ? (user.firstName?.[0] ?? "E") + (user.lastName?.[0] ?? "") : "EL";

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-100 px-6 py-3 flex items-center gap-4">
        <Link href="/dashboard" className="text-slate-500 hover:text-slate-800 text-sm font-medium">
          ← Tableau de bord
        </Link>
        <span className="text-slate-200">|</span>
        <span className="font-bold text-slate-900 text-sm">📸 Travail manuscrit &amp; correction</span>
        {quotaInfo && (
          <span className="text-[11px] font-semibold bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">
            {quotaInfo.remaining}/{quotaInfo.limit} photos restantes aujourd&apos;hui
          </span>
        )}
        <div className="ml-auto flex items-center gap-3">
          <div className="w-7 h-7 rounded-full bg-gradient-to-br from-pink-400 to-violet-500 flex items-center justify-center text-white text-xs font-bold uppercase">
            {initials}
          </div>
          <button onClick={handleLogout} className="text-xs font-medium text-rose-500 hover:text-rose-700">
            🚪 Déconnexion
          </button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto p-6 lg:p-10">
        <div className="mb-7">
          <h1 className="text-2xl font-extrabold text-slate-900 mb-1">Soumets une photo de ta copie papier</h1>
          <p className="text-slate-500 text-sm">
            Choisis d&apos;abord ce que tu veux faire (<strong>aide</strong>, <strong>correction</strong> ou <strong>note sur 20</strong>), puis importe ta photo.
          </p>
        </div>

        {errorMsg && (
          <div className="mb-5 bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold rounded-2xl px-4 py-3">
            ⚠️ {errorMsg}
          </div>
        )}

        {/* Mode selector — active even in step 2 so user can switch before analyzing */}
        <div className="grid sm:grid-cols-3 gap-3 mb-7">
          {(["question", "correct", "grade"] as PhotoMode[]).map((mKey) => {
            const m = MODE_CONFIG[mKey];
            const isSelected = mode === mKey;
            return (
              <button
                key={mKey}
                type="button"
                onClick={() => step !== "result" && setMode(mKey)}
                disabled={step === "result"}
                className={`text-left rounded-2xl p-4 border transition-all disabled:cursor-not-allowed ${
                  isSelected
                    ? "bg-indigo-50 border-indigo-500 ring-2 ring-indigo-200 shadow-xs"
                    : "bg-white border-slate-200 hover:border-indigo-300 disabled:opacity-60"
                }`}
              >
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <span className="text-2xl">{m.icon}</span>
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      isSelected ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-500"
                    }`}
                  >
                    {m.badge}
                  </span>
                </div>
                <div className="font-bold text-slate-900 text-sm">{m.title}</div>
                <div className="text-xs text-slate-500 mt-1 leading-relaxed">{m.desc}</div>
              </button>
            );
          })}
        </div>

        {/* Stepper */}
        <div className="flex items-center gap-2 text-xs font-bold mb-6">
          {[
            { id: "upload", label: "1. Photo" },
            { id: "confirm", label: "2. Confirmation lecture" },
            { id: "result", label: cfg.step3Label },
          ].map((s, i) => (
            <div key={s.id} className="flex items-center gap-2">
              <span
                className={`px-3 py-1 rounded-full ${
                  step === s.id ? "bg-indigo-600 text-white" : "bg-white border border-slate-200 text-slate-500"
                }`}
              >
                {s.label}
              </span>
              {i < 2 && <span className="text-slate-300">→</span>}
            </div>
          ))}
        </div>

        {/* STEP 1: Upload — visually adapts to chosen mode */}
        {step === "upload" && (
          <div className="bg-white rounded-3xl border border-slate-100 p-8 shadow-sm text-center">
            <div className={`border-2 border-dashed rounded-3xl p-8 sm:p-10 ${cfg.accentBorder} ${cfg.accentBg}`}>
              <div className="text-4xl mb-2">{cfg.icon}</div>
              <div className="inline-block text-[11px] font-bold uppercase tracking-wider px-3 py-0.5 rounded-full bg-white border border-slate-200 text-slate-600 mb-3">
                Mode actif : {cfg.title} · {cfg.badge}
              </div>
              <h2 className="font-extrabold text-slate-900 text-base mb-1">{cfg.uploadTitle}</h2>
              <p className="text-xs text-slate-600 max-w-lg mx-auto mb-6">{cfg.uploadHint}</p>

              {mode === "question" && (
                <div className="max-w-lg mx-auto mb-6 text-left space-y-2">
                  <label className="block text-xs font-bold text-slate-700">
                    Ta question sur cette feuille :
                  </label>
                  <input
                    type="text"
                    value={studentQuestion}
                    onChange={(e) => setStudentQuestion(e.target.value)}
                    placeholder="ex : Je ne comprends pas la question 2, quelle formule utiliser ?"
                    className="w-full border border-violet-200 rounded-xl px-4 py-2.5 text-sm text-slate-900 bg-white placeholder:text-slate-400 outline-none focus:border-violet-500"
                  />
                  <div className="flex flex-wrap gap-1.5">
                    {[
                      "Je ne sais pas par où commencer",
                      "Quelle formule utiliser ?",
                      "Explique-moi l'énoncé étape par étape",
                    ].map((chip) => (
                      <button
                        key={chip}
                        type="button"
                        onClick={() => setStudentQuestion(chip)}
                        className="text-[11px] font-semibold bg-white border border-violet-200 text-violet-700 hover:bg-violet-100 px-2.5 py-1 rounded-lg"
                      >
                        {chip}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <label
                className={`inline-block cursor-pointer text-white font-bold px-6 py-3 rounded-xl transition-colors text-sm shadow-md ${cfg.accentBtn} ${
                  uploading ? "opacity-60 pointer-events-none" : ""
                }`}
              >
                {uploading ? "⏳ Lecture de ta photo par Gemini Vision…" : cfg.uploadCta}
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  disabled={uploading}
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) runTranscription(f);
                    e.target.value = "";
                  }}
                />
              </label>

              <p className="text-[11px] text-slate-400 mt-5">
                Stockage privé Supabase Storage · Supprimé automatiquement après 90 jours
              </p>
            </div>
          </div>
        )}

        {/* STEP 2: Confirm OCR */}
        {step === "confirm" && (
          <div className="bg-white rounded-3xl border border-slate-100 p-7 shadow-sm space-y-5">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div>
                <h2 className="font-extrabold text-slate-900 text-lg">Voici ce que j&apos;ai lu</h2>
                <p className="text-xs text-slate-500">
                  Fichier : <span className="font-mono">{fileName}</span>
                  {storagePath && <span className="ml-2 text-emerald-600">✓ Stocké en privé</span>}
                </p>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Vérifie ou corrige les lignes ci-dessous avant de lancer le mode <strong>{cfg.title}</strong>.
                </p>
              </div>
              <button onClick={resetAll} className="text-xs font-semibold text-slate-500 hover:text-slate-800">
                Changer de photo
              </button>
            </div>

            {previewUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={previewUrl}
                alt="Ta copie"
                className="w-full max-h-64 object-contain rounded-2xl border border-slate-200 bg-slate-50"
              />
            )}

            {mode === "question" && (
              <div className="bg-violet-50 border border-violet-200 rounded-2xl p-4">
                <label className="block text-xs font-bold text-violet-900 mb-1.5">
                  ❓ Ta question au tuteur :
                </label>
                <input
                  type="text"
                  value={studentQuestion}
                  onChange={(e) => setStudentQuestion(e.target.value)}
                  placeholder="ex : Comment démarrer la question 1 ?"
                  className="w-full border border-violet-200 rounded-xl px-3.5 py-2 text-sm text-slate-900 bg-white outline-none focus:border-violet-500"
                />
              </div>
            )}

            <div className="space-y-3">
              {lines.map((line, idx) => (
                <div
                  key={line.id}
                  className={`rounded-2xl border p-4 ${
                    line.confidence === "low"
                      ? "bg-rose-50 border-rose-200"
                      : line.confidence === "medium"
                      ? "bg-amber-50 border-amber-200"
                      : "bg-slate-50 border-slate-200"
                  }`}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-bold text-slate-500">Ligne {idx + 1}</span>
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                          line.confidence === "low"
                            ? "bg-rose-200 text-rose-900"
                            : line.confidence === "medium"
                            ? "bg-amber-200 text-amber-900"
                            : "bg-emerald-100 text-emerald-700"
                        }`}
                      >
                        {line.confidence === "low"
                          ? "❌ Illisible — réécris-la"
                          : line.confidence === "medium"
                          ? "⚠️ Lecture à vérifier"
                          : "✓ Haute confiance"}
                      </span>
                      <button
                        type="button"
                        onClick={() => setLines((prev) => prev.filter((l) => l.id !== line.id))}
                        className="text-[11px] text-slate-400 hover:text-rose-600"
                        title="Supprimer cette ligne"
                      >
                        🗑️
                      </button>
                    </div>
                  </div>
                  <input
                    type="text"
                    value={line.text}
                    onChange={(e) =>
                      setLines((prev) =>
                        prev.map((l) => (l.id === line.id ? { ...l, text: e.target.value, confidence: "high" } : l))
                      )
                    }
                    className="w-full font-mono text-sm text-slate-900 bg-white border border-slate-200 rounded-xl px-3.5 py-2 outline-none focus:border-indigo-400"
                  />
                </div>
              ))}
              <button
                type="button"
                onClick={() =>
                  setLines((prev) => [
                    ...prev,
                    { id: (prev[prev.length - 1]?.id || 0) + 1, text: "", confidence: "high" },
                  ])
                }
                className="text-xs font-bold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 px-3 py-1.5 rounded-lg"
              >
                + Ajouter une ligne oubliée
              </button>
            </div>

            <button
              onClick={() => confirmAndAnalyze()}
              disabled={analyzing || lines.every((l) => !l.text.trim())}
              className={`w-full text-white font-bold py-3.5 rounded-2xl transition-colors shadow-lg disabled:opacity-60 ${cfg.accentBtn}`}
            >
              {analyzing ? "⏳ Analyse IA en cours…" : cfg.confirmCta}
            </button>
          </div>
        )}

        {/* STEP 3: Distinct Results per Mode */}
        {step === "result" && analysis && (
          <div className="bg-white rounded-3xl border border-slate-100 p-7 shadow-sm space-y-5">
            {/* Case A: User sent an exercise statement WITHOUT student answers in Correct or Grade mode */}
            {!analysis.hasStudentWork && analysis.mode !== "question" ? (
              <div className="bg-amber-50 border border-amber-300 rounded-2xl p-5 space-y-3">
                <div className="flex items-start gap-3">
                  <span className="text-2xl">⚠️</span>
                  <div>
                    <h2 className="font-extrabold text-amber-950 text-base">
                      Aucune réponse d&apos;élève détectée sur cette photo
                    </h2>
                    <p className="text-xs text-amber-900 mt-1 leading-relaxed">
                      {analysis.summary} Pour recevoir une correction ou une note, écris d&apos;abord tes réponses sur papier puis photographie ta résolution. Si tu veux juste de l&apos;aide pour comprendre cet énoncé, clique ci-dessous !
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2.5 pt-1">
                  <button
                    type="button"
                    disabled={analyzing}
                    onClick={() => confirmAndAnalyze("question")}
                    className="bg-violet-600 text-white text-xs font-bold px-4 py-2.5 rounded-xl hover:bg-violet-700 disabled:opacity-60"
                  >
                    {analyzing ? "⏳ Chargement…" : "❓ Basculer en mode « J'ai une question » (aide tuteur)"}
                  </button>
                  <button
                    type="button"
                    onClick={resetAll}
                    className="bg-white border border-amber-300 text-amber-900 text-xs font-bold px-4 py-2.5 rounded-xl hover:bg-amber-100"
                  >
                    📷 Envoyer une photo avec mes réponses
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <h2 className="text-lg font-extrabold text-slate-900">
                    {analysis.mode === "grade" && analysis.score !== null
                      ? `🎓 Note estimée (Barème Bac) : ${analysis.score.toFixed(1).replace(".", ",")} / ${analysis.maxScore}`
                      : analysis.mode === "question"
                      ? "❓ Explication du tuteur sur ta photo (non noté)"
                      : "✍️ Correction étape par étape"}
                  </h2>
                  <div className="flex items-center gap-2">
                    {analysis.mode === "correct" && analysis.score !== null && (
                      <span className="text-xs font-bold bg-indigo-100 text-indigo-800 px-3 py-1 rounded-full">
                        Score : {analysis.score.toFixed(1).replace(".", ",")} / {analysis.maxScore}
                      </span>
                    )}
                    {analysis.mode === "question" && (
                      <span className="text-xs font-bold bg-violet-100 text-violet-700 px-3 py-1 rounded-full">
                        Aide pédagogique · Non noté
                      </span>
                    )}
                    {analysis.errorCode && (
                      <span className="text-xs font-bold bg-rose-100 text-rose-700 px-3 py-1 rounded-full font-mono">
                        {analysis.errorCode}
                      </span>
                    )}
                  </div>
                </div>

                {/* Summary */}
                <div className="bg-indigo-50 border border-indigo-100 rounded-2xl p-4 text-sm text-indigo-900">
                  <strong>Bilan : </strong>
                  <MathText text={analysis.summary} />
                </div>

                {/* Tutor Reply */}
                {analysis.tutorReply && (
                  <div className="bg-violet-50 border border-violet-200 rounded-2xl p-4 text-sm text-violet-950 whitespace-pre-line leading-relaxed">
                    <strong>💬 {analysis.mode === "question" ? "Réponse du tuteur : " : "Conseil & méthode : "}</strong>
                    <MathText text={analysis.tutorReply} />
                  </div>
                )}

                {/* Bac Rubric Breakdown (Grade mode only) */}
                {analysis.mode === "grade" && analysis.rubricBreakdown && analysis.rubricBreakdown.length > 0 && (
                  <div className="bg-emerald-50/70 border border-emerald-200 rounded-2xl p-4 space-y-2.5">
                    <div className="text-xs font-extrabold uppercase tracking-wider text-emerald-900">
                      📋 Barème détaillé sur {analysis.maxScore}
                    </div>
                    <div className="grid sm:grid-cols-2 gap-2.5">
                      {analysis.rubricBreakdown.map((item, idx) => (
                        <div key={idx} className="bg-white rounded-xl p-3 border border-emerald-100">
                          <div className="flex items-center justify-between gap-2 text-xs font-bold text-slate-900 mb-1">
                            <span>{item.criterion}</span>
                            <span className="text-emerald-700 font-mono">
                              {item.points} / {item.maxPoints}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-600">
                            <MathText text={item.comment} />
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Line-by-line review */}
                <div className="space-y-2.5 text-sm">
                  {lines
                    .filter((l) => l.text.trim())
                    .map((l, idx) => {
                      const st = analysis.steps.find((s) => s.lineId === l.id);
                      const style = VERDICT_STYLE[st?.verdict || "info"];
                      return (
                        <div key={l.id} className={`rounded-2xl border p-4 ${style.box}`}>
                          <div className="flex items-center gap-2 flex-wrap">
                            <strong>
                              {style.label} · Ligne {idx + 1}
                            </strong>
                            <span className="text-xs bg-white/80 px-2 py-0.5 rounded">
                              <MathText text={l.text} />
                            </span>
                          </div>
                          {st?.comment && (
                            <span className="block mt-1.5 text-xs">
                              <MathText text={st.comment} />
                            </span>
                          )}
                        </div>
                      );
                    })}
                </div>

                {/* Honest persistence status */}
                <div className="text-xs text-slate-500">
                  {analysis.mode === "question"
                    ? "ℹ️ Session d'aide uniquement : aucune note n'a été enregistrée dans tes résultats."
                    : savedToDb
                    ? "✓ Copie et correction enregistrées — ton professeur peut la consulter et ajuster la note dans « Correction de copies »."
                    : "ℹ️ Correction affichée."}
                </div>

                <div className="flex flex-wrap gap-3 pt-2">
                  <button
                    type="button"
                    onClick={continueInTutor}
                    className="flex-1 text-center bg-indigo-600 text-white font-bold py-3 px-4 rounded-xl hover:bg-indigo-700 text-sm cursor-pointer"
                  >
                    💬 Continuer cette discussion avec le Tuteur IA →
                  </button>
                  <button
                    onClick={resetAll}
                    className="px-5 py-3 rounded-xl border border-slate-200 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    Nouvelle photo
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
