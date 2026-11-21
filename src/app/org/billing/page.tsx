"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function OrgBillingRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/org/dashboard");
  }, [router]);
  return null;
}
