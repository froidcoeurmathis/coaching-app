import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { AthleteForm } from "@/components/athlete-form";
import { ArchiveButton } from "@/components/archive-button";
import { AthleteAccess } from "@/components/athlete-access";
import { AthleteProgress } from "@/components/athlete-progress";
import { PacesEditor } from "@/components/paces-editor";
import { ReferenceLoads } from "@/components/reference-loads";
import { buttonClass, Card } from "@/components/ui";
import { requireCoach } from "@/lib/auth/session";
import { getAthlete, listExercises } from "@/lib/db/athletes";
import { formatPace, paceToSpeed } from "@/lib/format";

export const metadata: Metadata = { title: "Fiche coaché" };

async function AthleteDetail({ params }: { params: PageProps<"/athletes/[id]">["params"] }) {
  const { id } = await params;
  const coach = await requireCoach();
  const [athlete, exercises] = await Promise.all([getAthlete(coach.id, id), listExercises(coach.id)]);
  if (!athlete) notFound();

  const vmaPace = athlete.vma_kmh ? Math.round(3600 / athlete.vma_kmh) : null;

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <Link href="/athletes" className="text-sm text-zinc-500 hover:underline">
          ← Coachés
        </Link>
        <div className="mt-1 flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-xl font-semibold">
            {athlete.first_name} {athlete.last_name}
            {athlete.archived_at && (
              <span className="ml-2 rounded bg-zinc-200 px-1.5 py-0.5 align-middle text-xs font-normal dark:bg-zinc-800">
                Archivé
              </span>
            )}
          </h1>
          <div className="flex gap-2">
            <Link href={`/calendar?athlete=${athlete.id}`} className={buttonClass("secondary", "sm")}>
              Voir son calendrier
            </Link>
            <ArchiveButton athleteId={athlete.id} archived={!!athlete.archived_at} />
          </div>
        </div>
      </div>

      <Card>
        <h2 className="mb-4 font-medium">Progression</h2>
        <Suspense fallback={<p className="text-sm text-zinc-500">Chargement…</p>}>
          <AthleteProgress athleteId={athlete.id} />
        </Suspense>
      </Card>

      <Card>
        <h2 className="mb-4 font-medium">Profil</h2>
        <AthleteForm athlete={athlete} />
      </Card>

      <Card>
        <h2 className="mb-3 font-medium">Accès à l&apos;application</h2>
        <AthleteAccess
          athleteId={athlete.id}
          firstName={athlete.first_name}
          email={athlete.email}
          inviteCreatedAt={athlete.invite_created_at}
          linked={!!athlete.profile_id}
          archived={!!athlete.archived_at}
        />
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <h2 className="font-medium">Allures de référence</h2>
          <p className="mb-4 mt-0.5 text-xs text-zinc-500">
            Format 4:50 ou 4&apos;50 (min/km).
            {vmaPace && ` VMA ${String(athlete.vma_kmh).replace(".", ",")} km/h ≈ ${formatPace(vmaPace)}.`}
          </p>
          <PacesEditor
            athleteId={athlete.id}
            initial={athlete.paces.map((p) => ({
              label: p.label,
              pace: formatPace(p.pace_s_per_km).replace("/km", ""),
              speed: paceToSpeed(p.pace_s_per_km),
            }))}
          />
        </Card>

        <Card>
          <h2 className="font-medium">Charges de référence</h2>
          <p className="mb-4 mt-0.5 text-xs text-zinc-500">
            Utilisées pour calculer les charges en % dans les séances.
          </p>
          <ReferenceLoads
            athleteId={athlete.id}
            loads={athlete.reference_loads}
            exerciseNames={exercises.map((e) => e.name)}
          />
        </Card>
      </div>
    </div>
  );
}

export default function AthletePage(props: PageProps<"/athletes/[id]">) {
  return (
    <Suspense fallback={<p className="text-sm text-zinc-500">Chargement…</p>}>
      <AthleteDetail params={props.params} />
    </Suspense>
  );
}
