"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { supabaseServer } from "@/lib/supabase/server";
import { claimProfile, isAllowedEmail, normalizeEmail, sendLoginEmail } from "@/lib/auth/accounts";
import { homeFor } from "@/lib/auth/session";

export type LoginState = {
  step: "email" | "code";
  email?: string;
  error?: string;
  info?: string;
};

const emailSchema = z.email("Adresse e-mail invalide");

/** Étape 1 : envoi du lien magique + code (réponse identique que l'adresse soit connue ou non). */
export async function sendLoginLinkAction(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const parsed = emailSchema.safeParse(normalizeEmail(String(formData.get("email") ?? "")));
  if (!parsed.success) return { step: "email", error: parsed.error.issues[0].message };
  const email = parsed.data;

  if (await isAllowedEmail(email)) {
    const res = await sendLoginEmail(email);
    if (!res.ok && res.reason === "recently_sent") {
      return {
        step: "code",
        email,
        info: "Un e-mail vient déjà d'être envoyé à cette adresse : utilisez le lien ou le code qu'il contient. Vous pourrez en redemander un dans une minute.",
      };
    }
    if (!res.ok) {
      return {
        step: "email",
        email,
        error:
          res.reason === "rate_limited"
            ? "Trop de demandes d'e-mail. Patientez quelques minutes avant de réessayer."
            : "L'e-mail n'a pas pu être envoyé. Réessayez dans un instant.",
      };
    }
  }
  return {
    step: "code",
    email,
    info: "Si cette adresse est associée à un compte, un e-mail vient d'être envoyé avec un lien de connexion et un code.",
  };
}

/** Étape 2 (alternative au lien) : saisie du code à 6 chiffres. */
export async function verifyLoginCodeAction(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const email = normalizeEmail(String(formData.get("email") ?? ""));
  const token = String(formData.get("code") ?? "").replace(/\s/g, "");
  if (!/^\d{6}$/.test(token)) return { step: "code", email, error: "Le code contient 6 chiffres." };

  const supabase = await supabaseServer();
  const { data, error } = await supabase.auth.verifyOtp({ email, token, type: "email" });
  if (error || !data.user) return { step: "code", email, error: "Code invalide ou expiré." };

  const profile = await claimProfile(data.user);
  if (!profile) {
    await supabase.auth.signOut();
    return { step: "email", error: "Aucun espace n'est associé à cette adresse. Contactez votre coach." };
  }
  redirect(homeFor(profile.role));
}

export async function signOutAction() {
  const supabase = await supabaseServer();
  await supabase.auth.signOut();
  redirect("/login");
}
