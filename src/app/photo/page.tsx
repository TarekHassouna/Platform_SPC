"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";

type PhotoMode = "question" | "correct" | "grade";

const SAMPLE_TRANSCRIPTION = [
  { id: 1, text: "Données : R = 47 Ω, U = 12 V", confidence: "high" as const },
  { id: 2, text: "Loi d'Ohm : U = R × I  ⇒  I = R / U", confidence: "high" as const },
  { id: 3, text: "I = 47 / 12 = 3,92 A", confidence: "medium" as const },
];

export default function PhotoSubmissionPage() {
  const { user, logout } = useAuth();
  const router = useRouter();

  const [mode, setMode] = useState<PhotoMode>("correct");
  const [step, setStep] = useState<"upload" | "confirm" | "result">("upload");
  const [lines, setLines] = useState(SAMPLE_TRANSCRIPTION);
  const [studentQuestion, setStudentQuestion] = useState("");
  const [fileName, setFileName] = useState<string | null>(null);

  const handleFilePick = (name: string) => {
    setFileName(name);
    setStep("confirm");
  };

  const handleLogout = () => {
    logout();
    router.push("/auth/login");
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
        <div className="mb-8">
          <h1 className="text-2xl font-extrabold text-slate-900 mb-1">
            Soumets une photo de ta copie papier
          </h1>
          <p className="text-slate-500 text-sm">
            Le bac se fait sur papier : photographie ton raisonnement, vérifie la lecture, puis obtiens une correction étape par étape.
          </p>
        </div>

        {/* 3 Modes selector */}
        <div className="grid sm:grid-cols-3 gap-3 mb-8">
          {[
            { id: "question" as PhotoMode, icon: "❓", title: "« J'ai une question »", desc: "Photo + question — le tuteur te guide sur ton vrai brouillon" },
            { id: "correct" as PhotoMode, icon: "✍️", title: "« Corrige-moi »", desc: "Première erreur pointée, explication et corrigé détaillé" },
            { id: "grade" as PhotoMode, icon: "🎓", title: "« Note-moi »", desc: "Notation type Bac sur barème officiel avec points par question" },
          ].map((m) => (
            <button
              key={m.id}
              onClick={() => setMode(m.id)}
              className={`text-left rounded-2xl p-4 border transition-all ${
                mode === m.id
                  ? "bg-indigo-50 border-indigo-400 ring-2 ring-indigo-100"
                  : "bg-white border-slate-200 hover:border-indigo-200"
              }`}
            >
              <div className="text-2xl mb-1.5">{m.icon}</div>
              <div className="font-bold text-slate-900 text-sm">{m.title}</div>
              <div className="text-xs text-slate-500 mt-1 leading-relaxed">{m.desc}</div>
            </button>
          ))}
        </div>

        {/* Stepper */}
        <div className="flex items-center gap-2 text-xs font-bold mb-6">
          {[
            { id: "upload", label: "1. Photo" },
            { id: "confirm", label: "2. Confirmation lecture" },
            { id: "result", label: "3. Correction" },
          ].map((s, i) => (
            <div key={s.id} className="flex items-center gap-2">
              <span
                className={`px-3 py-1 rounded-full ${
                  step === s.id
                    ? "bg-indigo-600 text-white"
                    : "bg-white border border-slate-200 text-slate-500"
                }`}
              >
                {s.label}
              </span>
              {i < 2 && <span className="text-slate-300">→</span>}
            </div>
          ))}
        </div>

        {/* Step 1: Upload */}
        {step === "upload" && (
          <div className="bg-white rounded-3xl border border-slate-100 p-8 shadow-sm text-center">
            <div className="border-2 border-dashed border-indigo-200 rounded-3xl p-10 bg-indigo-50/30">
              <div className="text-4xl mb-3">📷</div>
              <h2 className="font-bold text-slate-900 text-base mb-1">
                Prends en photo ou importe ta feuille
              </h2>
              <p className="text-xs text-slate-500 mb-6">
                Recadrage et redressement automatiques · Stockage privé supprimé après 90 jours
              </p>

              {mode === "question" && (
                <div className="max-w-md mx-auto mb-5 text-left">
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Ta question sur cette feuille :
                  </label>
                  <input
                    type="text"
                    value={studentQuestion}
                    onChange={(e) => setStudentQuestion(e.target.value)}
                    placeholder="ex : Pourquoi je ne trouve pas le même résultat que le corrigé ?"
                    className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-900 bg-white placeholder:text-slate-400 outline-none focus:border-indigo-400"
                  />
                </div>
              )}

              <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                <label className="cursor-pointer bg-indigo-600 text-white font-bold px-6 py-3 rounded-xl hover:bg-indigo-700 transition-colors text-sm shadow-md shadow-indigo-100">
                  Choisir une photo
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => handleFilePick(e.target.files?.[0]?.name || "copie_physique.jpg")}
                  />
                </label>
                <button
                  type="button"
                  onClick={() => handleFilePick("exemple_loi_ohm_manuscrit.jpg")}
                  className="bg-white border border-slate-200 text-slate-700 font-semibold px-5 py-3 rounded-xl hover:border-indigo-300 text-sm"
                >
                  Tester avec un exemple manuscrit →
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Step 2: Confirm transcription */}
        {step === "confirm" && (
          <div className="bg-white rounded-3xl border border-slate-100 p-7 shadow-sm space-y-5">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-extrabold text-slate-900 text-lg">Voici ce que j&apos;ai lu</h2>
                <p className="text-xs text-slate-500">
                  Fichier : <span className="font-mono">{fileName}</span> · Corrige toute ligne mal lue avant l&apos;évaluation.
                </p>
              </div>
              <button
                onClick={() => setStep("upload")}
                className="text-xs font-semibold text-slate-500 hover:text-slate-800"
              >
                Changer de photo
              </button>
            </div>

            <div className="space-y-3">
              {lines.map((line, idx) => (
                <div
                  key={line.id}
                  className={`rounded-2xl border p-4 ${
                    line.confidence === "medium"
                      ? "bg-amber-50 border-amber-200"
                      : "bg-slate-50 border-slate-200"
                  }`}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-bold text-slate-500">Ligne {idx + 1}</span>
                    <span
                      className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                        line.confidence === "medium"
                          ? "bg-amber-200 text-amber-900"
                          : "bg-emerald-100 text-emerald-700"
                      }`}
                    >
                      {line.confidence === "medium" ? "⚠️ Lecture à vérifier" : "✓ Haute confiance"}
                    </span>
                  </div>
                  <input
                    type="text"
                    value={line.text}
                    onChange={(e) =>
                      setLines((prev) =>
                        prev.map((l) => (l.id === line.id ? { ...l, text: e.target.value } : l))
                      )
                    }
                    className="w-full font-mono text-sm text-slate-900 bg-white border border-slate-200 rounded-xl px-3.5 py-2 outline-none focus:border-indigo-400"
                  />
                </div>
              ))}
            </div>

            <button
              onClick={() => setStep("result")}
              className="w-full bg-indigo-600 text-white font-bold py-3.5 rounded-2xl hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-100"
            >
              ✅ Confirmer la lecture et analyser
            </button>
          </div>
        )}

        {/* Step 3: Result */}
        {step === "result" && (
          <div className="space-y-5">
            <div className="bg-white rounded-3xl border border-slate-100 p-7 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-extrabold text-slate-900">
                  {mode === "grade"
                    ? "🎓 Note estimée : 5,5 / 10 (Crédit partiel appliqué)"
                    : mode === "question"
                    ? "❓ Réponse du tuteur sur ton brouillon"
                    : "✍️ Correction étape par étape"}
                </h2>
                <span className="text-xs font-bold bg-rose-100 text-rose-700 px-3 py-1 rounded-full">
                  formule_inversee
                </span>
              </div>

              <div className="space-y-2.5 text-sm">
                <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 text-emerald-900">
                  <strong>✅ Ligne 1 :</strong> Données relevées correctement (R = 47 Ω, U = 12 V).
                </div>
                <div className="bg-rose-50 border border-rose-200 rounded-2xl p-4 text-rose-900">
                  <strong>❌ Ligne 2 (première erreur) :</strong> Tu as bien écrit <code className="font-mono bg-white px-1 rounded">U = R × I</code>, mais en isolant I tu as inversé la fraction : <code className="font-mono bg-white px-1 rounded">I = U / R</code> (et non R / U).
                </div>
                <div className="bg-indigo-50 border border-indigo-200 rounded-2xl p-4 text-indigo-900">
                  <strong>✓ Ligne 3 (non pénalisée deux fois) :</strong> Ton application numérique est cohérente avec ta ligne 2. Avec la bonne formule : <code className="font-mono bg-white px-1 rounded">I = 12 / 47 ≈ 0,26 A</code> (2 chiffres significatifs).
                </div>
              </div>

              <div className="flex flex-wrap gap-3 pt-2">
                <Link
                  href="/exercises"
                  className="flex-1 text-center bg-indigo-600 text-white font-bold py-3 rounded-xl hover:bg-indigo-700 text-sm"
                >
                  Pratiquer 3 exercices sur cette erreur →
                </Link>
                <button
                  onClick={() => setStep("upload")}
                  className="px-5 py-3 rounded-xl border border-slate-200 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Nouvelle photo
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
