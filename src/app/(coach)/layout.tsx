import { Suspense } from "react";
import { requireCoach } from "@/lib/auth/session";

async function CoachOnly({ children }: { children: React.ReactNode }) {
  await requireCoach(); // redirige un coaché vers /me et un visiteur vers /login
  return <>{children}</>;
}

export default function CoachLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<p className="text-sm text-zinc-500">Chargement…</p>}>
      <CoachOnly>{children}</CoachOnly>
    </Suspense>
  );
}
