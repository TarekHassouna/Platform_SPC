"use client";
import { useState } from "react";
import { useAuth } from "@/lib/auth-context";

export default function PrivateAdminGatePage() {
  const { refreshProfile } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [accessCode, setAccessCode] = useState("");
  const [showSecrets, setShowSecrets] = useState(false);

  // Step 2: 2FA TOTP verification
  const [mfaFactorId, setMfaFactorId] = useState<string | null>(null);
  const [totpCode, setTotpCode] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handlePrimarySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/admin/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          password,
          accessCode: accessCode.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(data.error || "Accès refusé.");
        setSubmitting(false);
        return;
      }

      if (data.requiresMfa && data.factorId) {
        setMfaFactorId(String(data.factorId));
        setSubmitting(false);
        return;
      }

      await refreshProfile();
      window.location.href = "/org/dashboard";
    } catch {
      setError("Erreur réseau lors de l'authentification.");
      setSubmitting(false);
    }
  };

  const handleMfaSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!mfaFactorId) return;
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/admin/auth/mfa", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          factorId: mfaFactorId,
          code: totpCode.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(data.error || "Code 2FA invalide.");
        setSubmitting(false);
        return;
      }

      await refreshProfile();
      window.location.href = "/org/dashboard";
    } catch {
      setError("Erreur réseau lors de la vérification 2FA.");
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6">
      <div className="w-full max-w-md">
        <div className="text-center mb-7">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white text-2xl font-extrabold shadow-xl shadow-indigo-950 mb-4">
            🔐
          </div>
          <h1 className="text-2xl font-extrabold text-white">Accès Administrateur Privé</h1>
          <p className="text-slate-400 mt-1 text-xs">
            Authentification multi-facteurs protégée côté serveur
          </p>
        </div>

        <div className="bg-slate-900 rounded-3xl border border-slate-800 shadow-2xl p-8">
          {error && (
            <div className="mb-5 bg-rose-950/70 border border-rose-800 text-rose-200 text-xs font-semibold rounded-2xl px-4 py-3 leading-relaxed">
              ⚠️ {error}
            </div>
          )}

          {!mfaFactorId ? (
            <form onSubmit={handlePrimarySubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  E-mail administrateur
                </label>
                <input
                  type="email"
                  required
                  autoComplete="username"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@etablissement.fr"
                  className="w-full border border-slate-700 rounded-xl px-4 py-3 text-sm text-white placeholder:text-slate-500 bg-slate-950 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/30"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Mot de passe
                </label>
                <input
                  type={showSecrets ? "text" : "password"}
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full border border-slate-700 rounded-xl px-4 py-3 text-sm text-white placeholder:text-slate-500 bg-slate-950 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/30"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-semibold text-slate-300">
                    Clé d&apos;accès serveur
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowSecrets((v) => !v)}
                    className="text-[11px] font-semibold text-slate-400 hover:text-slate-200"
                  >
                    {showSecrets ? "Masquer" : "Afficher"}
                  </button>
                </div>
                <input
                  type={showSecrets ? "text" : "password"}
                  required
                  autoComplete="off"
                  value={accessCode}
                  onChange={(e) => setAccessCode(e.target.value)}
                  placeholder="SPC-ADM-..."
                  className="w-full font-mono border border-slate-700 rounded-xl px-4 py-3 text-sm text-white placeholder:text-slate-500 bg-slate-950 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/30"
                />
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full bg-indigo-600 text-white font-bold py-3.5 rounded-xl hover:bg-indigo-500 transition-all shadow-lg shadow-indigo-950 disabled:opacity-60 text-sm"
              >
                {submitting ? "Vérification sécurisée…" : "Déverrouiller l'espace Admin"}
              </button>
            </form>
          ) : (
            <form onSubmit={handleMfaSubmit} className="space-y-4">
              <div className="bg-indigo-950/60 border border-indigo-800 rounded-2xl p-4 text-xs text-indigo-200 leading-relaxed">
                📱 <strong>Double authentification (2FA) requise :</strong> ouvrez Google Authenticator ou Authy et saisissez le code à 6 chiffres.
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Code à 6 chiffres
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="\d{6}"
                  maxLength={6}
                  required
                  autoFocus
                  value={totpCode}
                  onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  placeholder="123456"
                  className="w-full text-center tracking-[0.5em] font-mono text-xl font-bold border border-slate-700 rounded-xl px-4 py-3.5 text-white placeholder:text-slate-600 bg-slate-950 outline-none focus:border-indigo-500"
                />
              </div>

              <button
                type="submit"
                disabled={submitting || totpCode.length !== 6}
                className="w-full bg-emerald-600 text-white font-bold py-3.5 rounded-xl hover:bg-emerald-500 transition-all disabled:opacity-50 text-sm"
              >
                {submitting ? "Validation 2FA…" : "✅ Valider le code 2FA"}
              </button>

              <button
                type="button"
                onClick={() => {
                  setMfaFactorId(null);
                  setTotpCode("");
                  setError(null);
                }}
                className="w-full text-xs text-slate-400 hover:text-slate-200 py-1.5"
              >
                ← Retour
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
