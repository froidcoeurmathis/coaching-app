import { addDays, parseISO } from "date-fns";
import { listSessionsBetween } from "@/lib/db/sessions";
import { currentWeekStart, DISCIPLINE_LABEL, formatDay, formatNumber, shiftWeek, toISODate, todayISO } from "@/lib/format";
import type { Discipline } from "@/lib/db/types";
import { cn } from "./ui";

const WEEKS = 12;

/** Progression hebdomadaire d'un coaché sur les 12 dernières semaines (serveur). */
export async function AthleteProgress({ athleteId }: { athleteId: string }) {
  const thisWeek = currentWeekStart();
  const from = shiftWeek(thisWeek, -(WEEKS - 1));
  const to = toISODate(addDays(parseISO(thisWeek), 6));
  const today = todayISO();
  const sessions = await listSessionsBetween([athleteId], from, to);

  const weeks = Array.from({ length: WEEKS }, (_, i) => {
    const start = shiftWeek(from, i);
    const end = toISODate(addDays(parseISO(start), 6));
    const own = sessions.filter((s) => s.scheduled_on >= start && s.scheduled_on <= end);
    const due = own.filter((s) => s.scheduled_on <= today);
    const done = own.filter((s) => s.status === "done");
    const rpes = done.map((s) => s.rpe).filter((r): r is number => r != null);
    return {
      start,
      planned: own.length,
      due: due.length,
      done: done.length,
      minutes: done.reduce((t, s) => t + (s.duration_min ?? 0), 0),
      plannedMinutes: own.reduce((t, s) => t + (s.duration_min ?? 0), 0),
      avgRpe: rpes.length ? rpes.reduce((a, b) => a + b, 0) / rpes.length : null,
    };
  }).filter((w) => w.planned > 0 || w.start === thisWeek);

  const doneAll = sessions.filter((s) => s.status === "done" && s.scheduled_on <= today);
  const dueAll = sessions.filter((s) => s.scheduled_on <= today);
  const byDiscipline = (Object.keys(DISCIPLINE_LABEL) as Discipline[])
    .map((d) => ({ d, n: doneAll.filter((s) => s.discipline === d).length }))
    .filter((x) => x.n > 0);
  const maxMinutes = Math.max(1, ...weeks.map((w) => Math.max(w.minutes, w.plannedMinutes)));

  if (!sessions.length) {
    return <p className="text-sm text-zinc-500">Pas encore de séances sur les 12 dernières semaines.</p>;
  }

  return (
    <div className="space-y-4">
      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Séances faites" value={`${doneAll.length}`} sub={`sur ${dueAll.length} prévues à ce jour`} />
        <Stat
          label="Réalisation"
          value={dueAll.length ? `${Math.round((doneAll.length / dueAll.length) * 100)} %` : "—"}
          sub={`${WEEKS} dernières semaines`}
        />
        <Stat
          label="Temps d'entraînement"
          value={`${formatNumber(Math.round(doneAll.reduce((t, s) => t + (s.duration_min ?? 0), 0) / 6) / 10)} h`}
          sub="séances faites"
        />
        <Stat
          label="Répartition"
          value={byDiscipline.length ? byDiscipline.map((x) => `${x.n} ${DISCIPLINE_LABEL[x.d].toLowerCase()}`).join(" · ") : "—"}
          sub="séances faites"
          small
        />
      </dl>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[520px] text-sm">
          <caption className="mb-2 text-left text-xs text-zinc-500">
            Minutes réalisées par semaine (barre pleine) sur les minutes prévues (contour)
          </caption>
          <thead>
            <tr className="text-left text-xs text-zinc-500">
              <th className="pb-1 font-medium">Semaine du</th>
              <th className="pb-1 font-medium">Faites</th>
              <th className="pb-1 font-medium">RPE moyen</th>
              <th className="w-1/2 pb-1 font-medium">Volume</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {weeks.map((w) => (
              <tr key={w.start}>
                <td className="py-1.5 tabular-nums">
                  {formatDay(w.start, "d MMM")}
                  {w.start === thisWeek && <span className="text-zinc-500"> (en cours)</span>}
                </td>
                <td className="py-1.5 tabular-nums">
                  {w.done}/{w.planned}
                </td>
                <td className={cn("py-1.5 tabular-nums", w.avgRpe != null && w.avgRpe >= 8 && "font-semibold text-red-700 dark:text-red-400")}>
                  {w.avgRpe == null ? "—" : formatNumber(Math.round(w.avgRpe * 10) / 10)}
                  {w.avgRpe != null && w.avgRpe >= 8 && " ⚠"}
                </td>
                <td className="py-1.5">
                  <div className="flex items-center gap-2" title={`${w.minutes} min réalisées sur ${w.plannedMinutes} min prévues`}>
                    <div className="relative h-3 flex-1" aria-hidden>
                      <div
                        className="absolute inset-y-0 left-0 rounded-[3px] border border-zinc-300 dark:border-zinc-600"
                        style={{ width: `${(w.plannedMinutes / maxMinutes) * 100}%` }}
                      />
                      <div
                        className="absolute inset-y-0 left-0 rounded-[3px] bg-zinc-800 dark:bg-zinc-200"
                        style={{ width: `${(w.minutes / maxMinutes) * 100}%` }}
                      />
                    </div>
                    <span className="w-24 text-right text-xs tabular-nums text-zinc-500">
                      {w.minutes}/{w.plannedMinutes} min
                    </span>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Stat({ label, value, sub, small }: { label: string; value: string; sub: string; small?: boolean }) {
  return (
    <div className="rounded-md bg-zinc-50 p-3 dark:bg-zinc-800/40">
      <dt className="text-xs text-zinc-500">{label}</dt>
      <dd className={cn("font-semibold tabular-nums", small ? "text-sm" : "text-xl")}>{value}</dd>
      <dd className="text-xs text-zinc-500">{sub}</dd>
    </div>
  );
}
