"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function OrgSeatsRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/org/users?role=student");
  }, [router]);
  return null;
}
