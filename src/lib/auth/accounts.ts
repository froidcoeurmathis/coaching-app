import "server-only";
import { supabaseAdmin } from "@/lib/supabase/admin";
import type { Profile } from "@/lib/db/types";

// Gestion des comptes (clé service_role, côté serveur uniquement).

export const MIN_PASSWORD_LENGTH = 8;

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/** Échappe les jokers de ILIKE pour une comparaison exacte insensible à la casse. */
function exact(email: string): string {
  return email.replace(/[\\%_]/g, (c) => `\\${c}`);
}

function coachEmail(): string | null {
  const v = process.env.COACH_EMAIL;
  return v ? normalizeEmail(v) : null;
}

/**
 * Rattache l'utilisateur authentifié à son profil s'il ne l'est pas encore.
 * - profil existant (coach ou coaché) avec cet e-mail ;
 * - adresse COACH_EMAIL : reprend le profil coach sans compte, ou en crée un ;
 * - fiche coaché active avec cet e-mail : crée son profil coaché.
 * Renvoie null si aucun profil ne peut lui être associé.
 */
export async function claimProfile(user: { id: string; email?: string | null }): Promise<Profile | null> {
  const db = supabaseAdmin();

  const { data: linked, error: e1 } = await db.from("profiles").select("*").eq("user_id", user.id).maybeSingle();
  if (e1) throw e1;
  if (linked) return linked;
  if (!user.email) return null;
  const email = normalizeEmail(user.email);

  const { data: byEmail, error: e2 } = await db
    .from("profiles")
    .select("*")
    .ilike("email", exact(email))
    .is("user_id", null)
    .limit(1)
    .maybeSingle();
  if (e2) throw e2;
  if (byEmail) return linkProfile(byEmail.id, user.id, email);

  if (email === coachEmail()) {
    const { data: orphan } = await db
      .from("profiles")
      .select("id")
      .eq("role", "coach")
      .is("user_id", null)
      .order("created_at")
      .limit(1)
      .maybeSingle();
    if (orphan) return linkProfile(orphan.id, user.id, email);
    const { data, error } = await db
      .from("profiles")
      .insert({
        user_id: user.id,
        role: "coach",
        email,
        full_name: process.env.COACH_NAME?.trim() || email.split("@")[0],
      })
      .select("*")
      .single();
    if (error) throw error;
    return data;
  }

  const { data: athlete, error: e3 } = await db
    .from("athletes")
    .select("id")
    .ilike("email", exact(email))
    .is("profile_id", null)
    .is("archived_at", null)
    .order("created_at")
    .limit(1)
    .maybeSingle();
  if (e3) throw e3;
  if (athlete) return createAthleteProfile(athlete.id, user.id, email);

  return null;
}

async function linkProfile(profileId: string, userId: string, email: string): Promise<Profile> {
  const { data, error } = await supabaseAdmin()
    .from("profiles")
    .update({ user_id: userId, email })
    .eq("id", profileId)
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

async function createAthleteProfile(athleteId: string, userId: string, email: string): Promise<Profile> {
  const db = supabaseAdmin();
  const { data: athlete, error: e0 } = await db
    .from("athletes")
    .select("first_name, last_name")
    .eq("id", athleteId)
    .single();
  if (e0) throw e0;
  const { data: profile, error } = await db
    .from("profiles")
    .insert({
      user_id: userId,
      role: "athlete",
      email,
      full_name: [athlete.first_name, athlete.last_name].filter(Boolean).join(" "),
    })
    .select("*")
    .single();
  if (error) throw error;
  const { error: e2 } = await db.from("athletes").update({ profile_id: profile.id }).eq("id", athleteId);
  if (e2) throw e2;
  return profile;
}

export type AccountResult = { ok: true } | { ok: false; error: string };

/**
 * Crée l'accès d'un coaché (e-mail + mot de passe choisi par le coach) et le relie à sa fiche.
 * L'appelant doit avoir vérifié que la fiche appartient au coach connecté.
 */
export async function createAthleteAccess(
  athlete: { id: string; email: string },
  password: string,
): Promise<AccountResult> {
  const email = normalizeEmail(athlete.email);
  const db = supabaseAdmin();

  const { data: taken } = await db.from("profiles").select("id").ilike("email", exact(email)).maybeSingle();
  if (taken) return { ok: false, error: "Cette adresse est déjà utilisée par un autre compte." };

  const { data, error } = await db.auth.admin.createUser({ email, password, email_confirm: true });
  if (error) {
    if (error.code === "email_exists") {
      return { ok: false, error: "Un compte existe déjà avec cette adresse (sans fiche associée). Contactez le support." };
    }
    if (error.code === "weak_password") return { ok: false, error: "Mot de passe trop faible." };
    throw error;
  }
  try {
    await createAthleteProfile(athlete.id, data.user.id, email);
  } catch (e) {
    await db.auth.admin.deleteUser(data.user.id); // pas de compte orphelin
    throw e;
  }
  return { ok: true };
}

/** Change le mot de passe du compte relié à un profil (réinitialisation par le coach). */
export async function setPasswordForProfile(profileId: string, password: string): Promise<AccountResult> {
  const db = supabaseAdmin();
  const { data: profile, error } = await db.from("profiles").select("user_id").eq("id", profileId).single();
  if (error) throw error;
  if (!profile.user_id) return { ok: false, error: "Ce coaché n'a pas encore de compte." };
  const { error: e2 } = await db.auth.admin.updateUserById(profile.user_id, { password });
  if (e2) {
    if (e2.code === "weak_password") return { ok: false, error: "Mot de passe trop faible." };
    throw e2;
  }
  return { ok: true };
}
