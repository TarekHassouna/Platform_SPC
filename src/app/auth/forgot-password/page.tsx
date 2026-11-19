"use client";
import { useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";

export default function ForgotPasswordPage() {
  const { sendPasswordReset, authMode } = useAuth();
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const res = await sendPasswordReset(email);
    setLoading(false);
    if (!res.ok) {
      setError(res.error || "Erreur lors de l'envoi du lien.");
      return;
    }
    setSent(true);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-violet-50 flex items-center justify-center p-6">
      <div className="w-full max-w-md bg-white rounded-3xl border border-slate-100 shadow-xl p-8">
        <div className="text-center mb-6">
          <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 text-2xl flex items-center justify-center mx-auto mb-3">
            🔑
          </div>
          <h1 className="text-2xl font-extrabold text-slate-900">Mot de passe oublié</h1>
          <p className="text-sm text-slate-500 mt-1">
            Entrez votre e-mail pour recevoir un lien de réinitialisation sécurisé.
          </p>
        </div>

        {sent ? (
          <div className="text-center space-y-5">
            <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-2xl p-4 text-sm leading-relaxed">
              ✅ Si un compte existe pour <strong>{email}</strong>, un lien de réinitialisation vient d&apos;être envoyé.
              {authMode === "local" && (
                <div className="mt-2 text-xs text-emerald-700">
                  (En mode local, vous pouvez aussi tester directement la page{" "}
                  <Link href="/auth/reset-password" className="underline font-bold">
                    /auth/reset-password
                  </Link>
                  .)
                </div>
              )}
            </div>
            <Link
              href="/auth/login"
              className="block w-full bg-indigo-600 text-white font-bold py-3 rounded-xl hover:bg-indigo-700 text-sm"
            >
              Retour à la connexion
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold rounded-xl px-4 py-3">
                ⚠️ {error}
              </div>
            )}
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">Adresse e-mail</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="vous@exemple.fr"
                className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-900 bg-white placeholder:text-slate-400 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-indigo-600 text-white font-bold py-3.5 rounded-xl hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-100 disabled:opacity-60"
            >
              {loading ? "Envoi…" : "Envoyer le lien de réinitialisation"}
            </button>
            <div className="text-center pt-2">
              <Link href="/auth/login" className="text-sm font-semibold text-slate-500 hover:text-indigo-600">
                ← Retour à la connexion
              </Link>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
