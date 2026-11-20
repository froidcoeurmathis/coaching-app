"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireCoach } from "@/lib/auth/session";
import { headers } from "next/headers";
import {
  createAthleteAccess,
  createInviteToken,
  MIN_PASSWORD_LENGTH,
  normalizeEmail,
  setPasswordForProfile,
} from "@/lib/auth/accounts";
import {
  addReferenceLoad,
  getAthlete,
  createAthlete,
  deleteReferenceLoad,
  replacePaces,
  setAthleteArchived,
  updateAthlete,
} from "@/lib/db/athletes";
import { parsePace } from "@/lib/format";

export type FormState = { ok?: boolean; error?: string; fieldErrors?: Record<string, string> };

const optionalText = z
  .string()
  .trim()
  .transform((v) => (v === "" ? null : v))
  .nullable();

const optionalNumber = (min: number, max: number, label: string) =>
  z
    .string()
    .trim()
    .transform((v) => (v === "" ? null : Number(v.replace(",", "."))))
    .refine((v) => v === null || (!Number.isNaN(v) && v >= min && v <= max), {
      message: `${label} : entre ${min} et ${max}`,
    });

function fieldErrors(error: z.ZodError): FormState {
  const out: Record<string, string> = {};
  for (const issue of error.issues) out[String(issue.path[0])] ??= issue.message;
  return { error: "Certains champs sont invalides.", fieldErrors: out };
}

function str(formData: FormData, key: string): string {
  const v = formData.get(key);
  return typeof v === "string" ? v : "";
}

// ---------------------------------------------------------------------------
// Fiche coaché
// ---------------------------------------------------------------------------

const athleteSchema = z
  .object({
    first_name: z.string().trim().min(1, "Prénom requis"),
    last_name: optionalText,
    email: z
      .string()
      .trim()
      .transform((v) => (v === "" ? null : normalizeEmail(v)))
      .pipe(z.email("E-mail invalide").nullable()),
    goal: optionalText,
    target_event: optionalText,
    target_date: z
      .string()
      .transform((v) => (v === "" ? null : v))
      .pipe(z.iso.date("Date invalide").nullable()),
    vma_kmh: optionalNumber(5, 30, "VMA"),
    hr_max: optionalNumber(100, 240, "FC max"),
    hr_rest: optionalNumber(25, 120, "FC repos"),
    notes: optionalText,
  })
  .refine((a) => a.hr_max == null || a.hr_rest == null || a.hr_rest < a.hr_max, {
    message: "La FC repos doit être inférieure à la FC max",
    path: ["hr_rest"],
  });

export async function saveAthleteAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const coach = await requireCoach();
  const id = str(formData, "id");
  const keys = [
    "first_name", "last_name", "email", "goal", "target_event",
    "target_date", "vma_kmh", "hr_max", "hr_rest", "notes",
  ] as const;
  const parsed = athleteSchema.safeParse(Object.fromEntries(keys.map((k) => [k, str(formData, k)])));
  if (!parsed.success) return fieldErrors(parsed.error);

  const input = {
    ...parsed.data,
    hr_max: parsed.data.hr_max == null ? null : Math.round(parsed.data.hr_max),
    hr_rest: parsed.data.hr_rest == null ? null : Math.round(parsed.data.hr_rest),
  };

  if (id) {
    await updateAthlete(coach.id, id, input);
    revalidatePath("/athletes");
    revalidatePath(`/athletes/${id}`);
    revalidatePath("/calendar");
    return { ok: true };
  }
  const newId = await createAthlete(coach.id, input);
  revalidatePath("/athletes");
  revalidatePath("/calendar");
  redirect(`/athletes/${newId}`);
}

export async function setArchivedAction(id: string, archived: boolean) {
  const coach = await requireCoach();
  await setAthleteArchived(coach.id, id, archived);
  revalidatePath("/athletes");
  revalidatePath(`/athletes/${id}`);
  revalidatePath("/calendar");
}

// ---------------------------------------------------------------------------
// Allures
// ---------------------------------------------------------------------------

export async function savePacesAction(
  athleteId: string,
  paces: { label: string; pace: string }[],
): Promise<FormState> {
  const coach = await requireCoach();
  const clean: { label: string; pace_s_per_km: number }[] = [];
  for (const [i, p] of paces.entries()) {
    const label = p.label.trim();
    if (!label && !p.pace.trim()) continue;
    if (!label) return { error: `Ligne ${i + 1} : nom de l'allure manquant.` };
    const s = parsePace(p.pace);
    if (s === null || s < 120 || s > 1200) {
      return { error: `« ${label} » : allure invalide (format attendu 4:50 ou 4'50).` };
    }
    clean.push({ label, pace_s_per_km: s });
  }
  await replacePaces(coach.id, athleteId, clean);
  revalidatePath(`/athletes/${athleteId}`);
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Charges de référence
// ---------------------------------------------------------------------------

export async function addReferenceLoadAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const coach = await requireCoach();
  const parsed = z
    .object({
      athlete_id: z.guid(),
      exercise_name: z.string().trim().min(1, "Exercice requis"),
      load_kg: optionalNumber(0, 1000, "Charge").refine((v) => v !== null, "Charge requise"),
      reps: optionalNumber(1, 50, "Répétitions"),
      tested_on: z
        .string()
        .transform((v) => (v === "" ? null : v))
        .pipe(z.iso.date("Date invalide").nullable()),
    })
    .safeParse({
      athlete_id: str(formData, "athlete_id"),
      exercise_name: str(formData, "exercise_name"),
      load_kg: str(formData, "load_kg"),
      reps: str(formData, "reps"),
      tested_on: str(formData, "tested_on"),
    });
  if (!parsed.success) return fieldErrors(parsed.error);
  const d = parsed.data;
  await addReferenceLoad(coach.id, d.athlete_id, {
    exercise_name: d.exercise_name,
    load_kg: d.load_kg!,
    reps: d.reps == null ? 1 : Math.round(d.reps),
    tested_on: d.tested_on,
  });
  revalidatePath(`/athletes/${d.athlete_id}`);
  return { ok: true };
}

export async function deleteReferenceLoadAction(athleteId: string, id: string) {
  const coach = await requireCoach();
  await deleteReferenceLoad(coach.id, athleteId, id);
  revalidatePath(`/athletes/${athleteId}`);
}

// ---------------------------------------------------------------------------
// Accès à l'application : le coach crée le compte du coaché (e-mail + mot de
// passe qu'il lui transmet) ou réinitialise son mot de passe.
// ---------------------------------------------------------------------------

export async function setAthletePasswordAction(athleteId: string, password: string): Promise<FormState> {
  const coach = await requireCoach();
  if (password.length < MIN_PASSWORD_LENGTH) {
    return { error: `Le mot de passe doit contenir au moins ${MIN_PASSWORD_LENGTH} caractères.` };
  }
  const athlete = await getAthlete(coach.id, athleteId); // RLS : uniquement ses coachés
  if (!athlete) return { error: "Coaché introuvable." };

  const res = athlete.profile_id
    ? await setPasswordForProfile(athlete.profile_id, password)
    : athlete.email
      ? await createAthleteAccess({ id: athlete.id, email: athlete.email }, password)
      : { ok: false as const, error: "Renseignez d'abord l'e-mail du coaché dans son profil." };
  if (!res.ok) return { error: res.error };
  revalidatePath(`/athletes/${athleteId}`);
  return { ok: true };
}

/** Génère un lien d'invitation : le coaché y crée lui-même son compte (e-mail + mot de passe). */
export async function createInviteLinkAction(athleteId: string): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  const coach = await requireCoach();
  const athlete = await getAthlete(coach.id, athleteId); // RLS : uniquement ses coachés
  if (!athlete) return { ok: false, error: "Coaché introuvable." };
  if (athlete.profile_id) return { ok: false, error: "Ce coaché a déjà un compte." };
  if (athlete.archived_at) return { ok: false, error: "Ce coaché est archivé." };
  const token = await createInviteToken(athlete.id);
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? (host?.startsWith("localhost") ? "http" : "https");
  revalidatePath(`/athletes/${athleteId}`);
  return { ok: true, url: `${proto}://${host}/join/${token}` };
}
