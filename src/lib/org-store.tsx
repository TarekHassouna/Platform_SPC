"use client";
import { createContext, useCallback, useContext, useEffect, useState, ReactNode } from "react";
import { useAuth } from "@/lib/auth-context";
import {
  fetchAdminUsers,
  adminCreateUser,
  adminUpdateUser,
  adminDeleteUser,
  fetchAdminParentLinks,
  adminReviewParentLink,
  adminCreateParentLink,
  fetchAdminClasses,
  adminCreateClass,
  adminDeleteClass,
  adminAddStudentToClass,
  adminRemoveStudentFromClass,
  type AdminUserRecord,
  type AdminParentLinkRecord,
  type AdminClassRecord,
} from "@/lib/db";

interface OrgStoreContextType {
  orgName: string;
  orgInviteCode: string;
  users: AdminUserRecord[];
  parentLinks: AdminParentLinkRecord[];
  classes: AdminClassRecord[];
  loading: boolean;
  error: string | null;
  pendingUsersCount: number;
  pendingLinksCount: number;
  studentsCount: number;
  teachersCount: number;
  parentsCount: number;
  reloadAll: () => Promise<void>;
  createUser: (params: {
    firstName: string;
    lastName: string;
    email: string;
    password: string;
    role: "student" | "teacher" | "parent" | "org_admin";
    level?: string;
    classId?: string;
  }) => Promise<{ ok: boolean; userId?: string; error?: string; warning?: string }>;
  updateUser: (params: {
    userId: string;
    firstName?: string;
    lastName?: string;
    role?: "student" | "teacher" | "parent" | "org_admin" | "platform_admin";
    level?: string | null;
    accountStatus?: "pending" | "approved" | "rejected";
  }) => Promise<{ ok: boolean; error?: string }>;
  approveUser: (userId: string) => Promise<{ ok: boolean; error?: string }>;
  rejectUser: (userId: string) => Promise<{ ok: boolean; error?: string }>;
  deleteUser: (userId: string) => Promise<{ ok: boolean; error?: string }>;
  reviewParentLink: (
    linkId: string,
    action: "approve" | "reject" | "delete"
  ) => Promise<{ ok: boolean; error?: string }>;
  createParentLink: (
    parentId: string,
    studentId: string
  ) => Promise<{ ok: boolean; error?: string }>;
  createClass: (params: {
    name: string;
    level: string;
    teacherId: string;
    inviteCode?: string;
  }) => Promise<{ ok: boolean; inviteCode?: string; error?: string }>;
  deleteClass: (classId: string) => Promise<{ ok: boolean; error?: string }>;
  addStudentToClass: (
    classId: string,
    studentId: string
  ) => Promise<{ ok: boolean; error?: string }>;
  removeStudentFromClass: (
    classId: string,
    studentId: string
  ) => Promise<{ ok: boolean; error?: string }>;
}

const OrgStoreContext = createContext<OrgStoreContextType | null>(null);

export function OrgStoreProvider({ children }: { children: ReactNode }) {
  const { user, memberships } = useAuth();
  const [orgName, setOrgName] = useState(user?.school || "Administration SPC");
  const [orgInviteCode, setOrgInviteCode] = useState("");
  const [users, setUsers] = useState<AdminUserRecord[]>([]);
  const [parentLinks, setParentLinks] = useState<AdminParentLinkRecord[]>([]);
  const [classes, setClasses] = useState<AdminClassRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reloadAll = useCallback(async () => {
    const primaryOrg =
      memberships.find((m) => m.role === "org_admin")?.organization ||
      memberships[0]?.organization;
    if (primaryOrg) {
      setOrgName(primaryOrg.name);
      setOrgInviteCode(primaryOrg.invite_code);
    } else if (user?.school) {
      setOrgName(user.school);
    }

    if (!user?.id || user.role !== "org_admin") {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    const [usersRes, linksRes, classesRes] = await Promise.all([
      fetchAdminUsers(),
      fetchAdminParentLinks(),
      fetchAdminClasses(),
    ]);

    if (usersRes.error) {
      setError(usersRes.error);
    } else if (linksRes.error) {
      setError(linksRes.error);
    } else if (classesRes.error) {
      setError(classesRes.error);
    }

    setUsers(usersRes.users);
    setParentLinks(linksRes.links);
    setClasses(classesRes.classes);
    setLoading(false);
  }, [user, memberships]);

  useEffect(() => {
    reloadAll();
  }, [reloadAll]);

  const createUser: OrgStoreContextType["createUser"] = async (params) => {
    const { classId, ...rest } = params;
    const res = await adminCreateUser(rest);
    if (res.ok) {
      if (classId && res.userId && params.role === "student") {
        await adminAddStudentToClass(classId, res.userId);
      }
      await reloadAll();
    }
    return res;
  };

  const updateUser: OrgStoreContextType["updateUser"] = async (params) => {
    const res = await adminUpdateUser(params);
    if (res.ok) await reloadAll();
    return res;
  };

  const approveUser = async (userId: string) => {
    const res = await adminUpdateUser({ userId, accountStatus: "approved" });
    if (res.ok) {
      setUsers((prev) =>
        prev.map((u) => (u.id === userId ? { ...u, accountStatus: "approved" } : u))
      );
    }
    return res;
  };

  const rejectUser = async (userId: string) => {
    const res = await adminUpdateUser({ userId, accountStatus: "rejected" });
    if (res.ok) {
      setUsers((prev) =>
        prev.map((u) => (u.id === userId ? { ...u, accountStatus: "rejected" } : u))
      );
    }
    return res;
  };

  const deleteUser = async (userId: string) => {
    const res = await adminDeleteUser(userId);
    if (res.ok) {
      setUsers((prev) => prev.filter((u) => u.id !== userId));
      setParentLinks((prev) =>
        prev.filter((l) => l.parentId !== userId && l.studentId !== userId)
      );
      setClasses((prev) =>
        prev.map((c) => ({
          ...c,
          students: c.students.filter((s) => s.id !== userId),
        }))
      );
    }
    return res;
  };

  const reviewParentLink: OrgStoreContextType["reviewParentLink"] = async (linkId, action) => {
    const res = await adminReviewParentLink(linkId, action);
    if (res.ok) await reloadAll();
    return res;
  };

  const createParentLink: OrgStoreContextType["createParentLink"] = async (
    parentId,
    studentId
  ) => {
    const res = await adminCreateParentLink(parentId, studentId);
    if (res.ok) await reloadAll();
    return res;
  };

  const createClass: OrgStoreContextType["createClass"] = async (params) => {
    const res = await adminCreateClass(params);
    if (res.ok) await reloadAll();
    return res;
  };

  const deleteClass: OrgStoreContextType["deleteClass"] = async (classId) => {
    const res = await adminDeleteClass(classId);
    if (res.ok) {
      setClasses((prev) => prev.filter((c) => c.id !== classId));
    }
    return res;
  };

  const addStudentToClass: OrgStoreContextType["addStudentToClass"] = async (
    classId,
    studentId
  ) => {
    const res = await adminAddStudentToClass(classId, studentId);
    if (res.ok) await reloadAll();
    return res;
  };

  const removeStudentFromClass: OrgStoreContextType["removeStudentFromClass"] = async (
    classId,
    studentId
  ) => {
    const res = await adminRemoveStudentFromClass(classId, studentId);
    if (res.ok) {
      setClasses((prev) =>
        prev.map((c) =>
          c.id === classId
            ? { ...c, students: c.students.filter((s) => s.id !== studentId) }
            : c
        )
      );
    }
    return res;
  };

  const pendingUsersCount = users.filter((u) => u.accountStatus === "pending").length;
  const pendingLinksCount = parentLinks.filter(
    (l) => l.status === "pending_admin" || l.status === "pending"
  ).length;
  const studentsCount = users.filter((u) => u.role === "student").length;
  const teachersCount = users.filter((u) => u.role === "teacher").length;
  const parentsCount = users.filter((u) => u.role === "parent").length;

  return (
    <OrgStoreContext.Provider
      value={{
        orgName,
        orgInviteCode,
        users,
        parentLinks,
        classes,
        loading,
        error,
        pendingUsersCount,
        pendingLinksCount,
        studentsCount,
        teachersCount,
        parentsCount,
        reloadAll,
        createUser,
        updateUser,
        approveUser,
        rejectUser,
        deleteUser,
        reviewParentLink,
        createParentLink,
        createClass,
        deleteClass,
        addStudentToClass,
        removeStudentFromClass,
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
