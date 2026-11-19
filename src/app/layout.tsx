import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Suspense } from "react";
import { AppHeader, HeaderFallback } from "@/components/app-header";
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

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="fr" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col font-sans">
        <Suspense fallback={<HeaderFallback />}>
          <AppHeader />
        </Suspense>
        <main className="mx-auto w-full max-w-[1400px] flex-1 px-4 py-6">{children}</main>
      </body>
    </html>
  );
}
