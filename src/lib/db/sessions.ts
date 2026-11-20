import "server-only";
import { connection } from "next/server";
import { addDays, parseISO } from "date-fns";
import { supabaseServer } from "@/lib/supabase/server";
import { toISODate } from "@/lib/format";
import type { SessionStatus, SessionWithBlocks } from "./types";

const SESSION_SELECT = `*,
  blocks:session_blocks(*,
    exercises:block_exercises(*, exercise:exercises(id, name))
  )`;

function sortBlocks(s: SessionWithBlocks): SessionWithBlocks {
  s.blocks.sort((a, b) => a.position - b.position);
  for (const b of s.blocks) b.exercises.sort((x, y) => x.position - y.position);
  return s;
}

/** Séances de la semaine pour une liste de coachés (déjà filtrés sur le coach). */
export async function listWeekSessions(
  athleteIds: string[],
  weekStart: string,
): Promise<SessionWithBlocks[]> {
  await connection();
  if (!athleteIds.length) return [];
  const weekEnd = toISODate(addDays(parseISO(weekStart), 6));
  const { data, error } = await (await supabaseServer())
    .from("sessions")
    .select(SESSION_SELECT)
    .in("athlete_id", athleteIds)
    .gte("scheduled_on", weekStart)
    .lte("scheduled_on", weekEnd)
    .order("scheduled_on")
    .order("position");
  if (error) throw error;
  return (data as SessionWithBlocks[]).map(sortBlocks);
}

export async function getSession(coachId: string, id: string): Promise<SessionWithBlocks | null> {
  const { data, error } = await (await supabaseServer())
    .from("sessions")
    .select(`${SESSION_SELECT}, athlete:athletes!inner(coach_id)`)
    .eq("id", id)
    .eq("athlete.coach_id", coachId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const session = data as SessionWithBlocks & { athlete?: unknown };
  delete session.athlete;
  return sortBlocks(session);
}

export type SessionPayload = {
  id?: string;
  athlete_id: string;
  scheduled_on: string;
  title: string;
  discipline: string;
  description: string | null;
  duration_min: number | null;
  status: SessionStatus;
};

export type BlockPayload = {
  title: string | null;
  rounds: number | null;
  rest_s: number | null;
  notes: string | null;
  exercises: {
    name: string;
    sets: number | null;
    reps: string | null;
    distance_m: number | null;
    duration_s: number | null;
    intensity: string | null;
    load_kg: number | null;
    load_pct: number | null;
    rest_s: number | null;
    notes: string | null;
  }[];
};

/** Crée ou met à jour une séance et ses blocs (transaction côté SQL). */
export async function saveSession(session: SessionPayload, blocks: BlockPayload[]): Promise<string> {
  const { data, error } = await (await supabaseServer()).rpc("save_session", {
    p_session: session,
    p_blocks: blocks,
  });
  if (error) throw error;
  return data as string;
}

export async function deleteSession(id: string) {
  const { error } = await (await supabaseServer()).from("sessions").delete().eq("id", id);
  if (error) throw error;
}

/** Convertit une séance existante en payload (pour duplication). */
export function toPayload(s: SessionWithBlocks): { session: SessionPayload; blocks: BlockPayload[] } {
  return {
    session: {
      athlete_id: s.athlete_id,
      scheduled_on: s.scheduled_on,
      title: s.title,
      discipline: s.discipline,
      description: s.description,
      duration_min: s.duration_min,
      status: "planned",
    },
    blocks: s.blocks.map((b) => ({
      title: b.title,
      rounds: b.rounds,
      rest_s: b.rest_s,
      notes: b.notes,
      exercises: b.exercises.map((e) => ({
        name: e.exercise.name,
        sets: e.sets,
        reps: e.reps,
        distance_m: e.distance_m,
        duration_s: e.duration_s,
        intensity: e.intensity,
        load_kg: e.load_kg,
        load_pct: e.load_pct,
        rest_s: e.rest_s,
        notes: e.notes,
      })),
    })),
  };
}

/** Séance lue avec les droits de l'utilisateur (RLS : le coaché ne lit que les siennes). */
export async function getOwnSession(id: string): Promise<SessionWithBlocks | null> {
  await connection();
  const { data, error } = await (await supabaseServer())
    .from("sessions")
    .select(SESSION_SELECT)
    .eq("id", id)
    .maybeSingle();
  if (error) {
    if (error.code === "22P02") return null; // id non UUID
    throw error;
  }
  return data ? sortBlocks(data as SessionWithBlocks) : null;
}

/** Validation d'une séance par le coaché (fonction SQL log_session). */
export async function logSession(
  id: string,
  status: SessionStatus,
  rpe: number | null,
  comment: string | null,
) {
  const { error } = await (await supabaseServer()).rpc("log_session", {
    p_session_id: id,
    p_status: status,
    p_rpe: rpe,
    p_comment: comment,
  });
  if (error) throw error;
}
