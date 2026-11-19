"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import {
  deleteSessionAction,
  duplicateSessionAction,
  saveSessionAction,
  type SaveSessionInput,
} from "@/app/actions/sessions";
import type { Discipline, SessionStatus, SessionWithBlocks } from "@/lib/db/types";
import {
  blockLetter,
  DISCIPLINES,
  durationInput,
  exerciseLabel,
  formatDay,
  parseDuration,
  STATUS_LABEL,
} from "@/lib/format";
import { Alert, Button, cn, Field, Input, inputClass, Select, Textarea } from "../ui";
import type { CalendarAthlete } from "./week-calendar";

export type EditorTarget = { session: SessionWithBlocks } | { athleteId: string; date: string };

// ---------------------------------------------------------------------------
// État du formulaire (tout en texte pour la saisie, converti à l'enregistrement)
// ---------------------------------------------------------------------------

type ExerciseDraft = {
  key: number;
  name: string;
  sets: string;
  reps: string;
  distance: string;
  duration: string;
  intensity: string;
  load_kg: string;
  load_pct: string;
  rest: string;
  notes: string;
  showNotes: boolean;
};

type BlockDraft = {
  key: number;
  title: string;
  rounds: string;
  rest: string;
  notes: string;
  exercises: ExerciseDraft[];
};

let keySeq = 0;
const k = () => ++keySeq;

const emptyExercise = (): ExerciseDraft => ({
  key: k(),
  name: "",
  sets: "",
  reps: "",
  distance: "",
  duration: "",
  intensity: "",
  load_kg: "",
  load_pct: "",
  rest: "",
  notes: "",
  showNotes: false,
});

const emptyBlock = (): BlockDraft => ({
  key: k(),
  title: "",
  rounds: "",
  rest: "",
  notes: "",
  exercises: [emptyExercise()],
});

const str = (v: number | string | null | undefined) => (v == null ? "" : String(v).replace(".", ","));

function draftFromSession(s: SessionWithBlocks): BlockDraft[] {
  return s.blocks.map((b) => ({
    key: k(),
    title: b.title ?? "",
    rounds: str(b.rounds),
    rest: durationInput(b.rest_s),
    notes: b.notes ?? "",
    exercises: b.exercises.map((e) => ({
      key: k(),
      name: e.exercise.name,
      sets: str(e.sets),
      reps: e.reps ?? "",
      distance: str(e.distance_m),
      duration: durationInput(e.duration_s),
      intensity: e.intensity ?? "",
      load_kg: str(e.load_kg),
      load_pct: str(e.load_pct),
      rest: durationInput(e.rest_s),
      notes: e.notes ?? "",
      showNotes: !!e.notes,
    })),
  }));
}

class DraftError extends Error {}

function num(value: string, label: string, opts: { int?: boolean } = {}): number | null {
  const v = value.trim().replace(",", ".");
  if (!v) return null;
  const n = Number(v);
  if (Number.isNaN(n) || n < 0 || (opts.int && !Number.isInteger(n))) {
    throw new DraftError(`${label} : « ${value} » n'est pas un nombre valide.`);
  }
  return n;
}

function dur(value: string, label: string, bare: "s" | "min"): number | null {
  if (!value.trim()) return null;
  const s = parseDuration(value, bare);
  if (s === null) throw new DraftError(`${label} : « ${value} » n'est pas une durée valide (ex. 90, 1:30, 15').`);
  return s;
}

function blocksToPayload(blocks: BlockDraft[]): SaveSessionInput["blocks"] {
  return blocks.map((b, bi) => ({
    title: b.title,
    rounds: num(b.rounds, `Bloc ${blockLetter(bi)} — tours`, { int: true }),
    rest_s: dur(b.rest, `Bloc ${blockLetter(bi)} — repos`, "s"),
    notes: b.notes,
    exercises: b.exercises.map((e, ei) => {
      const label = exerciseLabel(bi, ei, b.exercises.length);
      return {
        name: e.name,
        sets: num(e.sets, `${label} — séries`, { int: true }),
        reps: e.reps,
        distance_m: num(e.distance, `${label} — distance`, { int: true }),
        duration_s: dur(e.duration, `${label} — durée`, "min"),
        intensity: e.intensity,
        load_kg: num(e.load_kg, `${label} — charge`),
        load_pct: num(e.load_pct, `${label} — %`),
        rest_s: dur(e.rest, `${label} — repos`, "s"),
        notes: e.notes,
      };
    }),
  }));
}

// ---------------------------------------------------------------------------
// Composant
// ---------------------------------------------------------------------------

export function SessionEditor({
  target,
  athletes,
  exerciseNames,
  onClose,
}: {
  target: EditorTarget;
  athletes: CalendarAthlete[];
  exerciseNames: string[];
  onClose: () => void;
}) {
  const existing = "session" in target ? target.session : null;
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);

  const [athleteId, setAthleteId] = useState(existing?.athlete_id ?? ("athleteId" in target ? target.athleteId : ""));
  const [date, setDate] = useState(existing?.scheduled_on ?? ("date" in target ? target.date : ""));
  const [title, setTitle] = useState(existing?.title ?? "");
  const [discipline, setDiscipline] = useState<Discipline>(existing?.discipline ?? "hyrox");
  const [duration, setDuration] = useState(str(existing?.duration_min));
  const [status, setStatus] = useState<SessionStatus>(existing?.status ?? "planned");
  const [description, setDescription] = useState(existing?.description ?? "");
  const [blocks, setBlocks] = useState<BlockDraft[]>(() =>
    existing ? draftFromSession(existing) : [emptyBlock()],
  );

  const [dupOpen, setDupOpen] = useState(false);
  const [dupDate, setDupDate] = useState("");
  const [dupAthlete, setDupAthlete] = useState("");

  useEffect(() => {
    const d = dialogRef.current;
    if (d && !d.open) d.showModal();
  }, []);

  const close = () => {
    if (dirty && !confirm("Fermer sans enregistrer les modifications ?")) return;
    onClose();
  };

  const touch = () => {
    setDirty(true);
    setError(null);
  };

  // --- Mutations des blocs -------------------------------------------------
  const updateBlock = (bk: number, patch: Partial<BlockDraft>) => {
    touch();
    setBlocks((bs) => bs.map((b) => (b.key === bk ? { ...b, ...patch } : b)));
  };
  const updateExercise = (bk: number, ek: number, patch: Partial<ExerciseDraft>) => {
    touch();
    setBlocks((bs) =>
      bs.map((b) =>
        b.key === bk ? { ...b, exercises: b.exercises.map((e) => (e.key === ek ? { ...e, ...patch } : e)) } : b,
      ),
    );
  };
  const moveBlock = (index: number, delta: number) => {
    touch();
    setBlocks((bs) => {
      const next = [...bs];
      const [b] = next.splice(index, 1);
      next.splice(index + delta, 0, b);
      return next;
    });
  };
  const removeBlock = (bk: number) => {
    touch();
    setBlocks((bs) => bs.filter((b) => b.key !== bk));
  };
  const addExercise = (bk: number) => {
    touch();
    setBlocks((bs) => bs.map((b) => (b.key === bk ? { ...b, exercises: [...b.exercises, emptyExercise()] } : b)));
  };
  const removeExercise = (bk: number, ek: number) => {
    touch();
    setBlocks((bs) =>
      bs.map((b) => (b.key === bk ? { ...b, exercises: b.exercises.filter((e) => e.key !== ek) } : b)),
    );
  };

  // --- Actions serveur -----------------------------------------------------
  const save = () => {
    let input: SaveSessionInput;
    try {
      input = {
        session: {
          id: existing?.id,
          athlete_id: athleteId,
          scheduled_on: date,
          title,
          discipline,
          description,
          duration_min: num(duration, "Durée", { int: true }),
          status,
        },
        blocks: blocksToPayload(blocks),
      };
    } catch (e) {
      setError(e instanceof DraftError ? e.message : "Données invalides");
      return;
    }
    startTransition(async () => {
      const res = await saveSessionAction(input);
      if (res.ok) onClose();
      else setError(res.error);
    });
  };

  const remove = () => {
    if (!existing || !confirm(`Supprimer la séance « ${existing.title} » ?`)) return;
    startTransition(async () => {
      const res = await deleteSessionAction(existing.id);
      if (res.ok) onClose();
      else setError(res.error);
    });
  };

  const duplicate = () => {
    if (!existing || !dupDate) return;
    startTransition(async () => {
      const res = await duplicateSessionAction(existing.id, dupDate, dupAthlete || undefined);
      if (res.ok) onClose();
      else setError(res.error);
    });
  };

  const athleteName = athletes.find((a) => a.id === athleteId)?.name;

  return (
    <dialog
      ref={dialogRef}
      onCancel={(e) => {
        e.preventDefault();
        close();
      }}
      className="m-auto h-full max-h-full w-full max-w-full bg-white p-0 text-zinc-900 sm:h-auto sm:max-h-[92vh] sm:max-w-5xl sm:rounded-xl dark:bg-zinc-900 dark:text-zinc-100"
      aria-labelledby="session-editor-title"
    >
      <form
        className="flex h-full flex-col sm:max-h-[92vh]"
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
      >
        {/* En-tête */}
        <div className="flex items-center justify-between gap-4 border-b border-zinc-200 px-4 py-3 sm:px-6 dark:border-zinc-800">
          <div>
            <h2 id="session-editor-title" className="font-semibold">
              {existing ? "Modifier la séance" : "Nouvelle séance"}
            </h2>
            <p className="text-xs capitalize text-zinc-500">
              {athleteName} {date && `· ${formatDay(date, "EEEE d MMMM")}`}
            </p>
          </div>
          <Button variant="ghost" size="sm" onClick={close} aria-label="Fermer">
            ✕
          </Button>
        </div>

        {/* Corps */}
        <div className="flex-1 space-y-6 overflow-y-auto px-4 py-4 sm:px-6">
          <div className="grid gap-3 sm:grid-cols-6">
            <Field label="Titre *" htmlFor="s-title" className="sm:col-span-3">
              <Input
                id="s-title"
                value={title}
                onChange={(e) => (touch(), setTitle(e.target.value))}
                placeholder="ex. Force + Hyrox"
                required
                autoFocus={!existing}
              />
            </Field>
            <Field label="Discipline" htmlFor="s-discipline">
              <Select id="s-discipline" value={discipline} onChange={(e) => (touch(), setDiscipline(e.target.value as Discipline))}>
                {DISCIPLINES.map((d) => (
                  <option key={d.value} value={d.value}>
                    {d.label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Durée (min)" htmlFor="s-duration">
              <Input id="s-duration" value={duration} inputMode="numeric" onChange={(e) => (touch(), setDuration(e.target.value))} placeholder="60" />
            </Field>
            <Field label="Statut" htmlFor="s-status">
              <Select id="s-status" value={status} onChange={(e) => (touch(), setStatus(e.target.value as SessionStatus))}>
                {(Object.keys(STATUS_LABEL) as SessionStatus[]).map((st) => (
                  <option key={st} value={st}>
                    {STATUS_LABEL[st]}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Coaché" htmlFor="s-athlete" className="sm:col-span-3">
              <Select id="s-athlete" value={athleteId} onChange={(e) => (touch(), setAthleteId(e.target.value))}>
                {athletes.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Date" htmlFor="s-date" className="sm:col-span-3">
              <Input id="s-date" type="date" value={date} onChange={(e) => (touch(), setDate(e.target.value))} required />
            </Field>
            <Field label="Consignes générales" htmlFor="s-description" className="sm:col-span-6">
              <Textarea
                id="s-description"
                rows={2}
                value={description}
                onChange={(e) => (touch(), setDescription(e.target.value))}
                placeholder="Échauffement, objectif de la séance, points techniques…"
              />
            </Field>
          </div>

          {/* Blocs */}
          <div className="space-y-4">
            {blocks.map((b, bi) => (
              <section key={b.key} className="rounded-lg border border-zinc-200 dark:border-zinc-800" aria-label={`Bloc ${blockLetter(bi)}`}>
                <div className="flex flex-wrap items-center gap-2 border-b border-zinc-100 bg-zinc-50 px-3 py-2 dark:border-zinc-800 dark:bg-zinc-800/40">
                  <span className="flex size-7 items-center justify-center rounded-md bg-zinc-900 text-sm font-bold text-white dark:bg-zinc-100 dark:text-zinc-900">
                    {blockLetter(bi)}
                  </span>
                  <Input
                    aria-label={`Titre du bloc ${blockLetter(bi)}`}
                    value={b.title}
                    onChange={(e) => updateBlock(b.key, { title: e.target.value })}
                    placeholder="Titre du bloc (optionnel)"
                    className="h-8 min-w-40 flex-1"
                  />
                  <label className="flex items-center gap-1 text-xs text-zinc-500">
                    Tours
                    <Input
                      value={b.rounds}
                      onChange={(e) => updateBlock(b.key, { rounds: e.target.value })}
                      inputMode="numeric"
                      className="h-8 w-14! text-center"
                      placeholder="—"
                    />
                  </label>
                  <label className="flex items-center gap-1 text-xs text-zinc-500">
                    Repos entre tours
                    <Input
                      value={b.rest}
                      onChange={(e) => updateBlock(b.key, { rest: e.target.value })}
                      className="h-8 w-16! text-center"
                      placeholder="1:30"
                    />
                  </label>
                  <div className="ml-auto flex">
                    <Button variant="ghost" size="sm" disabled={bi === 0} onClick={() => moveBlock(bi, -1)} aria-label="Monter le bloc">
                      ↑
                    </Button>
                    <Button variant="ghost" size="sm" disabled={bi === blocks.length - 1} onClick={() => moveBlock(bi, 1)} aria-label="Descendre le bloc">
                      ↓
                    </Button>
                    <Button variant="danger" size="sm" onClick={() => removeBlock(b.key)} aria-label={`Supprimer le bloc ${blockLetter(bi)}`}>
                      ✕
                    </Button>
                  </div>
                </div>

                <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
                  {b.exercises.map((e, ei) => (
                    <ExerciseRow
                      key={e.key}
                      label={exerciseLabel(bi, ei, b.exercises.length)}
                      exercise={e}
                      onChange={(patch) => updateExercise(b.key, e.key, patch)}
                      onRemove={() => removeExercise(b.key, e.key)}
                    />
                  ))}
                </div>

                <div className="flex flex-wrap items-center gap-2 px-3 py-2">
                  <Button variant="ghost" size="sm" onClick={() => addExercise(b.key)}>
                    + Exercice{b.exercises.length > 0 ? ` (${blockLetter(bi)}${b.exercises.length + 1})` : ""}
                  </Button>
                  <input
                    aria-label={`Notes du bloc ${blockLetter(bi)}`}
                    value={b.notes}
                    onChange={(e) => updateBlock(b.key, { notes: e.target.value })}
                    placeholder="Notes du bloc"
                    className={cn(inputClass, "h-8 min-w-40 flex-1 border-transparent bg-transparent dark:border-transparent dark:bg-transparent")}
                  />
                </div>
              </section>
            ))}

            <Button
              variant="secondary"
              className="w-full border-dashed"
              disabled={blocks.length >= 26}
              onClick={() => (touch(), setBlocks((bs) => [...bs, emptyBlock()]))}
            >
              + Bloc {blockLetter(blocks.length)}
            </Button>
          </div>

          <datalist id="exercise-names">
            {exerciseNames.map((n) => (
              <option key={n} value={n} />
            ))}
          </datalist>

          {/* Duplication */}
          {existing && dupOpen && (
            <div className="flex flex-wrap items-end gap-3 rounded-lg border border-zinc-200 p-3 dark:border-zinc-800">
              <Field label="Dupliquer vers le" htmlFor="dup-date">
                <Input id="dup-date" type="date" value={dupDate} onChange={(e) => setDupDate(e.target.value)} />
              </Field>
              <Field label="Pour" htmlFor="dup-athlete">
                <Select id="dup-athlete" value={dupAthlete} onChange={(e) => setDupAthlete(e.target.value)}>
                  <option value="">Le même coaché</option>
                  {athletes
                    .filter((a) => a.id !== existing.athlete_id)
                    .map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name}
                      </option>
                    ))}
                </Select>
              </Field>
              <Button size="sm" disabled={!dupDate || pending} onClick={duplicate}>
                Dupliquer
              </Button>
              <p className="w-full text-xs text-zinc-500">
                La copie reprend la version enregistrée de la séance (statut « Prévue »).
              </p>
            </div>
          )}
        </div>

        {/* Pied */}
        <div className="space-y-3 border-t border-zinc-200 px-4 py-3 sm:px-6 dark:border-zinc-800">
          {error && <Alert>{error}</Alert>}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex gap-1">
              {existing && (
                <>
                  <Button variant="danger" size="sm" onClick={remove} disabled={pending}>
                    Supprimer
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setDupOpen((o) => !o)} aria-expanded={dupOpen}>
                    Dupliquer…
                  </Button>
                </>
              )}
            </div>
            <div className="flex gap-2">
              <Button variant="secondary" onClick={close}>
                Annuler
              </Button>
              <Button type="submit" disabled={pending}>
                {pending ? "Enregistrement…" : "Enregistrer"}
              </Button>
            </div>
          </div>
        </div>
      </form>
    </dialog>
  );
}

function ExerciseRow({
  label,
  exercise: e,
  onChange,
  onRemove,
}: {
  label: string;
  exercise: ExerciseDraft;
  onChange: (patch: Partial<ExerciseDraft>) => void;
  onRemove: () => void;
}) {
  const small = "h-8 px-2 text-center";
  return (
    <div className="px-3 py-2.5">
      <div className="grid grid-cols-4 gap-2 lg:grid-cols-[2.5rem_minmax(0,3fr)_repeat(4,minmax(0,1fr))_minmax(0,1.6fr)_repeat(3,minmax(0,1fr))_4.5rem] lg:items-end">
        <span className="col-span-1 self-center text-sm font-semibold lg:self-end lg:pb-1.5">{label}</span>
        <div className="col-span-3 lg:col-span-1">
          <MiniLabel>Exercice</MiniLabel>
          <Input
            aria-label={`${label} — exercice`}
            value={e.name}
            onChange={(ev) => onChange({ name: ev.target.value })}
            list="exercise-names"
            placeholder="ex. Wall balls"
            className="h-8"
          />
        </div>
        <Mini label="Séries" value={e.sets} onChange={(v) => onChange({ sets: v })} placeholder="4" numeric className={small} ariaPrefix={label} />
        <Mini label="Reps" value={e.reps} onChange={(v) => onChange({ reps: v })} placeholder="8-10" className={small} ariaPrefix={label} />
        <Mini label="Dist. (m)" value={e.distance} onChange={(v) => onChange({ distance: v })} placeholder="1000" numeric className={small} ariaPrefix={label} />
        <Mini label="Durée" value={e.duration} onChange={(v) => onChange({ duration: v })} placeholder="15'" className={small} ariaPrefix={label} />
        <Mini
          label="Intensité"
          value={e.intensity}
          onChange={(v) => onChange({ intensity: v })}
          placeholder="4'50/km, Z2, RPE 8"
          className="col-span-2 h-8 px-2 lg:col-span-1"
          wrapperClass="col-span-2 lg:col-span-1"
          ariaPrefix={label}
        />
        <Mini label="Charge kg" value={e.load_kg} onChange={(v) => onChange({ load_kg: v })} placeholder="kg" numeric className={small} ariaPrefix={label} />
        <Mini label="% réf." value={e.load_pct} onChange={(v) => onChange({ load_pct: v })} placeholder="%" numeric className={small} ariaPrefix={label} />
        <Mini label="Repos" value={e.rest} onChange={(v) => onChange({ rest: v })} placeholder="1:30" className={small} ariaPrefix={label} />
        <div className="col-span-3 flex items-end justify-end gap-1 lg:col-span-1">
          <Button
            variant="ghost"
            size="sm"
            className={cn("px-1.5", e.showNotes && "text-zinc-900 dark:text-zinc-100")}
            onClick={() => onChange({ showNotes: !e.showNotes })}
            aria-label={`${label} — notes`}
            title="Notes"
          >
            ✎
          </Button>
          <Button variant="danger" size="sm" className="px-1.5" onClick={onRemove} aria-label={`Supprimer ${label}`}>
            ✕
          </Button>
        </div>
      </div>
      {e.showNotes && (
        <Input
          aria-label={`${label} — notes`}
          value={e.notes}
          onChange={(ev) => onChange({ notes: ev.target.value })}
          placeholder="Consigne technique, tempo, variante…"
          className="mt-2 h-8 lg:ml-12 lg:w-[calc(100%-3rem)]"
        />
      )}
    </div>
  );
}

function MiniLabel({ children }: { children: React.ReactNode }) {
  return <span className="mb-0.5 block text-[11px] text-zinc-500">{children}</span>;
}

function Mini({
  label,
  value,
  onChange,
  placeholder,
  numeric,
  className,
  wrapperClass,
  ariaPrefix,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  numeric?: boolean;
  className?: string;
  wrapperClass?: string;
  ariaPrefix: string;
}) {
  return (
    <div className={wrapperClass}>
      <MiniLabel>{label}</MiniLabel>
      <Input
        aria-label={`${ariaPrefix} — ${label}`}
        value={value}
        onChange={(ev) => onChange(ev.target.value)}
        placeholder={placeholder}
        inputMode={numeric ? "decimal" : undefined}
        className={className}
      />
    </div>
  );
}
