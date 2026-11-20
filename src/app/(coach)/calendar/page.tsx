import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
import { WeekCalendar } from "@/components/calendar/week-calendar";
import { requireCoach } from "@/lib/auth/session";
import { getAthleteRefs, listAthletes, listExercises } from "@/lib/db/athletes";
import { listTemplates } from "@/lib/db/templates";
import { listWeekSessions } from "@/lib/db/sessions";
import { parseWeekParam, weekDays } from "@/lib/format";

export const metadata: Metadata = { title: "Calendrier" };

async function Calendar({ searchParams }: { searchParams: PageProps<"/calendar">["searchParams"] }) {
  await connection(); // rendu à la requête : la « semaine courante » dépend de la date du jour
  const params = await searchParams;
  const weekStart = parseWeekParam(typeof params.week === "string" ? params.week : undefined);
  const athleteFilter = typeof params.athlete === "string" ? params.athlete : undefined;

  const coach = await requireCoach();
  const [athletes, exercises, templates] = await Promise.all([
    listAthletes(coach.id),
    listExercises(coach.id),
    listTemplates(coach.id),
  ]);
  const shown = athleteFilter ? athletes.filter((a) => a.id === athleteFilter) : athletes;
  const [sessions, refs] = await Promise.all([
    listWeekSessions(shown.map((a) => a.id), weekStart),
    getAthleteRefs(athletes.map((a) => a.id)),
  ]);

  return (
    <WeekCalendar
      weekStart={weekStart}
      days={weekDays(weekStart)}
      athletes={athletes.map((a) => ({ id: a.id, name: [a.first_name, a.last_name].filter(Boolean).join(" ") }))}
      athleteFilter={shown.length === 1 && athleteFilter ? athleteFilter : undefined}
      sessions={sessions}
      exerciseNames={exercises.map((e) => e.name)}
      templates={templates}
      refs={refs}
    />
  );
}

export default function CalendarPage(props: PageProps<"/calendar">) {
  return (
    <Suspense fallback={<p className="text-sm text-zinc-500">Chargement du calendrier…</p>}>
      <Calendar searchParams={props.searchParams} />
    </Suspense>
  );
}
