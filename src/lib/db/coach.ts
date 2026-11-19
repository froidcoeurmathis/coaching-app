import "server-only";
import { connection } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import type { Profile } from "./types";

/**
 * Coach courant. Étape 1 (sans authentification) : l'unique profil coach.
 * Étape 2 : le profil lié à l'utilisateur connecté.
 */
export async function getCurrentCoach(): Promise<Profile | null> {
  await connection();
  const { data, error } = await supabaseAdmin()
    .from("profiles")
    .select("*")
    .eq("role", "coach")
    .order("created_at")
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function requireCoach(): Promise<Profile> {
  const coach = await getCurrentCoach();
  if (!coach) throw new Error("Aucun profil coach : créez-le depuis l'accueil.");
  return coach;
}

export async function createCoach(fullName: string, email: string | null): Promise<Profile> {
  const { data, error } = await supabaseAdmin()
    .from("profiles")
    .insert({ role: "coach", full_name: fullName, email })
    .select("*")
    .single();
  if (error) throw error;
  return data;
}
