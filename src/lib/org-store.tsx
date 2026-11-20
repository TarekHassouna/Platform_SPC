"use client";
import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { getSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabase/client";
import { useAuth } from "@/lib/auth-context";

export interface OrgTeacher {
  id: string;
  name: string;
  email: string;
  levels: string[];
  classesCount: number;
  studentsCount: number;
  status: "active" | "invited";
  lastActive: string;
}

export interface OrgSeat {
  id: string;
  studentName: string;
  studentEmail: string;
  className: string;
  level: "Seconde" | "Première" | "Terminale";
  assignedAt: string;
  active: boolean;
}

export interface OrgInvoice {
  id: string;
  date: string;
  description: string;
  seats: number;
  amount: string;
  status: "Payée" | "En attente";
}

interface OrgStoreContextType {
  orgName: string;
  orgInviteCode: string;
  seatsPurchased: number;
  billingCycle: "monthly" | "yearly";
  setBillingCycle: (cycle: "monthly" | "yearly") => void;
  teachers: OrgTeacher[];
  inviteTeacher: (name: string, email: string, levels: string[]) => void;
  seats: OrgSeat[];
  assignSeat: (
    studentName: string,
    studentEmail: string,
    className: string,
    level: "Seconde" | "Première" | "Terminale"
  ) => boolean;
  revokeSeat: (seatId: string) => void;
  purchaseSeats: (additional: number) => void;
  invoices: OrgInvoice[];
  unitPriceForSeats: (totalSeats: number) => number | null;
}

export function getUnitPriceForSeats(totalSeats: number): number | null {
  if (totalSeats >= 300) return null;
  if (totalSeats >= 150) return 4;
  if (totalSeats >= 60) return 5;
  if (totalSeats >= 30) return 6;
  return 7;
}

const OrgStoreContext = createContext<OrgStoreContextType | null>(null);

export function OrgStoreProvider({ children }: { children: ReactNode }) {
  const { user, memberships } = useAuth();
  const [orgName, setOrgName] = useState(user?.school || "Mon établissement");
  const [orgInviteCode, setOrgInviteCode] = useState("");
  const [seatsPurchased, setSeatsPurchased] = useState(user?.orgSeats || 60);
  const [billingCycle, setBillingCycle] = useState<"monthly" | "yearly">("yearly");
  const [teachers, setTeachers] = useState<OrgTeacher[]>([]);
  const [seats, setSeats] = useState<OrgSeat[]>([]);
  const [invoices, setInvoices] = useState<OrgInvoice[]>([]);

  useEffect(() => {
    async function loadOrg() {
      const primaryOrg = memberships.find((m) => m.role === "org_admin")?.organization || memberships[0]?.organization;
      if (primaryOrg) {
        setOrgName(primaryOrg.name);
        setOrgInviteCode(primaryOrg.invite_code);
        setSeatsPurchased(primaryOrg.seats_purchased);
      } else if (user?.school) {
        setOrgName(user.school);
      }

      const supabase = getSupabaseBrowserClient();
      if (!isSupabaseConfigured || !supabase || !primaryOrg?.id) return;

      const { data: memRows } = await supabase
        .from("memberships")
        .select("id, role, status, created_at, profiles(first_name, last_name, email, level)")
        .eq("organization_id", primaryOrg.id);

      const dbTeachers: OrgTeacher[] = [];
      const dbSeats: OrgSeat[] = [];

      (memRows || []).forEach((m: Record<string, unknown>) => {
        const p = (Array.isArray(m.profiles) ? m.profiles[0] : m.profiles) as Record<string, string> | null;
        const fullName = p ? `${p.first_name || ""} ${p.last_name || ""}`.trim() : "Membre";
        if (m.role === "teacher") {
          dbTeachers.push({
            id: String(m.id),
            name: fullName,
            email: p?.email || "",
            levels: ["Seconde", "Première", "Terminale"],
            classesCount: 0,
            studentsCount: 0,
            status: m.status === "invited" ? "invited" : "active",
            lastActive: new Date(String(m.created_at)).toLocaleDateString("fr-FR"),
          });
        } else if (m.role === "student") {
          dbSeats.push({
            id: String(m.id),
            studentName: fullName,
            studentEmail: p?.email || "",
            className: p?.level || "Lycée",
            level: (p?.level as OrgSeat["level"]) || "Terminale",
            assignedAt: new Date(String(m.created_at)).toLocaleDateString("fr-FR"),
            active: true,
          });
        }
      });

      setTeachers(dbTeachers);
      setSeats(dbSeats);
    }
    loadOrg();
  }, [user, memberships]);

  const inviteTeacher = (name: string, email: string, levels: string[]) => {
    setTeachers((prev) => [
      {
        id: `t-${Date.now()}`,
        name: name.trim(),
        email: email.trim(),
        levels: levels.length ? levels : ["Terminale"],
        classesCount: 0,
        studentsCount: 0,
        status: "invited",
        lastActive: "Invitation envoyée",
      },
      ...prev,
    ]);
  };

  const assignSeat = (
    studentName: string,
    studentEmail: string,
    className: string,
    level: "Seconde" | "Première" | "Terminale"
  ) => {
    if (seats.length >= seatsPurchased) return false;
    setSeats((prev) => [
      {
        id: `st-${Date.now()}`,
        studentName: studentName.trim(),
        studentEmail: studentEmail.trim(),
        className: className.trim() || level,
        level,
        assignedAt: "Aujourd'hui",
        active: true,
      },
      ...prev,
    ]);
    return true;
  };

  const revokeSeat = (seatId: string) => {
    setSeats((prev) => prev.filter((s) => s.id !== seatId));
  };

  const purchaseSeats = (additional: number) => {
    if (additional <= 0) return;
    const newTotal = seatsPurchased + additional;
    const unit = getUnitPriceForSeats(newTotal) ?? 4;
    setSeatsPurchased(newTotal);
    setInvoices((prev) => [
      {
        id: `ORG-${Date.now().toString().slice(-6)}`,
        date: new Date().toLocaleDateString("fr-FR"),
        description: `Extension — +${additional} sièges élèves (${unit} €/siège)`,
        seats: additional,
        amount: `${(additional * unit).toFixed(2).replace(".", ",")} €`,
        status: "Payée",
      },
      ...prev,
    ]);
  };

  return (
    <OrgStoreContext.Provider
      value={{
        orgName,
        orgInviteCode,
        seatsPurchased,
        billingCycle,
        setBillingCycle,
        teachers,
        inviteTeacher,
        seats,
        assignSeat,
        revokeSeat,
        purchaseSeats,
        invoices,
        unitPriceForSeats: getUnitPriceForSeats,
      }}
    >
      {children}
    </OrgStoreContext.Provider>
  );
}

export function useOrgStore() {
  const ctx = useContext(OrgStoreContext);
  if (!ctx) throw new Error("useOrgStore must be used inside OrgStoreProvider");
  return ctx;
}
