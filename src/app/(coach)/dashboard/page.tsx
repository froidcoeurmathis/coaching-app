import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { addDays, parseISO } from "date-fns";
import { cn } from "@/components/ui";
import { requireCoach } from "@/lib/auth/session";
import { listAthletes } from "@/lib/db/athletes";
import { listSessionsBetween, type SessionSummary } from "@/lib/db/sessions";
import { currentWeekStart, formatDateTime, formatDay, formatNumber, toISODate, todayISO } from "@/lib/format";

export const metadata: Metadata = { title: "Suivi" };

const DAYS = 28;

type DayStatus = "done" | "skipped" | "missed" | "planned" | "none";

function dayStatus(sessions: SessionSummary[], day: string, today: string): DayStatus {
  if (!sessions.length) return "none";
  if (sessions.some((s) => s.status === "done")) return "done";
  if (sessions.every((s) => s.status === "skipped")) return "skipped";
  return day < today ? "missed" : "planned";
}

const STATUS_TEXT: Record<DayStatus, string> = {
  done: "faite",
  skipped: "pas faite",
  missed: "non validée",
  planned: "à venir",
  none: "repos",
};

async function Dashboard() {
  await connection();
  const coach = await requireCoach();
  const athletes = await listAthletes(coach.id);
  const today = todayISO();
  const from = toISODate(addDays(parseISO(today), -(DAYS - 1)));
  const weekStart = currentWeekStart();
  const weekEnd = toISODate(addDays(parseISO(weekStart), 6));
  const sessions = await listSessionsBetween(
    athletes.map((a) => a.id),
    from < weekStart ? from : weekStart,
    weekEnd > today ? weekEnd : today,
  );
  const days = Array.from({ length: DAYS }, (_, i) => toISODate(addDays(parseISO(from), i)));

  const rows = athletes.map((a) => {
    const own = sessions.filter((s) => s.athlete_id === a.id);
    const past = own.filter((s) => s.scheduled_on >= from && s.scheduled_on <= today);
    const done = past.filter((s) => s.status === "done");
    const skipped = past.filter((s) => s.status === "skipped");
    const missed = past.filter((s) => s.status === "planned" && s.scheduled_on < today);
    const rpes = past.map((s) => s.rpe).filter((r): r is number => r != null);
    const week = own.filter((s) => s.scheduled_on >= weekStart && s.scheduled_on <= weekEnd);
    const lastFeedback = own
      .map((s) => s.feedback_at)
      .filter(Boolean)
      .sort()
      .at(-1);
    return {
      athlete: a,
      byDay: days.map((d) => ({ day: d, status: dayStatus(own.filter((s) => s.scheduled_on === d), d, today) })),
      rate: past.length ? Math.round((done.length / past.length) * 100) : null,
      done: done.length,
      due: past.length,
      skipped: skipped.length,
      missed: missed.length,
      avgRpe: rpes.length ? rpes.reduce((x, y) => x + y, 0) / rpes.length : null,
      weekDone: week.filter((s) => s.status === "done").length,
      weekTotal: week.length,
      lastFeedback,
    };
  });

  const feedback = sessions
    .filter((s) => s.feedback_at && (s.athlete_comment || s.rpe != null))
    .sort((x, y) => (y.feedback_at! > x.feedback_at! ? 1 : -1))
    .slice(0, 12);
  const name = (id: string) => {
    const a = athletes.find((x) => x.id === id);
    return a ? [a.first_name, a.last_name].filter(Boolean).join(" ") : "";
  };

  if (!athletes.length) {
    return <p className="text-sm text-zinc-500">Aucun coaché actif.</p>;
  }

  return (
    <div className="space-y-8">
      {/* Tableau par coaché */}
      <section aria-labelledby="by-athlete">
        <h2 id="by-athlete" className="sr-only">Réalisation par coaché</h2>
        <div className="overflow-x-auto rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
          <table className="w-full min-w-[860px] text-sm">
            <thead>
              <tr className="border-b border-zinc-200 text-left text-xs text-zinc-500 dark:border-zinc-800">
                <th className="p-3 font-medium">Coaché</th>
                <th className="p-3 font-medium">Cette semaine</th>
                <th className="p-3 font-medium">Réalisation {DAYS} j</th>
                <th className="p-3 font-medium">RPE moyen</th>
                <th className="p-3 font-medium">
                  {DAYS} derniers jours <span className="font-normal">({formatDay(from, "d MMM")} → aujourd&apos;hui)</span>
                </th>
                <th className="p-3 font-medium">Dernier retour</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {rows.map((r) => (
                <tr key={r.athlete.id}>
                  <td className="p-3 font-medium">
                    <Link href={`/calendar?athlete=${r.athlete.id}`} className="hover:underline">
                      {r.athlete.first_name} {r.athlete.last_name}
                    </Link>
                  </td>
                  <td className="p-3 tabular-nums">
                    {r.weekTotal ? `${r.weekDone}/${r.weekTotal} faites` : <span className="text-zinc-400">—</span>}
                  </td>
                  <td className="p-3">
                    {r.rate == null ? (
                      <span className="text-zinc-400">—</span>
                    ) : (
                      <>
                        <span className="text-base font-semibold tabular-nums">{r.rate} %</span>
                        <span className="block text-xs text-zinc-500">
                          {r.done}/{r.due} faites
                          {r.skipped > 0 && ` · ${r.skipped} pas faite${r.skipped > 1 ? "s" : ""}`}
                          {r.missed > 0 && (
                            <span className="text-red-700 dark:text-red-400">
                              {` · ${r.missed} non validée${r.missed > 1 ? "s" : ""}`}
                            </span>
                          )}
                        </span>
                      </>
                    )}
                  </td>
                  <td className="p-3 tabular-nums">
                    {r.avgRpe == null ? (
                      <span className="text-zinc-400">—</span>
                    ) : (
                      <span className={cn(r.avgRpe >= 8 && "font-semibold text-red-700 dark:text-red-400")}>
                        {formatNumber(Math.round(r.avgRpe * 10) / 10)}
                        {r.avgRpe >= 8 && " ⚠"}
                      </span>
                    )}
                  </td>
                  <td className="p-3">
                    <StatusStrip days={r.byDay} />
                  </td>
                  <td className="p-3 text-xs text-zinc-500">{r.lastFeedback ? formatDateTime(r.lastFeedback) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Legend />
      </section>

      {/* Derniers retours */}
      <section aria-labelledby="feedback">
        <h2 id="feedback" className="mb-3 font-semibold">Derniers retours</h2>
        {feedback.length === 0 ? (
          <p className="text-sm text-zinc-500">Aucun retour sur la période.</p>
        ) : (
          <ul className="grid gap-2 md:grid-cols-2">
            {feedback.map((s) => (
              <li key={s.id} className="rounded-lg border border-zinc-200 bg-white p-3 text-sm dark:border-zinc-800 dark:bg-zinc-900">
                <div className="flex items-start justify-between gap-2">
                  <p>
                    <span className="font-medium">{name(s.athlete_id)}</span>
                    <span className="text-zinc-500"> · {s.title} · {formatDay(s.scheduled_on, "EEE d MMM")}</span>
                  </p>
                  {s.rpe != null && (
                    <span
                      className={cn(
                        "shrink-0 rounded px-1.5 text-xs font-semibold tabular-nums",
                        s.rpe >= 8 ? "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300" : "bg-zinc-100 dark:bg-zinc-800",
                      )}
                    >
                      RPE {s.rpe}
                    </span>
                  )}
                </div>
                {s.status === "skipped" && <p className="text-xs text-zinc-500">Séance non faite</p>}
                {s.athlete_comment && <p className="mt-1 italic text-zinc-700 dark:text-zinc-300">« {s.athlete_comment} »</p>}
                <p className="mt-1 text-xs text-zinc-400">{formatDateTime(s.feedback_at!)}</p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

const CELL: Record<DayStatus, string> = {
  done: "bg-emerald-600 dark:bg-emerald-500",
  skipped: "bg-zinc-400 dark:bg-zinc-500",
  missed: "border-2 border-red-600 bg-transparent dark:border-red-400",
  planned: "border border-zinc-400 bg-transparent dark:border-zinc-500",
  none: "bg-zinc-100 dark:bg-zinc-800",
};

function StatusStrip({ days }: { days: { day: string; status: DayStatus }[] }) {
  return (
    <ol className="flex gap-0.5" aria-label="Statut des séances, jour par jour">
      {days.map(({ day, status }) => {
        const label = `${formatDay(day, "EEE d MMM")} : ${STATUS_TEXT[status]}`;
        return (
          <li key={day} title={label} aria-label={label} className={cn("flex size-4 items-center justify-center rounded-[3px] text-[9px] leading-none", CELL[status])}>
            {status === "done" && <span className="text-white" aria-hidden>✓</span>}
          </li>
        );
      })}
    </ol>
  );
}

function Legend() {
  const items: DayStatus[] = ["done", "skipped", "missed", "planned", "none"];
  return (
    <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-zinc-500">
      {items.map((s) => (
        <li key={s} className="flex items-center gap-1.5">
          <span className={cn("flex size-3.5 items-center justify-center rounded-[3px] text-[8px]", CELL[s])} aria-hidden>
            {s === "done" && <span className="text-white">✓</span>}
          </span>
          {STATUS_TEXT[s].charAt(0).toUpperCase() + STATUS_TEXT[s].slice(1)}
        </li>
      ))}
    </ul>
  );
}

export default function DashboardPage() {
  return (
    <div>
      <h1 className="mb-4 text-xl font-semibold">Suivi</h1>
      <Suspense fallback={<p className="text-sm text-zinc-500">Chargement…</p>}>
        <Dashboard />
      </Suspense>
    </div>
  );
}
