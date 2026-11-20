// Calcul automatique des cibles à partir des références du coaché :
// - charge en % → kg, d'après la charge de référence du même exercice ;
// - intensité qui cite une allure de référence (« Seuil », « EF »…) → min/km.
import { formatNumber, formatPace } from "./format";

export type RefLoad = { exerciseName: string; load_kg: number; reps: number; tested_on: string | null };
export type RefPace = { label: string; pace_s_per_km: number };
export type AthleteRefs = { loads: RefLoad[]; paces: RefPace[] };

const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim();

/** 1RM estimé (formule d'Epley) à partir d'une charge soulevée `reps` fois. */
export function estimateOneRepMax(loadKg: number, reps: number): number {
  return reps <= 1 ? loadKg : loadKg * (1 + reps / 30);
}

/** Arrondi au 0,5 kg (incréments courants des disques). */
export function roundLoad(kg: number): number {
  return Math.round(kg * 2) / 2;
}

/** Référence la plus récente pour un exercice (comparaison sans casse ni accents). */
export function findRefLoad(exerciseName: string, loads: RefLoad[]): RefLoad | null {
  const key = norm(exerciseName);
  const matches = loads.filter((l) => norm(l.exerciseName) === key);
  if (!matches.length) return null;
  return matches.reduce((best, l) => ((l.tested_on ?? "") > (best.tested_on ?? "") ? l : best));
}

export type LoadTarget = { kg: number; oneRepMax: number; ref: RefLoad };

/** Charge cible en kg pour un pourcentage du 1RM, si une référence existe. */
export function targetLoad(exerciseName: string, loadPct: number | null, loads: RefLoad[]): LoadTarget | null {
  if (loadPct == null || !exerciseName) return null;
  const ref = findRefLoad(exerciseName, loads);
  if (!ref) return null;
  const oneRepMax = estimateOneRepMax(ref.load_kg, ref.reps);
  return { kg: roundLoad((oneRepMax * loadPct) / 100), oneRepMax, ref };
}

/**
 * Allure de référence citée dans le texte d'intensité (« Seuil », « allure EF »…).
 * Ignoré si l'intensité contient déjà une allure chiffrée (ex. « 4'50/km », « 5:00 »).
 */
export function matchPace(intensity: string | null, paces: RefPace[]): RefPace | null {
  if (!intensity || /\d\s*[:'’]\s*\d{2}/.test(intensity) || /\/km/.test(intensity)) return null;
  const text = ` ${norm(intensity)} `;
  const sorted = [...paces].sort((a, b) => b.label.length - a.label.length);
  return (
    sorted.find((p) => {
      const label = norm(p.label).replace(/[()]/g, "");
      return label.length > 1 && new RegExp(`(^|[^a-z0-9])${label.replace(/[.*+?^${}|[\]\\]/g, "\\$&")}([^a-z0-9]|$)`).test(text);
    }) ?? null
  );
}

type ExerciseLike = {
  name: string;
  intensity: string | null;
  load_kg: number | null;
  load_pct: number | null;
};

/** Résumé d'intensité enrichi : « 75 % (≈ 60 kg) · Seuil (≈ 4'50/km) ». */
export function intensityWithTargets(ex: ExerciseLike, refs: AthleteRefs | null | undefined): string {
  const parts: string[] = [];
  if (ex.load_kg != null) parts.push(`${formatNumber(ex.load_kg)} kg`);
  if (ex.load_pct != null) {
    const t = refs && ex.load_kg == null ? targetLoad(ex.name, ex.load_pct, refs.loads) : null;
    parts.push(`${formatNumber(ex.load_pct)} %${t ? ` (≈ ${formatNumber(t.kg)} kg)` : ""}`);
  }
  if (ex.intensity) {
    const p = refs ? matchPace(ex.intensity, refs.paces) : null;
    parts.push(p ? `${ex.intensity} (≈ ${formatPace(p.pace_s_per_km)})` : ex.intensity);
  }
  return parts.join(" · ");
}
