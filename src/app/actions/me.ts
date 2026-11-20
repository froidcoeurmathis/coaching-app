"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAthlete } from "@/lib/auth/session";
import { logSession } from "@/lib/db/sessions";

export type LogResult = { ok: true } | { ok: false; error: string };

const schema = z.object({
  id: z.guid(),
  status: z.enum(["planned", "done", "skipped"]),
  rpe: z.number().int().min(1).max(10).nullable(),
  comment: z
    .string()
    .trim()
    .max(2000, "Commentaire trop long (2000 caractères max).")
    .nullable()
    .transform((v) => (v ? v : null)),
});

/** Le coaché valide (ou dévalide) une séance et donne son ressenti. */
export async function logSessionAction(input: z.input<typeof schema>): Promise<LogResult> {
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Données invalides" };
  await requireAthlete();
  const { id, status, rpe, comment } = parsed.data;
  try {
    await logSession(id, status, status === "planned" ? null : rpe, status === "planned" ? null : comment);
  } catch (e) {
    console.error("logSessionAction", e);
    return { ok: false, error: "Impossible d'enregistrer. Vérifiez votre connexion et réessayez." };
  }
  revalidatePath("/me");
  revalidatePath(`/me/sessions/${id}`);
  revalidatePath("/calendar");
  return { ok: true };
}
