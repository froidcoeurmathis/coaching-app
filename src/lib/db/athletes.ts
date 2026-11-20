import "server-only";
import { connection } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { todayISO } from "@/lib/format";
import type { Athlete, AthleteDetail, Exercise } from "./types";

export type AthleteInput = Pick<
  Athlete,
  | "first_name"
  | "last_name"
  | "email"
  | "goal"
  | "target_event"
  | "target_date"
  | "vma_kmh"
  | "hr_max"
  | "hr_rest"
  | "notes"
>;

export type AthleteListItem = Athlete & {
  next_session: { scheduled_on: string; title: string } | null;
};

export async function listAthletes(
  coachId: string,
  { archived = false }: { archived?: boolean } = {},
): Promise<AthleteListItem[]> {
  await connection();
  const db = await supabaseServer();
  let query = db
    .from("athletes")
    .select("*")
    .eq("coach_id", coachId)
    .order("first_name");
  query = archived ? query.not("archived_at", "is", null) : query.is("archived_at", null);
  const { data: athletes, error } = await query;
  if (error) throw error;
  if (!athletes.length) return [];

  const today = todayISO();
  const { data: upcoming, error: e2 } = await db
    .from("sessions")
    .select("athlete_id, scheduled_on, title")
    .in("athlete_id", athletes.map((a) => a.id))
    .gte("scheduled_on", today)
    .eq("status", "planned")
    .order("scheduled_on")
    .order("position");
  if (e2) throw e2;

  const next = new Map<string, { scheduled_on: string; title: string }>();
  for (const s of upcoming) {
    if (!next.has(s.athlete_id)) next.set(s.athlete_id, { scheduled_on: s.scheduled_on, title: s.title });
  }
  return athletes.map((a) => ({ ...a, next_session: next.get(a.id) ?? null }));
}

export async function getAthlete(coachId: string, id: string): Promise<AthleteDetail | null> {
  await connection();
  const { data, error } = await (await supabaseServer())
    .from("athletes")
    .select(
      `*,
       paces:athlete_paces(*),
       reference_loads:athlete_reference_loads(*, exercise:exercises(id, name))`,
    )
    .eq("coach_id", coachId)
    .eq("id", id)
    .order("position", { referencedTable: "athlete_paces" })
    .order("created_at", { referencedTable: "athlete_reference_loads" })
    .maybeSingle();
  if (error) {
    if (error.code === "22P02") return null; // id non UUID
    throw error;
  }
  return data;
}

export async function createAthlete(coachId: string, input: AthleteInput): Promise<string> {
  const { data, error } = await (await supabaseServer())
    .from("athletes")
    .insert({ ...input, coach_id: coachId })
    .select("id")
    .single();
  if (error) throw error;
  return data.id;
}

export async function updateAthlete(coachId: string, id: string, input: AthleteInput) {
  const { error } = await (await supabaseServer())
    .from("athletes")
    .update(input)
    .eq("coach_id", coachId)
    .eq("id", id);
  if (error) throw error;
}

export async function setAthleteArchived(coachId: string, id: string, archived: boolean) {
  const { error } = await (await supabaseServer())
    .from("athletes")
    .update({ archived_at: archived ? new Date().toISOString() : null })
    .eq("coach_id", coachId)
    .eq("id", id);
  if (error) throw error;
}

export async function assertOwnsAthlete(coachId: string, athleteId: string) {
  const { data, error } = await (await supabaseServer())
    .from("athletes")
    .select("id")
    .eq("coach_id", coachId)
    .eq("id", athleteId)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("Coaché introuvable");
}

export async function replacePaces(
  coachId: string,
  athleteId: string,
  paces: { label: string; pace_s_per_km: number }[],
) {
  await assertOwnsAthlete(coachId, athleteId);
  const db = await supabaseServer();
  const { error } = await db.from("athlete_paces").delete().eq("athlete_id", athleteId);
  if (error) throw error;
  if (!paces.length) return;
  const { error: e2 } = await db
    .from("athlete_paces")
    .insert(paces.map((p, i) => ({ ...p, athlete_id: athleteId, position: i })));
  if (e2) throw e2;
}

export async function addReferenceLoad(
  coachId: string,
  athleteId: string,
  input: { exercise_name: string; load_kg: number; reps: number; tested_on: string | null },
) {
  await assertOwnsAthlete(coachId, athleteId);
  const db = await supabaseServer();
  const { data: exerciseId, error } = await db.rpc("ensure_exercise", {
    p_coach_id: coachId,
    p_name: input.exercise_name,
    p_discipline: "strength",
  });
  if (error) throw error;
  const { error: e2 } = await db.from("athlete_reference_loads").insert({
    athlete_id: athleteId,
    exercise_id: exerciseId,
    load_kg: input.load_kg,
    reps: input.reps,
    tested_on: input.tested_on,
  });
  if (e2) throw e2;
}

export async function deleteReferenceLoad(coachId: string, athleteId: string, id: string) {
  await assertOwnsAthlete(coachId, athleteId);
  const { error } = await (await supabaseServer())
    .from("athlete_reference_loads")
    .delete()
    .eq("athlete_id", athleteId)
    .eq("id", id);
  if (error) throw error;
}

export async function listExercises(coachId: string): Promise<Exercise[]> {
  await connection();
  const { data, error } = await (await supabaseServer())
    .from("exercises")
    .select("*")
    .eq("coach_id", coachId)
    .order("name");
  if (error) throw error;
  return data;
}

/** Fiche du coaché connecté (RLS : il ne peut lire que la sienne). */
export async function getAthleteForProfile(profileId: string): Promise<Athlete | null> {
  await connection();
  const { data, error } = await (await supabaseServer())
    .from("athletes")
    .select("*")
    .eq("profile_id", profileId)
    .maybeSingle();
  if (error) throw error;
  return data;
}
