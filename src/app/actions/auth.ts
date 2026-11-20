"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { supabaseServer } from "@/lib/supabase/server";
import { claimProfile, MIN_PASSWORD_LENGTH, normalizeEmail, redeemInvite } from "@/lib/auth/accounts";
import { getCurrentProfile, homeFor } from "@/lib/auth/session";

export type AuthFormState = { error?: string; ok?: boolean; email?: string };

/** Connexion par e-mail + mot de passe. */
export async function signInAction(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const email = normalizeEmail(String(formData.get("email") ?? ""));
  const password = String(formData.get("password") ?? "");
  if (!z.email().safeParse(email).success) return { email, error: "Adresse e-mail invalide." };
  if (!password) return { email, error: "Saisissez votre mot de passe." };

  const supabase = await supabaseServer();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error || !data.user) {
    if (error?.status === 429) return { email, error: "Trop de tentatives. Patientez quelques minutes." };
    return { email, error: "E-mail ou mot de passe incorrect." };
  }

  const profile = await claimProfile(data.user);
  if (!profile) {
    await supabase.auth.signOut();
    return { email, error: "Aucun espace n'est associé à ce compte. Contactez votre coach." };
  }
  redirect(homeFor(profile.role));
}

export async function signOutAction() {
  const supabase = await supabaseServer();
  await supabase.auth.signOut();
  redirect("/login");
}

/** Changement de son propre mot de passe (page « Mon compte »). */
export async function changePasswordAction(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");
  if (password.length < MIN_PASSWORD_LENGTH) {
    return { error: `Le mot de passe doit contenir au moins ${MIN_PASSWORD_LENGTH} caractères.` };
  }
  if (password !== confirm) return { error: "Les deux mots de passe ne correspondent pas." };

  const supabase = await supabaseServer();
  const { error } = await supabase.auth.updateUser({ password });
  if (error) {
    if (error.code === "same_password") return { error: "Choisissez un mot de passe différent de l'actuel." };
    if (error.code === "weak_password") return { error: "Mot de passe trop faible." };
    console.error("changePasswordAction", error);
    return { error: "Le mot de passe n'a pas pu être modifié." };
  }
  return { ok: true };
}

/** Création du compte depuis un lien d'invitation, puis connexion directe. */
export async function joinAction(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const token = String(formData.get("token") ?? "");
  const email = normalizeEmail(String(formData.get("email") ?? ""));
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");
  if (!z.email().safeParse(email).success) return { email, error: "Adresse e-mail invalide." };
  if (password.length < MIN_PASSWORD_LENGTH) {
    return { email, error: `Le mot de passe doit contenir au moins ${MIN_PASSWORD_LENGTH} caractères.` };
  }
  if (password !== confirm) return { email, error: "Les deux mots de passe ne correspondent pas." };

  const res = await redeemInvite(token, email, password);
  if (!res.ok) return { email, error: res.error };

  const supabase = await supabaseServer();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) redirect("/login");
  redirect("/me");
}
