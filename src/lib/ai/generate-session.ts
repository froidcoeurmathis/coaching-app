import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";
import type { AthleteRefs } from "@/lib/targets";
import type { Athlete, Discipline, TemplateBlock } from "@/lib/db/types";
import { formatPace } from "@/lib/format";

/** L'assistant IA n'est actif que si la clé API Anthropic est configurée. */
export function aiEnabled(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

const MODEL = "claude-opus-5-5";

// Schéma de sortie : exactement le format de blocs de l'appli (save_session / modèles).
const ExerciseSchema = z.object({
  name: z.string().describe("Nom de l'exercice, en français, réutiliser les noms de la bibliothèque si possible"),
  sets: z.number().int().nullable().describe("Nombre de séries"),
  reps: z.string().nullable().describe("Répétitions (texte libre : « 8 », « 8-10 », « 10/j », « EMOM 10 min : 10 rép. »)"),
  distance_m: z.number().int().nullable().describe("Distance en mètres"),
  duration_s: z.number().int().nullable().describe("Durée en secondes"),
  intensity: z.string().nullable().describe("Intensité : allure (« 5:00/km »), RIR, RPE, zone… ou nom d'une allure de référence"),
  load_kg: z.number().nullable().describe("Charge en kg"),
  load_pct: z.number().nullable().describe("Charge en % du 1RM, seulement si une charge de référence existe pour cet exercice"),
  rest_s: z.number().int().nullable().describe("Repos après chaque série, en secondes"),
  notes: z.string().nullable().describe("Consigne courte"),
});

const SessionSchema = z.object({
  title: z.string().describe("Titre court de la séance"),
  discipline: z.enum(["hyrox", "running", "strength", "other"]),
  duration_min: z.number().int().nullable().describe("Durée totale estimée en minutes"),
  description: z.string().nullable().describe("Consignes générales : échauffement, objectif, points d'attention"),
  blocks: z
    .array(
      z.object({
        title: z.string().nullable().describe("Titre du bloc (« Échauffement », « Finisher »…)"),
        rounds: z.number().int().nullable().describe("Nombre de tours si le bloc est un circuit / superset"),
        rest_s: z.number().int().nullable().describe("Repos entre les tours, en secondes"),
        notes: z.string().nullable(),
        exercises: z.array(ExerciseSchema).describe("Plusieurs exercices = superset A1, A2…"),
      }),
    )
    .describe("Blocs dans l'ordre (A, B, C…)"),
  coach_note: z.string().describe("Une ou deux phrases pour le coach : ce que tu as fait et pourquoi"),
});

export type GeneratedSession = z.infer<typeof SessionSchema>;

const SYSTEM = `Tu es l'assistant d'un coach sportif spécialisé en Hyrox, course à pied et musculation.
Tu prépares des séances que le coach relira et ajustera avant de les envoyer à son coaché.

Règles :
- Respecte la demande du coach (durée, matériel, focus). Si on te donne une séance existante à adapter, garde sa structure et modifie seulement ce qui est demandé.
- Tiens compte du profil du coaché : objectif, échéance, contraintes et blessures dans les notes, allures et charges de référence, ressenti des dernières séances (RPE élevés, commentaires de fatigue ou de douleur → alléger).
- Utilise de préférence les noms d'allures de référence du coaché dans le champ intensité (ex. « Qualité ») et les % du 1RM uniquement quand une charge de référence existe pour l'exercice.
- Une séance réaliste : échauffement si pertinent, 2 à 7 blocs, volumes cohérents avec la durée.
- Tout en français, concis, sans emoji.`;

export type GenerateInput = {
  request: string;
  date: string;
  athlete: Athlete;
  refs: AthleteRefs | undefined;
  recent: { scheduled_on: string; title: string; status: string; rpe: number | null; athlete_comment: string | null }[];
  current?: {
    title: string;
    discipline: Discipline;
    duration_min: number | null;
    description: string | null;
    blocks: TemplateBlock[];
  } | null;
  exerciseNames: string[];
};

function context(input: GenerateInput): string {
  const a = input.athlete;
  const lines = [
    `Date de la séance : ${input.date}`,
    `Coaché : ${a.first_name}${a.last_name ? ` ${a.last_name}` : ""}`,
    a.goal && `Objectif : ${a.goal}`,
    a.target_event && `Échéance : ${a.target_event}${a.target_date ? ` (${a.target_date})` : ""}`,
    a.vma_kmh && `VMA : ${a.vma_kmh} km/h`,
    a.hr_max && `FC max : ${a.hr_max}`,
    a.notes && `Notes du coach :\n${a.notes}`,
  ];
  if (input.refs?.paces.length) {
    lines.push(`Allures de référence : ${input.refs.paces.map((p) => `${p.label} = ${formatPace(p.pace_s_per_km)}`).join(" ; ")}`);
  }
  if (input.refs?.loads.length) {
    lines.push(
      `Charges de référence : ${input.refs.loads.map((l) => `${l.exerciseName} ${l.load_kg} kg × ${l.reps}`).join(" ; ")}`,
    );
  }
  if (input.recent.length) {
    lines.push(
      "Séances récentes :\n" +
        input.recent
          .map(
            (s) =>
              `- ${s.scheduled_on} ${s.title} : ${s.status === "done" ? "faite" : s.status === "skipped" ? "pas faite" : "prévue"}` +
              (s.rpe != null ? `, RPE ${s.rpe}` : "") +
              (s.athlete_comment ? `, « ${s.athlete_comment} »` : ""),
          )
          .join("\n"),
    );
  }
  if (input.exerciseNames.length) {
    lines.push(`Bibliothèque d'exercices du coach : ${input.exerciseNames.slice(0, 150).join(", ")}`);
  }
  if (input.current && (input.current.title || input.current.blocks.length)) {
    lines.push(`Séance actuelle dans l'éditeur (à adapter si la demande le dit) :\n${JSON.stringify(input.current)}`);
  }
  return lines.filter(Boolean).join("\n\n");
}

export type GenerateResult = { ok: true; session: GeneratedSession } | { ok: false; error: string };

export async function generateSession(input: GenerateInput): Promise<GenerateResult> {
  if (!aiEnabled()) return { ok: false, error: "L'assistant IA n'est pas configuré (clé ANTHROPIC_API_KEY manquante)." };
  const client = new Anthropic();
  try {
    const response = await client.beta.messages.parse({
      model: MODEL,
      max_tokens: 16000,
      // Si le modèle décline une demande, l'API réessaie sur le modèle de repli par défaut.
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: { effort: "medium", format: betaZodOutputFormat(SessionSchema) },
      system: SYSTEM,
      messages: [
        {
          role: "user",
          content: `${context(input)}\n\nDemande du coach :\n${input.request}`,
        },
      ],
    });
    if (response.stop_reason === "refusal") {
      return { ok: false, error: "L'IA n'a pas pu traiter cette demande. Reformulez-la." };
    }
    if (response.stop_reason === "max_tokens" || !response.parsed_output) {
      return { ok: false, error: "La réponse de l'IA est incomplète. Réessayez avec une demande plus simple." };
    }
    return { ok: true, session: response.parsed_output };
  } catch (e) {
    if (e instanceof Anthropic.AuthenticationError) return { ok: false, error: "Clé API Anthropic invalide." };
    if (e instanceof Anthropic.RateLimitError) return { ok: false, error: "Trop de demandes à l'IA, réessayez dans un instant." };
    if (e instanceof Anthropic.APIError) {
      console.error("generateSession", e.status, e.message);
      return { ok: false, error: `Erreur de l'IA (${e.status ?? "réseau"}). Réessayez.` };
    }
    throw e;
  }
}
