"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { copyWeekAction } from "@/app/actions/sessions";
import { formatWeekRange, shiftWeek, weekStartOf } from "@/lib/format";
import { parseISO } from "date-fns";
import { Alert, Button, Field, Input, Select } from "../ui";
import type { CalendarAthlete } from "./week-calendar";

/** Copie toutes les séances affichées de la semaine vers une autre semaine. */
export function CopyWeek({
  weekStart,
  athletes,
  athleteIds,
  singleAthlete,
  sessionCount,
}: {
  weekStart: string;
  athletes: CalendarAthlete[];
  athleteIds: string[];
  singleAthlete?: string;
  sessionCount: number;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [target, setTarget] = useState(shiftWeek(weekStart, 1));
  const [targetAthlete, setTargetAthlete] = useState("");
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  const targetWeek = target ? weekStartOf(parseISO(target)) : null;
  const who = singleAthlete ? athletes.find((a) => a.id === singleAthlete)?.name : "tous les coachés affichés";

  const copy = () => {
    if (!targetWeek) return;
    startTransition(async () => {
      const res = await copyWeekAction(weekStart, targetWeek, athleteIds, targetAthlete || undefined);
      if (!res.ok) return setResult({ ok: false, text: res.error });
      setResult({ ok: true, text: `${res.count} séance${(res.count ?? 0) > 1 ? "s" : ""} copiée${(res.count ?? 0) > 1 ? "s" : ""}.` });
      const p = new URLSearchParams({ week: targetWeek });
      if (targetAthlete || singleAthlete) p.set("athlete", targetAthlete || singleAthlete!);
      router.push(`/calendar?${p}`);
      setOpen(false);
    });
  };

  if (!open) {
    return (
      <>
        {result?.ok && <span className="text-sm text-emerald-700 dark:text-emerald-400" role="status">{result.text}</span>}
        <Button
          variant="secondary"
          size="sm"
          className="h-9"
          disabled={sessionCount === 0}
          title={sessionCount === 0 ? "Aucune séance cette semaine" : undefined}
          onClick={() => (setOpen(true), setResult(null), setTarget(shiftWeek(weekStart, 1)))}
        >
          Copier la semaine…
        </Button>
      </>
    );
  }

  return (
    <div className="w-full space-y-3 rounded-lg border border-zinc-200 bg-white p-3 sm:w-auto dark:border-zinc-800 dark:bg-zinc-900">
      <p className="text-sm">
        Copier les <strong>{sessionCount}</strong> séance{sessionCount > 1 ? "s" : ""} de la semaine du{" "}
        {formatWeekRange(weekStart)} ({who})
      </p>
      <div className="flex flex-wrap items-end gap-3">
        <Field label="Vers la semaine du" htmlFor="copy-target">
          <Input id="copy-target" type="date" value={target} onChange={(e) => setTarget(e.target.value)} />
        </Field>
        {singleAthlete && athletes.length > 1 && (
          <Field label="Pour" htmlFor="copy-athlete">
            <Select id="copy-athlete" value={targetAthlete} onChange={(e) => setTargetAthlete(e.target.value)}>
              <option value="">Le même coaché</option>
              {athletes
                .filter((a) => a.id !== singleAthlete)
                .map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
            </Select>
          </Field>
        )}
      </div>
      {targetWeek && <p className="text-xs text-zinc-500">Semaine cible : {formatWeekRange(targetWeek)}. Les séances déjà prévues sont conservées ; les copies sont au statut « prévue ».</p>}
      {result && !result.ok && <Alert>{result.text}</Alert>}
      <div className="flex gap-2">
        <Button size="sm" onClick={copy} disabled={pending || !targetWeek}>
          {pending ? "Copie…" : "Copier"}
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>
          Annuler
        </Button>
      </div>
    </div>
  );
}
