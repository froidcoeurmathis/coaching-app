"use client";

import { useState, useTransition } from "react";
import { logSessionAction } from "@/app/actions/me";
import type { SessionStatus } from "@/lib/db/types";
import { formatTime } from "@/lib/format";
import { Alert, Button, cn, Textarea } from "../ui";

const RPE_HINT: Record<number, string> = {
  1: "Très facile",
  2: "Facile",
  3: "Facile",
  4: "Modéré",
  5: "Modéré",
  6: "Soutenu",
  7: "Difficile",
  8: "Très difficile",
  9: "Extrême",
  10: "Maximal",
};

export function FeedbackForm({
  sessionId,
  status,
  rpe,
  comment,
  completedAt,
}: {
  sessionId: string;
  status: SessionStatus;
  rpe: number | null;
  comment: string | null;
  completedAt: string | null;
}) {
  const [editing, setEditing] = useState(status === "planned");
  const [choice, setChoice] = useState<Exclude<SessionStatus, "planned"> | null>(status === "planned" ? null : status);
  const [rpeValue, setRpeValue] = useState<number | null>(rpe);
  const [text, setText] = useState(comment ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const submit = (nextStatus: SessionStatus) =>
    startTransition(async () => {
      setError(null);
      const res = await logSessionAction({
        id: sessionId,
        status: nextStatus,
        rpe: nextStatus === "done" ? rpeValue : null,
        comment: text,
      });
      if (!res.ok) return setError(res.error);
      if (nextStatus === "planned") {
        setChoice(null);
        setRpeValue(null);
        setText("");
        setEditing(true);
      } else {
        setEditing(false);
      }
    });

  // Séance déjà validée : récapitulatif
  if (!editing && status !== "planned") {
    return (
      <section
        className={cn(
          "rounded-lg p-4",
          status === "done" ? "bg-emerald-50 dark:bg-emerald-950/40" : "bg-zinc-100 dark:bg-zinc-800/60",
        )}
        aria-label="Ma validation"
      >
        <p className="font-semibold">
          {status === "done" ? "✓ Séance faite" : "Séance non faite"}
          {status === "done" && completedAt && (
            <span className="font-normal text-zinc-500"> · validée à {formatTime(completedAt)}</span>
          )}
        </p>
        {rpe != null && (
          <p className="mt-1 text-sm">
            Ressenti : <strong>{rpe}/10</strong> — {RPE_HINT[rpe]}
          </p>
        )}
        {comment && <p className="mt-1 whitespace-pre-line text-sm text-zinc-700 dark:text-zinc-300">« {comment} »</p>}
        {error && <div className="mt-3"><Alert>{error}</Alert></div>}
        <div className="mt-3 flex gap-2">
          <Button variant="secondary" size="sm" onClick={() => setEditing(true)}>
            Modifier
          </Button>
          <Button variant="ghost" size="sm" disabled={pending} onClick={() => submit("planned")}>
            Annuler la validation
          </Button>
        </div>
      </section>
    );
  }

  return (
    <section className="space-y-4 rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900" aria-label="Valider la séance">
      <h2 className="font-semibold">Valider la séance</h2>
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => setChoice("done")}
          aria-pressed={choice === "done"}
          className={cn(
            "h-14 rounded-lg border-2 text-base font-semibold transition-colors",
            choice === "done"
              ? "border-emerald-600 bg-emerald-600 text-white"
              : "border-zinc-200 text-zinc-700 dark:border-zinc-700 dark:text-zinc-300",
          )}
        >
          ✓ Faite
        </button>
        <button
          type="button"
          onClick={() => setChoice("skipped")}
          aria-pressed={choice === "skipped"}
          className={cn(
            "h-14 rounded-lg border-2 text-base font-semibold transition-colors",
            choice === "skipped"
              ? "border-zinc-700 bg-zinc-700 text-white dark:border-zinc-300 dark:bg-zinc-300 dark:text-zinc-900"
              : "border-zinc-200 text-zinc-700 dark:border-zinc-700 dark:text-zinc-300",
          )}
        >
          Pas faite
        </button>
      </div>

      {choice === "done" && (
        <fieldset>
          <legend className="mb-2 text-sm font-medium">
            Ressenti de l&apos;effort (RPE){" "}
            <span className="font-normal text-zinc-500">{rpeValue ? `— ${rpeValue}/10 ${RPE_HINT[rpeValue]}` : "— optionnel"}</span>
          </legend>
          <div className="grid grid-cols-5 gap-1.5">
            {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setRpeValue(rpeValue === n ? null : n)}
                aria-pressed={rpeValue === n}
                aria-label={`RPE ${n} : ${RPE_HINT[n]}`}
                className={cn(
                  "h-11 rounded-md border text-base font-semibold tabular-nums transition-colors",
                  rpeValue === n
                    ? "border-zinc-900 bg-zinc-900 text-white dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900"
                    : "border-zinc-200 dark:border-zinc-700",
                  n >= 8 && rpeValue !== n && "text-red-700 dark:text-red-400",
                )}
              >
                {n}
              </button>
            ))}
          </div>
        </fieldset>
      )}

      {choice && (
        <div className="space-y-1">
          <label htmlFor="athlete-comment" className="text-sm font-medium">
            Commentaire pour votre coach <span className="font-normal text-zinc-500">— optionnel</span>
          </label>
          <Textarea
            id="athlete-comment"
            value={text}
            onChange={(e) => setText(e.target.value)}
            maxLength={2000}
            placeholder={
              choice === "done" ? "Sensations, charges réellement utilisées, douleurs…" : "Raison : fatigue, blessure, emploi du temps…"
            }
          />
        </div>
      )}

      {error && <Alert>{error}</Alert>}

      <div className="flex gap-2">
        {status !== "planned" && (
          <Button variant="secondary" onClick={() => setEditing(false)}>
            Annuler
          </Button>
        )}
        <Button className="flex-1" disabled={!choice || pending} onClick={() => choice && submit(choice)}>
          {pending ? "Enregistrement…" : "Enregistrer"}
        </Button>
      </div>
    </section>
  );
}
