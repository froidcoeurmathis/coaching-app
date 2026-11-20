// Génère supabase/data/clara.sql : la fiche de Clara et toutes les séances de sa phase
// « Séville » (12 cycles de 8 jours, du 2 nov. 2026 au 5 févr. 2027), d'après son programme Hyrox.
// Usage : node scripts/generate-clara-program.mjs
import { writeFileSync, mkdirSync } from "node:fs";

const START = Date.UTC(2026, 10, 2);
const iso = (c, j) => new Date(START + ((c - 1) * 8 + (j - 1)) * 864e5).toISOString().slice(0, 10);

const BLOCKS = ["Bloc 1 · Fondations", "Bloc 2 · Puissance", "Bloc 3 · Spécifique"];
const ANKLE = ["20–30 min", "20–30 min", "20–30 min", "20 min"];

const LOWER = {
  1: [
    ["Back squat", ["4 × 8 · RIR 3", "4 × 8 · RIR 2", "5 × 6 · RIR 2", "3 × 6 · RIR 4"], "2–3 min"],
    ["Soulevé de terre roumain à une jambe", ["3 × 8/j · RIR 3", "3 × 10/j · RIR 2", "4 × 8/j · RIR 2", "2 × 8/j · RIR 4"], "90 s"],
    ["Fentes bulgares", ["3 × 8/j · RIR 3", "3 × 10/j · RIR 2", "4 × 8/j · RIR 2", "2 × 8/j · RIR 4"], "90 s"],
    ["Hip thrust", ["3 × 10 · RIR 2", "3 × 12 · RIR 2", "3 × 10 · RIR 1–2", "2 × 10 · RIR 4"], "90 s"],
    ["Leg extension", ["3 × 12 · RIR 2", "3 × 12 · RIR 2", "3 × 10 · RIR 1–2", "2 × 12 · RIR 4"], "60 s"],
    ["Mollets debout (2 s en haut)", ["3 × 15", "3 × 15 · plus lourd", "4 × 12", "2 × 15"], "60 s"],
    ["Renfo chevilles (au choix)", ANKLE, "—"],
  ],
  2: [
    ["Step-ups lestés sur banc, montée rapide, sans saut", ["3 × 5/j", "4 × 5/j", "4 × 5/j", "2 × 5/j"], "90 s"],
    ["Back squat", ["4 × 6 · RIR 2", "5 × 5 · RIR 2", "5 × 4 · RIR 1–2", "3 × 5 · RIR 4"], "2–3 min"],
    ["Soulevé de terre roumain à une jambe", ["3 × 8/j · RIR 2", "4 × 6/j · RIR 2", "4 × 6/j · RIR 1–2", "2 × 8/j · RIR 4"], "90 s"],
    ["Fentes bulgares", ["3 × 8/j", "3 × 10/j", "4 × 8/j · plus lourd", "2 × 8/j"], "90 s"],
    ["Hip thrust", ["3 × 10 · RIR 2", "4 × 8 · RIR 2", "4 × 6 · RIR 2", "2 × 10 · RIR 4"], "90 s"],
    ["Leg extension", ["3 × 12 · RIR 2", "3 × 10 · RIR 2", "3 × 10 · RIR 1", "2 × 12 · RIR 4"], "60 s"],
    ["Mollets debout, chargés", ["3 × 12", "4 × 12", "4 × 10", "2 × 12"], "60 s"],
    ["Renfo chevilles (au choix)", ANKLE, "—"],
  ],
  3: [
    ["Broad jumps (pieds joints)", ["4 × 3", "4 × 3", "5 × 3", "2 × 3"], "90 s"],
    ["Back squat", ["4 × 5 · RIR 2", "4 × 4 · RIR 2", "5 × 3 · RIR 2", "3 × 4 · RIR 4"], "3 min"],
    ["Soulevé de terre roumain à une jambe", ["3 × 6/j · RIR 2", "4 × 6/j · RIR 2", "4 × 5/j · RIR 1–2", "2 × 6/j · RIR 4"], "90 s"],
    ["Fentes bulgares", ["3 × 6/j · RIR 2", "4 × 6/j · RIR 2", "4 × 5/j · RIR 1–2", "2 × 6/j · RIR 4"], "90 s"],
    ["Hip thrust", ["4 × 6 · RIR 2", "4 × 5 · RIR 2", "4 × 5 · RIR 1–2", "2 × 8 · RIR 4"], "90 s"],
    ["Leg extension", ["3 × 10 · RIR 2", "3 × 10 · RIR 1–2", "3 × 8 · RIR 1–2", "2 × 10 · RIR 4"], "60 s"],
    ["Mollets debout, chargés", ["4 × 10", "4 × 10", "4 × 8", "2 × 10"], "60 s"],
    ["Renfo chevilles (au choix)", ANKLE, "—"],
  ],
};

const UPPER = {
  1: [
    ["Développé militaire aux haltères", ["3 × 10 · RIR 3", "4 × 8 · RIR 2", "4 × 6 · RIR 2", "2 × 8 · RIR 4"], "2 min"],
    ["Tirage vertical (parfois tractions assistées)", ["3 × 10 · RIR 3", "4 × 8 · RIR 2", "4 × 6 · RIR 2", "2 × 8 · RIR 4"], "2 min"],
    ["Tirage horizontal", ["3 × 10 · RIR 3", "3 × 12 · RIR 2", "4 × 10 · RIR 2", "2 × 10 · RIR 4"], "90 s"],
    ["Élévations latérales", ["3 × 12 · RIR 2", "3 × 15 · RIR 2", "4 × 12 · RIR 1–2", "2 × 12 · RIR 4"], "60 s"],
    ["Triceps (au choix)", ["3 × 12 · RIR 2", "3 × 12 · RIR 2", "3 × 10 · RIR 1–2", "2 × 12 · RIR 4"], "60 s"],
    ["Biceps (au choix)", ["3 × 12 · RIR 2", "3 × 12 · RIR 2", "3 × 10 · RIR 1–2", "2 × 12 · RIR 4"], "60 s"],
    ["Abdos (au choix)", ["8 min", "8 min", "10 min", "6 min"], "—"],
    ["Renfo chevilles (au choix)", ANKLE, "—"],
    ["Finisher rameur", ["6 × 250 m · RPE 8", "4 × 500 m · RPE 7–8", "8 × 250 m · RPE 8", "4 × 250 m · RPE 7"], ["1:00", "1:30", "0:45", "1:00"]],
  ],
  2: [
    ["Développé militaire aux haltères", ["4 × 8 · RIR 2", "4 × 6 · RIR 2", "5 × 5 · RIR 2", "2 × 8 · RIR 4"], "2 min"],
    ["Tirage vertical (parfois tractions assistées)", ["4 × 8 · RIR 2", "4 × 6 · RIR 2", "5 × 5 · RIR 2", "2 × 8 · RIR 4"], "2 min"],
    ["Tirage horizontal", ["4 × 10 · RIR 2", "4 × 8 · RIR 2", "4 × 8 · RIR 1–2", "2 × 10 · RIR 4"], "90 s"],
    ["Élévations latérales", ["3 × 15 · RIR 2", "4 × 12 · RIR 2", "4 × 15 · RIR 1–2", "2 × 12 · RIR 4"], "60 s"],
    ["Triceps (au choix)", ["3 × 12 · RIR 2", "3 × 10 · RIR 2", "4 × 10 · RIR 1–2", "2 × 12 · RIR 4"], "60 s"],
    ["Biceps (au choix)", ["3 × 12 · RIR 2", "3 × 10 · RIR 2", "4 × 10 · RIR 1–2", "2 × 12 · RIR 4"], "60 s"],
    ["Abdos (au choix)", ["8 min", "10 min", "10 min", "6 min"], "—"],
    ["Renfo chevilles (au choix)", ANKLE, "—"],
    ["Finisher rameur", ["5 × 500 m · RPE 8", "3 × 1000 m · RPE 7–8", "10 × 250 m · RPE 8–9", "4 × 250 m · RPE 7"], ["1:30", "2:00", "0:40", "1:00"]],
  ],
  3: [
    ["Développé militaire aux haltères", ["4 × 6 · RIR 2", "4 × 5 · RIR 2", "5 × 4 · RIR 2", "2 × 6 · RIR 4"], "2 min"],
    ["Tirage vertical (parfois tractions assistées)", ["4 × 6 · RIR 2", "4 × 5 · RIR 2", "5 × 4 · RIR 2", "2 × 6 · RIR 4"], "2 min"],
    ["Tirage horizontal", ["4 × 8 · RIR 2", "4 × 6 · RIR 2", "4 × 6 · RIR 1–2", "2 × 8 · RIR 4"], "90 s"],
    ["Élévations latérales", ["4 × 12 · RIR 2", "4 × 12 · RIR 1–2", "4 × 10 · RIR 1–2", "2 × 12 · RIR 4"], "60 s"],
    ["Triceps (au choix)", ["3 × 10 · RIR 2", "3 × 10 · RIR 1–2", "3 × 8 · RIR 1–2", "2 × 10 · RIR 4"], "60 s"],
    ["Biceps (au choix)", ["3 × 10 · RIR 2", "3 × 10 · RIR 1–2", "3 × 8 · RIR 1–2", "2 × 10 · RIR 4"], "60 s"],
    ["Abdos (au choix)", ["8 min", "10 min", "10 min", "6 min"], "—"],
    ["Renfo chevilles (au choix)", ANKLE, "—"],
    ["Finisher : 250 m de rameur RPE 8 + 15 wall balls", ["4 tours", "5 tours", "6 tours", "3 tours"], "1:00 entre les tours"],
  ],
};

const HYROX = {
  1: [["Wall balls", "EMOM 10 min : 10 rép. (100 au total)", "—"], ["Sandbag lunges", "4 × 20 rép.", "1:30"], ["Burpees", "3 × 10", "1:00"], ["Circuit pour le temps (RPE 7–8)", "3 tours : 300 m de rameur + 12 wall balls + 10 fentes + 6 burpees", "noter le temps"]],
  2: [["Wall balls", "EMOM 12 min : 10 rép. (120 au total)", "—"], ["Sandbag lunges", "5 × 20 rép.", "1:15"], ["Burpees", "4 × 10", "1:00"], ["AMRAP 12 min (RPE 7–8)", "250 m de rameur + 10 wall balls + 10 fentes + 6 burpees", "noter les tours"]],
  3: [["Wall balls", "5 × 25 rép. (125 au total)", "1:30"], ["Sandbag lunges", "4 × 25 rép.", "1:00"], ["Burpees", "4 × 12", "1:00"], ["Circuit pour le temps (RPE 7–8)", "4 tours : 300 m de rameur + 15 wall balls + 15 fentes + 8 burpees", "noter le temps"]],
  4: [["TEST · Wall balls", "50 wall balls chronométrés", "5 min après"], ["TEST · Sandbag lunges", "50 rép. chronométrées", "—"], ["Burpees", "2 × 10", "1:00"], ["Circuit tranquille (RPE 6)", "2 tours : 250 m de rameur + 10 wall balls + 10 fentes", "—"]],
  5: [["Hyrox compromised", "4 tours : 500 m à 5:20–5:30/km + 10 burpees + 250 m de rameur RPE 8", "2:00 entre les tours"], ["Entretien wall balls", "EMOM 6 min : 10 rép.", "—"], ["Entretien fentes", "2 × 20 rép.", "1:00"]],
  6: [["Hyrox compromised", "4 tours : 600 m à 5:15–5:25/km + 12 burpees + 300 m de rameur RPE 8", "1:45 entre les tours"], ["Entretien wall balls", "EMOM 6 min : 12 rép.", "—"], ["Entretien fentes", "2 × 25 rép.", "1:00"]],
  7: [["Hyrox compromised", "3 tours : 1 km à 5:10–5:15/km + 20 burpees + 500 m de rameur RPE 8", "2:30 entre les tours"], ["Entretien wall balls", "2 × 25 rép.", "1:30"], ["Entretien fentes", "2 × 25 rép.", "1:00"]],
  8: [["TEST · Rameur", "1000 m chronométré, à fond", "—"], ["Burpees technique", "2 × 10", "1:00"], ["Entretien wall balls", "EMOM 5 min : 8 rép.", "—"], ["Entretien fentes", "1 × 20 rép.", "—"]],
  9: [["Hyrox compromised", "4 tours : 1 km à 5:05/km, puis 25 fentes (tours 1 et 3) ou 25 wall balls (tours 2 et 4)", "1:00 entre les tours"], ["Entretien burpees", "2 × 10", "1:30"]],
  10: [["Hyrox compromised", "4 tours : 1 km à 5:00/km, puis 35 fentes ou 35 wall balls en alternance", "1:00 entre les tours"], ["Entretien burpees", "2 × 12", "1:00"]],
  11: [["Simulation de fin de course", "1 km à 5:00 + 500 m de rameur + 1 km + 10 burpees + 1 km + 50 fentes + 1 km + 60 wall balls (séries de 15–20, 10 s de pause comme un relais)", "sans pause"]],
  12: [["RETEST · Wall balls", "50 wall balls chronométrés", "5 min après"], ["RETEST · Sandbag lunges", "50 rép. chronométrées, à comparer avec C4", "—"], ["Burpees technique", "1 × 10", "—"]],
};
const HYROX_DUR = ["55–65", "55–65", "60–70", "40", "60–70", "60–70", "60–70", "40", "55–65", "60–70", "45–55", "35"];

const QUALITY = {
  1: ["15 min faciles", "5 × 3 min à 5:40–5:50/km", "1:30 en trottinant", "5 min faciles", 43],
  2: ["15 min faciles", "4 × 5 min à 5:40–5:50/km", "1:30 en trottinant", "5 min faciles", 46],
  3: ["15 min faciles", "3 × 8 min à 5:35–5:45/km", "2 min en trottinant", "5 min faciles", 50],
  4: ["12 min faciles", "4 × 2 min à 5:35–5:45/km", "2 min en trottinant", "5 min faciles", 33],
  5: ["15 min faciles", "3 × 10 min à 5:30–5:40/km", "2 min en trottinant", "5 min faciles", 54],
  6: ["15 min faciles", "2 × 15 min à 5:25–5:35/km", "3 min en trottinant", "5 min faciles", 53],
  7: ["15 min faciles", "5 × 1 km à 5:00–5:05/km", "1:30 en marchant", "5 min faciles", 51],
  8: ["15 min faciles", "3 × 1 km à 5:15–5:20/km", "2 min en trottinant", "5 min faciles", 39],
  9: ["15 min faciles", "4 × 1 km à 5:00/km", "1:30 en marchant", "5 min faciles", 45],
  10: ["15 min faciles", "6 × 1 km à 5:00/km", "1:30 en marchant", "5 min faciles", 58],
  11: ["12 min faciles", "8 × 1 km à 5:00/km · repère de fin de phase", "1:30 en marchant", "5 min faciles", 68],
  12: ["15 min faciles", "3 × 1 km à 5:00/km", "2 min en marchant", "5 min faciles", 40],
};
const J2 = [40, 45, 45, 35, 45, 50, 55, 40, 50, 50, 55, 40];
const J7 = [45, 50, 55, 40, 55, 60, 65, 45, 65, 70, 70, 50];
const STRIDES = [0, 0, 4, 0, 6, 6, 6, 0, 6, 6, 6, 0];

const WARMUP =
  "Échauffement standard (10 min) : 5 min de rameur ou de marche inclinée, progressif, puis 2 tours : 10 squats, 10 montées sur pointes, 5 fentes/jambe, 10 cercles de chevilles/côté, 20 s de gainage.";

// ---------------------------------------------------------------------------
// Conversion des prescriptions texte en champs structurés
// ---------------------------------------------------------------------------

const empty = () => ({ sets: null, reps: null, distance_m: null, duration_s: null, intensity: null, load_kg: null, load_pct: null, rest_s: null, notes: null });

function parseVolume(text) {
  const out = empty();
  let m = text.match(/^(\d+) × (.+?)(?: · (.+))?$/);
  if (m) {
    out.sets = Number(m[1]);
    const work = m[2];
    out.intensity = m[3] ?? null;
    let w;
    if ((w = work.match(/^(\d+) m$/))) out.distance_m = Number(w[1]);
    else if ((w = work.match(/^(\d+) km$/))) out.distance_m = Number(w[1]) * 1000;
    else if ((w = work.match(/^(\d+) min$/))) out.duration_s = Number(w[1]) * 60;
    else out.reps = work.replace(/ rép\.?/, "");
    return out;
  }
  if ((m = text.match(/^(\d+) min$/))) {
    out.duration_s = Number(m[1]) * 60;
    return out;
  }
  out.reps = text; // prescription libre (EMOM, circuit, test…)
  return out;
}

/** « 90 s », « 2 min », « 1:30 », « 1:30 entre les tours », « 2–3 min », « noter le temps »… */
function parseRest(text, ex) {
  if (!text || text === "—") return;
  let m;
  if ((m = text.match(/^(\d+) s$/))) ex.rest_s = Number(m[1]);
  else if ((m = text.match(/^(\d+) min$/))) ex.rest_s = Number(m[1]) * 60;
  else if ((m = text.match(/^(\d+):(\d\d)(?: (.+))?$/))) {
    ex.rest_s = Number(m[1]) * 60 + Number(m[2]);
    if (m[3]) ex.notes = `Récup ${m[3]}`;
  } else if ((m = text.match(/^(\d+) min après$/))) {
    ex.rest_s = Number(m[1]) * 60;
  } else ex.notes = text.charAt(0).toUpperCase() + text.slice(1);
  if (/^\d+–\d+ min$/.test(text)) {
    ex.rest_s = null;
    ex.notes = `Récup ${text}`;
  }
}

const block = (exercises, extra = {}) => ({ title: null, rounds: null, rest_s: null, notes: null, ...extra, exercises });

function strengthBlocks(rows, i) {
  return rows.map(([name, presc, rest]) => {
    const text = presc[i];
    const r = Array.isArray(rest) ? rest[i] : rest;
    const rounds = text.match(/^(\d+) tours$/);
    if (rounds) {
      const ex = { ...empty(), name };
      const b = block([ex], { rounds: Number(rounds[1]) });
      const m = r.match(/^(\d+):(\d\d)/);
      if (m) b.rest_s = Number(m[1]) * 60 + Number(m[2]);
      return b;
    }
    const ex = { ...parseVolume(text), name };
    parseRest(r, ex);
    return block([ex]);
  });
}

const midpoint = (range) => {
  const [a, b] = String(range).split("–").map(Number);
  return b ? Math.round((a + b) / 2 / 5) * 5 : a;
};

function session(c, j) {
  const b = Math.ceil(c / 4);
  const i = (c - 1) % 4;
  const deload = i === 3;
  const header = `Cycle ${c}/12 · ${BLOCKS[b - 1]} · ${deload ? "décharge" : "charge"}.`;
  const base = { scheduled_on: iso(c, j), status: "planned" };

  if (j === 1 || j === 6) {
    const lower = j === 1;
    return {
      ...base,
      title: lower ? "Force bas du corps" : "Force haut du corps",
      discipline: "strength",
      duration_min: deload ? 60 : 80,
      description: [header, WARMUP, lower ? "Charges choisies pour respecter le RIR." : null].filter(Boolean).join("\n"),
      blocks: strengthBlocks((lower ? LOWER : UPPER)[b], i),
    };
  }
  if (j === 2 || j === 7) {
    const long = j === 7;
    const min = (long ? J7 : J2)[c - 1];
    const blocks = [block([{ ...empty(), name: long ? "Sortie longue" : "Footing", duration_s: min * 60, intensity: "RPE 2–3 · 7,2–7,5 km/h" }])];
    if (long && STRIDES[c - 1]) {
      blocks.push(block([{ ...empty(), name: "Lignes droites progressives", sets: STRIDES[c - 1], duration_s: 15, intensity: "progressif" }], { title: "Fin de sortie" }));
    }
    return {
      ...base,
      title: long ? "Sortie longue facile" : "Footing facile",
      discipline: "running",
      duration_min: min,
      description: `${header}\nAllure de conversation, sol plat et régulier.`,
      blocks,
    };
  }
  if (j === 3) {
    const title = b === 1 ? "Séance stations" : c === 8 || c === 12 ? "Tests et technique" : "Hyrox compromised";
    const test =
      c === 4 ? "Tests du bloc : noter le temps des 50 wall balls et des 50 fentes."
      : c === 8 ? "Test : noter le temps du 1000 m et l'allure /500 m."
      : c === 12 ? "Retest : comparer avec les temps de C4."
      : c === 11 ? "Repère : le 8 × 1 km de la course de qualité dit si 5:00/km est réaliste en course."
      : null;
    return {
      ...base,
      title,
      discipline: "hyrox",
      duration_min: midpoint(HYROX_DUR[c - 1]),
      description: [
        header,
        WARMUP,
        test,
        (HYROX[c].length > 1 ? "3 min de récup entre les parties. " : "") +
          "Wall ball 6 kg · sandbag 20 kg · burpees over plate, over bar ou to plate.",
      ].filter(Boolean).join("\n"),
      blocks: HYROX[c].map(([name, presc, rest]) => {
        const ex = { ...parseVolume(presc), name };
        parseRest(rest, ex);
        return block([ex]);
      }),
    };
  }
  if (j === 5) {
    const [wu, main, rec, cd, dur] = QUALITY[c];
    const easy = (text) => ({ ...empty(), name: "Course facile", duration_s: Number(text.match(/^(\d+)/)[1]) * 60, intensity: "facile" });
    const m = main.match(/^(\d+) × (\d+) (min|km) à (.+?)(?: · (.+))?$/);
    const work = { ...empty(), name: "Course", sets: Number(m[1]), intensity: m[4], notes: m[5] ? m[5].charAt(0).toUpperCase() + m[5].slice(1) : null };
    if (m[3] === "km") work.distance_m = Number(m[2]) * 1000;
    else work.duration_s = Number(m[2]) * 60;
    const r = rec.match(/^(?:(\d+):(\d\d)|(\d+) min) (.+)$/);
    work.rest_s = r[3] ? Number(r[3]) * 60 : Number(r[1]) * 60 + Number(r[2]);
    work.notes = [work.notes, `Récup ${r[4]}`].filter(Boolean).join(" · ");
    return {
      ...base,
      title: "Course de qualité",
      discipline: "running",
      duration_min: dur,
      description: `${header}\nSol plat ou tapis. Par forte chaleur, ralentir de 5–10 s/km plutôt que d'arrêter.`,
      blocks: [
        block([easy(wu)], { title: "Échauffement" }),
        block([work], { title: "Corps de séance" }),
        block([easy(cd)], { title: "Retour au calme" }),
      ],
    };
  }
  return null; // J4 et J8 : repos
}

const sessions = [];
for (let c = 1; c <= 12; c++) for (let j = 1; j <= 8; j++) {
  const s = session(c, j);
  if (s) sessions.push(s);
}

// ---------------------------------------------------------------------------
// SQL
// ---------------------------------------------------------------------------

const lit = (v) => `'${String(v).replace(/'/g, "''")}'`;
const json = (o) => `${lit(JSON.stringify(o))}::jsonb`;

const calls = sessions
  .map(({ blocks, ...s }) => `  perform public.save_session(${json(s)} || jsonb_build_object('athlete_id', v_athlete), ${json(blocks)});`)
  .join("\n");

const sql = `-- Programme Hyrox de Clara — phase « Séville » (2 nov. 2026 → 5 févr. 2027)
-- Fichier généré par scripts/generate-clara-program.mjs : ne pas modifier à la main.
--
-- Crée la fiche de Clara (si elle n'existe pas), ses allures de référence et ses
-- ${sessions.length} séances (12 cycles de 8 jours : 6 séances + 2 repos).
-- À exécuter une fois dans l'éditeur SQL de Supabase, APRÈS la première connexion du coach.
-- Sans effet si les séances ont déjà été importées.

do $clara$
declare
  v_coach   uuid;
  v_athlete uuid;
begin
  select id into v_coach from public.profiles where role = 'coach' order by created_at limit 1;
  if v_coach is null then
    raise exception 'Aucun profil coach : connectez-vous une première fois en tant que coach, puis relancez ce script.';
  end if;

  select id into v_athlete from public.athletes
   where coach_id = v_coach and first_name = 'Clara' and archived_at is null
   order by created_at limit 1;

  if v_athlete is null then
    insert into public.athletes (coach_id, first_name, goal, target_event, notes)
    values (
      v_coach, 'Clara',
      'Hyrox Rotterdam (avril 2027) en duo : 1h15–1h20. Course visée 5:00/km.',
      'Hyrox Rotterdam — duo',
      ${lit(`Phase Séville du 2 nov. au 5 févr. : cycles de 8 jours (6 séances, 2 repos).
Bloc 1 Fondations (C1–C4, priorité wall balls + sandbag lunges), Bloc 2 Puissance (C5–C8, priorité burpees), Bloc 3 Spécifique (C9–C12, wall balls + fentes en fatigue, allure 5:00). C4, C8 et C12 = décharge.
Règle cheville : douleur 0–3/10, stable, disparue le lendemain → on suit le plan ; au-delà ou pire le lendemain → refaire la séance du cycle précédent. Course : +10 % de temps total par cycle max, sortie longue +5 min max, sol plat.
Matériel : wall ball 6 kg (cible 2,70 m), sandbag 20 kg, burpees over plate / over bar / to plate.
À ajuster en février au retour en Belgique (focus sled).`)}
    )
    returning id into v_athlete;

    insert into public.athlete_paces (athlete_id, position, label, pace_s_per_km) values
      (v_athlete, 0, 'Footing (RPE 2–3)', 485),
      (v_athlete, 1, 'Qualité', 345),
      (v_athlete, 2, 'Allure Hyrox visée', 300);
  end if;

  if exists (select 1 from public.sessions
              where athlete_id = v_athlete and scheduled_on between '2026-11-02' and '2027-02-05') then
    raise notice 'Le programme de Clara est déjà importé : rien à faire.';
    return;
  end if;

${calls}

  raise notice 'Programme de Clara importé : % séances.', ${sessions.length};
end
$clara$;
`;

mkdirSync("supabase/data", { recursive: true });
writeFileSync("supabase/data/clara.sql", sql);
console.log(`supabase/data/clara.sql : ${sessions.length} séances`);
