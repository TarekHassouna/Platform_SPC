"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";

export default function ResetPasswordPage() {
  const { updatePassword } = useAuth();
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (password.length < 8 || !/[A-Z]/.test(password) || !/\d/.test(password)) {
      setError("Le mot de passe doit contenir au moins 8 caractères, une majuscule et un chiffre.");
      return;
    }
    if (password !== confirm) {
      setError("Les mots de passe ne correspondent pas.");
      return;
    }
    setLoading(true);
    const res = await updatePassword(password);
    setLoading(false);
    if (!res.ok) {
      setError(res.error || "Impossible de mettre à jour le mot de passe.");
      return;
    }
    setDone(true);
    setTimeout(() => router.push("/auth/login"), 1800);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-violet-50 flex items-center justify-center p-6">
      <div className="w-full max-w-md bg-white rounded-3xl border border-slate-100 shadow-xl p-8">
        <div className="text-center mb-6">
          <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 text-2xl flex items-center justify-center mx-auto mb-3">
            🔒
          </div>
          <h1 className="text-2xl font-extrabold text-slate-900">Nouveau mot de passe</h1>
          <p className="text-sm text-slate-500 mt-1">
            Choisissez un mot de passe solide (8+ caractères, 1 majuscule, 1 chiffre).
          </p>
        </div>

        {done ? (
          <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-2xl p-4 text-sm text-center">
            ✅ Mot de passe mis à jour ! Redirection vers la connexion…
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold rounded-xl px-4 py-3">
                ⚠️ {error}
              </div>
            )}
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">Nouveau mot de passe</label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Min. 8 car., 1 maj., 1 chiffre"
                className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-900 bg-white placeholder:text-slate-400 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">Confirmer le mot de passe</label>
              <input
                type="password"
                required
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder="Répéter le mot de passe"
                className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-900 bg-white placeholder:text-slate-400 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-indigo-600 text-white font-bold py-3.5 rounded-xl hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-100 disabled:opacity-60"
            >
              {loading ? "Mise à jour…" : "Enregistrer le mot de passe"}
            </button>
            <div className="text-center pt-1">
              <Link href="/auth/login" className="text-xs font-semibold text-slate-400 hover:text-indigo-600">
                ← Retour à la connexion
              </Link>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
