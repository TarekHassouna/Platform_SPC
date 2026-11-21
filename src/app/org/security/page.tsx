"use client";
import { useCallback, useEffect, useState } from "react";
import { OrgShell } from "@/components/OrgShell";
import { getSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabase/client";
import { useAuth } from "@/lib/auth-context";

interface TotpFactor {
  id: string;
  friendly_name?: string;
  status: string;
}

export default function OrgSecurityPage() {
  const { user } = useAuth();
  const [factors, setFactors] = useState<TotpFactor[]>([]);
  const [loading, setLoading] = useState(true);

  // Enrollment flow
  const [enrolling, setEnrolling] = useState(false);
  const [pendingFactorId, setPendingFactorId] = useState<string | null>(null);
  const [qrCodeSvg, setQrCodeSvg] = useState<string | null>(null);
  const [manualSecret, setManualSecret] = useState<string | null>(null);
  const [verifyCode, setVerifyCode] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const loadFactors = useCallback(async () => {
    const supabase = getSupabaseBrowserClient();
    if (!isSupabaseConfigured || !supabase) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data } = await supabase.auth.mfa.listFactors();
    const list: TotpFactor[] = (data?.totp || []).map((f) => ({
      id: f.id,
      friendly_name: f.friendly_name,
      status: f.status,
    }));
    setFactors(list);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadFactors();
  }, [loadFactors]);

  const handleStartEnroll = async () => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;
    setMsg(null);
    setEnrolling(true);

    // Clean up any stale unverified factor first
    const { data: existing } = await supabase.auth.mfa.listFactors();
    for (const f of existing?.all || []) {
      if (f.status === "unverified") {
        await supabase.auth.mfa.unenroll({ factorId: f.id });
      }
    }

    const { data, error } = await supabase.auth.mfa.enroll({
      factorType: "totp",
      friendlyName: "Platform SPC Admin",
    });
    setEnrolling(false);

    if (error || !data) {
      setMsg({ ok: false, text: error?.message || "Impossible de démarrer l'enrôlement 2FA." });
      return;
    }

    setPendingFactorId(data.id);
    setQrCodeSvg(data.totp.qr_code);
    setManualSecret(data.totp.secret);
  };

  const handleVerifyEnroll = async (e: React.FormEvent) => {
    e.preventDefault();
    const supabase = getSupabaseBrowserClient();
    if (!supabase || !pendingFactorId) return;
    setVerifying(true);
    setMsg(null);

    const { error } = await supabase.auth.mfa.challengeAndVerify({
      factorId: pendingFactorId,
      code: verifyCode.trim(),
    });
    setVerifying(false);

    if (error) {
      setMsg({ ok: false, text: "Code à 6 chiffres invalide. Vérifiez l'heure de votre téléphone et réessayez." });
      return;
    }

    setPendingFactorId(null);
    setQrCodeSvg(null);
    setManualSecret(null);
    setVerifyCode("");
    setMsg({
      ok: true,
      text: "✅ Double authentification (2FA) activée ! Un code Authenticator sera désormais exigé à chaque connexion admin.",
    });
    await loadFactors();
  };

  const handleUnenroll = async (factorId: string) => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;
    setMsg(null);
    const { error } = await supabase.auth.mfa.unenroll({ factorId });
    if (error) {
      setMsg({ ok: false, text: error.message });
      return;
    }
    setMsg({ ok: true, text: "Facteur 2FA supprimé. Vous pouvez en configurer un nouveau." });
    await loadFactors();
  };

  const verifiedFactors = factors.filter((f) => f.status === "verified");

  return (
    <OrgShell>
      <div className="mb-8">
        <h1 className="text-2xl font-extrabold text-slate-900">🔐 Sécurité Administrateur &amp; 2FA</h1>
        <p className="text-slate-500 mt-1 text-sm">
          Protection maximale du compte administrateur ({user?.email}).
        </p>
      </div>

      {msg && (
        <div
          className={`mb-6 rounded-2xl px-4 py-3 text-xs font-semibold border ${
            msg.ok
              ? "bg-emerald-50 border-emerald-200 text-emerald-800"
              : "bg-rose-50 border-rose-200 text-rose-700"
          }`}
        >
          {msg.text}
        </div>
      )}

      {/* Active Security Layers Checklist */}
      <div className="bg-white rounded-3xl border border-slate-100 p-6 shadow-sm mb-6">
        <h2 className="font-bold text-slate-900 text-base mb-4">🛡️ Couches de sécurité actives</h2>
        <div className="grid sm:grid-cols-2 gap-3 text-xs">
          {[
            {
              title: "Inscription Admin publique désactivée",
              desc: "Impossible de créer un compte Admin depuis /auth/signup ou l'API.",
              active: true,
            },
            {
              title: "Connexion Admin bloquée sur /auth/login",
              desc: "Portail privé caché (/spc-admin-gate) avec clé d'accès serveur + protection anti-brute-force.",
              active: true,
            },
            {
              title: "Protection serveur (/org/*)",
              desc: "Middleware vérifie le cookie signé HttpOnly + liste blanche e-mail en base (404 pour les non-admins).",
              active: true,
            },
            {
              title: "Double authentification (2FA Authenticator)",
              desc:
                verifiedFactors.length > 0
                  ? "Activée — code à 6 chiffres obligatoire à chaque connexion."
                  : "Non encore activée — cliquez ci-dessous pour scanner le QR code.",
              active: verifiedFactors.length > 0,
            },
          ].map((item) => (
            <div
              key={item.title}
              className={`rounded-2xl p-4 border ${
                item.active
                  ? "bg-emerald-50/60 border-emerald-200"
                  : "bg-amber-50/70 border-amber-200"
              }`}
            >
              <div className="font-bold text-slate-900 flex items-center gap-1.5">
                <span>{item.active ? "✅" : "⚠️"}</span>
                <span>{item.title}</span>
              </div>
              <p className="text-slate-600 mt-1 leading-relaxed">{item.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* 2FA TOTP Management Card */}
      <div className="bg-white rounded-3xl border border-slate-100 p-6 shadow-sm max-w-2xl">
        <h2 className="font-bold text-slate-900 text-base mb-1">
          📱 Double authentification (Google Authenticator / Authy)
        </h2>
        <p className="text-xs text-slate-500 mb-5">
          Même si quelqu&apos;un connaissait votre mot de passe et la clé serveur, il ne pourra pas accéder au panneau admin sans votre téléphone.
        </p>

        {loading ? (
          <div className="text-xs text-slate-400">Vérification du statut 2FA…</div>
        ) : verifiedFactors.length > 0 ? (
          <div className="space-y-3">
            {verifiedFactors.map((f) => (
              <div
                key={f.id}
                className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 flex items-center justify-between gap-3"
              >
                <div>
                  <div className="text-sm font-bold text-emerald-900">
                    ✅ {f.friendly_name || "Application Authenticator"}
                  </div>
                  <div className="text-xs text-emerald-700">Actif · Code à 6 chiffres exigé</div>
                </div>
                <button
                  type="button"
                  onClick={() => handleUnenroll(f.id)}
                  className="text-xs font-bold text-rose-600 bg-white border border-rose-200 px-3 py-1.5 rounded-xl hover:bg-rose-50"
                >
                  Retirer
                </button>
              </div>
            ))}
          </div>
        ) : qrCodeSvg ? (
          <form onSubmit={handleVerifyEnroll} className="space-y-4">
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 flex flex-col sm:flex-row items-center gap-5">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={qrCodeSvg}
                alt="QR Code 2FA Authenticator"
                className="w-40 h-40 rounded-xl bg-white p-2 border border-slate-200 shrink-0"
              />
              <div className="text-xs text-slate-600 space-y-2">
                <div className="font-bold text-slate-900 text-sm">
                  1. Scannez ce QR code avec votre application 2FA
                </div>
                <p>
                  Utilisez <strong>Google Authenticator</strong>, <strong>Authy</strong>, ou <strong>1Password</strong> sur votre téléphone.
                </p>
                {manualSecret && (
                  <div className="bg-white border border-slate-200 rounded-xl p-2.5">
                    <div className="text-[10px] uppercase text-slate-400 font-bold">
                      Clé manuelle (si vous ne pouvez pas scanner)
                    </div>
                    <code className="font-mono text-xs font-bold text-slate-800 break-all">
                      {manualSecret}
                    </code>
                  </div>
                )}
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                2. Entrez le code à 6 chiffres affiché sur votre téléphone
              </label>
              <div className="flex items-center gap-3">
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  required
                  value={verifyCode}
                  onChange={(e) => setVerifyCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  placeholder="123456"
                  className="w-44 text-center font-mono text-lg font-bold tracking-[0.35em] border border-slate-200 rounded-xl px-4 py-2.5 text-slate-900 bg-white outline-none focus:border-indigo-400"
                />
                <button
                  type="submit"
                  disabled={verifying || verifyCode.length !== 6}
                  className="bg-emerald-600 text-white font-bold px-5 py-2.5 rounded-xl text-xs hover:bg-emerald-700 disabled:opacity-50"
                >
                  {verifying ? "Vérification…" : "✅ Activer la 2FA"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setPendingFactorId(null);
                    setQrCodeSvg(null);
                    setManualSecret(null);
                  }}
                  className="text-xs font-semibold text-slate-500 hover:text-slate-800"
                >
                  Annuler
                </button>
              </div>
            </div>
          </form>
        ) : (
          <button
            type="button"
            disabled={enrolling}
            onClick={handleStartEnroll}
            className="bg-indigo-600 text-white font-bold px-5 py-2.5 rounded-xl text-xs hover:bg-indigo-700 shadow-sm disabled:opacity-60"
          >
            {enrolling ? "Génération du QR code…" : "🔐 Configurer Google Authenticator (2FA)"}
          </button>
        )}
      </div>
    </OrgShell>
  );
}
