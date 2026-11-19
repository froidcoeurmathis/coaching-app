import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import { Suspense } from "react";
import { NavLinks, NavLinksView } from "@/components/nav-links";
import { CoachSetup } from "@/components/coach-setup";
import { getCurrentCoach } from "@/lib/db/coach";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: { default: "Coaching", template: "%s · Coaching" },
  description: "Programmation et suivi des séances Hyrox, course et musculation.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

async function CoachGate({ children }: { children: React.ReactNode }) {
  const coach = await getCurrentCoach();
  if (!coach) return <CoachSetup />;
  return <>{children}</>;
}

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="fr" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col font-sans">
        <header className="sticky top-0 z-20 border-b border-zinc-200 bg-white/90 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/90">
          <div className="mx-auto flex h-14 max-w-[1400px] items-center justify-between gap-4 px-4">
            <Link href="/calendar" className="text-sm font-semibold tracking-tight">
              Coaching
            </Link>
            <Suspense fallback={<NavLinksView pathname={null} />}>
              <NavLinks />
            </Suspense>
          </div>
        </header>
        <main className="mx-auto w-full max-w-[1400px] flex-1 px-4 py-6">
          <Suspense fallback={<p className="text-sm text-zinc-500">Chargement…</p>}>
            <CoachGate>{children}</CoachGate>
          </Suspense>
        </main>
      </body>
    </html>
  );
}
