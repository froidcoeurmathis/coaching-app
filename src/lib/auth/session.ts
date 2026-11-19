import "server-only";
import { cache } from "react";
import { connection } from "next/server";
import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";
import type { Profile, UserRole } from "@/lib/db/types";

/** Page d'accueil selon le rôle. */
export function homeFor(role: UserRole): string {
  return role === "coach" ? "/calendar" : "/me";
}

/** Identifiant de l'utilisateur connecté (null si non connecté). Mis en cache par requête. */
export const getUserId = cache(async (): Promise<string | null> => {
  await connection();
  const supabase = await supabaseServer();
  const { data } = await supabase.auth.getClaims();
  return (data?.claims?.sub as string | undefined) ?? null;
});

/** Profil de l'utilisateur connecté (null si non connecté ou sans profil). */
export const getCurrentProfile = cache(async (): Promise<Profile | null> => {
  const userId = await getUserId();
  if (!userId) return null;
  const supabase = await supabaseServer();
  const { data, error } = await supabase.from("profiles").select("*").eq("user_id", userId).maybeSingle();
  if (error) throw error;
  return data;
});

/** Exige un coach connecté ; redirige sinon (utilisable dans les pages et les Server Actions). */
export async function requireCoach(): Promise<Profile> {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (profile.role !== "coach") redirect(homeFor(profile.role));
  return profile;
}

/** Exige un coaché connecté ; redirige sinon. */
export async function requireAthlete(): Promise<Profile> {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (profile.role !== "athlete") redirect(homeFor(profile.role));
  return profile;
}
