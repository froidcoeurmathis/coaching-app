"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { SessionWithBlocks } from "@/lib/db/types";
import {
  DISCIPLINE_STYLE,
  exerciseLabel,
  formatDay,
  formatWeekRange,
  shiftWeek,
  todayISO,
  currentWeekStart,
  volumeSummary,
} from "@/lib/format";
import { buttonClass, cn, Select } from "../ui";
import { SessionEditor, type EditorTarget } from "./session-editor";

export type CalendarAthlete = { id: string; name: string };

export function WeekCalendar({
  weekStart,
  days,
  athletes,
  athleteFilter,
  sessions,
  exerciseNames,
}: {
  weekStart: string;
  days: string[];
  athletes: CalendarAthlete[];
  athleteFilter?: string;
  sessions: SessionWithBlocks[];
  exerciseNames: string[];
}) {
  const router = useRouter();
  const [target, setTarget] = useState<EditorTarget | null>(null);
  const today = todayISO();
  const isCurrentWeek = weekStart === currentWeekStart();
  const rows = athleteFilter ? athletes.filter((a) => a.id === athleteFilter) : athletes;

  const href = (week: string, athlete = athleteFilter) => {
    const p = new URLSearchParams({ week });
    if (athlete) p.set("athlete", athlete);
    return `/calendar?${p}`;
  };

  const byCell = new Map<string, SessionWithBlocks[]>();
  for (const s of sessions) {
    const k = `${s.athlete_id}|${s.scheduled_on}`;
    byCell.set(k, [...(byCell.get(k) ?? []), s]);
  }

  return (
    <div>
      {/* Barre d'outils */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Link href={href(shiftWeek(weekStart, -1))} className={buttonClass("secondary", "sm")} aria-label="Semaine précédente">
            ←
          </Link>
          <Link
            href={href(currentWeekStart())}
            className={cn(buttonClass("secondary", "sm"), isCurrentWeek && "pointer-events-none opacity-50")}
          >
            Aujourd&apos;hui
          </Link>
          <Link href={href(shiftWeek(weekStart, 1))} className={buttonClass("secondary", "sm")} aria-label="Semaine suivante">
            →
          </Link>
          <h1 className="ml-2 text-lg font-semibold first-letter:uppercase">{formatWeekRange(weekStart)}</h1>
        </div>
        <Select
          aria-label="Filtrer par coaché"
          className="w-auto! min-w-48"
          value={athleteFilter ?? ""}
          onChange={(e) => router.push(href(weekStart, e.target.value || undefined))}
        >
          <option value="">Tous les coachés</option>
          {athletes.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </Select>
      </div>

      {athletes.length === 0 ? (
        <div className="rounded-lg border border-dashed border-zinc-300 p-10 text-center text-sm text-zinc-500 dark:border-zinc-700">
          Ajoutez d&apos;abord un coaché pour programmer des séances.{" "}
          <Link href="/athletes/new" className="font-medium text-zinc-900 underline dark:text-zinc-100">
            Ajouter un coaché
          </Link>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
          <table className="w-full min-w-[960px] table-fixed border-collapse text-sm">
            <colgroup>
              <col className="w-36" />
              {days.map((d) => (
                <col key={d} />
              ))}
            </colgroup>
            <thead>
              <tr className="border-b border-zinc-200 dark:border-zinc-800">
                <th className="sticky left-0 z-10 bg-white p-2 text-left text-xs font-medium text-zinc-500 dark:bg-zinc-900">
                  Coaché
                </th>
                {days.map((d) => (
                  <th
                    key={d}
                    className={cn(
                      "p-2 text-left text-xs font-medium capitalize",
                      d === today ? "text-zinc-900 dark:text-zinc-100" : "text-zinc-500",
                    )}
                  >
                    <span className={cn(d === today && "rounded bg-zinc-900 px-1.5 py-0.5 text-white dark:bg-zinc-100 dark:text-zinc-900")}>
                      {formatDay(d)}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((a) => (
                <tr key={a.id} className="border-b border-zinc-100 last:border-0 dark:border-zinc-800">
                  <th className="sticky left-0 z-10 bg-white p-2 text-left align-top font-medium dark:bg-zinc-900">
                    <Link href={`/athletes/${a.id}`} className="hover:underline">
                      {a.name}
                    </Link>
                  </th>
                  {days.map((d) => (
                    <td
                      key={d}
                      className={cn(
                        "group border-l border-zinc-100 p-1.5 align-top dark:border-zinc-800",
                        d === today && "bg-zinc-50 dark:bg-zinc-800/30",
                      )}
                    >
                      <div className={cn("flex flex-col gap-1.5", athleteFilter ? "min-h-64" : "min-h-24")}>
                        {(byCell.get(`${a.id}|${d}`) ?? []).map((s) => (
                          <SessionCard key={s.id} session={s} onClick={() => setTarget({ session: s })} />
                        ))}
                        <button
                          type="button"
                          onClick={() => setTarget({ athleteId: a.id, date: d })}
                          className="rounded-md border border-dashed border-transparent py-1 text-xs text-zinc-400 transition-colors hover:border-zinc-300 hover:text-zinc-700 focus-visible:border-zinc-300 group-hover:text-zinc-500 dark:hover:border-zinc-600 dark:hover:text-zinc-200"
                          aria-label={`Ajouter une séance pour ${a.name} le ${formatDay(d, "EEEE d MMMM")}`}
                        >
                          + Séance
                        </button>
                      </div>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {target && (
        <SessionEditor
          key={"session" in target ? target.session.id : `${target.athleteId}|${target.date}`}
          target={target}
          athletes={athletes}
          exerciseNames={exerciseNames}
          onClose={() => setTarget(null)}
        />
      )}
    </div>
  );
}

function SessionCard({ session: s, onClick }: { session: SessionWithBlocks; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "w-full rounded-md border-l-4 px-2 py-1.5 text-left transition-shadow hover:shadow-md",
        DISCIPLINE_STYLE[s.discipline],
        s.status === "skipped" && "opacity-60",
      )}
    >
      <div className="flex items-start justify-between gap-1">
        <span className={cn("font-medium leading-tight", s.status === "skipped" && "line-through")}>{s.title}</span>
        {s.status === "done" && (
          <span className="shrink-0 text-emerald-600 dark:text-emerald-400" title="Faite" aria-label="Faite">
            ✓
          </span>
        )}
        {s.status === "skipped" && (
          <span className="shrink-0 text-red-600 dark:text-red-400" title="Non faite" aria-label="Non faite">
            ✕
          </span>
        )}
      </div>
      {s.duration_min && <div className="text-xs text-zinc-500">{s.duration_min} min</div>}
      {(s.rpe != null || s.athlete_comment) && (
        <div className="mt-1 flex items-center gap-1.5 text-xs">
          {s.rpe != null && (
            <span
              className={cn(
                "rounded px-1 font-semibold tabular-nums",
                s.rpe >= 8 ? "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300" : "bg-white/80 text-zinc-700 dark:bg-black/30 dark:text-zinc-300",
              )}
              title="Ressenti du coaché (RPE)"
            >
              RPE {s.rpe}
            </span>
          )}
          {s.athlete_comment && (
            <span className="truncate italic text-zinc-600 dark:text-zinc-400" title={s.athlete_comment}>
              💬 {s.athlete_comment}
            </span>
          )}
        </div>
      )}
      {s.blocks.length > 0 && (
        <ul className="mt-1 space-y-0.5 text-xs text-zinc-600 dark:text-zinc-400">
          {s.blocks.flatMap((b, bi) =>
            b.exercises.map((e, ei) => (
              <li key={e.id} className="truncate">
                <span className="font-semibold text-zinc-800 dark:text-zinc-200">
                  {exerciseLabel(bi, ei, b.exercises.length)}
                </span>{" "}
                {e.exercise.name}
                {volumeSummary(e) && <span className="text-zinc-500"> · {volumeSummary(e)}</span>}
              </li>
            )),
          )}
        </ul>
      )}
    </button>
  );
}
