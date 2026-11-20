import "server-only";
import { connection } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import type { Discipline, SessionTemplate, TemplateBlock } from "./types";

export async function listTemplates(coachId: string): Promise<SessionTemplate[]> {
  await connection();
  const { data, error } = await (await supabaseServer())
    .from("session_templates")
    .select("*")
    .eq("coach_id", coachId)
    .order("name");
  if (error) throw error;
  return data;
}

export type TemplateInput = {
  name: string;
  title: string;
  discipline: Discipline;
  description: string | null;
  duration_min: number | null;
  blocks: TemplateBlock[];
};

/** Crée un modèle, ou remplace celui qui porte déjà ce nom. */
export async function upsertTemplate(coachId: string, input: TemplateInput): Promise<{ id: string; replaced: boolean }> {
  const db = await supabaseServer();
  const { data: existing, error: e1 } = await db
    .from("session_templates")
    .select("id")
    .eq("coach_id", coachId)
    .ilike("name", input.name.replace(/[\\%_]/g, (c) => `\\${c}`))
    .maybeSingle();
  if (e1) throw e1;
  if (existing) {
    const { error } = await db.from("session_templates").update(input).eq("id", existing.id);
    if (error) throw error;
    return { id: existing.id, replaced: true };
  }
  const { data, error } = await db
    .from("session_templates")
    .insert({ ...input, coach_id: coachId })
    .select("id")
    .single();
  if (error) throw error;
  return { id: data.id, replaced: false };
}

export async function renameTemplate(coachId: string, id: string, name: string) {
  const { error } = await (await supabaseServer())
    .from("session_templates")
    .update({ name })
    .eq("coach_id", coachId)
    .eq("id", id);
  if (error) {
    if (error.code === "23505") throw new Error("Un modèle porte déjà ce nom.");
    throw error;
  }
}

export async function deleteTemplate(coachId: string, id: string) {
  const { error } = await (await supabaseServer())
    .from("session_templates")
    .delete()
    .eq("coach_id", coachId)
    .eq("id", id);
  if (error) throw error;
}
