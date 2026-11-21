"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function OrgTeachersRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/org/users?role=teacher");
  }, [router]);
  return null;
}
