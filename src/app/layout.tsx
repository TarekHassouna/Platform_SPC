import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Platform SPC — Physique-Chimie AI Tutor",
  description: "Learn physique-chimie with an AI tutor that explains your mistakes and adapts to you.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="fr">
      <body className="antialiased">{children}</body>
    </html>
  );
}
