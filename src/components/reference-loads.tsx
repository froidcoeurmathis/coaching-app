"use client";

import { startTransition, useActionState, useRef, useTransition } from "react";
import {
  addReferenceLoadAction,
  deleteReferenceLoadAction,
  type FormState,
} from "@/app/actions/athletes";
import type { ReferenceLoad } from "@/lib/db/types";
import { formatDay, formatNumber } from "@/lib/format";
import { Alert, Button, Input } from "./ui";

export function ReferenceLoads({
  athleteId,
  loads,
  exerciseNames,
}: {
  athleteId: string;
  loads: ReferenceLoad[];
  exerciseNames: string[];
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const [state, action, pending] = useActionState<FormState, FormData>(async (prev, formData) => {
    const result = await addReferenceLoadAction(prev, formData);
    if (result.ok) formRef.current?.reset();
    return result;
  }, {});
  const [deleting, startDelete] = useTransition();

  return (
    <div className="space-y-4">
      {loads.length === 0 ? (
        <p className="text-sm text-zinc-500">Aucune charge de référence.</p>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-zinc-500">
              <th className="pb-1 font-medium">Exercice</th>
              <th className="pb-1 font-medium">Charge</th>
              <th className="pb-1 font-medium">Test</th>
              <th />
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {loads.map((l) => (
              <tr key={l.id}>
                <td className="py-1.5">{l.exercise.name}</td>
                <td className="py-1.5 tabular-nums">
                  {formatNumber(l.load_kg)} kg <span className="text-zinc-500">· {l.reps}RM</span>
                </td>
                <td className="py-1.5 text-zinc-500">{l.tested_on ? formatDay(l.tested_on, "d MMM yy") : "—"}</td>
                <td className="py-1.5 text-right">
                  <Button
                    variant="ghost"
                    size="sm"
                    aria-label={`Supprimer ${l.exercise.name}`}
                    disabled={deleting}
                    onClick={() => startDelete(() => deleteReferenceLoadAction(athleteId, l.id))}
                  >
                    ✕
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <form
        ref={formRef}
        className="space-y-2 border-t border-zinc-100 pt-4 dark:border-zinc-800"
        onSubmit={(e) => {
          e.preventDefault();
          const formData = new FormData(e.currentTarget);
          startTransition(() => action(formData));
        }}
      >
        <input type="hidden" name="athlete_id" value={athleteId} />
        <div className="grid grid-cols-[1fr_5rem_4rem] gap-2">
          <Input name="exercise_name" placeholder="Exercice" list="ref-exercises" aria-label="Exercice" required />
          <Input name="load_kg" placeholder="kg" inputMode="decimal" aria-label="Charge (kg)" required />
          <Input name="reps" placeholder="RM" inputMode="numeric" aria-label="Répétitions (RM)" defaultValue="1" />
        </div>
        <div className="flex items-center gap-2">
          <Input name="tested_on" type="date" aria-label="Date du test" className="flex-1" />
          <Button type="submit" size="sm" disabled={pending}>
            {pending ? "Ajout…" : "Ajouter"}
          </Button>
        </div>
        <datalist id="ref-exercises">
          {exerciseNames.map((n) => (
            <option key={n} value={n} />
          ))}
        </datalist>
        {state.error && (
          <Alert>{Object.values(state.fieldErrors ?? {})[0] ?? state.error}</Alert>
        )}
      </form>
    </div>
  );
}
