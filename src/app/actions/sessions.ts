"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireCoach } from "@/lib/auth/session";
import { assertOwnsAthlete } from "@/lib/db/athletes";
import { parseISO } from "date-fns";
import { copyWeek, deleteSession, getSession, saveSession, toPayload } from "@/lib/db/sessions";
import { weekStartOf } from "@/lib/format";

export type ActionResult = { ok: true; id?: string; count?: number } | { ok: false; error: string };

const nullableInt = (min: number, max: number) => z.number().int().min(min).max(max).nullable();
const nullableText = z
  .string()
  .trim()
  .nullable()
  .transform((v) => (v ? v : null));

const exerciseSchema = z.object({
  name: z.string().trim(),
  sets: nullableInt(1, 100),
  reps: nullableText,
  distance_m: nullableInt(1, 100000),
  duration_s: nullableInt(1, 86400),
  intensity: nullableText,
  load_kg: z.number().min(0).max(1000).nullable(),
  load_pct: z.number().min(0).max(200).nullable(),
  rest_s: nullableInt(0, 3600),
  notes: nullableText,
});

const blockSchema = z.object({
  title: nullableText,
  rounds: nullableInt(1, 100),
  rest_s: nullableInt(0, 3600),
  notes: nullableText,
  exercises: z.array(exerciseSchema).max(50),
});

const sessionSchema = z.object({
  id: z.guid().optional(),
  athlete_id: z.guid({ message: "Choisissez un coaché" }),
  scheduled_on: z.iso.date({ message: "Date invalide" }),
  title: z.string().trim().min(1, "Titre requis").max(120),
  discipline: z.enum(["hyrox", "running", "strength", "other"]),
  description: nullableText,
  duration_min: nullableInt(1, 600),
  status: z.enum(["planned", "done", "skipped"]),
});

const inputSchema = z.object({
  session: sessionSchema,
  blocks: z.array(blockSchema).max(26, "26 blocs maximum (A à Z)"),
});

export type SaveSessionInput = z.input<typeof inputSchema>;

function revalidate() {
  revalidatePath("/calendar");
  revalidatePath("/athletes", "layout");
}

function message(e: unknown): string {
  if (e instanceof Error) return e.message;
  if (e && typeof e === "object" && "message" in e) return String(e.message);
  return "Erreur inattendue";
}

export async function saveSessionAction(input: SaveSessionInput): Promise<ActionResult> {
  const parsed = inputSchema.safeParse(input);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return { ok: false, error: issue?.message ?? "Données invalides" };
  }
  try {
    const coach = await requireCoach();
    const { session, blocks } = parsed.data;
    await assertOwnsAthlete(coach.id, session.athlete_id);
    if (session.id && !(await getSession(coach.id, session.id))) {
      return { ok: false, error: "Séance introuvable" };
    }
    // On ignore les exercices sans nom et les blocs vides.
    const cleanBlocks = blocks
      .map((b) => ({ ...b, exercises: b.exercises.filter((e) => e.name) }))
      .filter((b) => b.exercises.length > 0 || b.title || b.notes);
    const id = await saveSession(session, cleanBlocks);
    revalidate();
    return { ok: true, id };
  } catch (e) {
    return { ok: false, error: message(e) };
  }
}

export async function deleteSessionAction(id: string): Promise<ActionResult> {
  try {
    const coach = await requireCoach();
    if (!(await getSession(coach.id, id))) return { ok: false, error: "Séance introuvable" };
    await deleteSession(id);
    revalidate();
    return { ok: true };
  } catch (e) {
    return { ok: false, error: message(e) };
  }
}

export async function duplicateSessionAction(
  id: string,
  targetDate: string,
  targetAthleteId?: string,
): Promise<ActionResult> {
  if (!z.iso.date().safeParse(targetDate).success) return { ok: false, error: "Date invalide" };
  try {
    const coach = await requireCoach();
    const source = await getSession(coach.id, id);
    if (!source) return { ok: false, error: "Séance introuvable" };
    const { session, blocks } = toPayload(source);
    session.scheduled_on = targetDate;
    if (targetAthleteId) {
      await assertOwnsAthlete(coach.id, targetAthleteId);
      session.athlete_id = targetAthleteId;
    }
    const newId = await saveSession(session, blocks);
    revalidate();
    return { ok: true, id: newId };
  } catch (e) {
    return { ok: false, error: message(e) };
  }
}

export async function copyWeekAction(
  fromWeek: string,
  toWeek: string,
  athleteIds: string[],
  targetAthleteId?: string,
): Promise<ActionResult> {
  const dates = z.object({ from: z.iso.date(), to: z.iso.date(), ids: z.array(z.guid()).min(1).max(50) });
  if (!dates.safeParse({ from: fromWeek, to: toWeek, ids: athleteIds }).success) {
    return { ok: false, error: "Paramètres invalides" };
  }
  const from = weekStartOf(parseISO(fromWeek));
  const to = weekStartOf(parseISO(toWeek));
  if (from === to && !targetAthleteId) return { ok: false, error: "Choisissez une autre semaine." };
  try {
    const coach = await requireCoach();
    for (const id of athleteIds) await assertOwnsAthlete(coach.id, id);
    if (targetAthleteId) await assertOwnsAthlete(coach.id, targetAthleteId);
    const count = await copyWeek(athleteIds, from, to, targetAthleteId);
    if (count === 0) return { ok: false, error: "Aucune séance à copier cette semaine." };
    revalidate();
    return { ok: true, count };
  } catch (e) {
    return { ok: false, error: message(e) };
  }
}
