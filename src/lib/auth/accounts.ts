import "server-only";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { supabaseAnonymous } from "@/lib/supabase/server";
import type { Profile } from "@/lib/db/types";

// Opérations de gestion des comptes (clé service_role, côté serveur uniquement).

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
 * Cette adresse a-t-elle le droit de recevoir un lien de connexion ?
 * - un profil existe déjà avec cet e-mail (coach ou coaché) ;
 * - c'est l'adresse du coach définie dans COACH_EMAIL ;
 * - c'est l'e-mail d'une fiche coaché active.
 */
export async function isAllowedEmail(rawEmail: string): Promise<boolean> {
  const email = normalizeEmail(rawEmail);
  if (email === coachEmail()) return true;
  const db = supabaseAdmin();
  const [{ count: profiles }, { count: athletes }] = await Promise.all([
    db.from("profiles").select("id", { count: "exact", head: true }).ilike("email", exact(email)),
    db
      .from("athletes")
      .select("id", { count: "exact", head: true })
      .ilike("email", exact(email))
      .is("archived_at", null),
  ]);
  return (profiles ?? 0) > 0 || (athletes ?? 0) > 0;
}

/** Crée le compte Supabase Auth s'il n'existe pas (e-mail considéré comme vérifié). */
async function ensureAuthUser(email: string) {
  const { error } = await supabaseAdmin().auth.admin.createUser({ email, email_confirm: true });
  if (error && error.code !== "email_exists" && !/already.*registered/i.test(error.message)) {
    throw error;
  }
}

export type SendLinkResult =
  | { ok: true }
  | { ok: false; reason: "recently_sent" | "rate_limited" | "error"; message: string };

/** Envoie un e-mail contenant un lien magique et un code à 6 chiffres. */
export async function sendLoginEmail(rawEmail: string): Promise<SendLinkResult> {
  const email = normalizeEmail(rawEmail);
  await ensureAuthUser(email);
  const { error } = await supabaseAnonymous().auth.signInWithOtp({
    email,
    options: { shouldCreateUser: false },
  });
  if (!error) return { ok: true };
  if (error.status === 429 || error.code === "over_email_send_rate_limit") {
    // « For security purposes, you can only request this after N seconds » : un e-mail
    // vient déjà d'être envoyé à cette adresse (limite par utilisateur), il reste valable.
    const recently = /security purposes/i.test(error.message);
    return { ok: false, reason: recently ? "recently_sent" : "rate_limited", message: error.message };
  }
  console.error("sendLoginEmail", error);
  return { ok: false, reason: "error", message: error.message };
}

/**
 * Rattache l'utilisateur authentifié à son profil, en le créant si besoin.
 * Renvoie null si aucun profil ne peut lui être associé.
 */
export async function claimProfile(user: { id: string; email?: string | null }): Promise<Profile | null> {
  const db = supabaseAdmin();

  const { data: linked, error: e1 } = await db.from("profiles").select("*").eq("user_id", user.id).maybeSingle();
  if (e1) throw e1;
  if (linked) return linked;
  if (!user.email) return null;
  const email = normalizeEmail(user.email);

  // 1. Profil existant (coach ou coaché) avec cet e-mail, pas encore relié.
  const { data: byEmail, error: e2 } = await db
    .from("profiles")
    .select("*")
    .ilike("email", exact(email))
    .is("user_id", null)
    .limit(1)
    .maybeSingle();
  if (e2) throw e2;
  if (byEmail) {
    const { data, error } = await db
      .from("profiles")
      .update({ user_id: user.id, email })
      .eq("id", byEmail.id)
      .select("*")
      .single();
    if (error) throw error;
    return data;
  }

  // 2. Adresse du coach (COACH_EMAIL) : reprend un profil coach sans compte ou en crée un.
  if (email === coachEmail()) {
    const { data: orphan } = await db
      .from("profiles")
      .select("*")
      .eq("role", "coach")
      .is("user_id", null)
      .order("created_at")
      .limit(1)
      .maybeSingle();
    if (orphan) {
      const { data, error } = await db
        .from("profiles")
        .update({ user_id: user.id, email })
        .eq("id", orphan.id)
        .select("*")
        .single();
      if (error) throw error;
      return data;
    }
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

  // 3. Fiche coaché active avec cet e-mail : création du profil coaché et rattachement.
  const { data: athlete, error: e3 } = await db
    .from("athletes")
    .select("id, first_name, last_name")
    .ilike("email", exact(email))
    .is("profile_id", null)
    .is("archived_at", null)
    .order("created_at")
    .limit(1)
    .maybeSingle();
  if (e3) throw e3;
  if (athlete) {
    const { data: profile, error } = await db
      .from("profiles")
      .insert({
        user_id: user.id,
        role: "athlete",
        email,
        full_name: [athlete.first_name, athlete.last_name].filter(Boolean).join(" "),
      })
      .select("*")
      .single();
    if (error) throw error;
    const { error: e4 } = await db.from("athletes").update({ profile_id: profile.id }).eq("id", athlete.id);
    if (e4) throw e4;
    return profile;
  }

  return null;
}

/** Marque l'invitation comme envoyée. */
export async function markInvited(athleteId: string) {
  const { error } = await supabaseAdmin()
    .from("athletes")
    .update({ invited_at: new Date().toISOString() })
    .eq("id", athleteId);
  if (error) throw error;
}
