"use client";
import { useState, useEffect, ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { useTeacherStore, Level } from "@/lib/teacher-store";

interface TeacherShellProps {
  children: ReactNode;
}

export function TeacherShell({ children }: TeacherShellProps) {
  const { user, logout } = useAuth();
  const { classes, selectedClassId, setSelectedClassId, createClass, copies } = useTeacherStore();
  const pathname = usePathname();
  const router = useRouter();

  const [showNewClassModal, setShowNewClassModal] = useState(false);
  const [newClassName, setNewClassName] = useState("");
  const [newClassLevel, setNewClassLevel] = useState<Level>("Terminale");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    if (user && user.role !== "teacher") {
      if (user.role === "org_admin") router.replace("/org/dashboard");
      else if (user.role === "parent") router.replace("/parent/dashboard");
      else router.replace("/dashboard");
    }
  }, [user, router]);

  const handleLogout = () => {
    logout();
    router.push("/auth/login");
  };

  const handleCreateClass = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newClassName.trim()) return;
    await createClass(newClassName, newClassLevel);
    setNewClassName("");
    setShowNewClassModal(false);
  };

  const displayName = user ? `${user.firstName} ${user.lastName}`.trim() : "Enseignant";
  const initials = user ? (user.firstName?.[0] ?? "E") + (user.lastName?.[0] ?? "") : "EN";
  const school = user?.school || "Établissement";
  const pendingCopiesCount = copies.filter(
    (c) => c.status === "to_review" && (selectedClassId === "all" || c.classId === selectedClassId)
  ).length;

  const navItems = [
    { icon: "🏠", label: "Tableau de bord", href: "/teacher/dashboard" },
    { icon: "🏫", label: "Mes classes", href: "/teacher/classes", badge: String(classes.length) },
    { icon: "📚", label: "Exercices & devoirs", href: "/teacher/exercises" },
    { icon: "✨", label: "Créer avec l'IA", href: "/teacher/create" },
    { icon: "📊", label: "Résultats & Heatmap", href: "/teacher/results" },
    {
      icon: "🖼️",
      label: "Correction de copies",
      href: "/teacher/grading",
      badge: pendingCopiesCount > 0 ? String(pendingCopiesCount) : undefined,
      badgeAlert: pendingCopiesCount > 0,
    },
  ];

  const SidebarContent = (
    <>
      <div className="p-5 border-b border-slate-100">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center text-white font-extrabold text-sm shadow-sm">
            S
          </div>
          <div>
            <span className="font-bold text-slate-900 block leading-tight">SPC Platform</span>
            <span className="text-[11px] font-semibold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full">
              Espace Enseignant / Tuteur
            </span>
          </div>
        </div>

        {/* Multi-class switcher */}
        <div className="mt-4">
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              Classe active
            </label>
            <button
              type="button"
              onClick={() => setShowNewClassModal(true)}
              className="text-[11px] font-bold text-indigo-600 hover:text-indigo-800"
            >
              + Nouvelle
            </button>
          </div>
          <select
            value={selectedClassId}
            onChange={(e) => setSelectedClassId(e.target.value)}
            className="w-full text-sm font-semibold text-slate-800 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 cursor-pointer"
          >
            <option value="all">🌐 Toutes mes classes ({classes.length})</option>
            {classes.map((cls) => (
              <option key={cls.id} value={cls.id}>
                {cls.name} ({cls.students.length} él.)
              </option>
            ))}
          </select>
        </div>
      </div>

      <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
        {navItems.map((item) => {
          const active = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setMobileMenuOpen(false)}
              className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all ${
                active
                  ? "bg-indigo-50 text-indigo-700 font-semibold"
                  : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
              }`}
            >
              <span className="text-base">{item.icon}</span>
              <span className="flex-1 truncate">{item.label}</span>
              {item.badge && (
                <span
                  className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                    item.badgeAlert
                      ? "bg-rose-100 text-rose-600"
                      : "bg-slate-100 text-slate-600"
                  }`}
                >
                  {item.badge}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      <div className="p-4 border-t border-slate-100 space-y-1">
        <div className="flex items-center gap-3 px-3 py-2">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center text-white text-xs font-bold uppercase shrink-0">
            {initials}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-slate-900 truncate">{displayName}</p>
            <p className="text-xs text-slate-400 truncate">{school}</p>
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium text-rose-500 hover:bg-rose-50 transition-all w-full"
        >
          <span>🚪</span> Se déconnecter
        </button>
      </div>
    </>
  );

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex flex-col w-68 bg-white border-r border-slate-100 fixed inset-y-0 z-30">
        {SidebarContent}
      </aside>

      {/* Mobile Top Bar */}
      <div className="lg:hidden fixed top-0 inset-x-0 h-14 bg-white border-b border-slate-100 z-30 px-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-2 rounded-lg text-slate-600 hover:bg-slate-100"
            aria-label="Menu"
          >
            ☰
          </button>
          <span className="font-bold text-slate-900 text-sm">SPC Enseignant</span>
        </div>
        <select
          value={selectedClassId}
          onChange={(e) => setSelectedClassId(e.target.value)}
          className="text-xs font-semibold text-slate-800 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5"
        >
          <option value="all">Toutes ({classes.length})</option>
          {classes.map((cls) => (
            <option key={cls.id} value={cls.id}>
              {cls.name}
            </option>
          ))}
        </select>
      </div>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="lg:hidden fixed inset-0 z-40 flex">
          <div className="w-72 bg-white h-full flex flex-col shadow-2xl">{SidebarContent}</div>
          <div className="flex-1 bg-black/30" onClick={() => setMobileMenuOpen(false)} />
        </div>
      )}

      {/* Main Content */}
      <main className="flex-1 lg:ml-68 pt-16 lg:pt-0 p-6 lg:p-10 min-w-0">
        {children}
      </main>

      {/* Create Class Modal */}
      {showNewClassModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-7 shadow-2xl border border-slate-100">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-lg font-extrabold text-slate-900">🏫 Créer une nouvelle classe</h3>
              <button
                onClick={() => setShowNewClassModal(false)}
                className="text-slate-400 hover:text-slate-600 text-xl"
              >
                ×
              </button>
            </div>
            <form onSubmit={handleCreateClass} className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                  Nom de la classe / groupe
                </label>
                <input
                  type="text"
                  required
                  value={newClassName}
                  onChange={(e) => setNewClassName(e.target.value)}
                  placeholder="ex : Terminale Spé 2, Groupe Soutien Bac…"
                  className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-900 bg-white placeholder:text-slate-400 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                  Niveau scolaire
                </label>
                <select
                  value={newClassLevel}
                  onChange={(e) => setNewClassLevel(e.target.value as Level)}
                  className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-900 bg-white outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                >
                  <option value="Seconde">Seconde</option>
                  <option value="Première">Première</option>
                  <option value="Terminale">Terminale</option>
                </select>
              </div>
              <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-3 text-xs text-indigo-700">
                💡 Un code d&apos;invitation unique sera généré automatiquement pour que vos élèves rejoignent cette classe.
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowNewClassModal(false)}
                  className="flex-1 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-50"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-bold hover:bg-indigo-700 shadow-md shadow-indigo-100"
                >
                  Créer la classe
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
