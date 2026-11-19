import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { buttonClass, cn } from "@/components/ui";
import { requireAthlete } from "@/lib/auth/session";
import { getAthleteForProfile } from "@/lib/db/athletes";
import { listWeekSessions } from "@/lib/db/sessions";
import type { SessionWithBlocks } from "@/lib/db/types";
import {
  DISCIPLINE_LABEL,
  DISCIPLINE_STYLE,
  exerciseLabel,
  formatDay,
  formatDuration,
  formatWeekRange,
  intensitySummary,
  parseWeekParam,
  shiftWeek,
  STATUS_LABEL,
  toISODate,
  volumeSummary,
  weekDays,
  weekStartOf,
} from "@/lib/format";

export const metadata: Metadata = { title: "Mes séances" };

// Vue provisoire du coaché (lecture seule) : l'espace mobile complet arrive à l'étape 3.

async function MySessions({ searchParams }: { searchParams: PageProps<"/me">["searchParams"] }) {
  await connection();
  const profile = await requireAthlete();
  const athlete = await getAthleteForProfile(profile.id);
  if (!athlete) {
    return <p className="text-sm text-zinc-500">Votre fiche n&apos;est pas encore disponible. Contactez votre coach.</p>;
  }

  const params = await searchParams;
  const weekStart = parseWeekParam(typeof params.week === "string" ? params.week : undefined);
  const sessions = await listWeekSessions([athlete.id], weekStart);
  const today = toISODate(new Date());
  const days = weekDays(weekStart).filter((d) => sessions.some((s) => s.scheduled_on === d));

  return (
    <div className="mx-auto max-w-xl">
      <h1 className="text-xl font-semibold">Bonjour {athlete.first_name} 👋</h1>
      {athlete.goal && <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">Objectif : {athlete.goal}</p>}

      <div className="mb-4 mt-5 flex items-center justify-between gap-2">
        <Link href={`/me?week=${shiftWeek(weekStart, -1)}`} className={buttonClass("secondary", "sm")} aria-label="Semaine précédente">
          ←
        </Link>
        <div className="text-center">
          <p className="text-sm font-medium first-letter:uppercase">{formatWeekRange(weekStart)}</p>
          {weekStart !== weekStartOf(new Date()) && (
            <Link href="/me" className="text-xs text-zinc-500 underline">
              Revenir à cette semaine
            </Link>
          )}
        </div>
        <Link href={`/me?week=${shiftWeek(weekStart, 1)}`} className={buttonClass("secondary", "sm")} aria-label="Semaine suivante">
          →
        </Link>
      </div>

      {days.length === 0 ? (
        <p className="rounded-lg border border-dashed border-zinc-300 p-8 text-center text-sm text-zinc-500 dark:border-zinc-700">
          Aucune séance prévue cette semaine.
        </p>
      ) : (
        <div className="space-y-6">
          {days.map((d) => (
            <section key={d}>
              <h2 className={cn("mb-2 text-sm font-semibold capitalize", d === today ? "text-zinc-900 dark:text-zinc-100" : "text-zinc-500")}>
                {formatDay(d, "EEEE d MMMM")}
                {d === today && " · aujourd'hui"}
              </h2>
              <div className="space-y-3">
                {sessions
                  .filter((s) => s.scheduled_on === d)
                  .map((s) => (
                    <SessionDetail key={s.id} session={s} />
                  ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

function SessionDetail({ session: s }: { session: SessionWithBlocks }) {
  return (
    <article className={cn("rounded-lg border-l-4 p-4", DISCIPLINE_STYLE[s.discipline])}>
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="font-semibold">{s.title}</h3>
          <p className="text-xs text-zinc-500">
            {DISCIPLINE_LABEL[s.discipline]}
            {s.duration_min && ` · ${s.duration_min} min`}
          </p>
        </div>
        {s.status !== "planned" && (
          <span className="rounded bg-white/70 px-1.5 py-0.5 text-xs dark:bg-black/30">{STATUS_LABEL[s.status]}</span>
        )}
      </div>
      {s.description && <p className="mt-2 whitespace-pre-line text-sm">{s.description}</p>}
      <ol className="mt-3 space-y-3">
        {s.blocks.map((b, bi) => (
          <li key={b.id} className="rounded-md bg-white/70 p-3 dark:bg-black/20">
            {(b.title || b.rounds) && (
              <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-zinc-500">
                {[b.title, b.rounds && `${b.rounds} tours`, b.rest_s && `repos ${formatDuration(b.rest_s)} entre les tours`]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
            )}
            <ul className="space-y-1.5">
              {b.exercises.map((e, ei) => (
                <li key={e.id} className="text-sm">
                  <span className="mr-1.5 font-bold">{exerciseLabel(bi, ei, b.exercises.length)}</span>
                  <span className="font-medium">{e.exercise.name}</span>
                  <span className="block pl-6 text-zinc-600 dark:text-zinc-400">
                    {[volumeSummary(e), intensitySummary(e), e.rest_s != null && `repos ${formatDuration(e.rest_s)}`]
                      .filter(Boolean)
                      .join(" · ")}
                  </span>
                  {e.notes && <span className="block pl-6 text-xs italic text-zinc-500">{e.notes}</span>}
                </li>
              ))}
            </ul>
            {b.notes && <p className="mt-1.5 text-xs italic text-zinc-500">{b.notes}</p>}
          </li>
        ))}
      </ol>
    </article>
  );
}

export default function MePage(props: PageProps<"/me">) {
  return (
    <Suspense fallback={<p className="text-sm text-zinc-500">Chargement…</p>}>
      <MySessions searchParams={props.searchParams} />
    </Suspense>
  );
}
