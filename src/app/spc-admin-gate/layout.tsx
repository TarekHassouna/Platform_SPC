import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Accès Restreint",
  robots: {
    index: false,
    follow: false,
    nocache: true,
  },
};

export default function PrivateAdminGateLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
