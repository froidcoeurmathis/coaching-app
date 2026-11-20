// Types métier correspondant au schéma SQL (supabase/migrations).

export type UserRole = "coach" | "athlete";
export type Discipline = "hyrox" | "running" | "strength" | "other";
export type SessionStatus = "planned" | "done" | "skipped";

export type Profile = {
  id: string;
  user_id: string | null;
  role: UserRole;
  full_name: string;
  email: string | null;
  created_at: string;
  updated_at: string;
};

export type Athlete = {
  id: string;
  coach_id: string;
  profile_id: string | null;
  first_name: string;
  last_name: string | null;
  email: string | null;
  goal: string | null;
  target_event: string | null;
  target_date: string | null;
  vma_kmh: number | null;
  hr_max: number | null;
  hr_rest: number | null;
  notes: string | null;
  archived_at: string | null;
  invited_at: string | null;
  created_at: string;
  updated_at: string;
};

export type AthletePace = {
  id: string;
  athlete_id: string;
  position: number;
  label: string;
  pace_s_per_km: number;
  notes: string | null;
};

export type Exercise = {
  id: string;
  coach_id: string;
  name: string;
  discipline: Discipline;
  notes: string | null;
};

export type ReferenceLoad = {
  id: string;
  athlete_id: string;
  exercise_id: string;
  load_kg: number;
  reps: number;
  tested_on: string | null;
  notes: string | null;
  exercise: Pick<Exercise, "id" | "name">;
};

export type BlockExercise = {
  id: string;
  block_id: string;
  position: number;
  exercise_id: string;
  sets: number | null;
  reps: string | null;
  distance_m: number | null;
  duration_s: number | null;
  intensity: string | null;
  load_kg: number | null;
  load_pct: number | null;
  rest_s: number | null;
  notes: string | null;
  exercise: Pick<Exercise, "id" | "name">;
};

export type SessionBlock = {
  id: string;
  session_id: string;
  position: number;
  title: string | null;
  rounds: number | null;
  rest_s: number | null;
  notes: string | null;
  exercises: BlockExercise[];
};

export type Session = {
  id: string;
  athlete_id: string;
  scheduled_on: string;
  position: number;
  title: string;
  discipline: Discipline;
  description: string | null;
  duration_min: number | null;
  status: SessionStatus;
  completed_at: string | null;
  rpe: number | null;
  athlete_comment: string | null;
  feedback_at: string | null;
};

export type SessionWithBlocks = Session & { blocks: SessionBlock[] };

export type AthleteDetail = Athlete & {
  paces: AthletePace[];
  reference_loads: ReferenceLoad[];
};

export type SessionTemplate = {
  id: string;
  coach_id: string;
  name: string;
  title: string;
  discipline: Discipline;
  description: string | null;
  duration_min: number | null;
  blocks: TemplateBlock[];
  created_at: string;
  updated_at: string;
};

/** Bloc de modèle : même format que le paramètre p_blocks de save_session. */
export type TemplateBlock = {
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
