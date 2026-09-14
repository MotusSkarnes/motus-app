import { uid } from "./storage";
import type { PeriodSchedulePlan, ProgramExercise, TrainingProgram, WeekdayPlanKey, WeeklyDayPlan } from "./types";

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

const TREADMILL_EASY_ID = "e45";
const TREADMILL_INTERVAL_ID = "e33";

function strengthExercise(
  name: string,
  sets: string,
  reps: string,
  notes = "",
  options?: { weight?: string; exerciseId?: string; holdSeconds?: string },
): ProgramExercise {
  return {
    id: uid("run-str-ex"),
    exerciseId: options?.exerciseId ?? `inspo-${name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
    exerciseName: name,
    sets,
    reps: options?.holdSeconds ? "" : reps,
    weight: options?.weight ?? "0",
    holdSeconds: options?.holdSeconds,
    restSeconds: "75",
    notes,
  };
}

function mobilityExercise(name: string, sets: string, holdSeconds: string, notes = "", exerciseId?: string): ProgramExercise {
  return {
    id: uid("run-mob-ex"),
    exerciseId: exerciseId ?? `inspo-${name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
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
  kind: "easy" | "interval",
  durationMinutes: number,
  speed: string,
  incline: string,
  restSeconds: string,
): ProgramExercise {
  return {
    id: uid("run-cardio-ex"),
    exerciseId: kind === "interval" ? TREADMILL_INTERVAL_ID : TREADMILL_EASY_ID,
    exerciseName: label,
    sets: "1",
    reps: "",
    weight: "",
    durationMinutes: String(durationMinutes),
    speed,
    incline,
    restSeconds,
    notes: "",
  };
}

function buildIntervalProgram(
  title: string,
  goal: string,
  notes: string,
  config: { warmupMin: number; workMin: number; workSpeed: string; reps: number; restSec: number; cooldownMin: number; warmupSpeed: string; cooldownSpeed: string },
): InspirationProgramTemplate {
  const exercises: ProgramExercise[] = [
    cardioStep("Oppvarming", "easy", config.warmupMin, config.warmupSpeed, "1", "0"),
  ];
  for (let index = 0; index < config.reps; index += 1) {
    exercises.push(
      cardioStep(`Drag ${index + 1}`, "interval", config.workMin, config.workSpeed, "1", String(config.restSec)),
    );
  }
  exercises.push(cardioStep("Nedjogg", "easy", config.cooldownMin, config.cooldownSpeed, "0", "0"));
  return { title, goal, notes, exercises, programCreatedBy: "member", programCreatedByName: AUTHOR };
}

function buildSub60Programs(): InspirationProgramTemplate[] {
  return [
    {
      title: SUB60_PROGRAM_TITLES.strength,
      goal: "Skadeforebyggende styrke for løpere",
      notes: "Kontroll foran vekt. Siste repetisjon skal være krevende, men teknisk.",
      exercises: [
        strengthExercise("Goblet squat", "3", "10", "", { exerciseId: "e57" }),
        strengthExercise("Glute bridge", "3", "12", "", { exerciseId: "e60" }),
        strengthExercise("Monster walk", "2", "14", "Små steg", { exerciseId: "e159" }),
        strengthExercise("Planke", "3", "", "", { exerciseId: "e29", holdSeconds: "45" }),
        strengthExercise("Båndet knebøy", "2", "15", "Lett motstand"),
        strengthExercise("Stående tåhev", "3", "15"),
        strengthExercise("Single-leg hip thrust", "2", "10", "Per side"),
        strengthExercise("Tibialis raise", "2", "15", "", { exerciseId: "e111" }),
      ],
      programCreatedBy: "member",
      programCreatedByName: AUTHOR,
      imageUrl: RUNNER_STRENGTH_COVER_IMAGE,
    },
    {
      title: SUB60_PROGRAM_TITLES.mobility,
      goal: "Mobilitet og restitusjon for løpere",
      notes: "Rolig tempo. Stopp før smerte.",
      exercises: [
        mobilityExercise("World's greatest stretch", "2", "45", "Per side", "e161"),
        mobilityExercise("90/90 hofte-rotasjon", "2", "45", "Per side"),
        mobilityExercise("Couch stretch", "2", "45", "Per side", "e166"),
        mobilityExercise("Leggstrekk mot vegg", "2", "45", "Per side"),
        mobilityExercise("Ankelmobilitet kne-til-vegg", "2", "45", "Per side"),
        mobilityExercise("Pigeon stretch", "2", "45", "Per side"),
        mobilityExercise("Setestrekk liggende", "2", "45", "Per side"),
      ],
      programCreatedBy: "member",
      programCreatedByName: AUTHOR,
      imageUrl: RUNNER_MOBILITY_COVER_IMAGE,
    },
    {
      title: SUB60_PROGRAM_TITLES.easy,
      goal: "Rolig sone 2 – bygger grunnform",
      notes: "Snakketempo. Du skal kunne holde en setning.",
      exercises: [cardioStep("Rolig løp", "easy", 38, "9.0", "1", "0")],
      programCreatedBy: "member",
      programCreatedByName: AUTHOR,
    },
    {
      title: SUB60_PROGRAM_TITLES.tempo,
      goal: "Kontinuerlig tempo mot 10 km-fart",
      notes: "Jevn innsats. Ikke start for hardt.",
      exercises: [
        cardioStep("Oppvarming", "easy", 10, "8.5", "1", "0"),
        cardioStep("Tempo", "easy", 14, "10.0", "1", "0"),
        cardioStep("Nedjogg", "easy", 8, "7.5", "0", "0"),
      ],
      programCreatedBy: "member",
      programCreatedByName: AUTHOR,
    },
    buildIntervalProgram(SUB60_PROGRAM_TITLES.interval, "Korte intervaller for fart og teknikk", "Start kontrollert. Juster farten etter dagsform.", {
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
      notes: "Samme rolige tempo hele veien. Siste 10 min kan være lettere.",
      exercises: [cardioStep("Langtur", "easy", 52, "8.8", "1", "0")],
      programCreatedBy: "member",
      programCreatedByName: AUTHOR,
      imageUrl: SUB60_LONG_RUN_COVER_IMAGE,
    },
    {
      title: SUB60_PROGRAM_TITLES.race,
      goal: "Test eller måløkt 10 km",
      notes: "Hold mål-farten. Ikke gå ut for hardt.",
      exercises: [
        cardioStep("Oppvarming", "easy", 15, "8.5", "1", "0"),
        cardioStep("Målfart 10 km", "easy", 60, "10.0", "1", "0"),
        cardioStep("Nedjogg", "easy", 10, "7.0", "0", "0"),
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
      notes: "Kvalitet foran kvantum. Hold 1–2 repetisjoner i reserve.",
      exercises: [
        strengthExercise("Bulgarian split squat", "3", "8", "Per side", { exerciseId: "e7" }),
        strengthExercise("Hip thrust", "3", "10", "", { exerciseId: "e8" }),
        strengthExercise("Monster walk", "2", "16", "", { exerciseId: "e159" }),
        strengthExercise("Planke", "3", "", "", { exerciseId: "e29", holdSeconds: "50" }),
        strengthExercise("Abduksjon maskin", "2", "15"),
        strengthExercise("Stående tåhev", "3", "18"),
        strengthExercise("Leg curl", "3", "12", "", { exerciseId: "e9" }),
        strengthExercise("Sideplanke med hoftehev", "2", "12", "Per side"),
      ],
      programCreatedBy: "member",
      programCreatedByName: AUTHOR,
      imageUrl: RUNNER_STRENGTH_COVER_IMAGE,
    },
    {
      title: SUB45_PROGRAM_TITLES.mobility,
      goal: "Mobilitet for høy løpebelastning",
      notes: "Kort og ofte. Hofte, legg og ankler.",
      exercises: [
        mobilityExercise("World's greatest stretch", "2", "50", "Per side", "e161"),
        mobilityExercise("90/90 hofte-rotasjon", "2", "50", "Per side"),
        mobilityExercise("Couch stretch", "2", "50", "Per side", "e166"),
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
      notes: "Lett nok til å snakke i setninger.",
      exercises: [cardioStep("Rolig løp", "easy", 40, "10.5", "1", "0")],
      programCreatedBy: "member",
      programCreatedByName: AUTHOR,
    },
    {
      title: SUB45_PROGRAM_TITLES.tempo,
      goal: "Tempo mot sub 45 min på 10 km",
      notes: "Jevn innsats mot 10 km-fart. Ikke start for hardt.",
      exercises: [
        cardioStep("Oppvarming", "easy", 10, "10", "1", "0"),
        cardioStep("Tempo", "easy", 18, "12.5", "1", "0"),
        cardioStep("Nedjogg", "easy", 8, "9", "0", "0"),
      ],
      programCreatedBy: "member",
      programCreatedByName: AUTHOR,
    },
    buildIntervalProgram(SUB45_PROGRAM_TITLES.interval, "Intervaller for fart", "Sterk innsats, kontrollert løpeteknikk.", {
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
      notes: "Rolig sone 2. Siste 15 min kan være lettere.",
      exercises: [cardioStep("Langtur", "easy", 58, "10", "1", "0")],
      programCreatedBy: "member",
      programCreatedByName: AUTHOR,
    },
    {
      title: SUB45_PROGRAM_TITLES.race,
      goal: "Konkurransetest 10 km",
      notes: "Hold mål-farten. Ikke gå ut for hardt.",
      exercises: [
        cardioStep("Oppvarming", "easy", 15, "10", "1", "0"),
        cardioStep("Målfart 10 km", "easy", 45, "13.3", "1", "0"),
        cardioStep("Nedjogg", "easy", 10, "8.5", "0", "0"),
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
    notes: "12 uker mot 10 km under 60 min. Følg ukens økter og hold de rolige dagene lette.",
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
    notes: "12 uker mot 10 km under 45 min. Hold de rolige øktene rolige, så orker du de harde.",
    startDate: new Date().toISOString().slice(0, 10),
    weeks: 12,
    createdAt: CREATED,
    weeklyPlans: buildWeeklyPlans(id, SUB45_WEEK_BLUEPRINTS),
  };
}

const SUB60_BODY = `**For hvem?** Du tåler 30–40 min jog og vil løpe 10 km på under 60 min.

**Slik bruker du planen**
1. Trykk **Legg til plan** – da følger alle øktene med.
2. Åpne **Trening → Plan** og start programmet som står den dagen.
3. Fart og tid står på hvert steg. Juster etter dagsform.

**Uke 1–3** grunnmur · **Uke 4–6** mer tempo · **Uke 7–9** peak · **Uke 10–12** taper og testløp lørdag uke 12.

Rolige dager skal føles lette. Hopp over økt ved smerte, og spør PT ved vondter i kne, legg eller hofte.`;

const SUB45_BODY = `**For hvem?** Du løper jevnlig og vil ned mot 10 km på under 45 min.

**Slik bruker du planen**
1. Trykk **Legg til plan** – da følger alle øktene med.
2. Åpne **Trening → Plan** og start programmet som står den dagen.
3. Intervalløkter åpner timer med nedtelling. Øvrige økter viser steg, tid og fart.

**Uke 12:** taper, deretter testløp lørdag.

Hold rolige økter rolige. Dropp styrke hvis du er støl før intervall – da er mobilitet bedre.`;

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

function runningProgramTemplateByTitle(): Map<string, InspirationProgramTemplate> {
  const map = new Map<string, InspirationProgramTemplate>();
  for (const item of RUNNING_INSPIRATION_ITEMS) {
    for (const program of item.bundledProgramTemplates) {
      map.set(program.title, program);
    }
  }
  return map;
}

/** Oppdater SUB60/SUB45-kopier slik at steg heter det de er, uten rotete notater. */
export function tidyInspirationRunningProgram(program: TrainingProgram): TrainingProgram {
  const template = runningProgramTemplateByTitle().get(program.title.trim());
  if (!template) return program;
  const exercises = (program.exercises ?? []).map((exercise, index) => {
    const fromTemplate = template.exercises[index];
    if (!fromTemplate) return exercise;
    return {
      ...exercise,
      exerciseId: fromTemplate.exerciseId || exercise.exerciseId,
      exerciseName: fromTemplate.exerciseName,
      notes: fromTemplate.notes,
      holdSeconds: fromTemplate.holdSeconds ?? exercise.holdSeconds,
      reps: fromTemplate.holdSeconds ? "" : exercise.reps,
    };
  });
  return {
    ...program,
    goal: template.goal,
    notes: template.notes,
    exercises,
  };
}
