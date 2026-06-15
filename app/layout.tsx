import type { Metadata } from "next";
import { Geist_Mono } from "next/font/google";
import "./globals.css";

const mono = Geist_Mono({ variable: "--font-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Gerador de Container",
  description: "Numeração ISO 6346 com histórico persistente",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={mono.variable}>
      <body className="min-h-screen bg-slate-950 text-slate-200 antialiased">
        {children}
      </body>
    </html>
  );
}
