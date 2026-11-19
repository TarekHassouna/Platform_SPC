import { OrgStoreProvider } from "@/lib/org-store";

export default function OrgLayout({ children }: { children: React.ReactNode }) {
  return <OrgStoreProvider>{children}</OrgStoreProvider>;
}
