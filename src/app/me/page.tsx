import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { InstallHint } from "@/components/athlete/install-hint";
import { buttonClass, cn } from "@/components/ui";
import { requireAthlete } from "@/lib/auth/session";
import { getAthleteForProfile } from "@/lib/db/athletes";
import { listWeekSessions } from "@/lib/db/sessions";
import type { SessionWithBlocks } from "@/lib/db/types";
import {
  currentWeekStart,
  DISCIPLINE_LABEL,
  DISCIPLINE_STYLE,
  formatDay,
  formatDayTitle,
  formatWeekRange,
  parseWeekParam,
  shiftWeek,
  todayISO,
  weekDays,
} from "@/lib/format";

export const metadata: Metadata = { title: "Mes séances" };

async function MyWeek({ searchParams }: { searchParams: PageProps<"/me">["searchParams"] }) {
  await connection();
  const profile = await requireAthlete();
  const athlete = await getAthleteForProfile(profile.id);
  if (!athlete) {
    return <p className="text-sm text-zinc-500">Votre fiche n&apos;est pas encore disponible. Contactez votre coach.</p>;
  }

  const params = await searchParams;
  const weekStart = parseWeekParam(typeof params.week === "string" ? params.week : undefined);
  const days = weekDays(weekStart);
  const today = todayISO();
  const sessions = await listWeekSessions([athlete.id], weekStart);

  const requestedDay = typeof params.day === "string" && days.includes(params.day) ? params.day : null;
  const selected =
    requestedDay ??
    (days.includes(today) ? today : (sessions[0]?.scheduled_on ?? days[0]));
  const daySessions = sessions.filter((s) => s.scheduled_on === selected);
  const done = sessions.filter((s) => s.status === "done").length;
  const href = (week: string, day?: string) => `/me?week=${week}${day ? `&day=${day}` : ""}`;

  return (
    <div className="mx-auto max-w-xl">
      <InstallHint />
      <h1 className="text-xl font-semibold">Bonjour {athlete.first_name} 👋</h1>
      {athlete.goal && <p className="mt-0.5 text-sm text-zinc-600 dark:text-zinc-400">Objectif : {athlete.goal}</p>}

      {/* Navigation semaine */}
      <div className="mt-5 flex items-center justify-between gap-2">
        <Link href={href(shiftWeek(weekStart, -1))} className={buttonClass("ghost", "sm")} aria-label="Semaine précédente">
          ←
        </Link>
        <div className="text-center">
          <p className="text-sm font-medium first-letter:uppercase">{formatWeekRange(weekStart)}</p>
          <p className="text-xs text-zinc-500">
            {sessions.length === 0
              ? "Aucune séance"
              : `${done} séance${done > 1 ? "s" : ""} faite${done > 1 ? "s" : ""} sur ${sessions.length}`}
            {weekStart !== currentWeekStart() && (
              <>
                {" · "}
                <Link href="/me" className="underline">
                  aujourd&apos;hui
                </Link>
              </>
            )}
          </p>
        </div>
        <Link href={href(shiftWeek(weekStart, 1))} className={buttonClass("ghost", "sm")} aria-label="Semaine suivante">
          →
        </Link>
      </div>

      {/* Bandeau des jours */}
      <nav className="mt-3 grid grid-cols-7 gap-1" aria-label="Jours de la semaine">
        {days.map((d) => {
          const ds = sessions.filter((s) => s.scheduled_on === d);
          const isSelected = d === selected;
          return (
            <Link
              key={d}
              href={href(weekStart, d)}
              aria-current={isSelected ? "date" : undefined}
              aria-label={`${formatDay(d, "EEEE d MMMM")}${ds.length ? ` : ${ds.length} séance${ds.length > 1 ? "s" : ""}` : ""}`}
              className={cn(
                "flex flex-col items-center rounded-lg py-2 text-xs transition-colors",
                isSelected
                  ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                  : "hover:bg-zinc-100 dark:hover:bg-zinc-800",
              )}
            >
              <span className={cn("capitalize", !isSelected && "text-zinc-500")}>{formatDay(d, "EEEEEE")}</span>
              <span className={cn("text-base font-semibold tabular-nums", d === today && !isSelected && "text-sky-600")}>
                {formatDay(d, "d")}
              </span>
              <span className="mt-0.5 flex h-1.5 gap-0.5">
                {ds.map((s) => (
                  <span
                    key={s.id}
                    className={cn(
                      "size-1.5 rounded-full",
                      s.status === "done" ? "bg-emerald-500" : s.status === "skipped" ? "bg-zinc-400" : isSelected ? "bg-white dark:bg-zinc-900" : "bg-zinc-900 dark:bg-zinc-100",
                    )}
                  />
                ))}
              </span>
            </Link>
          );
        })}
      </nav>

      {/* Séances du jour */}
      <section className="mt-5">
        <h2 className="mb-2 text-sm font-semibold text-zinc-500">
          {formatDayTitle(selected)}
          {selected === today && " · aujourd'hui"}
        </h2>
        {daySessions.length === 0 ? (
          <p className="rounded-lg border border-dashed border-zinc-300 p-8 text-center text-sm text-zinc-500 dark:border-zinc-700">
            Repos 😌
          </p>
        ) : (
          <div className="space-y-3">
            {daySessions.map((s) => (
              <SessionCard key={s.id} session={s} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function SessionCard({ session: s }: { session: SessionWithBlocks }) {
  const exercises = s.blocks.flatMap((b) => b.exercises.map((e) => e.exercise.name));
  return (
    <Link
      href={`/me/sessions/${s.id}`}
      className={cn("block rounded-lg border-l-4 p-4 transition-shadow active:shadow-inner", DISCIPLINE_STYLE[s.discipline])}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="font-semibold">{s.title}</h3>
          <p className="text-xs text-zinc-500">
            {DISCIPLINE_LABEL[s.discipline]}
            {s.duration_min && ` · ${s.duration_min} min`}
            {s.blocks.length > 0 && ` · ${s.blocks.length} bloc${s.blocks.length > 1 ? "s" : ""}`}
          </p>
        </div>
        <StatusBadge status={s.status} />
      </div>
      {exercises.length > 0 && (
        <p className="mt-2 line-clamp-2 text-sm text-zinc-600 dark:text-zinc-400">{[...new Set(exercises)].join(" · ")}</p>
      )}
      <p className="mt-3 text-sm font-medium">{s.status === "planned" ? "Voir la séance →" : "Voir le détail →"}</p>
    </Link>
  );
}

function StatusBadge({ status }: { status: SessionWithBlocks["status"] }) {
  if (status === "done")
    return <span className="shrink-0 rounded-full bg-emerald-600 px-2 py-0.5 text-xs font-medium text-white">✓ Faite</span>;
  if (status === "skipped")
    return <span className="shrink-0 rounded-full bg-zinc-300 px-2 py-0.5 text-xs font-medium text-zinc-800 dark:bg-zinc-700 dark:text-zinc-200">Pas faite</span>;
  return <span className="shrink-0 rounded-full border border-zinc-300 px-2 py-0.5 text-xs text-zinc-600 dark:border-zinc-600 dark:text-zinc-400">À faire</span>;
}

export default function MePage(props: PageProps<"/me">) {
  return (
    <Suspense fallback={<p className="text-sm text-zinc-500">Chargement…</p>}>
      <MyWeek searchParams={props.searchParams} />
    </Suspense>
  );
}
