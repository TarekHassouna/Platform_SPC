import type { Metadata } from "next";
import "katex/dist/katex.min.css";
import "./globals.css";
import { AuthProvider } from "@/lib/auth-context";

export const metadata: Metadata = {
  title: "Platform SPC — Physique-Chimie AI Tutor",
  description: "Learn physique-chimie with an AI tutor that explains your mistakes and adapts to you.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body className="antialiased">
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
