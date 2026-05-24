import { uid } from "./storage";
import type { PeriodSchedulePlan, ProgramExercise, WeekdayPlanKey, WeeklyDayPlan } from "./types";

/** Programtitler må matche periodeplan-rader for Start økt. */
export const SUB60_PROGRAM_TITLES = {
  strength: "SUB60 · Styrke løper",
  mobility: "SUB60 · Mobilitet løper",
  easy: "SUB60 · Rolig løp sone 2",
  tempo: "SUB60 · Tempo kontinuerlig",
  interval: "SUB60 · Intervall kort",
  long: "SUB60 · Langtur sone 2",
  race: "SUB60 · Testløp 10 km",
} as const;

export const SUB45_PROGRAM_TITLES = {
  strength: "SUB45 · Styrke løper",
  mobility: "SUB45 · Mobilitet løper",
  easy: "SUB45 · Rolig løp sone 2",
  tempo: "SUB45 · Tempo kontinuerlig",
  interval: "SUB45 · Intervall kort",
  long: "SUB45 · Langtur sone 2",
  race: "SUB45 · Testløp 10 km",
} as const;

export type InspirationProgramTemplate = {
  title: string;
  goal: string;
  notes: string;
  exercises: ProgramExercise[];
  programCreatedBy: "member";
  programCreatedByName: string;
  imageUrl?: string;
};

/** Forsidebilde for SUB60 langtur (ligger i public/program-covers/). */
export const SUB60_LONG_RUN_COVER_IMAGE = "/program-covers/sub60-langtur-sone-2.png";

/** Forsidebilde for styrke for løpere (SUB60/SUB45). */
export const RUNNER_STRENGTH_COVER_IMAGE = "/program-covers/styrke-loper.png";

/** Forsidebilde for mobilitet for løpere (SUB60/SUB45). */
export const RUNNER_MOBILITY_COVER_IMAGE = "/program-covers/mobilitet.png";

export type RunningInspirationItem = {
  id: string;
  category: "programs";
  kind: "periodPlan";
  title: string;
  description: string;
  body: string;
  tag: string;
  author: string;
  createdAt: string;
  periodPlanTemplate: PeriodSchedulePlan;
  bundledProgramTemplates: InspirationProgramTemplate[];
};

const REST = "Hvile / restitusjon";
const ACTIVE_REST = "Aktiv restitusjon";
const CREATED = "2026-05-20";
const AUTHOR = "Motus";

function emptyWeek(): WeeklyDayPlan {
  return { monday: "", tuesday: "", wednesday: "", thursday: "", friday: "", saturday: "", sunday: "" };
}

function weekDays(partial: Partial<WeeklyDayPlan>): WeeklyDayPlan {
  return { ...emptyWeek(), ...partial };
}

function strengthExercise(name: string, sets: string, reps: string, notes = "", weight = "0"): ProgramExercise {
  return {
    id: uid("run-str-ex"),
    exerciseId: `inspo-${name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
    exerciseName: name,
    sets,
    reps,
    weight,
    restSeconds: "75",
    notes,
  };
}

function mobilityExercise(name: string, sets: string, holdSeconds: string, notes = ""): ProgramExercise {
  return {
    id: uid("run-mob-ex"),
    exerciseId: `inspo-${name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
    exerciseName: name,
    sets,
    reps: "",
    weight: "0",
    holdSeconds,
    restSeconds: "30",
    notes,
  };
}

function cardioStep(
  label: string,
  exerciseName: string,
  durationMinutes: number,
  speed: string,
  incline: string,
  restSeconds: string,
): ProgramExercise {
  return {
    id: uid("run-cardio-ex"),
    exerciseId: `inspo-${exerciseName.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
    exerciseName,
    sets: "1",
    reps: "",
    weight: "",
    durationMinutes: String(durationMinutes),
    speed,
    incline,
    restSeconds,
    notes: label,
  };
}

function buildIntervalProgram(
  title: string,
  goal: string,
  notes: string,
  config: { warmupMin: number; workMin: number; workSpeed: string; reps: number; restSec: number; cooldownMin: number; warmupSpeed: string; cooldownSpeed: string },
): InspirationProgramTemplate {
  const exercises: ProgramExercise[] = [
    cardioStep("Oppvarming", "Nedjogg", config.warmupMin, config.warmupSpeed, "1", "0"),
  ];
  for (let index = 0; index < config.reps; index += 1) {
    exercises.push(
      cardioStep(`Drag ${index + 1}`, "Mølle intervall løp", config.workMin, config.workSpeed, "1", String(config.restSec)),
    );
  }
  exercises.push(cardioStep("Nedjogg", "Nedjogg", config.cooldownMin, config.cooldownSpeed, "0", "0"));
  return { title, goal, notes, exercises, programCreatedBy: "member", programCreatedByName: AUTHOR };
}

function buildSub60Programs(): InspirationProgramTemplate[] {
  return [
    {
      title: SUB60_PROGRAM_TITLES.strength,
      goal: "Skadeforebyggende styrke for løpere",
      notes:
        "Fokus på kontroll, ikke maksimal vekt. 2–3 min hvile mellom tunge sett. Juster vekt slik at siste reps føles utfordrende men teknisk solid.",
      exercises: [
        strengthExercise("Goblet squat", "3", "10", "Dyp nok til stabil knevinkel"),
        strengthExercise("Glute bridge", "3", "12", "Klem sete i topp"),
        strengthExercise("Monster walk", "2", "14", "Miniband over knær, små steg"),
        strengthExercise("Planke", "3", "45", "Sekunder per sett"),
        strengthExercise("Båndet knebøy", "2", "15", "Aktivering, lett motstand"),
        strengthExercise("Stående tåhev", "3", "15", "Full strekk i ankelen"),
        strengthExercise("Single-leg hip thrust", "2", "10", "Per side"),
        strengthExercise("Tibialis raise", "2", "15", "Styrker legg og ankler"),
      ],
      programCreatedBy: "member",
      programCreatedByName: AUTHOR,
      imageUrl: RUNNER_STRENGTH_COVER_IMAGE,
    },
    {
      title: SUB60_PROGRAM_TITLES.mobility,
      goal: "Mobilitet og restitusjon for løpere",
      notes: "Rolig tempo. Pust dypt. Ingen smerte – bare behagelig strekk.",
      exercises: [
        mobilityExercise("World's greatest stretch", "2", "45", "Per side"),
        mobilityExercise("90/90 hofte-rotasjon", "2", "45", "Per side"),
        mobilityExercise("Couch stretch", "2", "45", "Per side"),
        mobilityExercise("Leggstrekk mot vegg", "2", "45", "Per side"),
        mobilityExercise("Ankelmobilitet kne-til-vegg", "2", "45", "Per side"),
        mobilityExercise("Pigeon stretch", "2", "45", "Per side"),
        mobilityExercise("Setestrekk liggende", "2", "45", "Sekunder per side"),
      ],
      programCreatedBy: "member",
      programCreatedByName: AUTHOR,
      imageUrl: RUNNER_MOBILITY_COVER_IMAGE,
    },
    {
      title: SUB60_PROGRAM_TITLES.easy,
      goal: "Rolig sone 2 – bygger grunnform",
      notes:
        "Snakk tempo (ca. 6:00–6:30 min/km på mølle). Puls skal føles moderat – du skal kunne holde en setning. Øk varighet gradvis etter ukeplan.",
      exercises: [cardioStep("Rolig løp", "Nedjogg", 38, "9.0", "1", "0")],
      programCreatedBy: "member",
      programCreatedByName: AUTHOR,
    },
    {
      title: SUB60_PROGRAM_TITLES.tempo,
      goal: "Kontinuerlig tempo mot 10 km-fart",
      notes:
        "10 min rolig oppvarming → 12–15 min ved ca. 6:00 min/km (10 km/t) → 8 min rolig nedjogg. Hold jevn innsats – ikke start for hardt.",
      exercises: [
        cardioStep("Oppvarming", "Nedjogg", 10, "8.5", "1", "0"),
        cardioStep("Tempo", "Nedjogg", 14, "10.0", "1", "0"),
        cardioStep("Nedjogg", "Nedjogg", 8, "7.5", "0", "0"),
      ],
      programCreatedBy: "member",
      programCreatedByName: AUTHOR,
    },
    buildIntervalProgram(SUB60_PROGRAM_TITLES.interval, "Korte intervaller for fart og teknikk", "4×2 min drag med 90 sek pause. Juster hastighet etter uke – start kontrollert.", {
      warmupMin: 10,
      workMin: 2,
      workSpeed: "11.0",
      reps: 4,
      restSec: 90,
      cooldownMin: 8,
      warmupSpeed: "8.5",
      cooldownSpeed: "7.5",
    }),
    {
      title: SUB60_PROGRAM_TITLES.long,
      goal: "Langtur sone 2 – utholdenhet",
      notes: "Hold rolig tempo hele veien. Siste 10 min kan være litt lettere. Drikk vann før og etter.",
      exercises: [cardioStep("Langtur", "Nedjogg", 52, "8.8", "1", "0")],
      programCreatedBy: "member",
      programCreatedByName: AUTHOR,
      imageUrl: SUB60_LONG_RUN_COVER_IMAGE,
    },
    {
      title: SUB60_PROGRAM_TITLES.race,
      goal: "Test eller måløkt 10 km",
      notes:
        "Uke 12: 15 min oppvarming → 10 km i mål-fart (ca. 6:00 min/km / 10 km/t) → 10 min nedjogg. Alternativt: 3×2 km i mål-fart med 2 min lett mellom.",
      exercises: [
        cardioStep("Oppvarming", "Nedjogg", 15, "8.5", "1", "0"),
        cardioStep("Målfart 10 km", "Nedjogg", 60, "10.0", "1", "0"),
        cardioStep("Nedjogg", "Nedjogg", 10, "7.0", "0", "0"),
      ],
      programCreatedBy: "member",
      programCreatedByName: AUTHOR,
    },
  ];
}

function buildSub45Programs(): InspirationProgramTemplate[] {
  return [
    {
      title: SUB45_PROGRAM_TITLES.strength,
      goal: "Styrke og stabilitet for rask løper",
      notes: "Kvalitet over kvantum. Unngå stølhet som påvirker intervallene – hold 1–2 reps i reserve.",
      exercises: [
        strengthExercise("Bulgarian split squat", "3", "8", "Per side, kontrollert"),
        strengthExercise("Hip thrust", "3", "10", "Moderat vekt"),
        strengthExercise("Monster walk", "2", "16", "Aktivering"),
        strengthExercise("Planke", "3", "50", "Sekunder"),
        strengthExercise("Abduksjon maskin", "2", "15", "Stabile hofter"),
        strengthExercise("Stående tåhev", "3", "18", "Eksplosiv kontroll i topp"),
        strengthExercise("Leg curl", "3", "12", "Kontrollert, ikke for tungt før intervaller"),
        strengthExercise("Sideplanke med hoftehev", "2", "12", "Per side"),
      ],
      programCreatedBy: "member",
      programCreatedByName: AUTHOR,
      imageUrl: RUNNER_STRENGTH_COVER_IMAGE,
    },
    {
      title: SUB45_PROGRAM_TITLES.mobility,
      goal: "Mobilitet for høy løpebelastning",
      notes: "Kort og ofte. Fokus hofte, legg og ankler.",
      exercises: [
        mobilityExercise("World's greatest stretch", "2", "50", "Per side"),
        mobilityExercise("90/90 hofte-rotasjon", "2", "50", "Per side"),
        mobilityExercise("Couch stretch", "2", "50", "Per side"),
        mobilityExercise("Frog stretch", "2", "50"),
        mobilityExercise("Ankelmobilitet kne-til-vegg", "2", "50", "Per side"),
        mobilityExercise("Leggstrekk mot vegg", "2", "50", "Per side"),
      ],
      programCreatedBy: "member",
      programCreatedByName: AUTHOR,
      imageUrl: RUNNER_MOBILITY_COVER_IMAGE,
    },
    {
      title: SUB45_PROGRAM_TITLES.easy,
      goal: "Rolig sone 2",
      notes: "Ca. 5:15–5:45 min/km følelse. Lett nok til å kunne snakke i setninger.",
      exercises: [cardioStep("Rolig løp", "Nedjogg", 40, "10.5", "1", "0")],
      programCreatedBy: "member",
      programCreatedByName: AUTHOR,
    },
    {
      title: SUB45_PROGRAM_TITLES.tempo,
      goal: "Tempo mot sub 45 min på 10 km",
      notes: "10 min opp → 18–20 min ved ca. 4:35–4:45 min/km (12–12.5 km/t) → 8 min ned.",
      exercises: [
        cardioStep("Oppvarming", "Nedjogg", 10, "10", "1", "0"),
        cardioStep("Tempo", "Nedjogg", 18, "12.5", "1", "0"),
        cardioStep("Nedjogg", "Nedjogg", 8, "9", "0", "0"),
      ],
      programCreatedBy: "member",
      programCreatedByName: AUTHOR,
    },
    buildIntervalProgram(SUB45_PROGRAM_TITLES.interval, "Intervaller for fart", "5×3 min ved sterk innsats med 75 sek pause. Puls høy, men kontrollert løpeteknikk.", {
      warmupMin: 12,
      workMin: 3,
      workSpeed: "13.5",
      reps: 5,
      restSec: 75,
      cooldownMin: 10,
      warmupSpeed: "10",
      cooldownSpeed: "8.5",
    }),
    {
      title: SUB45_PROGRAM_TITLES.long,
      goal: "Langtur – aerob kapasitet",
      notes: "Rolig sone 2. Siste 15 min lett. Bygg gradvis mot 65–70 min i peak-uker.",
      exercises: [cardioStep("Langtur", "Nedjogg", 58, "10", "1", "0")],
      programCreatedBy: "member",
      programCreatedByName: AUTHOR,
    },
    {
      title: SUB45_PROGRAM_TITLES.race,
      goal: "Konkurransetest 10 km",
      notes: "Uke 12: Standard oppvarming → 10 km i mål-fart (ca. 4:30/km, 13.3 km/t) → nedjogg.",
      exercises: [
        cardioStep("Oppvarming", "Nedjogg", 15, "10", "1", "0"),
        cardioStep("Målfart 10 km", "Nedjogg", 45, "13.3", "1", "0"),
        cardioStep("Nedjogg", "Nedjogg", 10, "8.5", "0", "0"),
      ],
      programCreatedBy: "member",
      programCreatedByName: AUTHOR,
    },
  ];
}

type WeekBlueprint = Partial<Record<WeekdayPlanKey, string>>;

function buildWeeklyPlans(planId: string, weeks: WeekBlueprint[]): PeriodSchedulePlan["weeklyPlans"] {
  return weeks.map((days, index) => ({
    id: `${planId}-week-${index + 1}`,
    weekNumber: index + 1,
    days: weekDays(days),
  }));
}

const SUB60_WEEK_BLUEPRINTS: WeekBlueprint[] = [
  {
    monday: SUB60_PROGRAM_TITLES.strength,
    tuesday: SUB60_PROGRAM_TITLES.easy,
    wednesday: REST,
    thursday: SUB60_PROGRAM_TITLES.interval,
    friday: REST,
    saturday: SUB60_PROGRAM_TITLES.long,
    sunday: SUB60_PROGRAM_TITLES.mobility,
  },
  {
    monday: SUB60_PROGRAM_TITLES.strength,
    tuesday: SUB60_PROGRAM_TITLES.easy,
    wednesday: ACTIVE_REST,
    thursday: SUB60_PROGRAM_TITLES.interval,
    friday: REST,
    saturday: SUB60_PROGRAM_TITLES.long,
    sunday: SUB60_PROGRAM_TITLES.mobility,
  },
  {
    monday: SUB60_PROGRAM_TITLES.strength,
    tuesday: SUB60_PROGRAM_TITLES.easy,
    wednesday: REST,
    thursday: SUB60_PROGRAM_TITLES.interval,
    friday: ACTIVE_REST,
    saturday: SUB60_PROGRAM_TITLES.long,
    sunday: SUB60_PROGRAM_TITLES.mobility,
  },
  {
    monday: SUB60_PROGRAM_TITLES.strength,
    tuesday: SUB60_PROGRAM_TITLES.easy,
    wednesday: SUB60_PROGRAM_TITLES.mobility,
    thursday: SUB60_PROGRAM_TITLES.tempo,
    friday: REST,
    saturday: SUB60_PROGRAM_TITLES.long,
    sunday: REST,
  },
  {
    monday: SUB60_PROGRAM_TITLES.strength,
    tuesday: SUB60_PROGRAM_TITLES.easy,
    wednesday: REST,
    thursday: SUB60_PROGRAM_TITLES.interval,
    friday: ACTIVE_REST,
    saturday: SUB60_PROGRAM_TITLES.long,
    sunday: SUB60_PROGRAM_TITLES.mobility,
  },
  {
    monday: SUB60_PROGRAM_TITLES.strength,
    tuesday: SUB60_PROGRAM_TITLES.easy,
    wednesday: REST,
    thursday: SUB60_PROGRAM_TITLES.tempo,
    friday: REST,
    saturday: SUB60_PROGRAM_TITLES.long,
    sunday: SUB60_PROGRAM_TITLES.mobility,
  },
  {
    monday: SUB60_PROGRAM_TITLES.strength,
    tuesday: SUB60_PROGRAM_TITLES.easy,
    wednesday: REST,
    thursday: SUB60_PROGRAM_TITLES.interval,
    friday: ACTIVE_REST,
    saturday: SUB60_PROGRAM_TITLES.long,
    sunday: SUB60_PROGRAM_TITLES.mobility,
  },
  {
    monday: SUB60_PROGRAM_TITLES.strength,
    tuesday: SUB60_PROGRAM_TITLES.easy,
    wednesday: SUB60_PROGRAM_TITLES.mobility,
    thursday: SUB60_PROGRAM_TITLES.tempo,
    friday: REST,
    saturday: SUB60_PROGRAM_TITLES.long,
    sunday: REST,
  },
  {
    monday: SUB60_PROGRAM_TITLES.strength,
    tuesday: SUB60_PROGRAM_TITLES.easy,
    wednesday: REST,
    thursday: SUB60_PROGRAM_TITLES.interval,
    friday: REST,
    saturday: SUB60_PROGRAM_TITLES.long,
    sunday: SUB60_PROGRAM_TITLES.mobility,
  },
  {
    monday: SUB60_PROGRAM_TITLES.strength,
    tuesday: SUB60_PROGRAM_TITLES.easy,
    wednesday: ACTIVE_REST,
    thursday: SUB60_PROGRAM_TITLES.tempo,
    friday: REST,
    saturday: SUB60_PROGRAM_TITLES.long,
    sunday: SUB60_PROGRAM_TITLES.mobility,
  },
  {
    monday: SUB60_PROGRAM_TITLES.strength,
    tuesday: SUB60_PROGRAM_TITLES.easy,
    wednesday: REST,
    thursday: SUB60_PROGRAM_TITLES.interval,
    friday: REST,
    saturday: SUB60_PROGRAM_TITLES.long,
    sunday: ACTIVE_REST,
  },
  {
    monday: SUB60_PROGRAM_TITLES.mobility,
    tuesday: SUB60_PROGRAM_TITLES.easy,
    wednesday: REST,
    thursday: ACTIVE_REST,
    friday: REST,
    saturday: SUB60_PROGRAM_TITLES.race,
    sunday: SUB60_PROGRAM_TITLES.mobility,
  },
];

const SUB45_WEEK_BLUEPRINTS: WeekBlueprint[] = [
  {
    monday: SUB45_PROGRAM_TITLES.strength,
    tuesday: SUB45_PROGRAM_TITLES.easy,
    wednesday: REST,
    thursday: SUB45_PROGRAM_TITLES.interval,
    friday: REST,
    saturday: SUB45_PROGRAM_TITLES.long,
    sunday: SUB45_PROGRAM_TITLES.mobility,
  },
  {
    monday: SUB45_PROGRAM_TITLES.strength,
    tuesday: SUB45_PROGRAM_TITLES.easy,
    wednesday: ACTIVE_REST,
    thursday: SUB45_PROGRAM_TITLES.interval,
    friday: REST,
    saturday: SUB45_PROGRAM_TITLES.long,
    sunday: SUB45_PROGRAM_TITLES.mobility,
  },
  {
    monday: SUB45_PROGRAM_TITLES.strength,
    tuesday: SUB45_PROGRAM_TITLES.easy,
    wednesday: REST,
    thursday: SUB45_PROGRAM_TITLES.tempo,
    friday: ACTIVE_REST,
    saturday: SUB45_PROGRAM_TITLES.long,
    sunday: REST,
  },
  {
    monday: SUB45_PROGRAM_TITLES.strength,
    tuesday: SUB45_PROGRAM_TITLES.easy,
    wednesday: REST,
    thursday: SUB45_PROGRAM_TITLES.interval,
    friday: REST,
    saturday: SUB45_PROGRAM_TITLES.long,
    sunday: SUB45_PROGRAM_TITLES.mobility,
  },
  {
    monday: SUB45_PROGRAM_TITLES.strength,
    tuesday: SUB45_PROGRAM_TITLES.easy,
    wednesday: ACTIVE_REST,
    thursday: SUB45_PROGRAM_TITLES.interval,
    friday: REST,
    saturday: SUB45_PROGRAM_TITLES.long,
    sunday: SUB45_PROGRAM_TITLES.mobility,
  },
  {
    monday: SUB45_PROGRAM_TITLES.strength,
    tuesday: SUB45_PROGRAM_TITLES.easy,
    wednesday: REST,
    thursday: SUB45_PROGRAM_TITLES.tempo,
    friday: REST,
    saturday: SUB45_PROGRAM_TITLES.long,
    sunday: ACTIVE_REST,
  },
  {
    monday: SUB45_PROGRAM_TITLES.strength,
    tuesday: SUB45_PROGRAM_TITLES.easy,
    wednesday: REST,
    thursday: SUB45_PROGRAM_TITLES.interval,
    friday: ACTIVE_REST,
    saturday: SUB45_PROGRAM_TITLES.long,
    sunday: SUB45_PROGRAM_TITLES.mobility,
  },
  {
    monday: SUB45_PROGRAM_TITLES.strength,
    tuesday: SUB45_PROGRAM_TITLES.easy,
    wednesday: REST,
    thursday: SUB45_PROGRAM_TITLES.tempo,
    friday: REST,
    saturday: SUB45_PROGRAM_TITLES.long,
    sunday: SUB45_PROGRAM_TITLES.mobility,
  },
  {
    monday: SUB45_PROGRAM_TITLES.strength,
    tuesday: SUB45_PROGRAM_TITLES.easy,
    wednesday: ACTIVE_REST,
    thursday: SUB45_PROGRAM_TITLES.interval,
    friday: REST,
    saturday: SUB45_PROGRAM_TITLES.long,
    sunday: REST,
  },
  {
    monday: SUB45_PROGRAM_TITLES.strength,
    tuesday: SUB45_PROGRAM_TITLES.easy,
    wednesday: REST,
    thursday: SUB45_PROGRAM_TITLES.interval,
    friday: REST,
    saturday: SUB45_PROGRAM_TITLES.long,
    sunday: SUB45_PROGRAM_TITLES.mobility,
  },
  {
    monday: SUB45_PROGRAM_TITLES.strength,
    tuesday: SUB45_PROGRAM_TITLES.easy,
    wednesday: REST,
    thursday: SUB45_PROGRAM_TITLES.interval,
    friday: REST,
    saturday: ACTIVE_REST,
    sunday: SUB45_PROGRAM_TITLES.mobility,
  },
  {
    monday: SUB45_PROGRAM_TITLES.mobility,
    tuesday: SUB45_PROGRAM_TITLES.easy,
    wednesday: REST,
    thursday: ACTIVE_REST,
    friday: REST,
    saturday: SUB45_PROGRAM_TITLES.race,
    sunday: SUB45_PROGRAM_TITLES.mobility,
  },
];

function buildSub60PeriodPlan(): PeriodSchedulePlan {
  const id = "inspo-period-sub60-10k";
  return {
    id,
    title: "SUB60 · 10 km på under 60 min (12 uker)",
    notes:
      "Mål: fullføre 10 km (én norsk mil) på under 60 minutter (~6:00 min/km). Planen bygger gradvis volum med rolige løp, intervaller, tempo og styrke. Juster hastighet på mølle etter form – programmene har forslag.",
    startDate: new Date().toISOString().slice(0, 10),
    weeks: 12,
    createdAt: CREATED,
    weeklyPlans: buildWeeklyPlans(id, SUB60_WEEK_BLUEPRINTS),
  };
}

function buildSub45PeriodPlan(): PeriodSchedulePlan {
  const id = "inspo-period-sub45-10k";
  return {
    id,
    title: "SUB45 · 10 km på under 45 min (12 uker)",
    notes:
      "Mål: fullføre 10 km på under 45 minutter (~4:30 min/km). For deg som allerede løper jevnlig. Inkluderer høyere intensitet, mer styrke og tydeligere taper i uke 11–12.",
    startDate: new Date().toISOString().slice(0, 10),
    weeks: 12,
    createdAt: CREATED,
    weeklyPlans: buildWeeklyPlans(id, SUB45_WEEK_BLUEPRINTS),
  };
}

const SUB60_BODY = `**For hvem?**
Du tåler å jogge/rope 30–40 min og vil strukturert trene mot **10 km under 60 minutter** (ca. 6:00 min/km).

**Slik bruker du planen**
1. Trykk **Legg til periodeplan** – da får du også alle tilhørende treningsprogrammer.
2. Sett startdato til mandag i uke 1.
3. Under **Trening → Periodeplan** ser du ukens økter. Trykk **Start økt** på programmet som står den dagen.

**Ukeoppbygging (12 uker)**
- **Uke 1–3:** Grunnmur – rolig løp, korte intervaller, styrke 1×/uke, langtur som bygges.
- **Uke 4–6:** Mer tempo og litt lengre langtur.
- **Uke 7–9:** Peak – hardeste intervalluker og lengste langtur (~60 min rolig).
- **Uke 10–11:** Litt reduksjon i volum.
- **Uke 12:** Taper + **testløp 10 km** lørdag.

**Styrke og skadeforebygging**
Mandagens styrkeøkt er kort og målrettet mot hofter, sete, core og legg – ikke erstatning for løping, men støtte.

**Viktig**
- Hopp over eller bytt ut økt ved smerte eller sykdom.
- Rolige dager skal føles **lette** – da orker du de harde.
- Spør PT ved smerter i kne, legg eller hofte.`;

const SUB45_BODY = `**For hvem?**
Du løper jevnlig og vil mot **10 km under 45 minutter** (~4:30 min/km). Krever disiplin på både rolige og harde dager.

**Slik bruker du planen**
1. **Legg til periodeplan** – alle løpe- og styrkeprogrammer legges i biblioteket ditt.
2. Start mandag uke 1.
3. Følg kalenderen under Periodeplan og start riktig program hver dag.

**Struktur**
- 4–5 løpedager og 1–2 styrke/mobilitet per uke.
- Intervallprogram åpner **intervalltimer** i appen (nedtelling steg for steg).
- Langtur og rolig løp bygges på mølle – juster fart etter dagsform.

**Uke 12**
Taper mot testløp. Lørdag: **SUB45 · Testløp 10 km** – oppvarming, mål-fart, nedjogg.

**Skadeforebygging**
Styrke fokuserer på enbens øvelser, hofte og legg. Dropp styrke hvis du er støl før intervall – heller mobilitet.`;

export const RUNNING_INSPIRATION_ITEMS: RunningInspirationItem[] = [
  {
    id: "default-period-sub60-10k",
    category: "programs",
    kind: "periodPlan",
    title: "SUB60 · 10 km på under 60 min",
    description: "12-ukers periodeplan med løp, intervaller, styrke og mobilitet mot mil på 1 time.",
    body: SUB60_BODY,
    tag: "12 uker · 10 km",
    author: AUTHOR,
    createdAt: CREATED,
    periodPlanTemplate: buildSub60PeriodPlan(),
    bundledProgramTemplates: buildSub60Programs(),
  },
  {
    id: "default-period-sub45-10k",
    category: "programs",
    kind: "periodPlan",
    title: "SUB45 · 10 km på under 45 min",
    description: "12 uker for erfarne løpere – høyere intensitet og styrke mot sub 45 på 10 km.",
    body: SUB45_BODY,
    tag: "12 uker · 10 km",
    author: AUTHOR,
    createdAt: CREATED,
    periodPlanTemplate: buildSub45PeriodPlan(),
    bundledProgramTemplates: buildSub45Programs(),
  },
];
