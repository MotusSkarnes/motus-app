import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Bold,
  Brain,
  CalendarHeart,
  ClipboardList,
  Dumbbell,
  Flame,
  Footprints,
  Heading2,
  Heading3,
  ImagePlus,
  Italic,
  LayoutGrid,
  Lightbulb,
  Link2,
  List,
  ListOrdered,
  Newspaper,
  Pencil,
  Plus,
  Quote,
  Smartphone,
  Soup,
  Sparkles,
  Sun,
  Trash2,
  Users,
} from "lucide-react";
import { MOTUS } from "../app/data";
import {
  filterRecipesFromInspirationHub,
  mergeHubItemsPreservingRecipes,
} from "../app/inspirationHubItems";
import { EXERCISE_CATEGORY_OPTIONS, exerciseCategoryAccentColor } from "../app/exerciseCategories";
import { buildProgramExerciseFromBank, resolveExercisePrescriptionFields } from "../app/exercisePrescriptionFields";
import { ProgramExercisePrescriptionFields } from "./ProgramExercisePrescriptionFields";
import { formatProgramExercisePrescription, resolveProgramExerciseName } from "../app/programExercisePresentation";
import { EXERCISE_IMAGE_THUMB_CLASS } from "../app/exerciseIllustrations/constants";
import { getMedicalSketchFallbackDataUri, resolveExerciseImageSrc } from "../app/exerciseIllustrations";
import { compressImageDataUrl, compressImageFile } from "../app/imageCompress";
import { imageObjectPositionFromSrc } from "../app/imageFocalPoint";
import { uploadProgramCoverImageToSupabase } from "../app/programImageUpload";
import {
  fetchInspirationItemsForHub,
  filterSuppressedInspirationItems,
  INSPIRATION_CHANGED_EVENT,
  INSPIRATION_HERO_CHANGED_EVENT,
  INSPIRATION_STORAGE_KEY,
  loadInspirationHeroFromLocalStorage,
  loadInspirationItemsFromLocalStorage,
  mergeDefaultInspirationItems,
  notifyInspirationItemsChanged,
  persistInspirationHero,
  persistInspirationItems,
  pullInspirationFeedFromRemote,
  pullInspirationHeroFromRemote,
  suppressInspirationItemId,
  syncLocalInspirationToSupabaseIfNeeded,
  type InspirationHeroConfig,
} from "../app/inspirationStorage";
import { RUNNING_INSPIRATION_ITEMS } from "../app/inspirationRunningPlans";
import { buildPeriodPlanProgramSelectOptions, WEEKDAY_PLAN_FIELDS } from "../app/periodPlanBuilder";
import { normalizePeriodSchedulePlan, syncGradientMarkedWeekDays } from "../app/periodPlanMerge";
import { uid } from "../app/storage";
import { EmptyState, GradientButton, MotusSectionIcon, OutlineButton, SelectBox, TextArea, TextInput } from "../app/ui";
import { isSupabaseConfigured, supabaseClient } from "../services/supabaseClient";
import { ProgramCoverImageField } from "./ProgramCoverImageField";
import { ExerciseBankListCard } from "./ExerciseBankListCard";
import type { Exercise, Member, PeriodSchedulePlan, ProgramExercise, WeekdayPlanKey, WeeklyDayPlan, WeeklySchedulePlan } from "../app/types";
import type { SaveProgramInput } from "../services/appRepository";

type InspirationCategory = "recipes" | "programs" | "tips" | "news" | "appGuide";
type InspoSubView = "overview" | "appGuide";
type InspirationKind = "article" | "program" | "periodPlan";
type InspirationBodyStyle = "normal" | "bold" | "italic";
type ProgramTemplateInput = Omit<SaveProgramInput, "memberId">;

type InspirationItem = {
  id: string;
  category: InspirationCategory;
  kind: InspirationKind;
  title: string;
  description: string;
  body: string;
  bodyStyle?: InspirationBodyStyle;
  tag: string;
  author: string;
  createdAt: string;
  imageUrl?: string;
  programTemplate?: ProgramTemplateInput;
  periodPlanTemplate?: PeriodSchedulePlan;
  /** Medfølgende programmer når medlem legger til periodeplan (f.eks. løpeplaner). */
  bundledProgramTemplates?: ProgramTemplateInput[];
};

const MOTUS_GRADIENT = `${MOTUS.gradient}`;

/* Standard hero-bilde (PT kan bytte). Filen ligger i /public, så ingen import-bundling. */
const DEFAULT_INSPO_HERO_IMAGE = "/share/inspo-hero-woman.png";
const DEFAULT_INSPO_HERO_TITLE = "Bygg vaner som varer";
const DEFAULT_INSPO_HERO_SUBTITLE = "Små steg i dag — stor forskjell i morgen.";
const DEFAULT_INSPO_HERO_CTA = "Utforsk nå";
const FEATURED_ARTICLE_BADGE = "Dagens utvalgte";

/** Stabil daglig rotasjon — alle medlemmer ser samme artikkel samme dag, ny i morgen. */
function pickFeaturedItemFromPool<T extends { id: string }>(pool: T[], now = new Date()): T | null {
  if (!pool.length) return null;
  const startOfYear = new Date(now.getFullYear(), 0, 0).getTime();
  const dayOfYear = Math.floor((now.getTime() - startOfYear) / 86_400_000);
  const idx = ((dayOfYear % pool.length) + pool.length) % pool.length;
  return pool[idx] ?? null;
}

type InspoBadgeTone = "turquoise" | "pink";

function badgeToneForCategory(category: InspirationCategory): InspoBadgeTone {
  switch (category) {
    case "tips":
    case "news":
      return "pink";
    case "recipes":
    case "programs":
    case "appGuide":
    default:
      return "turquoise";
  }
}

const CATEGORY_META: Record<InspirationCategory, { label: string; plural: string; icon: typeof Soup }> = {
  recipes: { label: "Oppskrift", plural: "Oppskrifter", icon: Soup },
  programs: { label: "Trening", plural: "Treningsprogram", icon: ClipboardList },
  tips: { label: "Tips", plural: "Råd og tips", icon: Lightbulb },
  news: { label: "Info", plural: "Info fra senteret", icon: Newspaper },
  appGuide: { label: "App-guide", plural: "App-guide", icon: Smartphone },
};

const APP_GUIDE_TAG = "app-guide";

type QuickCategory = {
  id: string;
  label: string;
  icon: typeof ClipboardList;
  scrollToCategory: InspirationCategory;
  match: (item: InspirationItem) => boolean;
  tone: "mint" | "pink" | "mintSoft" | "pinkSoft";
};

function textIncludesAny(value: string, terms: string[]): boolean {
  const lower = value.toLowerCase();
  return terms.some((term) => lower.includes(term));
}

const QUICK_CATEGORIES: readonly QuickCategory[] = [
  {
    id: "running",
    label: "Løping",
    icon: Footprints,
    scrollToCategory: "programs",
    tone: "mint",
    match: (item) =>
      textIncludesAny(`${item.title} ${item.tag} ${item.description}`, [
        "løp",
        "løping",
        "running",
        "interval",
        "5k",
        "10k",
        "sub45",
        "sub60",
      ]),
  },
  {
    id: "strength",
    label: "Styrke",
    icon: Dumbbell,
    scrollToCategory: "programs",
    tone: "pink",
    match: (item) =>
      textIncludesAny(`${item.title} ${item.tag} ${item.description}`, [
        "styrke",
        "strength",
        "muskel",
        "strong",
        "kraft",
      ]),
  },
  {
    id: "motivation",
    label: "Motivasjon",
    icon: Brain,
    scrollToCategory: "tips",
    tone: "pinkSoft",
    match: (item) => item.category === "tips",
  },
];

const NEWS_TONES: Array<{
  key: string;
  bg: string;
  ring: string;
  iconBg: string;
  iconColor: string;
  icon: typeof Sun;
  dark?: boolean;
}> = [
  { key: "mint", bg: "#D6FBF1", ring: "rgba(48,227,190,0.5)", iconBg: "#30E3BE", iconColor: "#0B5C4D", icon: Sun },
  { key: "pink", bg: "#FFE5F0", ring: "rgba(217,18,120,0.32)", iconBg: "#D91278", iconColor: "#FFFFFF", icon: Users },
  { key: "ink", bg: "#0F172A", ring: "rgba(48,227,190,0.6)", iconBg: "#30E3BE", iconColor: "#0F172A", icon: CalendarHeart, dark: true },
];

function pickNewsTone(index: number) {
  return NEWS_TONES[index % NEWS_TONES.length];
}

function isAppGuideItem(item: Pick<InspirationItem, "category" | "tag">): boolean {
  if (item.category === "appGuide") return true;
  return item.tag.trim().toLowerCase() === APP_GUIDE_TAG;
}

function normalizeInspirationItem(item: InspirationItem): InspirationItem {
  if (!isAppGuideItem(item)) return item;
  return {
    ...item,
    category: "appGuide",
    tag: item.tag.trim() || "App-guide",
  };
}

function normalizeInspirationItems(items: InspirationItem[]): InspirationItem[] {
  return items.map(normalizeInspirationItem);
}

/** Vertikal rekkefølge på inspo-feed (øverst → nederst). */
/** Maks lengde for undertekst på inspo-kort (ca. 3 linjer i karusellen). */
const INSPO_CARD_DESCRIPTION_MAX = 120;
const INSPO_CARD_TITLE_MAX = 88;
const INSPO_FEED_CARD_WIDTH_CLASS = "w-52 sm:w-56";
const INSPO_FEED_CARD_HEIGHT_CLASS = "h-[24rem] sm:h-[24.75rem]";
const INSPO_FEED_CARD_IMAGE_CLASS = "aspect-square";
const INSPO_FEED_CARD_TITLE_CLASS = "line-clamp-3 overflow-hidden text-sm font-semibold leading-[1.2] text-slate-950";
const INSPO_FEED_CARD_DESCRIPTION_CLASS =
  "line-clamp-3 overflow-hidden text-xs leading-[1.2] text-slate-500";
const INSPO_FEED_CARD_ACTION_CLASS = "!min-h-8 !px-2 !py-1.5 !text-[11px] !leading-tight";

const INSPIRATION_OVERVIEW_SECTIONS: readonly { category: InspirationCategory; title: string }[] = [
  { category: "programs", title: "Treningsprogram" },
  { category: "news", title: "Info fra senteret" },
  { category: "tips", title: "Råd og tips" },
];

const INSPIRATION_APP_GUIDE_SECTION: readonly { category: InspirationCategory; title: string }[] = [
  { category: "appGuide", title: "App-guide" },
];

const BODY_STYLE_OPTIONS: Array<{ value: InspirationBodyStyle; label: string; className: string }> = [
  { value: "normal", label: "Vanlig", className: "font-normal not-italic" },
  { value: "bold", label: "Bold", className: "font-bold not-italic" },
  { value: "italic", label: "Kursiv", className: "font-normal italic" },
];

function bodyStyleClass(style?: InspirationBodyStyle): string {
  return BODY_STYLE_OPTIONS.find((option) => option.value === style)?.className ?? BODY_STYLE_OPTIONS[0].className;
}

function renderInlineMarkdown(value: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  const pattern = /(\*\*[^*]+?\*\*|\*[^*]+?\*|\[[^\]]+?\]\([^)]+?\))/g;
  let cursor = 0;
  let match: RegExpExecArray | null;
  let counter = 0;
  while ((match = pattern.exec(value)) !== null) {
    if (match.index > cursor) nodes.push(value.slice(cursor, match.index));
    const token = match[0];
    if (token.startsWith("**")) {
      nodes.push(
        <strong key={`b${counter++}`} className="font-bold text-slate-900">
          {token.slice(2, -2)}
        </strong>,
      );
    } else if (token.startsWith("[")) {
      const linkMatch = token.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
      if (linkMatch) {
        const [, label, url] = linkMatch;
        nodes.push(
          <a
            key={`l${counter++}`}
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-teal-700 underline decoration-teal-400 underline-offset-2 hover:text-teal-900"
          >
            {label}
          </a>,
        );
      } else {
        nodes.push(token);
      }
    } else {
      nodes.push(
        <em key={`i${counter++}`} className="italic">
          {token.slice(1, -1)}
        </em>,
      );
    }
    cursor = match.index + token.length;
  }
  if (cursor < value.length) nodes.push(value.slice(cursor));
  return nodes;
}

function renderFormattedBody(value: string): ReactNode[] {
  const blocks: ReactNode[] = [];
  const lines = value.split("\n");
  let listBuffer: { kind: "ul" | "ol"; items: string[] } | null = null;
  let paragraphBuffer: string[] = [];
  let blockIndex = 0;

  const flushList = () => {
    if (!listBuffer) return;
    const items = listBuffer.items;
    if (listBuffer.kind === "ul") {
      blocks.push(
        <ul key={`b${blockIndex++}`} className="my-2 list-disc space-y-1 pl-5">
          {items.map((line, idx) => (
            <li key={idx}>{renderInlineMarkdown(line)}</li>
          ))}
        </ul>,
      );
    } else {
      blocks.push(
        <ol key={`b${blockIndex++}`} className="my-2 list-decimal space-y-1 pl-5">
          {items.map((line, idx) => (
            <li key={idx}>{renderInlineMarkdown(line)}</li>
          ))}
        </ol>,
      );
    }
    listBuffer = null;
  };

  const flushParagraph = () => {
    if (!paragraphBuffer.length) return;
    blocks.push(
      <p key={`b${blockIndex++}`} className="whitespace-pre-wrap">
        {renderInlineMarkdown(paragraphBuffer.join("\n"))}
      </p>,
    );
    paragraphBuffer = [];
  };

  lines.forEach((line) => {
    if (line.startsWith("### ")) {
      flushList();
      flushParagraph();
      blocks.push(
        <h4 key={`b${blockIndex++}`} className="mt-3 text-base font-bold text-slate-900">
          {renderInlineMarkdown(line.slice(4))}
        </h4>,
      );
    } else if (line.startsWith("## ")) {
      flushList();
      flushParagraph();
      blocks.push(
        <h3 key={`b${blockIndex++}`} className="mt-4 text-lg font-bold text-slate-900">
          {renderInlineMarkdown(line.slice(3))}
        </h3>,
      );
    } else if (line.startsWith("- ")) {
      flushParagraph();
      if (listBuffer && listBuffer.kind !== "ul") flushList();
      if (!listBuffer) listBuffer = { kind: "ul", items: [] };
      listBuffer.items.push(line.slice(2));
    } else if (/^\d+\.\s/.test(line)) {
      flushParagraph();
      if (listBuffer && listBuffer.kind !== "ol") flushList();
      if (!listBuffer) listBuffer = { kind: "ol", items: [] };
      listBuffer.items.push(line.replace(/^\d+\.\s/, ""));
    } else if (line.trim() === "") {
      flushList();
      flushParagraph();
    } else {
      flushList();
      paragraphBuffer.push(line);
    }
  });
  flushList();
  flushParagraph();
  return blocks;
}

function splitMultiValue(value: string): string[] {
  return String(value ?? "")
    .split(/[,;|/]/)
    .map((part) => part.trim())
    .filter(Boolean);
}

function multiValueIncludes(value: string, candidate: string): boolean {
  const normalized = candidate.trim().toLowerCase();
  return splitMultiValue(value).some((item) => item.toLowerCase() === normalized);
}

function getExerciseSketchDataUri(exercise: Exercise): string {
  return getMedicalSketchFallbackDataUri(exercise);
}

function getExercisePreviewSrc(exercise: Exercise): string {
  return resolveExerciseImageSrc(exercise);
}

function programExerciseFromBank(exercise: Exercise): ProgramExercise {
  return { ...buildProgramExerciseFromBank(exercise), id: uid("inspo-prog-ex") };
}

function linkProgramExercisesToBank(exercises: ProgramExercise[], bank: Exercise[]): ProgramExercise[] {
  if (!bank.length) return exercises;
  const byId = new Map(bank.map((exercise) => [exercise.id, exercise]));
  const byName = new Map(bank.map((exercise) => [exercise.name.trim().toLowerCase(), exercise]));
  return exercises.map((row) => {
    const linked = byId.get(row.exerciseId);
    if (linked) return { ...row, exerciseName: linked.name };
    const match = byName.get(row.exerciseName.trim().toLowerCase());
    if (match) return { ...row, exerciseId: match.id, exerciseName: match.name };
    return row;
  });
}

function resolveProgramTemplateForItem(item: InspirationItem, exerciseBank: Exercise[]): ProgramTemplateInput {
  const base = item.programTemplate ?? createDefaultProgram(item.title, item.description, item.body);
  return {
    ...base,
    title: base.title?.trim() || item.title,
    goal: base.goal?.trim() || item.description,
    notes: base.notes?.trim() || item.body,
    imageUrl: base.imageUrl?.trim() || item.programTemplate?.imageUrl?.trim() || item.imageUrl?.trim() || undefined,
    exercises: linkProgramExercisesToBank(base.exercises ?? [], exerciseBank),
  };
}

function resolveLinkedExerciseForPreview(
  exercise: ProgramExercise,
  exercisesById: Map<string, Exercise>,
  exerciseBank: Exercise[],
): Exercise | undefined {
  const byId = exercisesById.get(exercise.exerciseId);
  if (byId) return byId;
  return exerciseBank.find((entry) => entry.name.trim().toLowerCase() === exercise.exerciseName.trim().toLowerCase());
}

function makeExercise(name: string, sets = "3", reps = "10", notes = ""): ProgramExercise {
  return {
    id: uid("inspo-ex"),
    exerciseId: `inspo-${name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
    exerciseName: name,
    sets,
    reps,
    weight: "",
    restSeconds: "60",
    notes,
  };
}

function createEmptyProgramTemplate(title: string, description: string, body: string): ProgramTemplateInput {
  return {
    title,
    goal: description || "Inspirasjonsprogram",
    notes: body,
    exercises: [],
    programCreatedBy: "member",
    programCreatedByName: "Motus inspirasjon",
  };
}

function createDefaultProgram(title: string, description: string, body: string): ProgramTemplateInput {
  return {
    title,
    goal: description || "Inspirasjonsprogram",
    notes: body,
    exercises: [
      makeExercise("Knebøy", "3", "10", "Kontrollert tempo"),
      makeExercise("Pushups", "3", "8-12", "Tilpass på knær ved behov"),
      makeExercise("Roing", "3", "10", "Hold skulderbladene samlet"),
      makeExercise("Planke", "3", "30 sek", "Rolig pust"),
    ],
    programCreatedBy: "member",
    programCreatedByName: "Motus inspirasjon",
  };
}

function emptyWeek(): WeeklyDayPlan {
  return {
    monday: "",
    tuesday: "",
    wednesday: "",
    thursday: "",
    friday: "",
    saturday: "",
    sunday: "",
  };
}

function createDefaultPeriodPlan(title: string, body: string): PeriodSchedulePlan {
  return {
    id: uid("inspo-period"),
    title,
    notes: body,
    startDate: new Date().toISOString().slice(0, 10),
    weeks: 1,
    createdAt: new Date().toISOString().slice(0, 10),
    weeklyPlans: [
      {
        id: uid("inspo-week"),
        weekNumber: 1,
        days: {
          ...emptyWeek(),
          monday: "Fullkropp styrke",
          wednesday: "Kondisjon rolig sone 2",
          friday: "Fullkropp styrke",
          sunday: "Mobilitet og lett tur",
        },
      },
    ],
  };
}

const DEFAULT_ITEMS: InspirationItem[] = [
  {
    id: "default-program-1",
    category: "programs",
    kind: "program",
    title: "Fullkropp 30 minutter",
    description: "Kort økt for travle dager.",
    body: "Et enkelt fullkroppsprogram med fire øvelser og rolig progresjon.",
    tag: "Nybegynner",
    author: "Motus",
    createdAt: "2026-05-01",
    programTemplate: createDefaultProgram("Fullkropp 30 minutter", "Kort økt for travle dager", "Kjør 3 runder med rolig oppvarming først."),
  },
  {
    id: "default-period-1",
    category: "programs",
    kind: "periodPlan",
    title: "Balansert startuke",
    description: "En ferdig ukeplan du kan legge til som periodeplan.",
    body: "Passer for medlemmer som vil ha struktur uten å trene hver dag.",
    tag: "Ukesplan",
    author: "Motus",
    createdAt: "2026-05-01",
    periodPlanTemplate: createDefaultPeriodPlan("Balansert startuke", "Ferdig inspirasjonsuke fra Motus."),
  },
  {
    id: "default-tip-1",
    category: "tips",
    kind: "article",
    title: "Gjør neste økt lettere å starte",
    description: "Legg frem klær og bestem første øvelse i kveld.",
    body: "Når første steg er klart, blir terskelen lavere. Velg én ting du skal gjøre uansett, og la resten være bonus.",
    tag: "Vaner",
    author: "Motus",
    createdAt: "2026-05-01",
  },
  {
    id: "default-tip-2",
    category: "appGuide",
    kind: "article",
    title: "Slik bruker du øktmodus",
    description: "Start program, logg sett underveis og fullfør økten.",
    body: "Øktmodus er den guidede treningsvisningen når du følger et program sett for sett.\n\n**Kom i gang**\n1. Gå til **Trening** og finn programmet du skal kjøre.\n2. Trykk **Start** på programkortet.\n3. Øktmodus åpnes med første øvelse øverst.\n\n**Under økten**\n- Fyll inn det du faktisk gjør (reps, vekt, tid osv.) og huk av hvert sett når det er gjort.\n- Trykk på **bilde/Info** ved øvelsen for større bilde og forklaring uten å avslutte økta.\n- **Bytt** lar deg velge en annen øvelse i samme muskelgruppe hvis utstyr er opptatt.\n- **Ta neste øvelse først** hopper over nåværende øvelse midlertidig – den kommer tilbake rett etter neste.\n\n**Avslutte**\nNår du er ferdig, fullfør økten i øktmodus. Da lagres loggen i historikken din, og eventuelle personlige rekorder feires underveis.",
    tag: "App-guide",
    author: "Motus",
    createdAt: "2026-05-16",
  },
  {
    id: "default-tip-3",
    category: "appGuide",
    kind: "article",
    title: "Lag egne treningsprogram",
    description: "Bygg en økt under Trening og lagre den i biblioteket.",
    body: "Du trenger ikke vente på trener for å komme i gang – du kan lage egne opplegg.\n\n**Bygg økten**\n1. Gå til **Trening** og scroll til **Lag egen økt**.\n2. Søk i øvelseslisten og trykk **Legg til** på øvelsene du vil ha.\n3. Juster sett, reps og vekt (eller sekunder for uttøyning) på hver linje.\n\n**To måter å bruke den på**\n- **Start egen økt** – tren med en gang uten å lagre programmet.\n- **Lagre som treningsprogram** – gi programmet et navn og legg det i biblioteket ditt, slik at du kan starte det på nytt senere med **Start**.\n\nEgne programmer kan **skjules, arkiveres eller slettes** fra menyen (⋯) på programkortet. Programmer fra trener kan du skjule eller arkivere, men ikke slette.",
    tag: "App-guide",
    author: "Motus",
    createdAt: "2026-05-16",
  },
  {
    id: "default-tip-4",
    category: "appGuide",
    kind: "article",
    title: "Endre øvelser i program og under økt",
    description: "Bytt under trening, eller lag et nytt program med andre øvelser.",
    body: "**Under en pågående økt (øktmodus)**\nTrykk **Bytt** ved øvelsen du står på. Du får forslag i samme muskelgruppe – velg den som passer utstyr og tid. Endringen gjelder resten av den økten.\n\n**Før du starter**\n- For **egne programmer**: gå til **Lag egen økt**, bygg økten på nytt og trykk **Lagre som treningsprogram** (du kan slette det gamle programmet fra ⋯-menyen hvis du vil).\n- For **program fra trener**: be trener om justering, eller bruk **Bytt** i øktmodus når noe ikke passer den dagen.\n\n**Se innholdet**\nUnder **Trening** kan du trykke **Vis** på et programkort for å se alle øvelser, sett og plan før du starter.",
    tag: "App-guide",
    author: "Motus",
    createdAt: "2026-05-16",
  },
  {
    id: "default-tip-5",
    category: "appGuide",
    kind: "article",
    title: "Intervalløkter med nedtelling",
    description: "Kondisjonsprogram med automatisk steg-for-steg-timer.",
    body: "Noen kondisjonsprogram (f.eks. mølleintervaller) bruker **intervallvindu** i stedet for vanlig øktmodus.\n\n**Start**\n1. Gå til **Trening** og finn intervallprogrammet (ofte merket som intervall/kondisjon).\n2. Trykk **Start** – da åpnes intervallvinduet med nedtelling.\n3. Trykk **Start økt** når du er klar.\n\n**Under økten**\n- Stor **nedtelling** viser tid igjen på aktivt steg (arbeid, pause, oppvarming osv.).\n- Du ser **fart, stigning og målpuls** når trener har lagt det inn.\n- **Neste**-feltet viser hva som kommer etterpå.\n- **Pause** / **Fortsett**, **Hopp over** og **Nullstill** ligger nederst.\n\nNår siste steg er fullført, får du beskjed om at intervalløkten er ferdig. Vanlige styrkeprogram bruker fortsatt øktmodus – bare intervallprogram åpner denne timeren.",
    tag: "App-guide",
    author: "Motus",
    createdAt: "2026-05-16",
  },
  {
    id: "default-tip-6",
    category: "appGuide",
    kind: "article",
    title: "Legg Motus på hjemskjermen",
    description: "Raskere tilgang på iPhone, iPad og Android.",
    body: "Motus kan legges på hjemskjermen som en app – da åpner den seg i fullskjerm uten nettleserens adresselinje.\n\n**iPhone og iPad (Safari)**\n1. Åpne Motus i **Safari** (ikke Chrome på iOS).\n2. Trykk **Del**-ikonet (firkant med pil opp).\n3. Velg **Legg til på Hjem-skjerm** / **Add to Home Screen**.\n4. Bekreft navnet og trykk **Legg til**.\n\n**Android (Chrome)**\n1. Åpne Motus i **Chrome**.\n2. Trykk **meny** (tre prikker) øverst til høyre.\n3. Velg **Legg til på startskjerm** eller **Installer app** (teksten kan variere).\n4. Bekreft – ikonet dukker opp på hjemskjermen.\n\n**Tips:** Bruk samme innlogging som før. Oppdater siden én gang etter installasjon hvis noe virker gammelt. På iOS må du bruke Safari for å få «Legg til på Hjem-skjerm».",
    tag: "App-guide",
    author: "Motus",
    createdAt: "2026-05-16",
  },
  {
    id: "default-tip-7",
    category: "appGuide",
    kind: "article",
    title: "Organiser programbiblioteket",
    description: "Arkiver eller slett – hold oversikten ryddig.",
    body: "Under **Trening** samles programmer fra trener og dine egne.\n\n**Menyen (⋯) på hvert program**\n- **Arkiver** – programmet forsvinner fra hovedlisten, men ligger fortsatt lagret.\n- **Slett program** – kun for programmer du selv har laget.\n\n**Gjenopprette**\nScroll til seksjonen for arkiverte programmer og velg **Gjenopprett**.\n\nDette endrer ikke det trener har skrevet – det styrer bare hva **du** ser i appen.",
    tag: "App-guide",
    author: "Motus",
    createdAt: "2026-05-16",
  },
  {
    id: "default-tip-8",
    category: "appGuide",
    kind: "article",
    title: "Følg fremgang og personlige rekorder",
    description: "Historikk, streak og feiring når du slår rekorden din.",
    body: "Motus husker øktene du fullfører.\n\n**Etter trening**\n- Fullførte økter lagres med dato, program og det du logget.\n- Under **Fremgang** (eller tilsvarende oversikt i appen) ser du trend, streak og aktivitet siste dager.\n\n**Personlige rekorder (PR)**\nI øktmodus sammenlignes resultatet ditt med tidligere beste på samme øvelse. Slår du rekorden, får du en kort feiring – den gjelder **øvelsen du nettopp gjorde**, ikke hele økta.\n\n**Badges og deling**\nNoen milepæler gir badges. Du kan også dele en enkel fremgangsgraf med venner – nyttig for motivasjon uten å dele hele treningsloggen.",
    tag: "App-guide",
    author: "Motus",
    createdAt: "2026-05-16",
  },
  {
    id: "default-tip-9",
    category: "appGuide",
    kind: "article",
    title: "Utforsk og meldinger",
    description: "Finn tips, nyheter og svar fra trener på ett sted.",
    body: "**Utforsk-fanen** har to deler:\n- **Utforsk** – info fra senteret, treningsprogram og råd og tips.\n- **App-guide** – steg-for-steg om hvordan du bruker Motus (øktmodus, egne programmer, hjemskjerm osv.).\n\nOppskrifter finner du under **Mat / Ernæring**.\n\nBytt mellom dem med knappene øverst under overskriften. Trykk på et kort for å lese hele teksten. Nye innlegg kan også dukke opp som **varsler** – da hopper du rett til innlegget.\n\nHar du spørsmål om program eller skader? Bruk **melding** til trener i stedet for å gjette – da får du svar tilpasset deg.",
    tag: "App-guide",
    author: "Motus",
    createdAt: "2026-05-16",
  },
  {
    id: "default-news-1",
    category: "news",
    kind: "article",
    title: "Ny uke, nye gruppetimer",
    description: "Følg med på oppdateringer fra senteret.",
    body: "PT-ene legger ut nyheter, små påminnelser og praktisk info her når det er noe alle bør få med seg.",
    tag: "Senter",
    author: "Motus",
    createdAt: "2026-05-01",
  },
  ...RUNNING_INSPIRATION_ITEMS,
];

type InspirationPublishValidation = { ok: true } | { ok: false; message: string };

function resolveComposerKind(categoryDraft: InspirationCategory, kindDraft: InspirationKind): InspirationKind {
  return categoryDraft === "programs" ? kindDraft : "article";
}

function validateInspirationPublish(input: {
  title: string;
  description: string;
  body: string;
  categoryDraft: InspirationCategory;
  kindDraft: InspirationKind;
  usesExerciseBank: boolean;
  programExerciseCount: number;
  isImageProcessing: boolean;
}): InspirationPublishValidation {
  if (input.isImageProcessing) {
    return { ok: false, message: "Vent til bildet er ferdig behandlet." };
  }
  if (!input.title.trim()) {
    return { ok: false, message: "Fyll inn tittel." };
  }

  const kind = resolveComposerKind(input.categoryDraft, input.kindDraft);
  if (kind === "program") {
    if (input.usesExerciseBank && input.programExerciseCount < 1) {
      return { ok: false, message: "Legg til minst én øvelse fra øvelsesbanken." };
    }
    return { ok: true };
  }
  if (kind === "periodPlan") {
    if (!input.body.trim()) {
      return { ok: false, message: "Fyll inn detaljer for ukesplanen." };
    }
    return { ok: true };
  }
  if (!input.description.trim()) {
    return { ok: false, message: "Fyll inn kort info under bildet." };
  }
  if (!input.body.trim()) {
    return { ok: false, message: "Fyll inn detaljer som vises under Les mer." };
  }
  return { ok: true };
}

function resolveComposerCopy(
  title: string,
  description: string,
  body: string,
  categoryDraft: InspirationCategory,
  kindDraft: InspirationKind,
): { title: string; description: string; body: string } | null {
  const nextTitle = title.trim().slice(0, INSPO_CARD_TITLE_MAX);
  if (!nextTitle) return null;
  const kind = resolveComposerKind(categoryDraft, kindDraft);
  if (kind === "program") {
    const nextDescription = (description.trim() || nextTitle).slice(0, INSPO_CARD_DESCRIPTION_MAX);
    const nextBody = body.trim() || nextDescription;
    return { title: nextTitle, description: nextDescription, body: nextBody };
  }
  const nextDescription = description.trim().slice(0, INSPO_CARD_DESCRIPTION_MAX);
  const nextBody = body.trim();
  if (!nextDescription || !nextBody) return null;
  return { title: nextTitle, description: nextDescription, body: nextBody };
}

function resolveInspirationHubItems(fetched: InspirationItem[] | null): InspirationItem[] {
  const base =
    fetched && fetched.length > 0
      ? fetched
      : typeof window !== "undefined"
        ? (loadInspirationItemsFromLocalStorage<InspirationItem>() ?? [])
        : [];
  const withoutSuppressed = filterSuppressedInspirationItems(base);
  if (!withoutSuppressed.length && typeof window === "undefined") return normalizeInspirationItems(DEFAULT_ITEMS);
  if (!withoutSuppressed.length) {
    return normalizeInspirationItems(filterSuppressedInspirationItems(DEFAULT_ITEMS));
  }
  const merged = mergeDefaultInspirationItems(withoutSuppressed, DEFAULT_ITEMS);
  return normalizeInspirationItems(filterRecipesFromInspirationHub(merged));
}

function loadInspirationItems(): InspirationItem[] {
  if (typeof window === "undefined") return DEFAULT_ITEMS;
  try {
    const raw = window.localStorage.getItem(INSPIRATION_STORAGE_KEY);
    if (!raw) return filterSuppressedInspirationItems(DEFAULT_ITEMS);
    const parsed = JSON.parse(raw) as InspirationItem[];
    if (!Array.isArray(parsed) || !parsed.length) return filterSuppressedInspirationItems(DEFAULT_ITEMS);
    return resolveInspirationHubItems(parsed);
  } catch {
    return filterSuppressedInspirationItems(DEFAULT_ITEMS);
  }
}

type InspirationHubProps = {
  canManage?: boolean;
  authorName?: string;
  memberId?: string;
  memberName?: string;
  /** PT-programmaler (`__template__`) til valg i periodeplan-uker. */
  programTemplates?: Array<{ id: string; title: string }>;
  /** Felles øvelsesbank – påkrevd for treningsprogram under inspo. */
  exerciseBank?: Exercise[];
  onAddProgram?: (program: ProgramTemplateInput) => void;
  onAddPeriodPlan?: (plan: PeriodSchedulePlan) => void;
  /** Åpne detalj for innlegg (f.eks. fra varsel). */
  focusItemId?: string | null;
  onFocusItemHandled?: () => void;
};

export function InspirationHub({
  canManage = false,
  authorName = "Motus",
  memberName = "Medlem",
  programTemplates = [],
  exerciseBank = [],
  onAddProgram,
  onAddPeriodPlan,
  focusItemId = null,
  onFocusItemHandled,
}: InspirationHubProps) {
  const [items, setItems] = useState<InspirationItem[]>(() => loadInspirationItems());
  const [inspoSubView, setInspoSubView] = useState<InspoSubView>("overview");
  const [expandedItemId, setExpandedItemId] = useState<string | null>(null);
  const [actionStatus, setActionStatus] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [body, setBody] = useState("");
  const [bodyStyle, setBodyStyle] = useState<InspirationBodyStyle>("normal");
  const [tag, setTag] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [categoryDraft, setCategoryDraft] = useState<InspirationCategory>("tips");
  const [kindDraft, setKindDraft] = useState<InspirationKind>("article");
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [composerOpen, setComposerOpen] = useState(false);
  const [programTemplateDraft, setProgramTemplateDraft] = useState<ProgramTemplateInput | null>(null);
  const [periodPlanTemplateDraft, setPeriodPlanTemplateDraft] = useState<PeriodSchedulePlan | null>(null);
  const [activePeriodWeekId, setActivePeriodWeekId] = useState("");
  const [isImageProcessing, setIsImageProcessing] = useState(false);
  const [programCoverImageUrl, setProgramCoverImageUrl] = useState("");
  const [isUploadingProgramCoverImage, setIsUploadingProgramCoverImage] = useState(false);
  const [heroConfig, setHeroConfig] = useState<InspirationHeroConfig | null>(() => loadInspirationHeroFromLocalStorage());
  const [isUploadingHeroImage, setIsUploadingHeroImage] = useState(false);
  const [heroTextEditorOpen, setHeroTextEditorOpen] = useState(false);
  const [heroTitleDraft, setHeroTitleDraft] = useState("");
  const [heroSubtitleDraft, setHeroSubtitleDraft] = useState("");
  const [heroCtaDraft, setHeroCtaDraft] = useState("");
  const [isSavingHeroText, setIsSavingHeroText] = useState(false);
  const [programExerciseSearch, setProgramExerciseSearch] = useState("");
  const [programExerciseCategoryFilter, setProgramExerciseCategoryFilter] = useState<"all" | Exercise["category"]>("all");
  const [programExerciseGroupFilter, setProgramExerciseGroupFilter] = useState("all");
  const bodyTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  const carouselRefs = useRef<Record<InspirationCategory, HTMLDivElement | null>>({
    news: null,
    programs: null,
    recipes: null,
    tips: null,
    appGuide: null,
  });
  const usesExerciseBank = exerciseBank.length > 0;
  const exercisesById = useMemo(() => new Map(exerciseBank.map((exercise) => [exercise.id, exercise])), [exerciseBank]);
  const programExerciseGroupOptions = useMemo(() => {
    const groups = Array.from(new Set(exerciseBank.flatMap((exercise) => splitMultiValue(exercise.group))));
    return groups.sort((a, b) => a.localeCompare(b, "no"));
  }, [exerciseBank]);
  const visibleProgramExercises = useMemo(() => {
    const query = programExerciseSearch.trim().toLowerCase();
    const filtered = exerciseBank.filter((exercise) => {
      if (programExerciseCategoryFilter !== "all" && exercise.category !== programExerciseCategoryFilter) return false;
      if (programExerciseGroupFilter !== "all" && !multiValueIncludes(exercise.group, programExerciseGroupFilter)) return false;
      if (!query) return true;
      return (
        exercise.name.toLowerCase().includes(query) ||
        exercise.group.toLowerCase().includes(query) ||
        exercise.equipment.toLowerCase().includes(query) ||
        exercise.description.toLowerCase().includes(query)
      );
    });
    return filtered.sort((a, b) => a.name.localeCompare(b.name, "no"));
  }, [exerciseBank, programExerciseSearch, programExerciseCategoryFilter, programExerciseGroupFilter]);

  const periodPlanProgramOptions = useMemo(() => {
    const titles = [
      ...programTemplates.map((program) => program.title),
      ...items.filter((item) => item.kind === "program").map((item) => item.title),
      ...items
        .filter((item) => item.programTemplate?.title)
        .map((item) => item.programTemplate!.title),
    ];
    return buildPeriodPlanProgramSelectOptions(titles);
  }, [programTemplates, items]);

  const activePeriodWeek = useMemo(
    () =>
      periodPlanTemplateDraft?.weeklyPlans.find((week) => week.id === activePeriodWeekId) ??
      periodPlanTemplateDraft?.weeklyPlans[0] ??
      null,
    [periodPlanTemplateDraft, activePeriodWeekId],
  );

  useEffect(() => {
    const weeks = periodPlanTemplateDraft?.weeklyPlans ?? [];
    if (!weeks.length) {
      setActivePeriodWeekId("");
      return;
    }
    setActivePeriodWeekId((prev) => {
      if (prev && weeks.some((week) => week.id === prev)) return prev;
      return weeks[0]?.id ?? "";
    });
  }, [periodPlanTemplateDraft]);

  const refreshInspirationFromDatabase = useCallback(async () => {
    const fetched = await fetchInspirationItemsForHub<InspirationItem>();
    setItems(resolveInspirationHubItems(fetched));
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const fetched = await fetchInspirationItemsForHub<InspirationItem>();
      if (cancelled) return;
      const resolved = resolveInspirationHubItems(fetched);
      setItems(resolved);
      if (canManage) {
        const synced = await syncLocalInspirationToSupabaseIfNeeded(resolved);
        if (synced && !cancelled) {
          const afterSync = await fetchInspirationItemsForHub<InspirationItem>();
          if (!cancelled) setItems(resolveInspirationHubItems(afterSync));
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [canManage]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const remote = await pullInspirationHeroFromRemote();
      if (!cancelled && remote) setHeroConfig(remote);
    })();
    const onHeroChanged = () => {
      const next = loadInspirationHeroFromLocalStorage();
      setHeroConfig(next);
    };
    window.addEventListener(INSPIRATION_HERO_CHANGED_EVENT, onHeroChanged);
    return () => {
      cancelled = true;
      window.removeEventListener(INSPIRATION_HERO_CHANGED_EVENT, onHeroChanged);
    };
  }, []);

  const heroImageSrc = heroConfig?.imageUrl?.trim() || DEFAULT_INSPO_HERO_IMAGE;
  const heroTitleText = heroConfig?.title?.trim() || DEFAULT_INSPO_HERO_TITLE;
  const heroSubtitleText = heroConfig?.subtitle?.trim() || DEFAULT_INSPO_HERO_SUBTITLE;
  const heroCtaText = heroConfig?.ctaLabel?.trim() || DEFAULT_INSPO_HERO_CTA;
  const featuredAutoRotate = heroConfig?.featuredAutoRotate ?? true;
  const pinnedFeaturedItemId = heroConfig?.featuredItemId?.trim() ?? "";

  /** Artikler som kan brukes som «Dagens utvalgte» — tips og news (ikke app-guide eller program/ukesplan). */
  const featuredArticlePool = useMemo(() => {
    return items.filter((item) => {
      if (item.kind !== "article") return false;
      if (item.category === "appGuide") return false;
      return Boolean(item.title.trim());
    });
  }, [items]);

  const featuredItem = useMemo(() => {
    if (!featuredArticlePool.length) return null;
    if (!featuredAutoRotate && pinnedFeaturedItemId) {
      const pinned = featuredArticlePool.find((item) => item.id === pinnedFeaturedItemId);
      if (pinned) return pinned;
    }
    return pickFeaturedItemFromPool(featuredArticlePool);
  }, [featuredArticlePool, featuredAutoRotate, pinnedFeaturedItemId]);

  const [featuredPickerOpen, setFeaturedPickerOpen] = useState(false);
  const [isSavingFeatured, setIsSavingFeatured] = useState(false);

  async function persistFeaturedSelection(input: { featuredItemId?: string; featuredAutoRotate: boolean }) {
    setIsSavingFeatured(true);
    setActionStatus(null);
    try {
      const next: InspirationHeroConfig = {
        imageUrl: heroConfig?.imageUrl?.trim() || DEFAULT_INSPO_HERO_IMAGE,
        badge: heroConfig?.badge ?? undefined,
        title: heroConfig?.title ?? undefined,
        subtitle: heroConfig?.subtitle ?? undefined,
        ctaLabel: heroConfig?.ctaLabel ?? undefined,
        featuredItemId: input.featuredItemId?.trim() || undefined,
        featuredAutoRotate: input.featuredAutoRotate,
      };
      const result = await persistInspirationHero(next);
      if (!result.ok) {
        setActionStatus(result.error);
        return;
      }
      setHeroConfig(result.config);
      setActionStatus(
        input.featuredItemId
          ? "Dagens utvalgte er låst til valgt artikkel."
          : "Dagens utvalgte velges automatisk og rotereres daglig.",
      );
    } finally {
      setIsSavingFeatured(false);
    }
  }

  async function setFeaturedItemAndPin(itemId: string) {
    await persistFeaturedSelection({ featuredItemId: itemId, featuredAutoRotate: false });
    setFeaturedPickerOpen(false);
  }

  async function clearFeaturedPin() {
    await persistFeaturedSelection({ featuredItemId: undefined, featuredAutoRotate: true });
    setFeaturedPickerOpen(false);
  }

  async function handleHeroImageFile(file: File | null) {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setActionStatus("Velg en bildefil (JPG, PNG eller WebP).");
      return;
    }
    setIsUploadingHeroImage(true);
    setActionStatus("Laster opp nytt hero-bilde…");
    try {
      const compressed = await compressImageFile(file);
      const next: InspirationHeroConfig = {
        ...(heroConfig ?? {}),
        imageUrl: compressed,
        title: heroConfig?.title ?? heroTitleText,
        subtitle: heroConfig?.subtitle ?? heroSubtitleText,
        ctaLabel: heroConfig?.ctaLabel ?? heroCtaText,
      };
      const result = await persistInspirationHero(next);
      if (!result.ok) {
        setActionStatus(result.error);
        return;
      }
      setHeroConfig(result.config);
      setActionStatus(result.cloudSynced ? "Hero-bilde oppdatert for alle medlemmer." : result.warning ?? "Hero-bilde lagret lokalt.");
    } catch {
      setActionStatus("Kunne ikke lese bildefilen. Prøv et mindre bilde.");
    } finally {
      setIsUploadingHeroImage(false);
    }
  }

  async function resetHeroImageToDefault() {
    setIsUploadingHeroImage(true);
    setActionStatus("Tilbakestiller hero-bilde…");
    try {
      const next: InspirationHeroConfig = {
        ...(heroConfig ?? {}),
        imageUrl: DEFAULT_INSPO_HERO_IMAGE,
      };
      const result = await persistInspirationHero(next);
      if (!result.ok) {
        setActionStatus(result.error);
        return;
      }
      setHeroConfig(result.config);
      setActionStatus("Hero-bilde tilbakestilt til standard.");
    } finally {
      setIsUploadingHeroImage(false);
    }
  }

  function openHeroTextEditor() {
    setHeroTitleDraft(heroConfig?.title ?? "");
    setHeroSubtitleDraft(heroConfig?.subtitle ?? "");
    setHeroCtaDraft(heroConfig?.ctaLabel ?? "");
    setHeroTextEditorOpen(true);
    setActionStatus(null);
  }

  function closeHeroTextEditor() {
    setHeroTextEditorOpen(false);
  }

  async function saveHeroText() {
    setIsSavingHeroText(true);
    setActionStatus("Lagrer hero-tekst…");
    try {
      const next: InspirationHeroConfig = {
        imageUrl: heroConfig?.imageUrl?.trim() || DEFAULT_INSPO_HERO_IMAGE,
        title: heroTitleDraft.trim() || undefined,
        subtitle: heroSubtitleDraft.trim() || undefined,
        ctaLabel: heroCtaDraft.trim() || undefined,
        featuredItemId: heroConfig?.featuredItemId ?? undefined,
        featuredAutoRotate: heroConfig?.featuredAutoRotate ?? undefined,
      };
      const result = await persistInspirationHero(next);
      if (!result.ok) {
        setActionStatus(result.error);
        return;
      }
      setHeroConfig(result.config);
      setActionStatus(result.cloudSynced ? "Hero-tekst oppdatert for alle medlemmer." : result.warning ?? "Hero-tekst lagret lokalt.");
      setHeroTextEditorOpen(false);
    } finally {
      setIsSavingHeroText(false);
    }
  }

  async function resetHeroTextToDefaults() {
    setIsSavingHeroText(true);
    setActionStatus("Tilbakestiller hero-tekst…");
    try {
      const next: InspirationHeroConfig = {
        imageUrl: heroConfig?.imageUrl?.trim() || DEFAULT_INSPO_HERO_IMAGE,
        featuredItemId: heroConfig?.featuredItemId ?? undefined,
        featuredAutoRotate: heroConfig?.featuredAutoRotate ?? undefined,
      };
      const result = await persistInspirationHero(next);
      if (!result.ok) {
        setActionStatus(result.error);
        return;
      }
      setHeroConfig(result.config);
      setHeroTitleDraft("");
      setHeroSubtitleDraft("");
      setHeroCtaDraft("");
      setActionStatus("Hero-tekst tilbakestilt til standard.");
    } finally {
      setIsSavingHeroText(false);
    }
  }

  const heroHasCustomText = Boolean(
    heroConfig?.title || heroConfig?.subtitle || heroConfig?.ctaLabel,
  );

  const previewHeroTitle = (heroTitleDraft.trim() || DEFAULT_INSPO_HERO_TITLE);
  const previewHeroSubtitle = (heroSubtitleDraft.trim() || DEFAULT_INSPO_HERO_SUBTITLE);
  const previewHeroCta = (heroCtaDraft.trim() || DEFAULT_INSPO_HERO_CTA);

  useEffect(() => {
    const syncFromRemote = () => {
      void refreshInspirationFromDatabase();
      void pullInspirationHeroFromRemote();
    };
    const onVisible = () => {
      if (document.visibilityState === "visible") {
        void refreshInspirationFromDatabase();
        void pullInspirationHeroFromRemote();
      }
    };
    window.addEventListener(INSPIRATION_CHANGED_EVENT, syncFromRemote);
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", syncFromRemote);
    return () => {
      window.removeEventListener(INSPIRATION_CHANGED_EVENT, syncFromRemote);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", syncFromRemote);
    };
  }, [refreshInspirationFromDatabase]);

  useEffect(() => {
    if (!focusItemId?.trim()) return;
    const match = items.find((item) => item.id === focusItemId);
    if (!match) return;
    if (isAppGuideItem(match)) setInspoSubView("appGuide");
    setExpandedItemId(focusItemId);
    onFocusItemHandled?.();
  }, [focusItemId, items, onFocusItemHandled]);

  async function moveItemWithinCategory(itemId: string, direction: "up" | "down") {
    const target = items.find((row) => row.id === itemId);
    if (!target) return;
    const siblings = items
      .filter((row) => normalizeInspirationItem(row).category === normalizeInspirationItem(target).category)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    const index = siblings.findIndex((row) => row.id === itemId);
    if (index === -1) return;
    const neighborIndex = direction === "up" ? index - 1 : index + 1;
    const neighbor = siblings[neighborIndex];
    if (!neighbor) return;
    const next = items.map((row) => {
      if (row.id === target.id) return { ...row, createdAt: neighbor.createdAt };
      if (row.id === neighbor.id) return { ...row, createdAt: target.createdAt };
      return row;
    });
    const result = await commitItems(next);
    if (result.ok) setActionStatus(result.message);
  }

  async function commitItems(next: InspirationItem[]): Promise<{ ok: true; message: string } | { ok: false }> {
    const existingFeed = loadInspirationItemsFromLocalStorage<InspirationItem>() ?? items;
    const normalized = normalizeInspirationItems(
      mergeHubItemsPreservingRecipes(next, existingFeed),
    );
    const result = await persistInspirationItems(normalized);
    if (!result.ok) {
      setActionStatus(result.error);
      return { ok: false };
    }
    if (result.cloudSynced) {
      const snapshot = await pullInspirationFeedFromRemote();
      setItems(resolveInspirationHubItems(snapshot?.items ?? normalized));
    } else {
      setItems(resolveInspirationHubItems(normalized));
    }
    notifyInspirationItemsChanged();
    const message = result.warning
      ? result.warning
      : result.cloudSynced
        ? "Lagret og synket til alle brukere."
        : "Lagret på denne enheten.";
    return { ok: true, message };
  }

  async function resolveImageForStorage(value: string): Promise<string | undefined> {
    const trimmed = value.trim();
    if (!trimmed) return undefined;
    if (!trimmed.startsWith("data:image/")) return trimmed;
    return compressImageDataUrl(trimmed);
  }

  const sortedItems = useMemo(() => [...items].sort((a, b) => b.createdAt.localeCompare(a.createdAt)), [items]);

  const itemsByCategory = useMemo(() => {
    const grouped: Record<InspirationCategory, InspirationItem[]> = {
      news: [],
      programs: [],
      recipes: [],
      tips: [],
      appGuide: [],
    };
    for (const item of sortedItems) {
      const normalized = normalizeInspirationItem(item);
      grouped[normalized.category].push(normalized);
    }
    return grouped;
  }, [sortedItems]);

  const activeFeedSections = inspoSubView === "appGuide" ? INSPIRATION_APP_GUIDE_SECTION : INSPIRATION_OVERVIEW_SECTIONS;
  const appGuideCount = itemsByCategory.appGuide.length;

  const expandedItem = items.find((item) => item.id === expandedItemId) ?? null;
  const composerKind = resolveComposerKind(categoryDraft, kindDraft);
  const publishValidation = useMemo(
    () =>
      validateInspirationPublish({
        title,
        description,
        body,
        categoryDraft,
        kindDraft,
        usesExerciseBank,
        programExerciseCount: programTemplateDraft?.exercises.length ?? 0,
        isImageProcessing,
      }),
    [
      title,
      description,
      body,
      categoryDraft,
      kindDraft,
      usesExerciseBank,
      programTemplateDraft?.exercises.length,
      isImageProcessing,
    ],
  );

  useEffect(() => {
    if (!expandedItemId || typeof window === "undefined") return;
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [expandedItemId]);

  function closeDetailView() {
    setExpandedItemId(null);
  }

  function openInspirationItem(item: InspirationItem) {
    if (isAppGuideItem(item)) setInspoSubView("appGuide");
    setExpandedItemId(item.id);
  }

  function scrollSectionCarousel(category: InspirationCategory, direction: "left" | "right") {
    const node = carouselRefs.current[category];
    if (!node) return;
    const amount = Math.max(300, Math.round(node.clientWidth * 0.82));
    node.scrollBy({ left: direction === "left" ? -amount : amount, behavior: "smooth" });
  }

  function scrollToCategorySection(category: InspirationCategory) {
    const node = carouselRefs.current[category];
    if (!node) return;
    const sectionEl = node.closest("section");
    const target = sectionEl ?? node;
    target.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function renderNewsCard(item: InspirationItem, index: number, total: number) {
    const tone = pickNewsTone(index);
    const ToneIcon = tone.icon;
    return (
      <article
        key={item.id}
        className={`motus-inspo-news-card ${tone.dark ? "motus-inspo-news-card--dark" : ""}`}
        style={{ background: tone.bg, borderColor: tone.ring }}
      >
        {canManage ? (
          <div className="motus-inspo-card-edit-actions">
            <button
              type="button"
              onClick={() => void moveItemWithinCategory(item.id, "up")}
              className="motus-inspo-card-edit-btn"
              aria-label={`Flytt ${item.title} opp`}
              title="Flytt opp"
              disabled={index === 0}
            >
              <ArrowUp className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => void moveItemWithinCategory(item.id, "down")}
              className="motus-inspo-card-edit-btn"
              aria-label={`Flytt ${item.title} ned`}
              title="Flytt ned"
              disabled={index >= total - 1}
            >
              <ArrowDown className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => beginEdit(item)}
              className="motus-inspo-card-edit-btn"
              aria-label={`Rediger ${item.title}`}
              title="Rediger"
            >
              <Pencil className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => confirmDeleteItem(item.id)}
              className="motus-inspo-card-edit-btn motus-inspo-card-edit-btn--danger"
              aria-label={`Slett ${item.title}`}
              title="Slett"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        ) : null}
        <button type="button" onClick={() => openInspirationItem(item)} className="motus-inspo-news-button">
          <span
            className="motus-inspo-news-icon"
            style={{ background: tone.iconBg, color: tone.iconColor }}
            aria-hidden
          >
            <ToneIcon className="h-4 w-4" />
          </span>
          <div className="motus-inspo-news-body">
            <div className="motus-inspo-news-title">{item.title}</div>
            <p className="motus-inspo-news-desc">{item.description}</p>
            <span className="motus-inspo-news-link">
              Les mer
              <ArrowRight className="h-3 w-3" aria-hidden />
            </span>
          </div>
        </button>
      </article>
    );
  }

  function renderInspirationCard(item: InspirationItem, index: number, total: number) {
    const meta = CATEGORY_META[item.category];
    const Icon = meta.icon;
    const kindLabel = item.kind === "periodPlan" ? "Ukesplan" : item.kind === "program" ? "Program" : meta.label;
    const badgeText = (item.tag.trim() || kindLabel).toUpperCase();
    const badgeTone = badgeToneForCategory(item.category);
    return (
      <article
        key={item.id}
        className={`relative flex shrink-0 snap-start flex-col overflow-hidden rounded-xl border bg-white ${INSPO_FEED_CARD_WIDTH_CLASS} ${INSPO_FEED_CARD_HEIGHT_CLASS}`}
        style={{ borderColor: "rgba(15,23,42,0.08)" }}
      >
        {canManage ? (
          <div className="absolute right-2 top-2 z-10 flex flex-wrap justify-end gap-1">
            <button
              type="button"
              onClick={() => void moveItemWithinCategory(item.id, "up")}
              className="rounded-lg border border-white/80 bg-white/95 p-1.5 text-slate-700 shadow-sm transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-40"
              aria-label={`Flytt ${item.title} opp`}
              title="Flytt opp"
              disabled={index === 0}
            >
              <ArrowUp className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => void moveItemWithinCategory(item.id, "down")}
              className="rounded-lg border border-white/80 bg-white/95 p-1.5 text-slate-700 shadow-sm transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-40"
              aria-label={`Flytt ${item.title} ned`}
              title="Flytt ned"
              disabled={index >= total - 1}
            >
              <ArrowDown className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => beginEdit(item)}
              className="rounded-lg border border-white/80 bg-white/95 p-1.5 text-slate-700 shadow-sm hover:bg-white"
              aria-label={`Rediger ${item.title}`}
              title="Rediger"
            >
              <Pencil className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => confirmDeleteItem(item.id)}
              className="rounded-lg border border-white/80 bg-white/95 p-1.5 text-rose-700 shadow-sm hover:bg-rose-50"
              aria-label={`Slett ${item.title}`}
              title="Slett"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        ) : null}
        <button type="button" onClick={() => openInspirationItem(item)} className="flex min-h-0 flex-1 flex-col text-left">
          <div
            className={`motus-image-frame motus-image-frame--square w-full shrink-0 relative ${INSPO_FEED_CARD_IMAGE_CLASS} ${item.imageUrl ? "bg-slate-100" : "bg-[#F3F5F7]"}`}
          >
            {item.imageUrl ? (
              <img
                src={item.imageUrl}
                alt=""
                className="motus-image-media h-full w-full"
                loading="lazy"
                decoding="async"
                style={{ objectPosition: imageObjectPositionFromSrc(item.imageUrl) }}
              />
            ) : null}
            {!item.imageUrl ? (
              <div className="flex h-full w-full items-center justify-center text-teal-600/80">
                <Icon className="h-9 w-9" />
              </div>
            ) : null}
            <span className={`motus-inspo-overlay-badge motus-inspo-overlay-badge--${badgeTone}`}>
              {badgeText}
            </span>
          </div>
          <div className="flex min-h-0 flex-1 flex-col px-2 pb-2 pt-1.5">
            <h3 className={`${INSPO_FEED_CARD_TITLE_CLASS}`}>{item.title}</h3>
            <p className={`mt-0.5 min-w-0 ${INSPO_FEED_CARD_DESCRIPTION_CLASS}`}>{item.description || "\u00a0"}</p>
          </div>
        </button>
        <div className="shrink-0 border-t border-slate-100 px-2.5 py-2">
          <OutlineButton onClick={() => openInspirationItem(item)} className={`w-full ${INSPO_FEED_CARD_ACTION_CLASS}`}>
            Les mer
          </OutlineButton>
        </div>
      </article>
    );
  }

  function renderEditorPreviewCard() {
    const meta = CATEGORY_META[categoryDraft];
    const Icon = meta.icon;
    const previewTitle = title.trim() || "Tittel kommer her";
    const previewDescription = description.trim() || "Kort beskrivelse vises her under bildet.";
    const kindLabel =
      kindDraft === "periodPlan" ? "Ukesplan" : kindDraft === "program" ? "Program" : meta.label;
    const previewTag = tag.trim() || (categoryDraft === "appGuide" ? "App-guide" : kindLabel);
    if (categoryDraft === "news") {
      const tone = pickNewsTone(0);
      const ToneIcon = tone.icon;
      return (
        <article
          className="motus-inspo-news-card w-full"
          style={{ background: tone.bg, borderColor: tone.ring }}
        >
          <div className="motus-inspo-news-button">
            <span
              className="motus-inspo-news-icon"
              style={{ background: tone.iconBg, color: tone.iconColor }}
              aria-hidden
            >
              <ToneIcon className="h-4 w-4" />
            </span>
            <div className="motus-inspo-news-body">
              <div className="motus-inspo-news-title">{previewTitle}</div>
              <p className="motus-inspo-news-desc">{previewDescription}</p>
              <span className="motus-inspo-news-link">
                Les mer
                <ArrowRight className="h-3 w-3" aria-hidden />
              </span>
            </div>
          </div>
        </article>
      );
    }
    const previewBadgeTone = badgeToneForCategory(categoryDraft);
    const previewBadgeText = previewTag.toUpperCase();
    return (
      <article
        className={`relative flex shrink-0 snap-start flex-col overflow-hidden rounded-xl border bg-white ${INSPO_FEED_CARD_WIDTH_CLASS} ${INSPO_FEED_CARD_HEIGHT_CLASS}`}
        style={{ borderColor: "rgba(15,23,42,0.08)" }}
      >
        <div
          className={`motus-image-frame motus-image-frame--square w-full shrink-0 relative ${INSPO_FEED_CARD_IMAGE_CLASS} ${
            imageUrl ? "bg-slate-100" : "bg-[#F3F5F7]"
          }`}
        >
          {imageUrl ? (
            <img
              src={imageUrl}
              alt=""
              className="motus-image-media h-full w-full"
              loading="lazy"
              decoding="async"
              style={{ objectPosition: imageObjectPositionFromSrc(imageUrl) }}
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-teal-600/80">
              <Icon className="h-9 w-9" />
            </div>
          )}
          <span className={`motus-inspo-overlay-badge motus-inspo-overlay-badge--${previewBadgeTone}`}>
            {previewBadgeText}
          </span>
        </div>
        <div className="flex min-h-0 flex-1 flex-col px-2 pb-2 pt-1.5">
          <h3 className={`${INSPO_FEED_CARD_TITLE_CLASS}`}>{previewTitle}</h3>
          <p className={`mt-0.5 min-w-0 ${INSPO_FEED_CARD_DESCRIPTION_CLASS}`}>{previewDescription}</p>
        </div>
        <div className="shrink-0 border-t border-slate-100 px-2.5 py-2">
          <OutlineButton disabled className={`w-full ${INSPO_FEED_CARD_ACTION_CLASS}`}>
            Les mer
          </OutlineButton>
        </div>
      </article>
    );
  }

  function resetComposerFields() {
    setEditingItemId(null);
    setTitle("");
    setDescription("");
    setBody("");
    setBodyStyle("normal");
    setTag("");
    setImageUrl("");
    setCategoryDraft("tips");
    setKindDraft("article");
    setProgramTemplateDraft(null);
    setPeriodPlanTemplateDraft(null);
    setActivePeriodWeekId("");
    setProgramCoverImageUrl("");
  }

  function resetComposer() {
    resetComposerFields();
    setComposerOpen(false);
  }

  function openCreateComposer() {
    resetComposerFields();
    if (inspoSubView === "appGuide") {
      setCategoryDraft("appGuide");
      setTag("App-guide");
    }
    setComposerOpen(true);
    setActionStatus(null);
  }

  function beginEdit(item: InspirationItem) {
    setEditingItemId(item.id);
    setTitle(item.title);
    setDescription(item.description);
    setBody(item.body);
    setBodyStyle(item.bodyStyle ?? "normal");
    setTag(item.tag);
    setImageUrl(item.imageUrl ?? "");
    setCategoryDraft(item.category);
    setKindDraft(item.kind);
    setProgramTemplateDraft(
      item.programTemplate
        ? {
            ...structuredClone(item.programTemplate),
            exercises: linkProgramExercisesToBank(structuredClone(item.programTemplate.exercises), exerciseBank),
          }
        : null,
    );
    setProgramCoverImageUrl(item.programTemplate?.imageUrl?.trim() || item.imageUrl?.trim() || "");
    const clonedPlan = item.periodPlanTemplate ? normalizePeriodSchedulePlan(structuredClone(item.periodPlanTemplate)) : null;
    setPeriodPlanTemplateDraft(clonedPlan);
    setActivePeriodWeekId(clonedPlan?.weeklyPlans[0]?.id ?? "");
    setComposerOpen(true);
    setActionStatus(null);
  }

  function ensureProgramTemplateDraft(nextTitle: string, nextDescription: string, nextBody: string) {
    setProgramTemplateDraft((prev) =>
      prev ??
      (usesExerciseBank
        ? createEmptyProgramTemplate(nextTitle, nextDescription, nextBody)
        : createDefaultProgram(nextTitle, nextDescription, nextBody)),
    );
  }

  function addProgramExerciseFromBank(exercise: Exercise) {
    setProgramTemplateDraft((prev) => {
      const base =
        prev ??
        (usesExerciseBank
          ? createEmptyProgramTemplate(title.trim() || "Nytt program", description.trim(), body.trim())
          : createDefaultProgram(title.trim() || "Nytt program", description.trim(), body.trim()));
      return { ...base, exercises: [...base.exercises, programExerciseFromBank(exercise)] };
    });
  }

  function ensurePeriodPlanTemplateDraft(nextTitle: string, nextBody: string) {
    setPeriodPlanTemplateDraft((prev) => normalizePeriodSchedulePlan(prev ?? createDefaultPeriodPlan(nextTitle, nextBody)));
  }

  function updateProgramExercise(exerciseId: string, field: keyof ProgramExercise, value: string) {
    setProgramTemplateDraft((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        exercises: prev.exercises.map((exercise) => (exercise.id === exerciseId ? { ...exercise, [field]: value } : exercise)),
      };
    });
  }

  function removeProgramExercise(exerciseId: string) {
    setProgramTemplateDraft((prev) => {
      if (!prev) return prev;
      return { ...prev, exercises: prev.exercises.filter((exercise) => exercise.id !== exerciseId) };
    });
  }

  function wrapSelectedBodyText(marker: "**" | "*") {
    const textarea = bodyTextareaRef.current;
    const start = textarea?.selectionStart ?? body.length;
    const end = textarea?.selectionEnd ?? body.length;
    const selected = body.slice(start, end);
    const fallback = marker === "**" ? "bold tekst" : "kursiv tekst";
    const wrapped = `${marker}${selected || fallback}${marker}`;
    const nextBody = `${body.slice(0, start)}${wrapped}${body.slice(end)}`;
    setBody(nextBody);
    window.requestAnimationFrame(() => {
      const nextStart = start + marker.length;
      const nextEnd = nextStart + (selected || fallback).length;
      bodyTextareaRef.current?.focus();
      bodyTextareaRef.current?.setSelectionRange(nextStart, nextEnd);
    });
  }

  /** Prefikser hver linje i markert tekst (eller gjeldende linje) med et tegn — brukes for overskrifter og lister. */
  function prefixSelectedBodyLines(prefix: string, fallback: string) {
    const textarea = bodyTextareaRef.current;
    const start = textarea?.selectionStart ?? body.length;
    const end = textarea?.selectionEnd ?? body.length;
    const lineStart = body.lastIndexOf("\n", start - 1) + 1;
    const lineEnd = body.indexOf("\n", end);
    const sliceEnd = lineEnd === -1 ? body.length : lineEnd;
    const block = body.slice(lineStart, sliceEnd);
    const lines = block.length ? block.split("\n") : [fallback];
    const transformed = lines
      .map((line, idx) => {
        if (prefix === "1. ") return `${idx + 1}. ${line || fallback}`;
        return `${prefix}${line || fallback}`;
      })
      .join("\n");
    const nextBody = `${body.slice(0, lineStart)}${transformed}${body.slice(sliceEnd)}`;
    setBody(nextBody);
    window.requestAnimationFrame(() => {
      bodyTextareaRef.current?.focus();
      const nextCaret = lineStart + transformed.length;
      bodyTextareaRef.current?.setSelectionRange(nextCaret, nextCaret);
    });
  }

  function insertLinkAtSelection() {
    const textarea = bodyTextareaRef.current;
    const start = textarea?.selectionStart ?? body.length;
    const end = textarea?.selectionEnd ?? body.length;
    const selected = body.slice(start, end);
    const label = selected || "lenketekst";
    const inserted = `[${label}](https://)`;
    const nextBody = `${body.slice(0, start)}${inserted}${body.slice(end)}`;
    setBody(nextBody);
    window.requestAnimationFrame(() => {
      bodyTextareaRef.current?.focus();
      const urlStart = start + label.length + 3;
      const urlEnd = urlStart + 8;
      bodyTextareaRef.current?.setSelectionRange(urlStart, urlEnd);
    });
  }

  function syncPeriodPlanWeekCount(weekCount: number) {
    const clamped = Math.max(1, Math.min(12, weekCount));
    setPeriodPlanTemplateDraft((prev) => {
      const base = prev ?? createDefaultPeriodPlan(title.trim() || "Ny ukesplan", body.trim());
      const weeklyPlans: WeeklySchedulePlan[] = [];
      for (let weekNumber = 1; weekNumber <= clamped; weekNumber += 1) {
        const existing = base.weeklyPlans.find((week) => week.weekNumber === weekNumber);
        weeklyPlans.push(
          existing ?? {
            id: uid("inspo-week"),
            weekNumber,
            days: emptyWeek(),
          },
        );
      }
      return normalizePeriodSchedulePlan({ ...base, weeks: clamped, weeklyPlans });
    });
  }

  function toggleGradientPeriodWeek(weekId: string) {
    setActivePeriodWeekId(weekId);
    setPeriodPlanTemplateDraft((prev) => {
      if (!prev) return prev;
      const current = prev.weeklyPlans.find((week) => week.id === weekId);
      if (!current) return prev;
      const shouldMark = current.usesGradientPlan !== true;
      const existingGradient = prev.weeklyPlans.find((week) => week.usesGradientPlan === true);
      const sharedDays = shouldMark && existingGradient ? { ...existingGradient.days } : { ...current.days };
      const nextWeeks = prev.weeklyPlans.map((week) =>
        week.id === weekId
          ? { ...week, usesGradientPlan: shouldMark, days: shouldMark ? sharedDays : week.days }
          : week.usesGradientPlan === true && shouldMark
            ? { ...week, days: sharedDays }
            : week,
      );
      return normalizePeriodSchedulePlan({
        ...prev,
        weeklyPlans: syncGradientMarkedWeekDays(nextWeeks),
      });
    });
  }

  function updateActivePeriodWeekDay(day: WeekdayPlanKey, value: string) {
    if (!activePeriodWeek) return;
    setPeriodPlanTemplateDraft((prev) => {
      if (!prev) return prev;
      const after =
        activePeriodWeek.usesGradientPlan === true
          ? prev.weeklyPlans.map((week) =>
              week.usesGradientPlan === true ? { ...week, days: { ...week.days, [day]: value } } : week,
            )
          : prev.weeklyPlans.map((week) =>
              week.id === activePeriodWeek.id ? { ...week, days: { ...week.days, [day]: value } } : week,
            );
      return normalizePeriodSchedulePlan({
        ...prev,
        weeklyPlans: syncGradientMarkedWeekDays(after),
      });
    });
  }

  async function saveItem() {
    if (!publishValidation.ok) {
      setActionStatus(publishValidation.message);
      return;
    }
    const resolved = resolveComposerCopy(title, description, body, categoryDraft, kindDraft);
    if (!resolved) return;
    const { title: nextTitle, description: nextDescription, body: nextBody } = resolved;

    let storedImageUrl: string | undefined;
    try {
      storedImageUrl = await resolveImageForStorage(imageUrl);
    } catch {
      setActionStatus("Kunne ikke behandle bildet. Prøv et annet bilde.");
      return;
    }

    const kind = composerKind;
    let programTemplate: ProgramTemplateInput | undefined;
    let periodPlanTemplate: PeriodSchedulePlan | undefined;

    if (kind === "program") {
      const draft =
        programTemplateDraft ??
        (usesExerciseBank
          ? createEmptyProgramTemplate(nextTitle, nextDescription, nextBody)
          : createDefaultProgram(nextTitle, nextDescription, nextBody));
      const linkedExercises = linkProgramExercisesToBank(draft.exercises, exerciseBank);
      if (usesExerciseBank) {
        if (!linkedExercises.length) {
          setActionStatus("Legg til minst én øvelse fra øvelsesbanken.");
          return;
        }
        const bankIds = new Set(exerciseBank.map((exercise) => exercise.id));
        const unlinked = linkedExercises.filter((row) => !bankIds.has(row.exerciseId));
        if (unlinked.length) {
          setActionStatus("Alle øvelser må velges fra øvelsesbanken. Fjern rader som ikke er koblet.");
          return;
        }
      }
      programTemplate = {
        ...draft,
        title: nextTitle,
        goal: nextDescription,
        notes: nextBody,
        imageUrl: programCoverImageUrl.trim() || storedImageUrl,
        exercises: linkedExercises.length
          ? linkedExercises
          : usesExerciseBank
            ? []
            : createDefaultProgram(nextTitle, nextDescription, nextBody).exercises,
      };
    }
    if (kind === "periodPlan") {
      const draft = periodPlanTemplateDraft ?? createDefaultPeriodPlan(nextTitle, nextBody);
      periodPlanTemplate = normalizePeriodSchedulePlan({
        ...draft,
        title: nextTitle,
        notes: nextBody,
        weeks: draft.weeklyPlans.length || draft.weeks,
        weeklyPlans: draft.weeklyPlans.length ? draft.weeklyPlans : createDefaultPeriodPlan(nextTitle, nextBody).weeklyPlans,
      });
    }

    if (editingItemId) {
      const next = items.map((item) =>
        item.id === editingItemId
          ? {
              ...item,
              category: categoryDraft,
              kind,
              title: nextTitle,
              description: nextDescription,
              body: nextBody,
              bodyStyle: categoryDraft === "news" ? bodyStyle : undefined,
              tag: tag.trim() || CATEGORY_META[categoryDraft].label,
              imageUrl: storedImageUrl,
              programTemplate: kind === "program" ? programTemplate : undefined,
              periodPlanTemplate: kind === "periodPlan" ? periodPlanTemplate : undefined,
            }
          : item,
      );
      const saved = await commitItems(next);
      if (!saved.ok) return;
      setActionStatus(saved.message === "Lagret på denne enheten." ? "Endringene er lagret." : saved.message);
    } else {
    const now = new Date();
      const nextItem: InspirationItem = {
      id: `inspiration-${now.getTime()}`,
      category: categoryDraft,
        kind,
      title: nextTitle,
      description: nextDescription,
      body: nextBody,
        bodyStyle: categoryDraft === "news" ? bodyStyle : undefined,
      tag: tag.trim() || CATEGORY_META[categoryDraft].label,
      author: authorName.trim() || "Motus",
        createdAt: now.toISOString(),
        imageUrl: storedImageUrl,
        programTemplate,
        periodPlanTemplate,
      };
      const published = await commitItems([nextItem, ...items]);
      if (!published.ok) return;
      setActionStatus(published.message === "Lagret på denne enheten." ? "Innlegget er publisert." : published.message);
    }
    resetComposer();
  }

  function confirmDeleteItem(id: string) {
    const item = items.find((entry) => entry.id === id);
    if (!item) return;
    if (!window.confirm(`Slette «${item.title}» fra Utforsk?`)) return;
    suppressInspirationItemId(id);
    const next = items.filter((entry) => entry.id !== id);
    void (async () => {
      const deleted = await commitItems(next);
      if (!deleted.ok) return;
      if (editingItemId === id) resetComposer();
      if (expandedItemId === id) setExpandedItemId(null);
      setActionStatus("Innlegget er slettet.");
    })();
  }

  function handleAddProgram(item: InspirationItem) {
    const base = item.programTemplate ?? createDefaultProgram(item.title, item.description, item.body);
    const template = {
      ...base,
      title: base.title || item.title,
      imageUrl: base.imageUrl?.trim() || item.programTemplate?.imageUrl?.trim() || item.imageUrl?.trim() || undefined,
      exercises: linkProgramExercisesToBank(base.exercises, exerciseBank),
      programCreatedByName: memberName,
    };
    onAddProgram?.(template);
    setActionStatus(`${item.title} er lagt til under Mine treningsprogram.`);
  }

  function handleAddPeriodPlan(item: InspirationItem) {
    const template = item.periodPlanTemplate ?? createDefaultPeriodPlan(item.title, item.body);
    const bundled = item.bundledProgramTemplates ?? [];
    for (const programTemplate of bundled) {
      onAddProgram?.({
        ...programTemplate,
        title: programTemplate.title.trim() || item.title,
        imageUrl: programTemplate.imageUrl?.trim() || item.imageUrl?.trim() || undefined,
        exercises: linkProgramExercisesToBank(programTemplate.exercises, exerciseBank),
        programCreatedByName: memberName,
      });
    }
    onAddPeriodPlan?.({ ...template, title: template.title || item.title });
    const programNote =
      bundled.length > 0 ? ` ${bundled.length} treningsprogram er også lagt til under Mine programmer.` : "";
    setActionStatus(`${item.title} er lagt til under Trening → Periodeplan.${programNote}`);
  }

  async function handleImageFile(file: File | null) {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setActionStatus("Velg en bildefil (JPG, PNG eller WebP).");
      return;
    }
    setIsImageProcessing(true);
    setActionStatus(null);
    try {
      const compressed = await compressImageFile(file);
      setImageUrl(compressed);
    } catch {
      setActionStatus("Kunne ikke lese bildefilen. Prøv et mindre bilde.");
    } finally {
      setIsImageProcessing(false);
    }
  }

  async function handleProgramCoverImageUpload(file: File) {
    if (!isSupabaseConfigured || !supabaseClient) {
      setActionStatus("Bildefunksjonen er ikke tilgjengelig akkurat nå.");
      return;
    }
    setIsUploadingProgramCoverImage(true);
    setActionStatus("Laster opp programbilde…");
    try {
      const result = await uploadProgramCoverImageToSupabase(file, supabaseClient);
      if (!result.ok) {
        setActionStatus(result.message);
        return;
      }
      setProgramCoverImageUrl(result.publicUrl);
      setActionStatus("Programbilde lastet opp. Husk å lagre innlegget.");
    } catch {
      setActionStatus("Kunne ikke laste opp bilde akkurat nå.");
    } finally {
      setIsUploadingProgramCoverImage(false);
    }
  }

  if (expandedItem && !composerOpen) {
    const detailMeta = CATEGORY_META[expandedItem.category];
    const DetailIcon = detailMeta.icon;
    const showProgramPreview = expandedItem.kind === "program" || Boolean(expandedItem.programTemplate);
    const programPreview = showProgramPreview ? resolveProgramTemplateForItem(expandedItem, exerciseBank) : null;
    const detailImageUrl = programPreview?.imageUrl?.trim() || expandedItem.imageUrl?.trim() || "";
  return (
      <div className="min-w-0 max-w-full space-y-4 overflow-x-hidden">
        <button
          type="button"
          onClick={closeDetailView}
          className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-800 shadow-sm transition hover:bg-slate-50"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden />
          Tilbake til Utforsk
        </button>

        {actionStatus ? (
          <div
            className={`rounded-xl border px-3 py-2 text-sm font-medium ${
              /kunne ikke|for stort/i.test(actionStatus)
                ? "border-rose-200 bg-rose-50 text-rose-900"
                : "motus-brand-surface"
            }`}
          >
            {actionStatus}
            </div>
        ) : null}

        <article className="mx-auto w-full max-w-2xl overflow-hidden rounded-2xl border bg-white shadow-sm" style={{ borderColor: "rgba(15,23,42,0.08)" }}>
          {detailImageUrl ? (
            <div className="aspect-[4/3] w-full overflow-hidden bg-slate-100 sm:aspect-[16/10]">
              <img src={detailImageUrl} alt="" className="h-full w-full object-cover" loading="lazy" decoding="async" />
          </div>
          ) : (
            <div className="flex aspect-[4/3] w-full items-center justify-center bg-[#F3F5F7] sm:aspect-[16/10]">
              <DetailIcon className="h-16 w-16 text-teal-600/70" />
          </div>
          )}
          <div className="p-4 sm:p-6">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-teal-50 px-2.5 py-1 text-[11px] font-bold text-teal-800 ring-1 ring-teal-100">
                <DetailIcon className="h-3.5 w-3.5" />
                {expandedItem.kind === "periodPlan" ? "Ukesplan" : expandedItem.kind === "program" ? "Program" : detailMeta.label}
              </span>
              <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-medium text-slate-600">{expandedItem.tag}</span>
        </div>
            <h1 className="mt-4 text-2xl font-bold leading-snug tracking-tight text-slate-950 sm:text-3xl">{expandedItem.title}</h1>
            <p className="mt-2 text-base text-slate-600">{expandedItem.description}</p>
            {expandedItem.body.trim() && !showProgramPreview ? (
              <div className={`mt-5 space-y-3 text-sm leading-relaxed text-slate-700 sm:text-base ${bodyStyleClass(expandedItem.bodyStyle)}`}>{renderFormattedBody(expandedItem.body)}</div>
            ) : null}

            {programPreview ? (
              <div className="mt-6 space-y-3 rounded-xl border border-sky-100 bg-sky-50/40 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h2 className="text-sm font-semibold text-slate-900">Forhåndsvisning av treningsprogram</h2>
                  <span className="rounded-full bg-white px-2.5 py-1 text-[11px] font-medium text-slate-600 ring-1 ring-sky-100">
                    {programPreview.exercises.length} øvelse{programPreview.exercises.length === 1 ? "" : "r"}
                  </span>
                </div>
                {programPreview.goal?.trim() && programPreview.goal.trim() !== expandedItem.description.trim() ? (
                  <p className="text-sm text-slate-600">{programPreview.goal}</p>
                ) : null}
                {programPreview.notes?.trim() && programPreview.notes.trim() !== expandedItem.body.trim() ? (
                  <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-600">{programPreview.notes}</p>
                ) : null}
                {programPreview.exercises.length === 0 ? (
                  <EmptyState
                    icon="🏋️"
                    title="Ingen øvelser i programmet"
                    description="PT kan legge til øvelser ved redigering av innlegget."
                    className="bg-white"
                  />
                ) : (
                  <ol className="space-y-2">
                    {programPreview.exercises.map((exercise, index) => {
                      const linked = resolveLinkedExerciseForPreview(exercise, exercisesById, exerciseBank);
          return (
                        <li
                          key={exercise.id}
                          className="flex gap-3 rounded-xl border bg-white px-3 py-2.5 shadow-sm"
                          style={{ borderColor: "rgba(15,23,42,0.06)" }}
                        >
                          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-sky-50 text-xs font-bold text-sky-800 ring-1 ring-sky-100">
                            {index + 1}
                          </span>
                          <div className="min-w-0 flex-1">
                            <div className="font-medium text-slate-900">
                              {resolveProgramExerciseName(programPreview.exercises, index)}
                            </div>
                            {linked ? (
                              <div className="mt-0.5 text-xs text-slate-500">
                                {linked.category} · {linked.group}
                              </div>
                            ) : null}
                            <div className="mt-1 text-sm text-slate-700">
                              {formatProgramExercisePrescription(exercise, index, programPreview.exercises, exerciseBank)}
                            </div>
                            {exercise.restSeconds?.trim() ? (
                              <div className="mt-0.5 text-xs text-slate-500">Hvile {exercise.restSeconds} sek</div>
                            ) : null}
                            {exercise.notes?.trim() ? (
                              <div className="mt-1 text-xs text-slate-600">{exercise.notes}</div>
                            ) : null}
                          </div>
                          {linked ? (
                            <img
                              src={getExercisePreviewSrc(linked)}
                              alt=""
                              className="h-12 w-12 shrink-0 rounded-lg object-cover ring-1 ring-slate-200"
                              loading="lazy"
                              decoding="async"
                            />
                          ) : null}
                        </li>
          );
        })}
                  </ol>
                )}
      </div>
            ) : null}

            {expandedItem.periodPlanTemplate ? (
              <div className="mt-6 space-y-3">
                <p className="text-xs font-medium text-slate-600">
                  {expandedItem.periodPlanTemplate.weeks} uker · eksempel fra uke 1 (full plan legges til ved «Legg til periodeplan»)
                </p>
                <div className="grid gap-2 sm:grid-cols-2">
                  {WEEKDAY_PLAN_FIELDS.map((field) => {
                    const entry = expandedItem.periodPlanTemplate?.weeklyPlans[0]?.days[field.key]?.trim() ?? "";
                    return (
                      <div key={field.key} className="rounded-xl bg-slate-50 px-3 py-2.5 text-sm ring-1 ring-slate-100">
                        <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{field.label}</div>
                        <div className="mt-1 font-medium text-slate-800">{entry || "Ingen plan"}</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : null}

            <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
              {expandedItem.kind === "program" && onAddProgram ? (
                <GradientButton onClick={() => handleAddProgram(expandedItem)} className="w-full sm:w-auto">
                  Legg til i mine programmer
                    </GradientButton>
              ) : null}
              {expandedItem.kind === "periodPlan" && onAddPeriodPlan ? (
                <GradientButton onClick={() => handleAddPeriodPlan(expandedItem)} className="w-full sm:w-auto">
                  {expandedItem.bundledProgramTemplates?.length
                    ? `Legg til plan + ${expandedItem.bundledProgramTemplates.length} programmer`
                    : "Legg til periodeplan"}
                </GradientButton>
              ) : null}
              {canManage ? (
                <>
                  <OutlineButton onClick={() => beginEdit(expandedItem)} className="w-full sm:w-auto">
                    Rediger
                    </OutlineButton>
                  <OutlineButton
                    onClick={() => confirmDeleteItem(expandedItem.id)}
                    className="w-full !border-rose-200 !text-rose-700 hover:!bg-rose-50 sm:w-auto"
                  >
                    Slett
                  </OutlineButton>
                </>
              ) : null}
            </div>
                </div>
              </article>
      </div>
    );
  }

  const programsCount = (itemsByCategory.programs ?? []).length;
  const showHero = inspoSubView === "overview";

  return (
    <div className="motus-inspo-page min-w-0 max-w-full space-y-4 overflow-x-hidden">
      {showHero ? (
        <section className="motus-inspo-hero">
          <div className="motus-inspo-hero-media">
            <img
              src={heroImageSrc}
              alt=""
              className="motus-inspo-hero-image"
              loading="eager"
              decoding="async"
              aria-hidden
            />
          </div>
          <div className="motus-inspo-hero-content">
            <h1 className="motus-inspo-hero-title">{heroTitleText}</h1>
            <p className="motus-inspo-hero-subtitle">{heroSubtitleText}</p>
            <div className="motus-inspo-hero-stats" aria-hidden>
              <div className="motus-inspo-hero-stat">
                <span className="motus-inspo-hero-stat-icon" aria-hidden>
                  <Dumbbell className="h-4 w-4" />
                </span>
                <div className="motus-inspo-hero-stat-text">
                  <span className="motus-inspo-hero-stat-value">{programsCount}</span>
                  <span className="motus-inspo-hero-stat-label">programmer</span>
                </div>
              </div>
            </div>
            <button
              type="button"
              className="motus-inspo-hero-cta motus-pressable"
              onClick={() => {
                const first = INSPIRATION_OVERVIEW_SECTIONS.find((section) => itemsByCategory[section.category].length > 0);
                if (first) scrollToCategorySection(first.category);
              }}
            >
              {heroCtaText}
              <ArrowRight className="h-4 w-4" aria-hidden />
            </button>
          </div>
          {canManage ? (
            <div className="motus-inspo-hero-pt-actions">
              <label
                className={`motus-inspo-hero-pt-btn ${isUploadingHeroImage ? "is-busy" : ""}`}
                title="Bytt hero-bilde"
              >
                <ImagePlus className="h-4 w-4" aria-hidden />
                <span>{isUploadingHeroImage ? "Lagrer…" : "Bytt bilde"}</span>
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  disabled={isUploadingHeroImage}
                  onChange={(event) => {
                    const file = event.target.files?.[0] ?? null;
                    event.target.value = "";
                    void handleHeroImageFile(file);
                  }}
                />
              </label>
              {heroConfig?.imageUrl && heroConfig.imageUrl !== DEFAULT_INSPO_HERO_IMAGE ? (
                <button
                  type="button"
                  onClick={() => void resetHeroImageToDefault()}
                  className="motus-inspo-hero-pt-btn motus-inspo-hero-pt-btn--ghost"
                  disabled={isUploadingHeroImage}
                  title="Tilbakestill til standardbilde"
                >
                  Tilbakestill
                </button>
              ) : null}
              <button
                type="button"
                onClick={openHeroTextEditor}
                className="motus-inspo-hero-pt-btn"
                disabled={isUploadingHeroImage || isSavingHeroText}
                title="Rediger hero-tekst"
              >
                <Pencil className="h-4 w-4" aria-hidden />
                <span>Rediger tekst</span>
              </button>
              <button
                type="button"
                onClick={openCreateComposer}
                className="motus-inspo-hero-add motus-pressable"
                aria-label="Legg til innhold"
                title="Legg til"
              >
                <Plus className="h-5 w-5" aria-hidden />
              </button>
            </div>
          ) : null}
        </section>
      ) : null}

      <div
        className="flex gap-1 rounded-xl border border-slate-200 bg-slate-50 p-1"
        role="tablist"
        aria-label="Utforsk undermeny"
      >
        <button
          type="button"
          role="tab"
          aria-selected={inspoSubView === "overview"}
          onClick={() => setInspoSubView("overview")}
          className={`flex-1 rounded-lg px-3 py-2 text-sm font-semibold transition ${
            inspoSubView === "overview" ? "bg-white text-slate-900 shadow-sm" : "text-slate-600 hover:text-slate-900"
          }`}
        >
          Utforsk
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={inspoSubView === "appGuide"}
          onClick={() => setInspoSubView("appGuide")}
          className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold transition ${
            inspoSubView === "appGuide" ? "bg-white text-slate-900 shadow-sm" : "text-slate-600 hover:text-slate-900"
          }`}
        >
          <Smartphone className="h-4 w-4 shrink-0" aria-hidden />
          App-guide
          {appGuideCount > 0 ? (
            <span className="rounded-full bg-slate-200 px-1.5 py-0.5 text-[10px] font-bold leading-none text-slate-700">
              {appGuideCount}
            </span>
          ) : null}
        </button>
      </div>

      {showHero ? (
        <section className="motus-inspo-quick-section">
          <div className="motus-inspo-quick-head">
            <h2 className="motus-inspo-quick-title">Hva vil du utforske?</h2>
          </div>
          <div className="motus-inspo-quick-grid">
            {QUICK_CATEGORIES.map((cat) => {
              const Icon = cat.icon;
              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => scrollToCategorySection(cat.scrollToCategory)}
                  className={`motus-inspo-quick-pill motus-inspo-quick-pill--${cat.tone} motus-pressable`}
                >
                  <span className="motus-inspo-quick-pill-icon" aria-hidden>
                    <Icon className="h-5 w-5" strokeWidth={2} />
                  </span>
                  <span className="motus-inspo-quick-pill-label">{cat.label}</span>
                </button>
              );
            })}
            <button
              type="button"
              onClick={() => {
                const first = INSPIRATION_OVERVIEW_SECTIONS.find((section) => itemsByCategory[section.category].length > 0);
                if (first) scrollToCategorySection(first.category);
              }}
              className="motus-inspo-quick-pill motus-inspo-quick-pill--all motus-pressable"
            >
              <span className="motus-inspo-quick-pill-icon" aria-hidden>
                <LayoutGrid className="h-5 w-5" strokeWidth={2} />
              </span>
              <span className="motus-inspo-quick-pill-label">Se alle</span>
            </button>
          </div>
        </section>
      ) : null}

      {showHero && featuredItem && inspoSubView !== "appGuide" ? (
        <section className="motus-inspo-featured-section">
          <button
            type="button"
            onClick={() => openInspirationItem(featuredItem)}
            className="motus-inspo-featured motus-pressable"
            aria-label={`Les Dagens utvalgte: ${featuredItem.title}`}
          >
            {featuredItem.imageUrl ? (
              <img
                src={featuredItem.imageUrl}
                alt=""
                className="motus-inspo-featured-image"
                loading="lazy"
                decoding="async"
                style={{ objectPosition: imageObjectPositionFromSrc(featuredItem.imageUrl) }}
              />
            ) : (
              <div className="motus-inspo-featured-image motus-inspo-featured-image--placeholder" aria-hidden>
                <Newspaper className="h-12 w-12" />
              </div>
            )}
            <div className="motus-inspo-featured-overlay" aria-hidden />
            <span className="motus-inspo-featured-badge">
              <Sparkles className="h-3.5 w-3.5" aria-hidden />
              {FEATURED_ARTICLE_BADGE.toUpperCase()}
            </span>
            <div className="motus-inspo-featured-content">
              <span className="motus-inspo-featured-kicker">
                {(featuredItem.tag.trim() || CATEGORY_META[featuredItem.category].label).toUpperCase()}
              </span>
              <h2 className="motus-inspo-featured-title">{featuredItem.title}</h2>
              {featuredItem.description ? (
                <p className="motus-inspo-featured-desc">{featuredItem.description}</p>
              ) : null}
              <span className="motus-inspo-featured-cta">
                Les mer
                <ArrowRight className="h-4 w-4" aria-hidden />
              </span>
            </div>
          </button>
          {canManage ? (
            <div className="motus-inspo-featured-actions">
              <span
                className={`motus-inspo-featured-mode ${featuredAutoRotate ? "is-auto" : "is-pinned"}`}
                aria-live="polite"
              >
                <Sparkles className="h-3.5 w-3.5" aria-hidden />
                {featuredAutoRotate ? "AI velger daglig" : "Pinnet av PT"}
              </span>
              <button
                type="button"
                className="motus-inspo-featured-action"
                onClick={() => setFeaturedPickerOpen(true)}
                disabled={isSavingFeatured}
                title="Velg artikkel for Dagens utvalgte"
              >
                <Pencil className="h-3.5 w-3.5" aria-hidden />
                <span>Velg artikkel</span>
              </button>
              {!featuredAutoRotate ? (
                <button
                  type="button"
                  className="motus-inspo-featured-action motus-inspo-featured-action--ghost"
                  onClick={() => void clearFeaturedPin()}
                  disabled={isSavingFeatured}
                  title="La AI rotere daglig"
                >
                  La AI rotere
                </button>
              ) : null}
            </div>
          ) : null}
        </section>
      ) : null}

      {actionStatus ? (
        <div
          className={`rounded-xl border px-3 py-2 text-sm font-medium ${
            /kunne ikke|for stort/i.test(actionStatus)
              ? "border-rose-200 bg-rose-50 text-rose-900"
              : "motus-brand-surface"
          }`}
        >
          {actionStatus}
            </div>
      ) : null}

      <div className="space-y-4">
        {inspoSubView === "appGuide" && appGuideCount === 0 ? (
          <p className="rounded-xl border border-slate-200 bg-white px-4 py-6 text-center text-sm text-slate-600">
            Ingen app-guider her ennå.
          </p>
        ) : null}
        {activeFeedSections.map(({ category, title }) => {
          // "Dagens utvalgte" får ligge på sin faste plass i feeden i tillegg til banneret
          // øverst — slik at den ikke "forsvinner" fra sin opprinnelige kategori-seksjon.
          const sectionItems = itemsByCategory[category];
          if (!sectionItems.length) return null;
          const isNewsLayout = category === "news";
          return (
            <section
              key={category}
              className={`motus-inspo-section ${isNewsLayout ? "motus-inspo-section--news" : ""}`}
            >
              <div className="motus-inspo-section-head">
                <h2 className="motus-inspo-section-title">{title}</h2>
                <button
                  type="button"
                  onClick={() => scrollSectionCarousel(category, "right")}
                  className="motus-inspo-section-link"
                  aria-label={`Bla videre i ${title}`}
                >
                  Se alle
                  <ArrowRight className="h-3.5 w-3.5" aria-hidden />
                </button>
              </div>
              {isNewsLayout ? (
                <div
                  ref={(node) => {
                    carouselRefs.current[category] = node;
                  }}
                  className="motus-inspo-news-grid"
                >
                  {sectionItems.map((item, index) => renderNewsCard(item, index, sectionItems.length))}
                </div>
              ) : (
                <div
                  ref={(node) => {
                    carouselRefs.current[category] = node;
                  }}
                  className="motus-inspo-section-scroll scrollbar-none"
                >
                  {sectionItems.map((item, index) => renderInspirationCard(item, index, sectionItems.length))}
                </div>
              )}
            </section>
          );
        })}

        {showHero ? (
          <section className="motus-inspo-quote">
            <Quote className="motus-inspo-quote-mark" aria-hidden />
            <div className="motus-inspo-quote-body">
              <div className="motus-inspo-quote-title">Du er sterkere enn du tror.</div>
              <div className="motus-inspo-quote-sub">Fortsett å bygge de gode vanene.</div>
            </div>
            <Flame className="motus-inspo-quote-flame" aria-hidden />
          </section>
        ) : null}
      </div>


      {canManage && composerOpen ? (
        <div className="fixed inset-0 z-[10020] overflow-y-auto bg-slate-950/45 p-3 backdrop-blur-sm sm:p-6">
          <div
            className="mx-auto min-w-0 max-w-[min(96rem,96vw)] rounded-2xl border bg-white p-4 shadow-xl sm:p-5"
            style={{ borderColor: "rgba(15,23,42,0.08)" }}
          >
          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 items-center gap-2">
            <MotusSectionIcon className="!p-2">
              {editingItemId ? <Pencil className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
            </MotusSectionIcon>
            <div className="min-w-0">
              <div className="font-semibold text-slate-900">{editingItemId ? "Rediger innhold" : "Legg ut innhold"}</div>
              <div className="text-xs text-slate-500">
                {editingItemId
                  ? "Endre tekst, bilde, program eller ukesplan. Lagres for alle som bruker Utforsk."
                  : "Velg bilde og kort tekst. Detaljer vises når man trykker les mer."}
            </div>
            </div>
            </div>
            <OutlineButton type="button" onClick={resetComposer} className="shrink-0">
              Lukk
            </OutlineButton>
          </div>
          <div className="mt-4 grid gap-5 lg:grid-cols-[minmax(0,1fr)_22rem]">
          <div className="min-w-0">
          <div className="grid gap-3 md:grid-cols-2">
            <SelectBox
              value={categoryDraft}
              onChange={(value) => {
                const next = value as InspirationCategory;
                setCategoryDraft(next);
                if (next !== "programs") {
                  setKindDraft("article");
                  setProgramTemplateDraft(null);
                  setPeriodPlanTemplateDraft(null);
                } else if (kindDraft === "article") {
                  setKindDraft("program");
                  setProgramTemplateDraft(
                    (prev) =>
                      prev ??
                      (usesExerciseBank
                        ? createEmptyProgramTemplate(title.trim(), description.trim(), body.trim())
                        : createDefaultProgram(title.trim(), description.trim(), body.trim())),
                  );
                }
              }}
              options={[
                { value: "programs", label: "Trening / program / ukesplan" },
                { value: "tips", label: "Råd og tips" },
                { value: "appGuide", label: "App-guide" },
                { value: "news", label: "Info fra senteret" },
              ]}
            />
            {categoryDraft === "programs" ? (
              <SelectBox
                value={kindDraft}
                onChange={(value) => {
                  const next = value as InspirationKind;
                  setKindDraft(next);
                  if (next === "program") {
                    if (usesExerciseBank) {
                      setProgramTemplateDraft(
                        programTemplateDraft ?? createEmptyProgramTemplate(title.trim(), description.trim(), body.trim()),
                      );
                    } else {
                      ensureProgramTemplateDraft(title.trim(), description.trim(), body.trim());
                    }
                  }
                  if (next === "periodPlan") ensurePeriodPlanTemplateDraft(title.trim(), body.trim());
                  if (next === "article") {
                    setProgramTemplateDraft(null);
                    setPeriodPlanTemplateDraft(null);
                  }
                }}
                options={[
                  { value: "article", label: "Bare innhold" },
                  { value: "program", label: "Treningsprogram som kan legges til" },
                  { value: "periodPlan", label: "Ukesplan som kan legges til" },
                ]}
              />
            ) : (
              <TextInput value={tag} onChange={(event) => setTag(event.target.value)} placeholder="Tagg, f.eks. 20 min eller mobilitet" />
            )}
            <label className="grid gap-1">
              <TextInput
                value={title}
                onChange={(event) => setTitle(event.target.value.slice(0, INSPO_CARD_TITLE_MAX))}
                placeholder={`Tittel (maks ${INSPO_CARD_TITLE_MAX} tegn)`}
                maxLength={INSPO_CARD_TITLE_MAX}
              />
              <span className="text-[11px] text-slate-500">{title.length}/{INSPO_CARD_TITLE_MAX} tegn</span>
            </label>
            <label className="grid gap-1">
              <TextInput
                value={description}
                onChange={(event) => setDescription(event.target.value.slice(0, INSPO_CARD_DESCRIPTION_MAX))}
                placeholder={`Kort info under bildet (maks ${INSPO_CARD_DESCRIPTION_MAX} tegn)`}
                maxLength={INSPO_CARD_DESCRIPTION_MAX}
              />
              <span className="text-[11px] text-slate-500">{description.length}/{INSPO_CARD_DESCRIPTION_MAX} tegn</span>
            </label>
            <TextInput value={tag} onChange={(event) => setTag(event.target.value)} placeholder="Tagg" />
            <label
              className={`flex cursor-pointer items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 ${isImageProcessing ? "pointer-events-none opacity-60" : ""}`}
            >
              <ImagePlus className="h-4 w-4" />
              <span>{isImageProcessing ? "Behandler bilde…" : imageUrl ? "Bilde valgt" : "Velg kvadratisk bilde"}</span>
              <input
                type="file"
                accept="image/*"
                className="hidden"
                disabled={isImageProcessing}
                onChange={(event) => void handleImageFile(event.target.files?.[0] ?? null)}
              />
            </label>
          </div>
          <TextArea
            ref={bodyTextareaRef}
            value={body}
            onChange={(event) => setBody(event.target.value)}
            className="mt-3 min-h-[110px]"
            placeholder={
              composerKind === "program"
                ? "Detaljer under Les mer (valgfritt for program)"
                : "Detaljer som vises under Les mer"
            }
          />
          <div className="mt-2 flex flex-wrap items-center gap-1 rounded-xl border bg-slate-50 p-1" style={{ borderColor: "rgba(15,23,42,0.08)" }}>
            <button
              type="button"
              onClick={() => prefixSelectedBodyLines("## ", "Overskrift")}
              className="flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-white hover:text-slate-950"
              aria-label="Stor overskrift"
              title="Stor overskrift (H2)"
            >
              <Heading2 className="h-3.5 w-3.5" aria-hidden />
            </button>
            <button
              type="button"
              onClick={() => prefixSelectedBodyLines("### ", "Mellomtittel")}
              className="flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-white hover:text-slate-950"
              aria-label="Mellomtittel"
              title="Mellomtittel (H3)"
            >
              <Heading3 className="h-3.5 w-3.5" aria-hidden />
            </button>
            <span className="mx-0.5 hidden h-5 w-px bg-slate-300 sm:inline-block" aria-hidden />
            <button
              type="button"
              onClick={() => wrapSelectedBodyText("**")}
              className="rounded-lg px-2.5 py-1.5 text-xs font-bold text-slate-700 transition hover:bg-white hover:text-slate-950"
              aria-label="Gjør markert tekst bold"
              title="Bold"
            >
              <Bold className="h-3.5 w-3.5" aria-hidden />
            </button>
            <button
              type="button"
              onClick={() => wrapSelectedBodyText("*")}
              className="rounded-lg px-2.5 py-1.5 text-xs italic text-slate-700 transition hover:bg-white hover:text-slate-950"
              aria-label="Gjør markert tekst kursiv"
              title="Kursiv"
            >
              <Italic className="h-3.5 w-3.5" aria-hidden />
            </button>
            <span className="mx-0.5 hidden h-5 w-px bg-slate-300 sm:inline-block" aria-hidden />
            <button
              type="button"
              onClick={() => prefixSelectedBodyLines("- ", "Punkt")}
              className="rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-white hover:text-slate-950"
              aria-label="Punktliste"
              title="Punktliste"
            >
              <List className="h-3.5 w-3.5" aria-hidden />
            </button>
            <button
              type="button"
              onClick={() => prefixSelectedBodyLines("1. ", "Punkt")}
              className="rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-white hover:text-slate-950"
              aria-label="Nummerert liste"
              title="Nummerert liste"
            >
              <ListOrdered className="h-3.5 w-3.5" aria-hidden />
            </button>
            <button
              type="button"
              onClick={insertLinkAtSelection}
              className="rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-white hover:text-slate-950"
              aria-label="Sett inn lenke"
              title="Lenke"
            >
              <Link2 className="h-3.5 w-3.5" aria-hidden />
            </button>
            {categoryDraft === "news" && bodyStyle !== "normal" ? (
              <button
                type="button"
                onClick={() => setBodyStyle("normal")}
                className="rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-600 transition hover:bg-white hover:text-slate-950"
              >
                Vanlig
              </button>
            ) : null}
            </div>

          {categoryDraft === "programs" && kindDraft === "program" ? (
            <div className="mt-4 space-y-3 rounded-xl border border-sky-100 bg-sky-50/50 p-3">
              <div>
                <div className="text-sm font-semibold text-slate-900">Treningsprogram fra øvelsesbank</div>
                <p className="mt-1 text-xs text-slate-500">
                  {usesExerciseBank
                    ? "Velg øvelser fra banken. Medlemmer får samme kobling som i vanlige programmer."
                    : "Øvelsesbanken er ikke lastet. Last PT-appen på nytt."}
                </p>
              </div>
              <ProgramCoverImageField
                imageUrl={programCoverImageUrl}
                onImageUrlChange={setProgramCoverImageUrl}
                onUploadFile={handleProgramCoverImageUpload}
                isUploading={isUploadingProgramCoverImage}
              />
              <div className={`grid gap-4 ${usesExerciseBank ? "xl:grid-cols-[1.05fr_0.95fr]" : ""}`}>
                <div className="space-y-3">
                  {(programTemplateDraft?.exercises ?? []).length === 0 ? (
                    <EmptyState
                      icon="🏋️"
                      title="Ingen øvelser valgt"
                      description={usesExerciseBank ? "Trykk en øvelse i banken." : "Last øvelsesbanken først."}
                      className="bg-white"
                    />
                  ) : null}
                  {(programTemplateDraft?.exercises ?? []).map((item) => {
                    const linkedExercise = exercisesById.get(item.exerciseId);
                    const isCardio = linkedExercise?.category === "Kondisjon";
                    const isTreadmill = (linkedExercise?.equipment ?? "").trim().toLowerCase().includes("tredem");
                    const prescriptionFields = resolveExercisePrescriptionFields(linkedExercise);
                    return (
                      <div key={item.id} className="rounded-xl border bg-white p-3 space-y-3" style={{ borderColor: "rgba(15,23,42,0.08)" }}>
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className="font-medium text-slate-900">{item.exerciseName}</div>
                            {linkedExercise ? (
                              <div className="mt-0.5 text-xs text-slate-500">
                                {linkedExercise.category} · {linkedExercise.group}
                              </div>
                            ) : usesExerciseBank ? (
                              <div className="mt-1 text-xs font-medium text-amber-700">Ikke koblet – fjern og velg på nytt</div>
                            ) : null}
                          </div>
                          <button type="button" onClick={() => removeProgramExercise(item.id)} className="rounded-lg border border-rose-200 p-1.5 text-rose-700 hover:bg-rose-50" aria-label="Fjern">
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                        <ProgramExercisePrescriptionFields
                          fields={prescriptionFields}
                          item={item}
                          onUpdate={(field, value) => updateProgramExercise(item.id, field, value)}
                          trailing={
                            isCardio && isTreadmill ? (
                              <>
                                <div className="space-y-1">
                                  <div className="text-[11px] font-medium text-slate-500">Fart</div>
                                  <TextInput value={item.speed ?? ""} onChange={(e) => updateProgramExercise(item.id, "speed", e.target.value)} placeholder="km/t" />
                                </div>
                                <div className="space-y-1">
                                  <div className="text-[11px] font-medium text-slate-500">Stigning</div>
                                  <TextInput value={item.incline ?? ""} onChange={(e) => updateProgramExercise(item.id, "incline", e.target.value)} placeholder="%" />
                                </div>
                              </>
                            ) : null
                          }
                        />
                        {!linkedExercise && !usesExerciseBank ? (
                          <TextInput value={item.exerciseName} onChange={(e) => updateProgramExercise(item.id, "exerciseName", e.target.value)} placeholder="Øvelsesnavn" />
                        ) : null}
                      </div>
                    );
                  })}
                </div>
                {usesExerciseBank ? (
                  <div className="rounded-xl border bg-white p-3 space-y-3" style={{ borderColor: "rgba(15,23,42,0.08)" }}>
                    <div className="font-semibold text-slate-900">Øvelsesbank</div>
                    <TextInput value={programExerciseSearch} onChange={(e) => setProgramExerciseSearch(e.target.value)} placeholder="Søk øvelse, muskelgruppe eller utstyr" />
                    <div className="grid gap-2 sm:grid-cols-2">
                      <SelectBox
                        value={programExerciseCategoryFilter}
                        onChange={(value) => setProgramExerciseCategoryFilter(value as typeof programExerciseCategoryFilter)}
                        options={[
                          { value: "all", label: "Alle typer" },
                          ...EXERCISE_CATEGORY_OPTIONS.map((category) => ({ value: category, label: category })),
                        ]}
                      />
                      <SelectBox
                        value={programExerciseGroupFilter}
                        onChange={setProgramExerciseGroupFilter}
                        options={[{ value: "all", label: "Alle muskelgrupper" }, ...programExerciseGroupOptions.map((g) => ({ value: g, label: g }))]}
                      />
                    </div>
                    <div className="max-h-[420px] space-y-2 overflow-auto pr-1">
                      {visibleProgramExercises.length === 0 ? (
                        <EmptyState icon="🔎" title="Ingen øvelser matcher" description="Prøv annet søk." className="bg-slate-50 py-4" />
                      ) : null}
                      {visibleProgramExercises.map((exercise) => (
                        <ExerciseBankListCard
                          key={exercise.id}
                          exercise={exercise}
                          compact
                          imageSrc={getExercisePreviewSrc(exercise)}
                          onImageError={(event) => {
                            event.currentTarget.src = getExerciseSketchDataUri(exercise);
                          }}
                          onMainClick={() => addProgramExerciseFromBank(exercise)}
                          showAddButton={false}
                        />
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            </div>

          ) : null}

          {categoryDraft === "programs" && kindDraft === "periodPlan" ? (
            <div className="mt-4 space-y-3 rounded-xl border border-teal-100 bg-teal-50/40 p-3">
              <div className="flex flex-wrap items-end gap-3">
                <label className="grid gap-1 text-sm">
                  <span className="font-semibold text-slate-900">Antall uker</span>
                  <TextInput
                    value={String(periodPlanTemplateDraft?.weeks ?? periodPlanTemplateDraft?.weeklyPlans.length ?? 1)}
                    onChange={(event) => syncPeriodPlanWeekCount(Number(event.target.value) || 1)}
                    type="number"
                    min={1}
                    max={12}
                    className="w-24"
                  />
                </label>
              </div>
              {(periodPlanTemplateDraft?.weeklyPlans ?? []).length > 0 ? (
                <div className="rounded-xl border bg-white p-3 space-y-2" style={{ borderColor: "rgba(15,23,42,0.08)" }}>
                  <div className="text-sm font-semibold text-slate-900">Uker i planen</div>
                  <p className="text-xs text-slate-500">
                    Trykk en uke for å redigere. Trykk igjen for å markere flere uker med samme plan (farget).
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {(periodPlanTemplateDraft?.weeklyPlans ?? []).map((week) => {
                      const marked = week.usesGradientPlan === true;
                      const isActive = activePeriodWeekId === week.id;
                      return (
                        <button
                          key={week.id}
                          type="button"
                          onClick={() => toggleGradientPeriodWeek(week.id)}
                          className={`rounded-md border px-1 py-1.5 text-center text-xs font-semibold leading-tight transition ${
                            marked ? "text-white shadow-sm" : "bg-white text-slate-700 hover:bg-slate-50"
                          } ${isActive ? "ring-2 ring-teal-200" : ""}`}
                          style={
                            marked
                              ? {
                                  borderColor: "transparent",
                                  background: `${MOTUS.gradient}`,
                                }
                              : { borderColor: "rgba(15,23,42,0.08)" }
                          }
                          aria-pressed={marked}
                        >
                          Uke {week.weekNumber}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : null}
              {programTemplates.length > 0 ? (
                <p className="text-xs text-slate-600">
                  Programmaler fra PT er tilgjengelige i dagvelgeren under ({programTemplates.length} stk).
                </p>
              ) : null}
              {activePeriodWeek ? (
                <div className="space-y-2">
                  <div className="text-sm font-semibold text-slate-900">
                    Ukedager {activePeriodWeek.usesGradientPlan ? "(gjelder alle markerte uker)" : `(uke ${activePeriodWeek.weekNumber})`}
                  </div>
                  <div className="grid gap-2 lg:grid-cols-2">
                    {WEEKDAY_PLAN_FIELDS.map((field) => {
                      const currentValue = activePeriodWeek.days[field.key];
                      const hasCurrentValueInOptions = periodPlanProgramOptions.some((option) => option.value === currentValue);
                      const options = hasCurrentValueInOptions
                        ? periodPlanProgramOptions
                        : [...periodPlanProgramOptions, { value: currentValue, label: `${currentValue} (tilpasset)` }];
                      return (
                        <label key={field.key} className="grid gap-1">
                          <span className="text-xs font-semibold text-slate-700">{field.label}</span>
                          <SelectBox value={currentValue} onChange={(value) => updateActivePeriodWeekDay(field.key, value)} options={options} />
                        </label>
                      );
                    })}
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}

          
          <div className="mt-3 flex flex-col items-end gap-2">
            {!publishValidation.ok ? <p className="w-full text-right text-xs text-slate-500">{publishValidation.message}</p> : null}
            <div className="flex flex-wrap justify-end gap-2">
              <OutlineButton type="button" onClick={resetComposer}>
                {editingItemId ? "Avbryt redigering" : "Lukk"}
              </OutlineButton>
              <GradientButton type="button" onClick={() => void saveItem()} disabled={!publishValidation.ok}>
                {editingItemId ? "Lagre endringer" : "Publiser"}
            </GradientButton>
            </div>
          </div>
          </div>
          <aside className="lg:sticky lg:top-4 lg:self-start" aria-label="Forhåndsvisning">
            <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-3">
              <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                <Sparkles className="h-3.5 w-3.5 text-teal-500" aria-hidden />
                Forhåndsvisning
              </div>
              <div className="flex justify-center">{renderEditorPreviewCard()}</div>
              {body.trim() ? (
                <details className="mt-3 rounded-xl border border-slate-200 bg-white p-3 text-xs text-slate-700">
                  <summary className="cursor-pointer text-xs font-semibold text-slate-700">Les mer-visning</summary>
                  <div className={`mt-2 space-y-2 text-xs leading-relaxed text-slate-700 ${bodyStyleClass(bodyStyle)}`}>
                    {renderFormattedBody(body)}
                  </div>
                </details>
              ) : null}
              <p className="mt-3 text-[11px] leading-snug text-slate-500">
                Slik vises kortet i Utforsk-feeden. Endringer oppdateres mens du skriver.
              </p>
            </div>
          </aside>
          </div>
          </div>
        </div>
      ) : null}

      {canManage && heroTextEditorOpen ? (
        <div className="fixed inset-0 z-[10020] overflow-y-auto bg-slate-950/45 p-3 backdrop-blur-sm sm:p-6">
          <div
            className="mx-auto min-w-0 max-w-[min(56rem,96vw)] rounded-2xl border bg-white p-4 shadow-xl sm:p-5"
            style={{ borderColor: "rgba(15,23,42,0.08)" }}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 items-center gap-2">
                <MotusSectionIcon className="!p-2">
                  <Pencil className="h-4 w-4" />
                </MotusSectionIcon>
                <div className="min-w-0">
                  <div className="font-semibold text-slate-900">Rediger hero-tekst</div>
                  <div className="text-xs text-slate-500">
                    Endre tittel, undertekst og knappetekst. Lagres for alle som bruker Utforsk.
                  </div>
                </div>
              </div>
              <OutlineButton type="button" onClick={closeHeroTextEditor} className="shrink-0">
                Lukk
              </OutlineButton>
            </div>

            <div className="mt-4 grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
              <div className="grid gap-3">
                <label className="grid gap-1">
                  <span className="text-xs font-semibold text-slate-700">Tittel</span>
                  <TextInput
                    value={heroTitleDraft}
                    onChange={(event) => setHeroTitleDraft(event.target.value.slice(0, 80))}
                    placeholder={DEFAULT_INSPO_HERO_TITLE}
                    maxLength={80}
                  />
                  <span className="text-[11px] text-slate-500">{heroTitleDraft.length}/80 tegn</span>
                </label>

                <label className="grid gap-1">
                  <span className="text-xs font-semibold text-slate-700">Undertekst</span>
                  <TextArea
                    value={heroSubtitleDraft}
                    onChange={(event) => setHeroSubtitleDraft(event.target.value.slice(0, 160))}
                    placeholder={DEFAULT_INSPO_HERO_SUBTITLE}
                    className="min-h-[72px]"
                  />
                  <span className="text-[11px] text-slate-500">{heroSubtitleDraft.length}/160 tegn</span>
                </label>

                <label className="grid gap-1">
                  <span className="text-xs font-semibold text-slate-700">Knappetekst (CTA)</span>
                  <TextInput
                    value={heroCtaDraft}
                    onChange={(event) => setHeroCtaDraft(event.target.value.slice(0, 30))}
                    placeholder={DEFAULT_INSPO_HERO_CTA}
                    maxLength={30}
                  />
                  <span className="text-[11px] text-slate-500">La stå tomt for «{DEFAULT_INSPO_HERO_CTA}».</span>
                </label>
              </div>

              <aside className="rounded-2xl border bg-slate-50 p-3" style={{ borderColor: "rgba(15,23,42,0.08)" }}>
                <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">Forhåndsvisning</div>
                <div className="motus-inspo-hero">
                  <div className="motus-inspo-hero-media">
                    <img src={heroImageSrc} alt="" className="motus-inspo-hero-image" />
                  </div>
                  <div className="motus-inspo-hero-content">
                    <h1 className="motus-inspo-hero-title">{previewHeroTitle}</h1>
                    <p className="motus-inspo-hero-subtitle">{previewHeroSubtitle}</p>
                    <button type="button" className="motus-inspo-hero-cta" disabled>
                      {previewHeroCta}
                      <ArrowRight className="h-4 w-4" aria-hidden />
                    </button>
                  </div>
                </div>
                <p className="mt-3 text-[11px] leading-snug text-slate-500">
                  Forhåndsvisning bruker dagens hero-bilde. Bytt bilde fra hero-knappen «Bytt bilde».
                </p>
              </aside>
            </div>

            <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
              {heroHasCustomText ? (
                <OutlineButton
                  type="button"
                  onClick={() => void resetHeroTextToDefaults()}
                  className="w-full sm:w-auto"
                  disabled={isSavingHeroText}
                >
                  Tilbakestill til standard
                </OutlineButton>
              ) : null}
              <OutlineButton type="button" onClick={closeHeroTextEditor} className="w-full sm:w-auto">
                Avbryt
              </OutlineButton>
              <GradientButton
                type="button"
                onClick={() => void saveHeroText()}
                className="w-full sm:w-auto"
                disabled={isSavingHeroText}
              >
                {isSavingHeroText ? "Lagrer…" : "Lagre"}
              </GradientButton>
            </div>
          </div>
        </div>
      ) : null}

      {canManage && featuredPickerOpen ? (
        <div className="fixed inset-0 z-[10020] overflow-y-auto bg-slate-950/45 p-3 backdrop-blur-sm sm:p-6">
          <div
            className="mx-auto min-w-0 max-w-[min(48rem,96vw)] rounded-2xl border bg-white p-4 shadow-xl sm:p-5"
            style={{ borderColor: "rgba(15,23,42,0.08)" }}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 items-center gap-2">
                <MotusSectionIcon className="!p-2">
                  <Sparkles className="h-4 w-4" />
                </MotusSectionIcon>
                <div className="min-w-0">
                  <div className="font-semibold text-slate-900">Velg Dagens utvalgte</div>
                  <div className="text-xs text-slate-500">
                    Pin én artikkel, eller la AI rotere automatisk hver dag.
                  </div>
                </div>
              </div>
              <OutlineButton type="button" onClick={() => setFeaturedPickerOpen(false)} className="shrink-0">
                Lukk
              </OutlineButton>
            </div>

            <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3">
              <button
                type="button"
                onClick={() => void clearFeaturedPin()}
                disabled={isSavingFeatured || featuredAutoRotate}
                className="flex w-full items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white p-3 text-left transition hover:border-teal-300 hover:bg-teal-50/50 disabled:opacity-60"
              >
                <span className="flex min-w-0 items-center gap-2.5">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-teal-100 text-teal-700">
                    <Sparkles className="h-4 w-4" />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold text-slate-900">La AI velge automatisk</span>
                    <span className="block text-[11px] text-slate-500">
                      Roterer Dagens utvalgte fra alle artikler hver dag.
                    </span>
                  </span>
                </span>
                {featuredAutoRotate ? (
                  <span className="rounded-full bg-teal-600 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
                    Aktiv
                  </span>
                ) : null}
              </button>
            </div>

            {featuredArticlePool.length ? (
              <div className="mt-3 grid max-h-[min(70vh,28rem)] gap-2 overflow-y-auto rounded-xl border border-slate-200 bg-slate-50 p-3">
                <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                  Eller pin én bestemt artikkel
                </div>
                {featuredArticlePool.map((item) => {
                  const meta = CATEGORY_META[item.category];
                  const Icon = meta.icon;
                  const isActivePin = !featuredAutoRotate && item.id === pinnedFeaturedItemId;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => void setFeaturedItemAndPin(item.id)}
                      disabled={isSavingFeatured}
                      className={`flex w-full items-center gap-3 rounded-lg border p-2.5 text-left transition disabled:opacity-60 ${
                        isActivePin
                          ? "border-teal-400 bg-teal-50/70 ring-1 ring-teal-400"
                          : "border-slate-200 bg-white hover:border-teal-300 hover:bg-teal-50/40"
                      }`}
                    >
                      <span className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-slate-100">
                        {item.imageUrl ? (
                          <img
                            src={item.imageUrl}
                            alt=""
                            className="h-full w-full object-cover"
                            loading="lazy"
                            decoding="async"
                            style={{ objectPosition: imageObjectPositionFromSrc(item.imageUrl) }}
                          />
                        ) : (
                          <Icon className="h-5 w-5 text-teal-600" />
                        )}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-500">
                          {(item.tag.trim() || meta.label).toUpperCase()}
                        </span>
                        <span className="block truncate text-sm font-semibold text-slate-900">{item.title}</span>
                        {item.description ? (
                          <span className="block truncate text-xs text-slate-500">{item.description}</span>
                        ) : null}
                      </span>
                      {isActivePin ? (
                        <span className="shrink-0 rounded-full bg-teal-600 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
                          Pinnet
                        </span>
                      ) : null}
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="mt-3 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4 text-center text-sm text-slate-500">
                Ingen artikler å velge mellom enda. Legg til en artikkel under Utforsk for å låse den som Dagens utvalgte.
              </div>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
