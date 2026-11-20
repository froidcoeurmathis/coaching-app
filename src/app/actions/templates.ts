"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireCoach } from "@/lib/auth/session";
import { deleteTemplate, renameTemplate, upsertTemplate } from "@/lib/db/templates";
import type { SaveSessionInput } from "./sessions";

export type TemplateResult = { ok: true; replaced?: boolean } | { ok: false; error: string };

const nameSchema = z.string().trim().min(1, "Donnez un nom au modèle.").max(120, "Nom trop long.");

function message(e: unknown) {
  return e instanceof Error ? e.message : "Erreur inattendue";
}

/** Enregistre le contenu d'une séance (déjà validé côté éditeur) comme modèle. */
export async function saveTemplateAction(
  name: string,
  session: Pick<SaveSessionInput["session"], "title" | "discipline" | "description" | "duration_min">,
  blocks: SaveSessionInput["blocks"],
): Promise<TemplateResult> {
  const parsedName = nameSchema.safeParse(name);
  if (!parsedName.success) return { ok: false, error: parsedName.error.issues[0].message };
  const title = String(session.title ?? "").trim();
  if (!title) return { ok: false, error: "La séance doit avoir un titre." };
  try {
    const coach = await requireCoach();
    const cleanBlocks = blocks
      .map((b) => ({
        title: b.title?.trim() || null,
        rounds: b.rounds ?? null,
        rest_s: b.rest_s ?? null,
        notes: b.notes?.trim() || null,
        exercises: b.exercises
          .filter((e) => e.name.trim())
          .map((e) => ({
            name: e.name.trim(),
            sets: e.sets ?? null,
            reps: e.reps?.trim() || null,
            distance_m: e.distance_m ?? null,
            duration_s: e.duration_s ?? null,
            intensity: e.intensity?.trim() || null,
            load_kg: e.load_kg ?? null,
            load_pct: e.load_pct ?? null,
            rest_s: e.rest_s ?? null,
            notes: e.notes?.trim() || null,
          })),
      }))
      .filter((b) => b.exercises.length || b.title || b.notes);
    const res = await upsertTemplate(coach.id, {
      name: parsedName.data,
      title,
      discipline: session.discipline,
      description: session.description?.trim() || null,
      duration_min: session.duration_min ?? null,
      blocks: cleanBlocks,
    });
    revalidatePath("/templates");
    revalidatePath("/calendar");
    return { ok: true, replaced: res.replaced };
  } catch (e) {
    return { ok: false, error: message(e) };
  }
}

export async function renameTemplateAction(id: string, name: string): Promise<TemplateResult> {
  const parsed = nameSchema.safeParse(name);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  try {
    const coach = await requireCoach();
    await renameTemplate(coach.id, id, parsed.data);
    revalidatePath("/templates");
    revalidatePath("/calendar");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: message(e) };
  }
}

export async function deleteTemplateAction(id: string): Promise<TemplateResult> {
  try {
    const coach = await requireCoach();
    await deleteTemplate(coach.id, id);
    revalidatePath("/templates");
    revalidatePath("/calendar");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: message(e) };
  }
}
