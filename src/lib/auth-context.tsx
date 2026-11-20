"use client";
import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { getSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabase/client";
import {
  fetchRelationalProfile,
  completeRelationalOnboarding,
  type MembershipRecord,
} from "@/lib/db";

export type UserRole = "student" | "teacher" | "parent" | "org_admin";

export interface UserProfile {
  id?: string;
  firstName: string;
  lastName: string;
  email: string;
  role: UserRole;
  level?: string;         // student
  classCode?: string;     // student
  school?: string;        // teacher / org_admin
  levels?: string[];      // teacher
  schoolCode?: string;    // teacher
  childName?: string;     // parent
  childEmail?: string;    // parent (for relational auto-linking)
  childLevel?: string;    // parent
  orgSeats?: number;      // org_admin
}

export interface AuthActionResult {
  ok: boolean;
  error?: string;
  needsEmailVerification?: boolean;
  warnings?: string[];
  profile?: UserProfile;
  mode: "supabase" | "local";
}

interface LocalAccountRecord {
  email: string;
  password: string;
  profile: UserProfile;
}

interface AuthContextType {
  user: UserProfile | null;
  memberships: MembershipRecord[];
  loading: boolean;
  authMode: "supabase" | "local";
  loginWithPassword: (email: string, password: string) => Promise<AuthActionResult>;
  signupWithEmail: (profile: UserProfile, password: string) => Promise<AuthActionResult>;
  loginWithGoogle: () => Promise<AuthActionResult>;
  sendPasswordReset: (email: string) => Promise<AuthActionResult>;
  updatePassword: (newPassword: string) => Promise<AuthActionResult>;
  updateProfile: (updates: Partial<UserProfile>) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  memberships: [],
  loading: true,
  authMode: "local",
  loginWithPassword: async () => ({ ok: false, mode: "local" }),
  signupWithEmail: async () => ({ ok: false, mode: "local" }),
  loginWithGoogle: async () => ({ ok: false, mode: "local" }),
  sendPasswordReset: async () => ({ ok: false, mode: "local" }),
  updatePassword: async () => ({ ok: false, mode: "local" }),
  updateProfile: async () => {},
  logout: async () => {},
});

const SESSION_KEY = "spc_user";
const ACCOUNTS_KEY = "spc_local_accounts_v1";

const SEED_LOCAL_ACCOUNTS: LocalAccountRecord[] = [];

function readLocalAccounts(): LocalAccountRecord[] {
  try {
    const raw = localStorage.getItem(ACCOUNTS_KEY);
    if (!raw) {
      localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(SEED_LOCAL_ACCOUNTS));
      return SEED_LOCAL_ACCOUNTS;
    }
    return JSON.parse(raw);
  } catch {
    return SEED_LOCAL_ACCOUNTS;
  }
}

function writeLocalAccounts(accounts: LocalAccountRecord[]) {
  try {
    localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(accounts));
  } catch {
    // ignore
  }
}

export function getDashboardPathForRole(role: UserRole): string {
  if (role === "teacher") return "/teacher/dashboard";
  if (role === "parent") return "/parent/dashboard";
  if (role === "org_admin") return "/org/dashboard";
  return "/dashboard";
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [memberships, setMemberships] = useState<MembershipRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    const supabase = getSupabaseBrowserClient();

    async function hydrate() {
      if (isSupabaseConfigured && supabase) {
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (session?.user && mounted) {
          const { profile, memberships: mems } = await fetchRelationalProfile(session.user.id);
          const meta = session.user.user_metadata || {};
          const resolved: UserProfile = profile || {
            id: session.user.id,
            email: session.user.email || "",
            firstName: meta.firstName || "Utilisateur",
            lastName: meta.lastName || "",
            role: (meta.role as UserRole) || "student",
            level: meta.level,
            school: meta.school,
            childName: meta.childName,
            childLevel: meta.childLevel,
          };
          setUser(resolved);
          setMemberships(mems);
          setLoading(false);
          return;
        }
      } else {
        // Local mode session restore
        try {
          readLocalAccounts(); // ensure demo accounts exist
          const stored = localStorage.getItem(SESSION_KEY);
          if (stored && mounted) setUser(JSON.parse(stored));
        } catch {
          // ignore
        }
      }
      if (mounted) setLoading(false);
    }

    hydrate();

    if (isSupabaseConfigured && supabase) {
      const { data: sub } = supabase.auth.onAuthStateChange(async (_event, session) => {
        if (!session?.user) {
          setUser(null);
          setMemberships([]);
          return;
        }
        const { profile, memberships: mems } = await fetchRelationalProfile(session.user.id);
        const meta = session.user.user_metadata || {};
        setUser(
          profile || {
            id: session.user.id,
            email: session.user.email || "",
            firstName: meta.firstName || "Utilisateur",
            lastName: meta.lastName || "",
            role: (meta.role as UserRole) || "student",
            level: meta.level,
            school: meta.school,
          }
        );
        setMemberships(mems);
      });
      return () => {
        mounted = false;
        sub.subscription.unsubscribe();
      };
    }

    return () => {
      mounted = false;
    };
  }, []);

  const signupWithEmail = async (
    profile: UserProfile,
    password: string
  ): Promise<AuthActionResult> => {
    const supabase = getSupabaseBrowserClient();

    if (isSupabaseConfigured && supabase) {
      const origin = typeof window !== "undefined" ? window.location.origin : "";
      const { data, error } = await supabase.auth.signUp({
        email: profile.email.trim().toLowerCase(),
        password,
        options: {
          emailRedirectTo: `${origin}/auth/callback`,
          data: {
            firstName: profile.firstName.trim(),
            lastName: profile.lastName.trim(),
            role: profile.role,
            level: profile.level || null,
            classCode: profile.classCode || null,
            school: profile.school || null,
            levels: profile.levels || [],
            schoolCode: profile.schoolCode || null,
            childName: profile.childName || null,
            childEmail: profile.childEmail || null,
            childLevel: profile.childLevel || null,
          },
        },
      });

      if (error) {
        return { ok: false, error: error.message, mode: "supabase" };
      }

      // If email confirmation is enabled in Supabase, session will be null until confirmed
      if (!data.session) {
        return {
          ok: true,
          needsEmailVerification: true,
          profile: { ...profile, id: data.user?.id },
          mode: "supabase",
        };
      }

      const savedProfile: UserProfile = { ...profile, id: data.user!.id };
      const { warnings } = await completeRelationalOnboarding(data.user!.id, savedProfile);
      const { memberships: mems } = await fetchRelationalProfile(data.user!.id);
      setUser(savedProfile);
      setMemberships(mems);
      return { ok: true, profile: savedProfile, warnings, mode: "supabase" };
    }

    // Local registry mode (real validation + relational profile storage)
    const normalizedEmail = profile.email.trim().toLowerCase();
    const accounts = readLocalAccounts();
    if (accounts.some((a) => a.email.toLowerCase() === normalizedEmail)) {
      return {
        ok: false,
        error: "Un compte existe déjà avec cette adresse e-mail. Connectez-vous ou utilisez un autre e-mail.",
        mode: "local",
      };
    }

    const createdProfile: UserProfile = {
      ...profile,
      id: `local-${Date.now()}`,
      email: normalizedEmail,
    };
    writeLocalAccounts([...accounts, { email: normalizedEmail, password, profile: createdProfile }]);
    localStorage.setItem(SESSION_KEY, JSON.stringify(createdProfile));
    setUser(createdProfile);
    return { ok: true, profile: createdProfile, mode: "local" };
  };

  const loginWithPassword = async (
    email: string,
    password: string
  ): Promise<AuthActionResult> => {
    const supabase = getSupabaseBrowserClient();
    const normalizedEmail = email.trim().toLowerCase();

    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: normalizedEmail,
        password,
      });

      if (error) {
        const msg = error.message.toLowerCase().includes("invalid login")
          ? "Adresse e-mail ou mot de passe incorrect."
          : error.message.toLowerCase().includes("email not confirmed")
          ? "Veuillez confirmer votre adresse e-mail avant de vous connecter."
          : error.message;
        return { ok: false, error: msg, mode: "supabase" };
      }

      const { profile, memberships: mems } = await fetchRelationalProfile(data.user.id);
      const meta = data.user.user_metadata || {};
      const resolved: UserProfile = profile || {
        id: data.user.id,
        email: data.user.email || normalizedEmail,
        firstName: meta.firstName || "Utilisateur",
        lastName: meta.lastName || "",
        role: (meta.role as UserRole) || "student",
        level: meta.level,
        school: meta.school,
        childName: meta.childName,
        childLevel: meta.childLevel,
      };
      setUser(resolved);
      setMemberships(mems);
      return { ok: true, profile: resolved, mode: "supabase" };
    }

    // Local account verification (validates real email + password + loads stored role)
    const accounts = readLocalAccounts();
    const match = accounts.find((a) => a.email.toLowerCase() === normalizedEmail);
    if (!match || match.password !== password) {
      return {
        ok: false,
        error: "Adresse e-mail ou mot de passe incorrect. (Astuce : créez un compte ou utilisez un compte démo ci-dessous.)",
        mode: "local",
      };
    }

    localStorage.setItem(SESSION_KEY, JSON.stringify(match.profile));
    setUser(match.profile);
    return { ok: true, profile: match.profile, mode: "local" };
  };

  const loginWithGoogle = async (): Promise<AuthActionResult> => {
    const supabase = getSupabaseBrowserClient();
    if (!isSupabaseConfigured || !supabase) {
      return {
        ok: false,
        error:
          "Google OAuth nécessite la connexion à votre projet Supabase (.env.local + provider Google activé dans Supabase Auth).",
        mode: "local",
      };
    }
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${origin}/auth/callback` },
    });
    if (error) return { ok: false, error: error.message, mode: "supabase" };
    return { ok: true, mode: "supabase" };
  };

  const sendPasswordReset = async (email: string): Promise<AuthActionResult> => {
    const supabase = getSupabaseBrowserClient();
    if (isSupabaseConfigured && supabase) {
      const origin = typeof window !== "undefined" ? window.location.origin : "";
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
        redirectTo: `${origin}/auth/callback?next=/auth/reset-password`,
      });
      if (error) return { ok: false, error: error.message, mode: "supabase" };
      return { ok: true, mode: "supabase" };
    }
    return { ok: true, mode: "local" };
  };

  const updatePassword = async (newPassword: string): Promise<AuthActionResult> => {
    const supabase = getSupabaseBrowserClient();
    if (isSupabaseConfigured && supabase) {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) return { ok: false, error: error.message, mode: "supabase" };
      return { ok: true, mode: "supabase" };
    }
    return { ok: true, mode: "local" };
  };

  const updateProfile = async (updates: Partial<UserProfile>) => {
    setUser((prev) => {
      if (!prev) return prev;
      const next = { ...prev, ...updates };
      try {
        localStorage.setItem(SESSION_KEY, JSON.stringify(next));
        const accounts = readLocalAccounts();
        writeLocalAccounts(
          accounts.map((a) =>
            a.email.toLowerCase() === prev.email.toLowerCase() ? { ...a, profile: next } : a
          )
        );
      } catch {
        // ignore
      }
      return next;
    });

    const supabase = getSupabaseBrowserClient();
    if (isSupabaseConfigured && supabase && user?.id) {
      await supabase
        .from("profiles")
        .update({
          first_name: updates.firstName ?? user.firstName,
          last_name: updates.lastName ?? user.lastName,
          level: updates.level ?? user.level ?? null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", user.id);
    }
  };

  const logout = async () => {
    const supabase = getSupabaseBrowserClient();
    if (isSupabaseConfigured && supabase) {
      await supabase.auth.signOut();
    }
    localStorage.removeItem(SESSION_KEY);
    setUser(null);
    setMemberships([]);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        memberships,
        loading,
        authMode: isSupabaseConfigured ? "supabase" : "local",
        loginWithPassword,
        signupWithEmail,
        loginWithGoogle,
        sendPasswordReset,
        updatePassword,
        updateProfile,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
