"use server";

import { addDays, parseISO } from "date-fns";
import { z } from "zod";
import { requireCoach } from "@/lib/auth/session";
import { getAthlete, getAthleteRefs, listExercises } from "@/lib/db/athletes";
import { listSessionsBetween } from "@/lib/db/sessions";
import { toISODate } from "@/lib/format";
import { generateSession, type GeneratedSession } from "@/lib/ai/generate-session";
import type { Discipline, TemplateBlock } from "@/lib/db/types";

const inputSchema = z.object({
  athleteId: z.guid(),
  date: z.iso.date(),
  request: z.string().trim().min(3, "Décrivez la séance souhaitée.").max(2000),
});

/** Génère (ou adapte) une séance avec l'IA ; le coach la relit avant d'enregistrer. */
export async function generateSessionAction(
  input: z.input<typeof inputSchema>,
  current: {
    title: string;
    discipline: Discipline;
    duration_min: number | null;
    description: string | null;
    blocks: TemplateBlock[];
  } | null,
): Promise<{ ok: true; session: GeneratedSession } | { ok: false; error: string }> {
  const parsed = inputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const { athleteId, date, request } = parsed.data;
  const coach = await requireCoach();
  const athlete = await getAthlete(coach.id, athleteId);
  if (!athlete) return { ok: false, error: "Coaché introuvable." };

  const from = toISODate(addDays(parseISO(date), -21));
  const to = toISODate(addDays(parseISO(date), 7));
  const [refs, recent, exercises] = await Promise.all([
    getAthleteRefs([athleteId]),
    listSessionsBetween([athleteId], from, to),
    listExercises(coach.id),
  ]);

  return generateSession({
    request,
    date,
    athlete,
    refs: refs[athleteId],
    recent,
    current,
    exerciseNames: exercises.map((e) => e.name),
  });
}
