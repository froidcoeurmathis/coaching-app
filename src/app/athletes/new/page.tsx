import type { Metadata } from "next";
import Link from "next/link";
import { AthleteForm } from "@/components/athlete-form";
import { Card } from "@/components/ui";

export const metadata: Metadata = { title: "Nouveau coaché" };

export default function NewAthletePage() {
  return (
    <div className="mx-auto max-w-3xl">
      <Link href="/athletes" className="text-sm text-zinc-500 hover:underline">
        ← Coachés
      </Link>
      <h1 className="mb-4 mt-1 text-xl font-semibold">Nouveau coaché</h1>
      <Card>
        <AthleteForm />
      </Card>
    </div>
  );
}
