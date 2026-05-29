import type { LucideIcon } from "lucide-react";
import {
  Apple,
  Brain,
  ClipboardList,
  Dumbbell,
  Footprints,
  LayoutGrid,
  Lightbulb,
  Moon,
  Newspaper,
} from "lucide-react";

export type InspirationHubCategory = "recipes" | "programs" | "tips" | "news" | "appGuide" | "nutrition";

export type InspoThemeId =
  | "running"
  | "strength"
  | "motivation"
  | "nutrition"
  | "recovery"
  | "programs"
  | "news"
  | "tips"
  | "all";

export type InspoHubItem = {
  id: string;
  category: InspirationHubCategory;
  kind: string;
  title: string;
  description: string;
  tag: string;
  body?: string;
};

export type InspoThemeConfig = {
  id: InspoThemeId;
  label: string;
  description: string;
  icon: LucideIcon;
  tone: "mint" | "pink" | "mintSoft" | "purple" | "orange" | "all";
  showInTopNav?: boolean;
  match: (item: InspoHubItem) => boolean;
};

function textIncludesAny(value: string, terms: string[]): boolean {
  const lower = value.toLowerCase();
  return terms.some((term) => lower.includes(term));
}

export const INSPO_TOP_NAV_THEMES: readonly InspoThemeConfig[] = [
  {
    id: "running",
    label: "Løping",
    icon: Footprints,
    tone: "mint",
    description: "Løpeplaner, intervaller og utholdenhet.",
    showInTopNav: true,
    match: (item) =>
      item.category === "programs" &&
      textIncludesAny(`${item.title} ${item.tag} ${item.description}`, [
        "løp",
        "løping",
        "running",
        "interval",
        "5k",
        "10k",
        "sub45",
        "sub60",
        "maraton",
      ]),
  },
  {
    id: "strength",
    label: "Styrke",
    icon: Dumbbell,
    tone: "pink",
    description: "Styrkeøkter, programmer og progresjon.",
    showInTopNav: true,
    match: (item) =>
      item.category === "programs" &&
      textIncludesAny(`${item.title} ${item.tag} ${item.description}`, [
        "styrke",
        "strength",
        "muskel",
        "kraft",
        "heving",
        "squat",
        "knebøy",
      ]),
  },
  {
    id: "motivation",
    label: "Motivasjon",
    icon: Brain,
    tone: "purple",
    description: "Råd, vaner og mental styrke.",
    showInTopNav: true,
    match: (item) => item.category === "tips",
  },
  {
    id: "nutrition",
    label: "Kosthold",
    icon: Apple,
    tone: "mintSoft",
    description: "Kunnskapsartikler om kosthold — ikke oppskrifter.",
    showInTopNav: true,
    match: (item) => item.category === "nutrition",
  },
  {
    id: "recovery",
    label: "Restitusjon",
    icon: Moon,
    tone: "orange",
    description: "Søvn, restitusjon og skadeforebygging.",
    showInTopNav: true,
    match: (item) =>
      item.category === "tips" ||
      item.category === "news" ||
      textIncludesAny(`${item.title} ${item.tag} ${item.description} ${item.body ?? ""}`, [
        "restitusjon",
        "recovery",
        "søvn",
        "hvile",
        "stretch",
        "mobilitet",
        "skade",
      ]),
  },
];

export const INSPO_CATEGORY_THEMES: readonly InspoThemeConfig[] = [
  {
    id: "programs",
    label: "Trening",
    icon: ClipboardList,
    tone: "mint",
    description: "Alle treningsprogram og ukesplaner.",
    match: (item) => item.category === "programs",
  },
  {
    id: "news",
    label: "Nytt fra Motus",
    icon: Newspaper,
    tone: "pink",
    description: "Info og nyheter fra senteret.",
    match: (item) => item.category === "news",
  },
  {
    id: "tips",
    label: "Råd og tips",
    icon: Lightbulb,
    tone: "pinkSoft",
    description: "Praktiske tips for hverdagen.",
    match: (item) => item.category === "tips",
  },
  {
    id: "all",
    label: "Alt innhold",
    icon: LayoutGrid,
    tone: "all",
    description: "Alt i Utforsk unntatt app-guide.",
    match: () => true,
  },
];

export function getInspoThemeById(themeId: InspoThemeId): InspoThemeConfig | undefined {
  return [...INSPO_TOP_NAV_THEMES, ...INSPO_CATEGORY_THEMES].find((theme) => theme.id === themeId);
}

export function filterItemsForInspoTheme(items: InspoHubItem[], themeId: InspoThemeId): InspoHubItem[] {
  const theme = getInspoThemeById(themeId);
  if (!theme) return items;
  const hubItems = items.filter((item) => item.category !== "appGuide" && item.category !== "recipes");
  if (themeId === "all") return hubItems;
  return hubItems.filter(theme.match);
}

export type BentoTileSize = "hero" | "wide" | "tall" | "medium" | "compact";

export type BentoTile = {
  item: InspoHubItem;
  size: BentoTileSize;
};

export function buildExploreBentoTiles(items: InspoHubItem[], excludeIds: Set<string> = new Set()): BentoTile[] {
  const pool = items.filter((item) => !excludeIds.has(item.id) && item.category !== "appGuide" && item.category !== "recipes");
  const tiles: BentoTile[] = [];
  const used = new Set<string>();

  const take = (predicate: (item: InspoHubItem) => boolean, size: BentoTileSize, limit = 1) => {
    for (const item of pool) {
      if (used.has(item.id)) continue;
      if (!predicate(item)) continue;
      tiles.push({ item, size });
      used.add(item.id);
      if (tiles.filter((t) => t.size === size).length >= limit) return;
    }
  };

  take((item) => item.category === "news", "wide", 1);
  take((item) => item.category === "programs" && item.kind !== "article", "hero", 1);
  take((item) => item.category === "nutrition", "medium", 1);
  take((item) => item.category === "tips", "tall", 1);

  const fillerSizes: BentoTileSize[] = ["compact", "medium", "tall", "compact", "medium", "compact"];
  let fillerIndex = 0;
  for (const item of pool) {
    if (used.has(item.id)) continue;
    let size: BentoTileSize = fillerSizes[fillerIndex % fillerSizes.length] ?? "compact";
    if (item.category === "programs" && item.kind !== "article") size = fillerIndex % 2 === 0 ? "medium" : "compact";
    if (item.category === "news") size = fillerIndex % 3 === 0 ? "wide" : "compact";
    tiles.push({ item, size });
    used.add(item.id);
    fillerIndex += 1;
    if (tiles.length >= 12) break;
  }

  return tiles;
}
