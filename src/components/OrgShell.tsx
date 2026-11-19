"use client";
import { ReactNode, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { useOrgStore } from "@/lib/org-store";

export function OrgShell({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth();
  const { orgName, seatsPurchased, seats, teachers } = useOrgStore();
  const pathname = usePathname();
  const router = useRouter();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    if (user && user.role !== "org_admin") {
      if (user.role === "teacher") router.replace("/teacher/dashboard");
      else if (user.role === "parent") router.replace("/parent/dashboard");
      else router.replace("/dashboard");
    }
  }, [user, router]);

  const handleLogout = async () => {
    await logout();
    router.push("/auth/login");
  };

  const displayName = user ? `${user.firstName} ${user.lastName}`.trim() : "Admin Établissement";
  const initials = user ? (user.firstName?.[0] ?? "A") + (user.lastName?.[0] ?? "") : "AD";
  const schoolTitle = user?.school || orgName;

  const navItems = [
    { icon: "🏛️", label: "Vue établissement", href: "/org/dashboard" },
    { icon: "👨‍🏫", label: "Enseignants & classes", href: "/org/teachers", badge: String(teachers.length) },
    { icon: "🎟️", label: "Sièges élèves", href: "/org/seats", badge: `${seats.length}/${seatsPurchased}` },
    { icon: "💳", label: "Facturation & RGPD", href: "/org/billing" },
  ];

  const SidebarContent = (
    <>
      <div className="p-5 border-b border-slate-100">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-slate-800 to-indigo-700 flex items-center justify-center text-white font-extrabold text-sm shadow-sm">
            S
          </div>
          <div className="min-w-0">
            <span className="font-bold text-slate-900 block leading-tight truncate">{schoolTitle}</span>
            <span className="text-[11px] font-semibold text-violet-700 bg-violet-50 px-2 py-0.5 rounded-full">
              Admin Établissement
            </span>
          </div>
        </div>
      </div>

      <nav className="flex-1 p-3 space-y-1">
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
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                  {item.badge}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      <div className="p-4 border-t border-slate-100 space-y-1">
        <div className="flex items-center gap-3 px-3 py-2">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-slate-700 to-indigo-600 flex items-center justify-center text-white text-xs font-bold uppercase shrink-0">
            {initials}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-slate-900 truncate">{displayName}</p>
            <p className="text-xs text-slate-400">Licence Établissement</p>
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
      <aside className="hidden lg:flex flex-col w-68 bg-white border-r border-slate-100 fixed inset-y-0 z-30">
        {SidebarContent}
      </aside>

      <div className="lg:hidden fixed top-0 inset-x-0 h-14 bg-white border-b border-slate-100 z-30 px-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-2 rounded-lg text-slate-600 hover:bg-slate-100"
          >
            ☰
          </button>
          <span className="font-bold text-slate-900 text-sm">SPC Admin</span>
        </div>
        <button onClick={handleLogout} className="text-xs font-semibold text-rose-500">
          🚪 Déconnexion
        </button>
      </div>

      {mobileMenuOpen && (
        <div className="lg:hidden fixed inset-0 z-40 flex">
          <div className="w-68 bg-white h-full flex flex-col shadow-2xl">{SidebarContent}</div>
          <div className="flex-1 bg-black/30" onClick={() => setMobileMenuOpen(false)} />
        </div>
      )}

      <main className="flex-1 lg:ml-68 pt-16 lg:pt-0 p-6 lg:p-10 min-w-0">{children}</main>
    </div>
  );
}
