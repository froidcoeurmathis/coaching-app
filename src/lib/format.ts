import { addDays, format, isValid, parseISO, startOfWeek } from "date-fns";
import { fr } from "date-fns/locale";
import type { BlockExercise, Discipline, SessionStatus } from "./db/types";

// ---------------------------------------------------------------------------
// Semaine (lundi → dimanche)
// ---------------------------------------------------------------------------

/** Lundi de la semaine contenant `date`, au format yyyy-MM-dd. */
export function weekStartOf(date: Date): string {
  return toISODate(startOfWeek(date, { weekStartsOn: 1 }));
}

export const TIME_ZONE = "Europe/Paris";

/** Date du jour à Paris (yyyy-MM-dd), identique côté serveur (UTC sur Vercel) et navigateur. */
export function todayISO(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TIME_ZONE }).format(new Date());
}

/** Lundi de la semaine en cours (heure de Paris). */
export function currentWeekStart(): string {
  return weekStartOf(parseISO(todayISO()));
}

/** Lit un paramètre ?week= et renvoie le lundi correspondant (semaine courante par défaut). */
export function parseWeekParam(value: string | undefined): string {
  if (value) {
    const d = parseISO(value);
    if (isValid(d)) return weekStartOf(d);
  }
  return currentWeekStart();
}

/** Date et heure de Paris d'un horodatage, ex. « 20 nov. à 18:42 ». */
export function formatDateTime(timestamp: string): string {
  const d = new Date(timestamp);
  const day = new Intl.DateTimeFormat("fr-FR", { timeZone: TIME_ZONE, day: "numeric", month: "short" }).format(d);
  return `${day} à ${formatTime(timestamp)}`;
}

/** Heure de Paris d'un horodatage, ex. « 18:42 ». */
export function formatTime(timestamp: string): string {
  return new Intl.DateTimeFormat("fr-FR", { timeZone: TIME_ZONE, hour: "2-digit", minute: "2-digit" }).format(
    new Date(timestamp),
  );
}

export function toISODate(date: Date): string {
  return format(date, "yyyy-MM-dd");
}

export function weekDays(weekStart: string): string[] {
  const start = parseISO(weekStart);
  return Array.from({ length: 7 }, (_, i) => toISODate(addDays(start, i)));
}

export function shiftWeek(weekStart: string, weeks: number): string {
  return toISODate(addDays(parseISO(weekStart), weeks * 7));
}

export function formatDay(iso: string, pattern = "EEE d"): string {
  return format(parseISO(iso), pattern, { locale: fr });
}

/** Comme formatDay, avec une majuscule initiale : « Mercredi 18 novembre ». */
export function formatDayTitle(iso: string, pattern = "EEEE d MMMM"): string {
  const s = formatDay(iso, pattern);
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function formatWeekRange(weekStart: string): string {
  const start = parseISO(weekStart);
  const end = addDays(start, 6);
  const sameMonth = start.getMonth() === end.getMonth();
  return sameMonth
    ? `${format(start, "d", { locale: fr })} – ${format(end, "d MMMM yyyy", { locale: fr })}`
    : `${format(start, "d MMM", { locale: fr })} – ${format(end, "d MMM yyyy", { locale: fr })}`;
}

// ---------------------------------------------------------------------------
// Lettres de blocs : A, B, C… et A1, A2 pour les supersets
// ---------------------------------------------------------------------------

export function blockLetter(blockIndex: number): string {
  return String.fromCharCode(65 + blockIndex);
}

export function exerciseLabel(blockIndex: number, exerciseIndex: number, count: number): string {
  return count > 1 ? `${blockLetter(blockIndex)}${exerciseIndex + 1}` : blockLetter(blockIndex);
}

// ---------------------------------------------------------------------------
// Allures et durées
// ---------------------------------------------------------------------------

/** 290 → « 4'50/km » */
export function formatPace(secondsPerKm: number): string {
  const m = Math.floor(secondsPerKm / 60);
  const s = Math.round(secondsPerKm % 60);
  return `${m}'${String(s).padStart(2, "0")}/km`;
}

/** « 4:50 », « 4'50 », « 4'50" », « 4m50 » → 290. Renvoie null si invalide. */
export function parsePace(input: string): number | null {
  const m = input.trim().match(/^(\d{1,2})\s*[:'’m]\s*(\d{1,2})\s*(?:["”s]|\/km)?$/i);
  if (!m) return null;
  const sec = Number(m[2]);
  if (sec >= 60) return null;
  return Number(m[1]) * 60 + sec;
}

/** Vitesse en km/h pour une allure en s/km. */
export function paceToSpeed(secondsPerKm: number): string {
  return (3600 / secondsPerKm).toFixed(1).replace(".", ",");
}

/**
 * Durée saisie librement → secondes.
 * « 1:30 », « 1'30 » → 90 · « 90s » → 90 · « 15min », « 15' » → 900 · « 1h05 » → 3900
 * Un nombre seul est interprété dans `bareUnit` (secondes pour un repos, minutes pour une durée).
 */
export function parseDuration(input: string, bareUnit: "s" | "min" = "s"): number | null {
  const v = input.trim().toLowerCase().replace(",", ".");
  if (!v) return null;
  let m: RegExpMatchArray | null;
  if ((m = v.match(/^(\d+(?:\.\d+)?)$/))) {
    return Math.round(Number(m[1]) * (bareUnit === "min" ? 60 : 1));
  }
  if ((m = v.match(/^(\d+)\s*h\s*(\d{1,2})?\s*(?:min)?$/))) {
    return Number(m[1]) * 3600 + Number(m[2] ?? 0) * 60;
  }
  if ((m = v.match(/^(\d+)\s*(?::|'|’|min|mn|m)\s*(\d{1,2})?\s*(?:s|"|”)?$/))) {
    const sec = Number(m[2] ?? 0);
    if (sec >= 60) return null;
    return Number(m[1]) * 60 + sec;
  }
  if ((m = v.match(/^(\d+)\s*(?:s|sec|"|”)$/))) {
    return Number(m[1]);
  }
  return null;
}

/** 90 → « 1'30 » · 900 → « 15' » · 45 → « 45" » · 3900 → « 1h05 » */
export function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}"`;
  if (seconds >= 3600) {
    const h = Math.floor(seconds / 3600);
    const min = Math.round((seconds % 3600) / 60);
    return `${h}h${String(min).padStart(2, "0")}`;
  }
  const min = Math.floor(seconds / 60);
  const sec = seconds % 60;
  return sec ? `${min}'${String(sec).padStart(2, "0")}` : `${min}'`;
}

/** Valeur à afficher dans un champ de saisie de durée. */
export function durationInput(seconds: number | null | undefined): string {
  if (seconds == null) return "";
  if (seconds < 60) return String(seconds);
  const min = Math.floor(seconds / 60);
  const sec = seconds % 60;
  return sec ? `${min}:${String(sec).padStart(2, "0")}` : `${min}:00`;
}

export function formatDistance(meters: number): string {
  return meters >= 1000 && meters % 100 === 0
    ? `${(meters / 1000).toString().replace(".", ",")} km`
    : `${meters} m`;
}

export function formatNumber(n: number): string {
  return n.toString().replace(".", ",");
}

// ---------------------------------------------------------------------------
// Résumés d'exercice
// ---------------------------------------------------------------------------

type ExerciseSummaryInput = Pick<
  BlockExercise,
  "sets" | "reps" | "distance_m" | "duration_s" | "intensity" | "load_kg" | "load_pct" | "rest_s"
>;

/** « 5 × 1000 m » / « 4 × 5 » / « 15' » */
export function volumeSummary(ex: ExerciseSummaryInput): string {
  const work =
    ex.reps ?? (ex.distance_m ? formatDistance(ex.distance_m) : null) ??
    (ex.duration_s ? formatDuration(ex.duration_s) : null);
  const extra =
    ex.reps && ex.distance_m ? ` · ${formatDistance(ex.distance_m)}` :
    (ex.reps || ex.distance_m) && ex.duration_s ? ` · ${formatDuration(ex.duration_s)}` : "";
  if (ex.sets && work) return `${ex.sets} × ${work}${extra}`;
  if (ex.sets) return `${ex.sets} séries`;
  return work ? `${work}${extra}` : "";
}

/** « 75 % · 60 kg · RPE 8 » */
export function intensitySummary(ex: ExerciseSummaryInput): string {
  return [
    ex.load_kg != null ? `${formatNumber(ex.load_kg)} kg` : null,
    ex.load_pct != null ? `${formatNumber(ex.load_pct)} %` : null,
    ex.intensity,
  ]
    .filter(Boolean)
    .join(" · ");
}

// ---------------------------------------------------------------------------
// Libellés
// ---------------------------------------------------------------------------

export const DISCIPLINES: { value: Discipline; label: string }[] = [
  { value: "hyrox", label: "Hyrox" },
  { value: "running", label: "Course" },
  { value: "strength", label: "Muscu" },
  { value: "other", label: "Autre" },
];

export const DISCIPLINE_LABEL: Record<Discipline, string> = Object.fromEntries(
  DISCIPLINES.map((d) => [d.value, d.label]),
) as Record<Discipline, string>;

export const DISCIPLINE_STYLE: Record<Discipline, string> = {
  hyrox: "border-l-amber-500 bg-amber-50 dark:bg-amber-950/40",
  running: "border-l-sky-500 bg-sky-50 dark:bg-sky-950/40",
  strength: "border-l-violet-500 bg-violet-50 dark:bg-violet-950/40",
  other: "border-l-zinc-400 bg-zinc-50 dark:bg-zinc-800/60",
};

export const STATUS_LABEL: Record<SessionStatus, string> = {
  planned: "Prévue",
  done: "Faite",
  skipped: "Non faite",
};
