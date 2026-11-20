"use client";

import { useEffect, useState } from "react";
import type { SessionBlock } from "@/lib/db/types";
import { exerciseLabel, formatDuration, volumeSummary } from "@/lib/format";
import { intensityWithTargets, type AthleteRefs } from "@/lib/targets";
import { cn } from "../ui";

/**
 * Détail des blocs d'une séance. Avec `checkable`, chaque exercice peut être coché
 * pendant l'entraînement ; ces coches sont un simple aide-mémoire conservé sur
 * l'appareil (localStorage), elles ne sont pas envoyées au coach.
 */
export function SessionBlocks({
  sessionId,
  blocks,
  checkable = false,
  refs,
}: {
  sessionId: string;
  blocks: SessionBlock[];
  checkable?: boolean;
  refs?: AthleteRefs;
}) {
  const storageKey = `coaching:checked:${sessionId}`;
  const [checked, setChecked] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!checkable) return;
    try {
      const raw = localStorage.getItem(storageKey);
      // eslint-disable-next-line react-hooks/set-state-in-effect -- lecture unique au montage
      if (raw) setChecked(new Set(JSON.parse(raw) as string[]));
    } catch {
      // stockage indisponible (navigation privée…) : coches non conservées
    }
  }, [checkable, storageKey]);

  const toggle = (id: string) => {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      try {
        localStorage.setItem(storageKey, JSON.stringify([...next]));
      } catch {}
      return next;
    });
  };

  if (blocks.length === 0) return null;

  return (
    <ol className="space-y-3">
      {blocks.map((b, bi) => (
        <li key={b.id} className="rounded-lg border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900">
          {(b.title || b.rounds || b.rest_s) && (
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-zinc-500">
              {[b.title, b.rounds && `${b.rounds} tours`, b.rest_s != null && `repos ${formatDuration(b.rest_s)} entre les tours`]
                .filter(Boolean)
                .join(" · ")}
            </p>
          )}
          <ul className="space-y-1">
            {b.exercises.map((e, ei) => {
              const label = exerciseLabel(bi, ei, b.exercises.length);
              const isChecked = checked.has(e.id);
              const intensity = intensityWithTargets({ ...e, name: e.exercise.name }, refs);
              const details = [volumeSummary(e), intensity, e.rest_s != null && `repos ${formatDuration(e.rest_s)}`]
                .filter(Boolean)
                .join(" · ");
              const content = (
                <>
                  <span
                    className={cn(
                      "flex size-8 shrink-0 items-center justify-center rounded-md text-sm font-bold",
                      isChecked
                        ? "bg-emerald-600 text-white"
                        : "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900",
                    )}
                    aria-hidden
                  >
                    {isChecked ? "✓" : label}
                  </span>
                  <span className={cn("min-w-0 flex-1", isChecked && "text-zinc-400 line-through dark:text-zinc-600")}>
                    <span className="block font-medium">{e.exercise.name}</span>
                    {details && <span className="block text-sm text-zinc-600 dark:text-zinc-400">{details}</span>}
                    {e.notes && <span className="block text-xs italic text-zinc-500">{e.notes}</span>}
                  </span>
                </>
              );
              return (
                <li key={e.id}>
                  {checkable ? (
                    <button
                      type="button"
                      onClick={() => toggle(e.id)}
                      aria-pressed={isChecked}
                      aria-label={`${label} ${e.exercise.name}${isChecked ? " (fait)" : ""}`}
                      className="-mx-1 flex w-[calc(100%+0.5rem)] items-start gap-3 rounded-md px-1 py-1.5 text-left active:bg-zinc-100 dark:active:bg-zinc-800"
                    >
                      {content}
                    </button>
                  ) : (
                    <div className="flex items-start gap-3 py-1.5">{content}</div>
                  )}
                </li>
              );
            })}
          </ul>
          {b.notes && <p className="mt-2 text-xs italic text-zinc-500">{b.notes}</p>}
        </li>
      ))}
    </ol>
  );
}
