"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth, UserRole, getDashboardPathForRole } from "@/lib/auth-context";
import { BrandLogo } from "@/components/BrandLogo";

const roles = [
  { label: "Élève", icon: "🎓", value: "student" as UserRole, hint: "Seconde à Terminale" },
  { label: "Enseignant", icon: "👨‍🏫", value: "teacher" as UserRole, hint: "Professeur ou tuteur" },
  { label: "Parent", icon: "👪", value: "parent" as UserRole, hint: "Suivi pédagogique" },
];

const inputClass =
  "w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all bg-white";
const selectClass =
  "w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-900 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all bg-white";

function getPasswordChecks(pwd: string) {
  return {
    length: pwd.length >= 8,
    upper: /[A-Z]/.test(pwd),
    number: /\d/.test(pwd),
    special: /[^A-Za-z0-9]/.test(pwd),
  };
}

export default function SignupPage() {
  const { signupWithEmail, loginWithGoogle } = useAuth();
  const router = useRouter();
  const [role, setRole] = useState<UserRole>("student");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [gdprAccepted, setGdprAccepted] = useState(false);
  const [verificationEmail, setVerificationEmail] = useState<string | null>(null);

  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    password: "",
    confirmPassword: "",
    level: "",
    classCode: "",
    school: "",
    schoolCode: "",
    teacherLevels: ["Terminale"] as string[],
    childName: "",
    childEmail: "",
    childLevel: "",
    orgSeats: "60",
  });

  const set = (key: string, val: string) => setForm((f) => ({ ...f, [key]: val }));

  const toggleLevel = (lvl: string) => {
    setForm((f) => ({
      ...f,
      teacherLevels: f.teacherLevels.includes(lvl)
        ? f.teacherLevels.filter((l) => l !== lvl)
        : [...f.teacherLevels, lvl],
    }));
  };

  const checks = getPasswordChecks(form.password);
  const strengthScore = Object.values(checks).filter(Boolean).length;
  const strengthLabel =
    strengthScore <= 1 ? "Faible" : strengthScore === 2 ? "Moyen" : strengthScore === 3 ? "Bon" : "Très fort";
  const strengthColor =
    strengthScore <= 1
      ? "bg-rose-500"
      : strengthScore === 2
      ? "bg-amber-400"
      : strengthScore === 3
      ? "bg-lime-500"
      : "bg-emerald-500";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!form.firstName.trim() || !form.lastName.trim()) {
      setError("Veuillez renseigner votre prénom et votre nom.");
      return;
    }
    if (role === "student" && !form.level) {
      setError("Veuillez choisir votre niveau scolaire (Seconde, Première ou Terminale).");
      return;
    }
    if (role === "teacher" && !form.school.trim()) {
      setError("Veuillez indiquer le nom de votre établissement ou activité de tutorat.");
      return;
    }
    if (role === "org_admin" && !form.school.trim()) {
      setError("Veuillez renseigner le nom de votre établissement.");
      return;
    }
    if (!checks.length || !checks.upper || !checks.number) {
      setError("Le mot de passe doit contenir au moins 8 caractères, une majuscule et un chiffre.");
      return;
    }
    if (form.password !== form.confirmPassword) {
      setError("Les deux mots de passe ne correspondent pas.");
      return;
    }
    if (!gdprAccepted) {
      setError("Veuillez accepter les CGU et la politique de protection des données (RGPD).");
      return;
    }

    setSubmitting(true);
    const res = await signupWithEmail(
      {
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        email: form.email.trim().toLowerCase(),
        role,
        level: form.level || undefined,
        classCode: form.classCode.trim() || undefined,
        school: form.school.trim() || undefined,
        levels: form.teacherLevels,
        schoolCode: form.schoolCode.trim() || undefined,
        childName: form.childName.trim() || undefined,
        childEmail: form.childEmail.trim().toLowerCase() || undefined,
        childLevel: form.childLevel || undefined,
        orgSeats: Number(form.orgSeats) || 60,
      },
      form.password
    );
    setSubmitting(false);

    if (!res.ok) {
      setError(res.error || "Erreur lors de la création du compte.");
      return;
    }

    if (res.needsEmailVerification) {
      setVerificationEmail(form.email.trim().toLowerCase());
      return;
    }

    router.push(getDashboardPathForRole(role));
  };

  if (verificationEmail) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-violet-50 flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-white rounded-3xl border border-slate-100 shadow-xl p-8 text-center">
          <div className="w-16 h-16 rounded-2xl bg-emerald-100 text-emerald-700 text-3xl flex items-center justify-center mx-auto mb-5">
            ✉️
          </div>
          <h1 className="text-2xl font-extrabold text-slate-900 mb-2">Vérifiez votre boîte mail</h1>
          <p className="text-sm text-slate-600 leading-relaxed mb-6">
            Un lien de confirmation vient d&apos;être envoyé à{" "}
            <strong className="text-slate-900">{verificationEmail}</strong>. Cliquez dessus pour activer votre compte et accéder automatiquement à votre espace.
          </p>
          <Link
            href="/auth/login"
            className="block w-full bg-indigo-600 text-white font-bold py-3 rounded-xl hover:bg-indigo-700 text-sm"
          >
            Retour à la connexion
          </Link>
        </div>
      </div>
    );
  }

  const ctaLabel =
    role === "parent"
      ? "Envoyer ma demande parent →"
      : role === "teacher"
      ? "Envoyer ma demande enseignant →"
      : role === "org_admin"
      ? "Créer l'espace administrateur →"
      : "Envoyer ma demande élève →";

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-violet-50 flex items-center justify-center p-6">
      <div className="w-full max-w-lg">
        <div className="text-center mb-7">
          <Link href="/" className="inline-flex items-center justify-center mb-4">
            <BrandLogo size="lg" className="shadow-xl rounded-2xl" />
          </Link>
          <h1 className="text-2xl font-extrabold text-slate-900">Créer un compte</h1>
          <p className="text-slate-500 mt-1 text-sm">
            Espace pédagogique Physique-Chimie
          </p>
        </div>

        <div className="bg-white rounded-3xl border border-slate-100 shadow-xl p-8">
          {error && (
            <div className="mb-5 bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold rounded-2xl px-4 py-3 leading-relaxed">
              ⚠️ {error}
            </div>
          )}

            {/* Role selector */}
          <div className="mb-6">
            <label className="block text-sm font-semibold text-slate-700 mb-2.5">Je suis…</label>
            <div className="grid grid-cols-3 gap-2.5">
              {roles.map((r) => (
                <button
                  key={r.value}
                  type="button"
                  onClick={() => {
                    setRole(r.value);
                    setError(null);
                  }}
                  className={`border rounded-2xl p-3 text-left transition-all flex items-center gap-3 ${
                    role === r.value
                      ? "border-indigo-500 bg-indigo-50 ring-2 ring-indigo-100"
                      : "border-slate-200 hover:border-slate-300 hover:bg-slate-50"
                  }`}
                >
                  <span className="text-2xl">{r.icon}</span>
                  <div>
                    <div className="text-xs font-bold text-slate-800">{r.label}</div>
                    <div className="text-[11px] text-slate-400">{r.hint}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">Prénom *</label>
                <input
                  type="text"
                  required
                  placeholder="Prénom"
                  className={inputClass}
                  value={form.firstName}
                  onChange={(e) => set("firstName", e.target.value)}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">Nom *</label>
                <input
                  type="text"
                  required
                  placeholder="Nom"
                  className={inputClass}
                  value={form.lastName}
                  onChange={(e) => set("lastName", e.target.value)}
                />
              </div>
            </div>

            {/* STUDENT relational fields */}
            {role === "student" && (
              <div className="grid sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">Niveau scolaire *</label>
                  <select className={selectClass} value={form.level} onChange={(e) => set("level", e.target.value)}>
                    <option value="">Choisir…</option>
                    <option value="Seconde">Seconde</option>
                    <option value="Première">Première</option>
                    <option value="Terminale">Terminale</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Code classe <span className="text-slate-400 font-normal">(optionnel)</span>
                  </label>
                  <input
                    type="text"
                    placeholder="PHY-2026-TS1"
                    className={inputClass}
                    value={form.classCode}
                    onChange={(e) => set("classCode", e.target.value.toUpperCase())}
                  />
                </div>
              </div>
            )}

            {/* TEACHER relational fields */}
            {role === "teacher" && (
              <>
                <div className="grid sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">Établissement / Tutorat *</label>
                    <input
                      type="text"
                      placeholder="Lycée Victor Hugo"
                      className={inputClass}
                      value={form.school}
                      onChange={(e) => set("school", e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                      Code établissement <span className="text-slate-400 font-normal">(optionnel)</span>
                    </label>
                    <input
                      type="text"
                      placeholder="ORG-A1B2C3"
                      className={inputClass}
                      value={form.schoolCode}
                      onChange={(e) => set("schoolCode", e.target.value.toUpperCase())}
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">Niveaux enseignés</label>
                  <div className="flex gap-4">
                    {["Seconde", "Première", "Terminale"].map((lvl) => (
                      <label key={lvl} className="flex items-center gap-1.5 cursor-pointer">
                        <input
                          type="checkbox"
                          className="accent-indigo-600 w-4 h-4"
                          checked={form.teacherLevels.includes(lvl)}
                          onChange={() => toggleLevel(lvl)}
                        />
                        <span className="text-sm text-slate-700">{lvl}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </>
            )}

            {/* PARENT relational fields */}
            {role === "parent" && (
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  E-mail du compte élève de votre enfant{" "}
                  <span className="text-slate-400 font-normal">(optionnel — soumis à validation admin)</span>
                </label>
                <input
                  type="email"
                  placeholder="eleve@exemple.com"
                  className={inputClass}
                  value={form.childEmail}
                  onChange={(e) => set("childEmail", e.target.value)}
                />
                <p className="text-[11px] text-slate-400 mt-1">
                  La liaison avec un élève nécessite l&apos;accord de l&apos;administrateur. Vous pourrez aussi demander un rattachement après validation de votre compte.
                </p>
              </div>
            )}

            <div className="bg-amber-50 border border-amber-200 rounded-2xl px-3.5 py-2.5 text-xs text-amber-800">
              ⏳ <strong>Validation requise :</strong> votre demande de compte sera envoyée à l&apos;administrateur. Votre accès s&apos;ouvrira dès son acceptation.
            </div>

            {/* Email */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">Adresse e-mail *</label>
              <input
                type="email"
                required
                autoComplete="email"
                placeholder="vous@exemple.fr"
                className={inputClass}
                value={form.email}
                onChange={(e) => set("email", e.target.value)}
              />
            </div>

            {/* Password + Strength Meter */}
            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">Mot de passe *</label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    required
                    autoComplete="new-password"
                    placeholder="Min. 8 car., 1 maj., 1 chiffre"
                    className={`${inputClass} pr-14`}
                    value={form.password}
                    onChange={(e) => set("password", e.target.value)}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] font-semibold text-slate-400 hover:text-slate-700"
                  >
                    {showPassword ? "Cacher" : "Voir"}
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">Confirmer *</label>
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  autoComplete="new-password"
                  placeholder="Répéter le mot de passe"
                  className={inputClass}
                  value={form.confirmPassword}
                  onChange={(e) => set("confirmPassword", e.target.value)}
                />
              </div>
            </div>

            {/* Live password strength indicator */}
            {form.password.length > 0 && (
              <div className="bg-slate-50 rounded-2xl p-3 border border-slate-100">
                <div className="flex items-center justify-between text-[11px] font-semibold mb-1.5">
                  <span className="text-slate-500">Sécurité du mot de passe</span>
                  <span className="text-slate-700">{strengthLabel}</span>
                </div>
                <div className="grid grid-cols-4 gap-1.5 mb-2">
                  {[1, 2, 3, 4].map((n) => (
                    <div
                      key={n}
                      className={`h-1.5 rounded-full transition-all ${
                        strengthScore >= n ? strengthColor : "bg-slate-200"
                      }`}
                    />
                  ))}
                </div>
                <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px]">
                  <span className={checks.length ? "text-emerald-600 font-semibold" : "text-slate-400"}>
                    {checks.length ? "✓" : "○"} 8+ caractères
                  </span>
                  <span className={checks.upper ? "text-emerald-600 font-semibold" : "text-slate-400"}>
                    {checks.upper ? "✓" : "○"} 1 majuscule
                  </span>
                  <span className={checks.number ? "text-emerald-600 font-semibold" : "text-slate-400"}>
                    {checks.number ? "✓" : "○"} 1 chiffre
                  </span>
                  <span className={checks.special ? "text-emerald-600 font-semibold" : "text-slate-400"}>
                    {checks.special ? "✓" : "○"} 1 symbole
                  </span>
                </div>
              </div>
            )}

            {/* Mandatory GDPR / Parental consent checkbox */}
            <label className="flex items-start gap-2.5 cursor-pointer bg-slate-50 rounded-2xl p-3.5 border border-slate-100">
              <input
                type="checkbox"
                checked={gdprAccepted}
                onChange={(e) => setGdprAccepted(e.target.checked)}
                className="mt-0.5 w-4 h-4 accent-indigo-600 shrink-0"
              />
              <span className="text-xs text-slate-600 leading-relaxed">
                J&apos;accepte les{" "}
                <Link href="/terms" target="_blank" className="text-indigo-600 font-semibold hover:underline">
                  CGU
                </Link>{" "}
                et la{" "}
                <Link href="/privacy" target="_blank" className="text-indigo-600 font-semibold hover:underline">
                  politique RGPD
                </Link>
                {role === "student"
                  ? " (avec autorisation parentale si j'ai moins de 15 ans)."
                  : role === "parent"
                  ? " et je donne mon consentement parental pour le suivi pédagogique de mon enfant."
                  : "."}
              </span>
            </label>

            <button
              type="submit"
              disabled={submitting}
              className="w-full text-center bg-indigo-600 text-white font-bold py-3.5 rounded-xl hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200 disabled:opacity-60"
            >
              {submitting ? "Création du compte…" : ctaLabel}
            </button>
          </form>

          <div className="relative my-5">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-slate-100" />
            </div>
            <div className="relative flex justify-center">
              <span className="bg-white px-4 text-xs text-slate-400">ou</span>
            </div>
          </div>

          <button
            type="button"
            onClick={async () => {
              const res = await loginWithGoogle(role);
              if (!res.ok && res.error) setError(res.error);
            }}
            className="w-full flex items-center justify-center gap-3 border border-slate-200 rounded-xl py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
          >
            <svg viewBox="0 0 24 24" className="w-5 h-5">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" />
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
            </svg>
            S&apos;inscrire avec Google
          </button>

          <p className="text-center text-sm text-slate-500 mt-5">
            Déjà un compte ?{" "}
            <Link href="/auth/login" className="text-indigo-600 font-semibold hover:underline">
              Se connecter
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
