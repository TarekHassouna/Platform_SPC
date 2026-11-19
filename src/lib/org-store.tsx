"use client";
import { createContext, useContext, useEffect, useState, ReactNode } from "react";

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
  seatsPurchased: number;
  billingCycle: "monthly" | "yearly";
  setBillingCycle: (cycle: "monthly" | "yearly") => void;
  teachers: OrgTeacher[];
  inviteTeacher: (name: string, email: string, levels: string[]) => void;
  seats: OrgSeat[];
  assignSeat: (studentName: string, studentEmail: string, className: string, level: "Seconde" | "Première" | "Terminale") => boolean;
  revokeSeat: (seatId: string) => void;
  purchaseSeats: (additional: number) => void;
  invoices: OrgInvoice[];
  unitPriceForSeats: (totalSeats: number) => number | null;
}

const DEFAULT_TEACHERS: OrgTeacher[] = [
  {
    id: "t1",
    name: "Sondos Elsamny",
    email: "s.elsamny@lycee-francais.edu",
    levels: ["Terminale", "Première"],
    classesCount: 3,
    studentsCount: 68,
    status: "active",
    lastActive: "Il y a 15 min",
  },
  {
    id: "t2",
    name: "Marc Lefèvre",
    email: "m.lefevre@lycee-francais.edu",
    levels: ["Seconde", "Première"],
    classesCount: 2,
    studentsCount: 44,
    status: "active",
    lastActive: "Hier",
  },
  {
    id: "t3",
    name: "Nadia Mansouri",
    email: "n.mansouri@lycee-francais.edu",
    levels: ["Terminale"],
    classesCount: 1,
    studentsCount: 22,
    status: "invited",
    lastActive: "Invitation envoyée",
  },
];

const DEFAULT_SEATS: OrgSeat[] = [
  { id: "st1", studentName: "Amira Benali", studentEmail: "amira.b@lycee.edu", className: "Terminale Spé 1", level: "Terminale", assignedAt: "02 sept. 2026", active: true },
  { id: "st2", studentName: "Karim Saidi", studentEmail: "karim.s@lycee.edu", className: "Terminale Spé 1", level: "Terminale", assignedAt: "02 sept. 2026", active: true },
  { id: "st3", studentName: "Lina Mansour", studentEmail: "lina.m@lycee.edu", className: "Terminale Spé 1", level: "Terminale", assignedAt: "03 sept. 2026", active: true },
  { id: "st4", studentName: "Omar Diallo", studentEmail: "omar.d@lycee.edu", className: "Première Spé B", level: "Première", assignedAt: "04 sept. 2026", active: true },
  { id: "st5", studentName: "Chloé Laurent", studentEmail: "chloe.l@lycee.edu", className: "Première Spé B", level: "Première", assignedAt: "04 sept. 2026", active: true },
  { id: "st6", studentName: "Yassine Amrani", studentEmail: "yassine.a@lycee.edu", className: "Seconde 3", level: "Seconde", assignedAt: "05 sept. 2026", active: true },
];

const DEFAULT_INVOICES: OrgInvoice[] = [
  { id: "ORG-2026-09", date: "01 sept. 2026", description: "Licence Établissement — 60 sièges (Annuel)", seats: 60, amount: "300,00 €", status: "Payée" },
  { id: "ORG-2026-10", date: "15 oct. 2026", description: "Extension — +20 sièges élèves", seats: 20, amount: "100,00 €", status: "Payée" },
];

export function getUnitPriceForSeats(totalSeats: number): number | null {
  if (totalSeats >= 300) return null; // Quote
  if (totalSeats >= 150) return 4;
  if (totalSeats >= 60) return 5;
  if (totalSeats >= 30) return 6;
  return 7;
}

const STORAGE_KEY = "spc_org_store_v1";
const OrgStoreContext = createContext<OrgStoreContextType | null>(null);

export function OrgStoreProvider({ children }: { children: ReactNode }) {
  const [orgName] = useState("Lycée Français International");
  const [seatsPurchased, setSeatsPurchased] = useState(80);
  const [billingCycle, setBillingCycle] = useState<"monthly" | "yearly">("yearly");
  const [teachers, setTeachers] = useState<OrgTeacher[]>(DEFAULT_TEACHERS);
  const [seats, setSeats] = useState<OrgSeat[]>(DEFAULT_SEATS);
  const [invoices, setInvoices] = useState<OrgInvoice[]>(DEFAULT_INVOICES);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed.seatsPurchased) setSeatsPurchased(parsed.seatsPurchased);
        if (parsed.billingCycle) setBillingCycle(parsed.billingCycle);
        if (parsed.teachers?.length) setTeachers(parsed.teachers);
        if (parsed.seats?.length) setSeats(parsed.seats);
        if (parsed.invoices?.length) setInvoices(parsed.invoices);
      }
    } catch {
      // ignore
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ seatsPurchased, billingCycle, teachers, seats, invoices })
      );
    } catch {
      // ignore
    }
  }, [seatsPurchased, billingCycle, teachers, seats, invoices, hydrated]);

  const inviteTeacher = (name: string, email: string, levels: string[]) => {
    const t: OrgTeacher = {
      id: `t-${Date.now()}`,
      name: name.trim(),
      email: email.trim(),
      levels: levels.length ? levels : ["Terminale"],
      classesCount: 0,
      studentsCount: 0,
      status: "invited",
      lastActive: "Invitation envoyée à l'instant",
    };
    setTeachers((prev) => [t, ...prev]);
  };

  const assignSeat = (
    studentName: string,
    studentEmail: string,
    className: string,
    level: "Seconde" | "Première" | "Terminale"
  ) => {
    if (seats.length >= seatsPurchased) return false;
    const next: OrgSeat = {
      id: `st-${Date.now()}`,
      studentName: studentName.trim(),
      studentEmail: studentEmail.trim() || `${studentName.toLowerCase().replace(/\s+/g, ".")}@lycee.edu`,
      className: className.trim() || `${level} A`,
      level,
      assignedAt: "Aujourd'hui",
      active: true,
    };
    setSeats((prev) => [next, ...prev]);
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
        id: `ORG-2026-${Math.floor(10 + Math.random() * 89)}`,
        date: "Aujourd'hui",
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
