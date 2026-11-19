import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { buttonClass, cn } from "@/components/ui";
import { requireCoach } from "@/lib/auth/session";
import { listAthletes } from "@/lib/db/athletes";
import { formatDay } from "@/lib/format";

export const metadata: Metadata = { title: "Coachés" };

async function AthleteList({ searchParams }: { searchParams: PageProps<"/athletes">["searchParams"] }) {
  const { archived } = await searchParams;
  const showArchived = archived === "1";
  const coach = await requireCoach();
  const athletes = await listAthletes(coach.id, { archived: showArchived });

  return (
    <>
      <div className="mb-4 flex gap-1 text-sm">
        <Link
          href="/athletes"
          className={cn("rounded-md px-2.5 py-1", !showArchived ? "bg-zinc-200 dark:bg-zinc-800" : "text-zinc-500")}
        >
          Actifs
        </Link>
        <Link
          href="/athletes?archived=1"
          className={cn("rounded-md px-2.5 py-1", showArchived ? "bg-zinc-200 dark:bg-zinc-800" : "text-zinc-500")}
        >
          Archivés
        </Link>
      </div>

      {athletes.length === 0 ? (
        <div className="rounded-lg border border-dashed border-zinc-300 p-10 text-center text-sm text-zinc-500 dark:border-zinc-700">
          {showArchived ? "Aucun coaché archivé." : "Aucun coaché pour l'instant. Ajoutez votre premier coaché."}
        </div>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {athletes.map((a) => (
            <li key={a.id}>
              <Link
                href={`/athletes/${a.id}`}
                className="block h-full rounded-lg border border-zinc-200 bg-white p-4 transition-colors hover:border-zinc-400 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-zinc-600"
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="font-medium">
                    {a.first_name} {a.last_name}
                  </p>
                  {a.target_date && (
                    <span className="shrink-0 rounded bg-zinc-100 px-1.5 py-0.5 text-xs text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
                      {formatDay(a.target_date, "d MMM yyyy")}
                    </span>
                  )}
                </div>
                <p className="mt-1 line-clamp-2 text-sm text-zinc-600 dark:text-zinc-400">
                  {a.goal || <span className="italic">Pas d&apos;objectif renseigné</span>}
                </p>
                <p className="mt-3 text-xs text-zinc-500">
                  {a.next_session
                    ? `Prochaine séance : ${formatDay(a.next_session.scheduled_on, "EEEE d MMM")} — ${a.next_session.title}`
                    : "Aucune séance prévue"}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

export default function AthletesPage(props: PageProps<"/athletes">) {
  return (
    <div>
      <div className="mb-4 flex items-center justify-between gap-4">
        <h1 className="text-xl font-semibold">Coachés</h1>
        <Link href="/athletes/new" className={buttonClass("primary", "sm")}>
          + Ajouter un coaché
        </Link>
      </div>
      <Suspense fallback={<p className="text-sm text-zinc-500">Chargement…</p>}>
        <AthleteList searchParams={props.searchParams} />
      </Suspense>
    </div>
  );
}
