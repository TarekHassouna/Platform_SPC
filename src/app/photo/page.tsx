"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { uploadStudentPhoto } from "@/lib/db";

type PhotoMode = "question" | "correct" | "grade";

interface TranscribedLine {
  id: number;
  text: string;
  confidence: "high" | "medium" | "low";
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

export default function PhotoSubmissionPage() {
  const { user, logout } = useAuth();
  const router = useRouter();

  const [mode, setMode] = useState<PhotoMode>("correct");
  const [step, setStep] = useState<"upload" | "confirm" | "result">("upload");
  const [lines, setLines] = useState<TranscribedLine[]>([]);
  const [studentQuestion, setStudentQuestion] = useState("");
  const [fileName, setFileName] = useState<string | null>(null);
  const [storagePath, setStoragePath] = useState<string | null>(null);
  const [provider, setProvider] = useState<string | null>(null);
  const [quotaInfo, setQuotaInfo] = useState<{ remaining: number; limit: number } | null>(null);
  const [uploading, setUploading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const runTranscription = async (file?: File) => {
    setErrorMsg(null);
    setUploading(true);
    try {
      let imageBase64: string | undefined;
      let mimeType: string | undefined;

      if (file) {
        setFileName(file.name);
        if (user?.id) {
          const up = await uploadStudentPhoto(user.id, file);
          if (up.path) setStoragePath(up.path);
        }
        imageBase64 = await fileToBase64(file);
        mimeType = file.type || "image/jpeg";
      } else {
        setFileName("exemple_loi_ohm_manuscrit.jpg");
      }

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
      if (!res.ok) {
        setErrorMsg(data.error || "Erreur lors de la lecture de la photo.");
        setUploading(false);
        return;
      }

      setLines(data.lines || []);
      if (data.provider) setProvider(data.provider);
      if (data.quota) setQuotaInfo({ remaining: data.quota.remaining, limit: data.quota.limit });
      setStep("confirm");
    } catch {
      setErrorMsg("Impossible d'analyser l'image pour le moment.");
    }
    setUploading(false);
  };

  const handleLogout = async () => {
    await logout();
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
        <div className="mb-8">
          <h1 className="text-2xl font-extrabold text-slate-900 mb-1">
            Soumets une photo de ta copie papier
          </h1>
          <p className="text-slate-500 text-sm">
            Le bac se fait sur papier : photographie ton raisonnement, vérifie la lecture, puis obtiens une correction étape par étape.
          </p>
        </div>

        {errorMsg && (
          <div className="mb-5 bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold rounded-2xl px-4 py-3">
            ⚠️ {errorMsg}
          </div>
        )}

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

        {step === "upload" && (
          <div className="bg-white rounded-3xl border border-slate-100 p-8 shadow-sm text-center">
            <div className="border-2 border-dashed border-indigo-200 rounded-3xl p-10 bg-indigo-50/30">
              <div className="text-4xl mb-3">📷</div>
              <h2 className="font-bold text-slate-900 text-base mb-1">
                Prends en photo ou importe ta feuille
              </h2>
              <p className="text-xs text-slate-500 mb-6">
                Stockage privé Supabase Storage · Supprimé automatiquement après 90 jours
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
                  {uploading ? "⏳ Lecture en cours…" : "Choisir une photo"}
                  <input
                    type="file"
                    accept="image/*"
                    disabled={uploading}
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) runTranscription(f);
                    }}
                  />
                </label>
                <button
                  type="button"
                  disabled={uploading}
                  onClick={() => runTranscription()}
                  className="bg-white border border-slate-200 text-slate-700 font-semibold px-5 py-3 rounded-xl hover:border-indigo-300 text-sm disabled:opacity-50"
                >
                  Tester avec un exemple manuscrit →
                </button>
              </div>
            </div>
          </div>
        )}

        {step === "confirm" && (
          <div className="bg-white rounded-3xl border border-slate-100 p-7 shadow-sm space-y-5">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div>
                <h2 className="font-extrabold text-slate-900 text-lg">Voici ce que j&apos;ai lu</h2>
                <p className="text-xs text-slate-500">
                  Fichier : <span className="font-mono">{fileName}</span>
                  {storagePath && <span className="ml-2 text-emerald-600">✓ Stocké en privé</span>}
                  {provider && <span className="ml-2 font-mono text-slate-400">({provider})</span>}
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
                    line.confidence === "low"
                      ? "bg-rose-50 border-rose-200"
                      : line.confidence === "medium"
                      ? "bg-amber-50 border-amber-200"
                      : "bg-slate-50 border-slate-200"
                  }`}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-bold text-slate-500">Ligne {idx + 1}</span>
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
                        ? "❌ Illisible — merci de réécrire"
                        : line.confidence === "medium"
                        ? "⚠️ Lecture à vérifier"
                        : "✓ Haute confiance"}
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

        {step === "result" && (
          <div className="bg-white rounded-3xl border border-slate-100 p-7 shadow-sm space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <h2 className="text-lg font-extrabold text-slate-900">
                {mode === "grade"
                  ? "🎓 Note estimée : 5,5 / 10 (Crédit partiel appliqué)"
                  : mode === "question"
                  ? "❓ Réponse du tuteur sur ton brouillon"
                  : "✍️ Correction étape par étape"}
              </h2>
              <span className="text-xs font-bold bg-rose-100 text-rose-700 px-3 py-1 rounded-full font-mono">
                formule_inversee
              </span>
            </div>

            <div className="space-y-2.5 text-sm">
              {lines.map((l, idx) => (
                <div
                  key={l.id}
                  className={`rounded-2xl border p-4 ${
                    idx === 1
                      ? "bg-rose-50 border-rose-200 text-rose-900"
                      : idx === 2
                      ? "bg-indigo-50 border-indigo-200 text-indigo-900"
                      : "bg-emerald-50 border-emerald-200 text-emerald-900"
                  }`}
                >
                  <strong>
                    {idx === 0 ? "✅ Étape 1 : " : idx === 1 ? "❌ Étape 2 (erreur détectée) : " : "✓ Étape 3 : "}
                  </strong>
                  <span className="font-mono text-xs bg-white/80 px-1.5 py-0.5 rounded mr-2">{l.text}</span>
                  {idx === 1 && (
                    <span className="block mt-1">
                      La formule de la loi d&apos;Ohm est U = R × I, donc I = U / R (et non R / U).
                    </span>
                  )}
                  {idx === 2 && (
                    <span className="block mt-1">
                      Non pénalisée deux fois : avec la bonne formule, I = 12 / 47 ≈ 0,26 A (2 chiffres significatifs).
                    </span>
                  )}
                </div>
              ))}
            </div>

            <div className="flex flex-wrap gap-3 pt-2">
              <Link
                href="/exercises/ohm-001"
                className="flex-1 text-center bg-indigo-600 text-white font-bold py-3 rounded-xl hover:bg-indigo-700 text-sm"
              >
                Pratiquer cet exercice maintenant →
              </Link>
              <button
                onClick={() => setStep("upload")}
                className="px-5 py-3 rounded-xl border border-slate-200 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                Nouvelle photo
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
