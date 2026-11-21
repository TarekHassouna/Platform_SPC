"use client";
import { ReactNode, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";

const ROLE_LABELS: Record<string, string> = {
  student: "Élève",
  teacher: "Enseignant / Tuteur",
  parent: "Parent",
  org_admin: "Administrateur",
};

export function AccountApprovalGate({ children }: { children: ReactNode }) {
  const { user, loading, refreshProfile, logout } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const [checking, setChecking] = useState(false);
  const [checkNote, setCheckNote] = useState<string | null>(null);

  const isPublicRoute = pathname === "/" || pathname.startsWith("/auth/");
  const isBlocked =
    !loading &&
    !isPublicRoute &&
    Boolean(user) &&
    user?.role !== "org_admin" &&
    (user?.accountStatus === "pending" || user?.accountStatus === "rejected");

  if (!isBlocked || !user) {
    return <>{children}</>;
  }

  const isRejected = user.accountStatus === "rejected";
  const roleLabel = ROLE_LABELS[user.role] || user.role;

  const handleCheck = async () => {
    setChecking(true);
    setCheckNote(null);
    const updated = await refreshProfile();
    setChecking(false);
    if (updated?.accountStatus === "approved") {
      setCheckNote("✅ Compte validé ! Ouverture de votre espace…");
    } else if (updated?.accountStatus === "rejected") {
      setCheckNote("❌ Votre compte a été refusé par l'administrateur.");
    } else {
      setCheckNote("⏳ Toujours en attente de validation par l'administrateur.");
    }
  };

  const handleLogout = async () => {
    await logout();
    router.push("/auth/login");
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-violet-50 flex items-center justify-center p-6">
      <div className="max-w-md w-full bg-white rounded-3xl border border-slate-100 shadow-xl p-8 text-center">
        <div
          className={`w-16 h-16 rounded-2xl text-3xl flex items-center justify-center mx-auto mb-5 ${
            isRejected
              ? "bg-rose-100 text-rose-700"
              : "bg-amber-100 text-amber-700"
          }`}
        >
          {isRejected ? "❌" : "⏳"}
        </div>

        <h1 className="text-2xl font-extrabold text-slate-900 mb-2">
          {isRejected
            ? "Inscription refusée"
            : "Compte en attente de validation"}
        </h1>

        <p className="text-sm text-slate-600 leading-relaxed mb-5">
          {isRejected ? (
            <>
              Bonjour <strong>{user.firstName}</strong>, votre demande de compte{" "}
              <strong>{roleLabel}</strong> n&apos;a pas été acceptée par l&apos;administrateur.
              Contactez la direction de votre établissement pour plus d&apos;informations.
            </>
          ) : (
            <>
              Bonjour <strong>{user.firstName}</strong>, votre demande d&apos;inscription (
              <strong>{roleLabel}</strong>) a bien été transmise à l&apos;administrateur.
              Votre compte sera activé dès qu&apos;il l&apos;aura accepté.
            </>
          )}
        </p>

        <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 text-left text-xs space-y-1.5 mb-5">
          <div className="flex justify-between gap-2">
            <span className="text-slate-400">Nom complet</span>
            <span className="font-bold text-slate-800">
              {user.firstName} {user.lastName}
            </span>
          </div>
          <div className="flex justify-between gap-2">
            <span className="text-slate-400">Adresse e-mail</span>
            <span className="font-semibold text-slate-700 truncate">{user.email}</span>
          </div>
          <div className="flex justify-between gap-2">
            <span className="text-slate-400">Profil demandé</span>
            <span className="font-bold text-indigo-700">{roleLabel}</span>
          </div>
          <div className="flex justify-between gap-2">
            <span className="text-slate-400">Statut</span>
            <span
              className={`font-bold px-2 py-0.5 rounded-full ${
                isRejected
                  ? "bg-rose-100 text-rose-700"
                  : "bg-amber-100 text-amber-800"
              }`}
            >
              {isRejected ? "Refusé" : "En attente admin"}
            </span>
          </div>
        </div>

        {checkNote && (
          <div className="mb-4 text-xs font-semibold text-indigo-700 bg-indigo-50 border border-indigo-200 rounded-xl px-3.5 py-2.5">
            {checkNote}
          </div>
        )}

        <div className="space-y-2.5">
          <button
            type="button"
            onClick={handleCheck}
            disabled={checking}
            className="w-full bg-indigo-600 text-white font-bold py-3 rounded-xl hover:bg-indigo-700 transition-colors text-sm disabled:opacity-60"
          >
            {checking ? "Vérification en cours…" : "🔄 Vérifier mon statut"}
          </button>
          <button
            type="button"
            onClick={handleLogout}
            className="w-full border border-slate-200 text-slate-600 font-semibold py-2.5 rounded-xl hover:bg-slate-50 transition-colors text-sm"
          >
            🚪 Se déconnecter
          </button>
        </div>
      </div>
    </div>
  );
}
