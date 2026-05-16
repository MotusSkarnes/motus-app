import { useEffect, useMemo, useRef, useState } from "react";
import { CalendarRange, ChevronLeft, ChevronRight, ClipboardList, ImagePlus, Lightbulb, Newspaper, Pencil, Plus, Soup, Sparkles, Trash2 } from "lucide-react";
import { MOTUS } from "../app/data";
import {
  INSPIRATION_STORAGE_KEY,
  notifyInspirationItemsChanged,
  saveInspirationItemsToStorage,
} from "../app/inspirationStorage";
import { WEEKDAY_PLAN_LABELS, WEEKDAY_PLAN_ORDER } from "../app/periodPlanSwaps";
import { uid } from "../app/storage";
import { GradientButton, OutlineButton, SelectBox, TextArea, TextInput } from "../app/ui";
import type { PeriodSchedulePlan, ProgramExercise, WeekdayPlanKey, WeeklyDayPlan, WeeklySchedulePlan } from "../app/types";
import type { SaveProgramInput } from "../services/appRepository";

type InspirationCategory = "recipes" | "programs" | "tips" | "news";
type InspirationKind = "article" | "program" | "periodPlan";
type ProgramTemplateInput = Omit<SaveProgramInput, "memberId">;

type InspirationItem = {
  id: string;
  category: InspirationCategory;
  kind: InspirationKind;
  title: string;
  description: string;
  body: string;
  tag: string;
  author: string;
  createdAt: string;
  imageUrl?: string;
  programTemplate?: ProgramTemplateInput;
  periodPlanTemplate?: PeriodSchedulePlan;
};

const CATEGORY_META: Record<InspirationCategory, { label: string; plural: string; icon: typeof Soup; accent: string; image: string }> = {
  recipes: { label: "Oppskrift", plural: "Oppskrifter", icon: Soup, accent: "bg-emerald-50 text-emerald-800 ring-emerald-100", image: "linear-gradient(135deg,#d1fae5,#ffffff,#fce7f3)" },
  programs: { label: "Trening", plural: "Treningsprogram", icon: ClipboardList, accent: "bg-sky-50 text-sky-800 ring-sky-100", image: "linear-gradient(135deg,#cffafe,#f8fafc,#fbcfe8)" },
  tips: { label: "Tips", plural: "Råd og tips", icon: Lightbulb, accent: "bg-amber-50 text-amber-800 ring-amber-100", image: "linear-gradient(135deg,#fef3c7,#ffffff,#ccfbf1)" },
  news: { label: "Nyhet", plural: "Nyheter på senteret", icon: Newspaper, accent: "bg-pink-50 text-pink-800 ring-pink-100", image: "linear-gradient(135deg,#fce7f3,#ffffff,#ccfbf1)" },
};

const DAY_LABELS: Record<WeekdayPlanKey, string> = {
  monday: "Mandag",
  tuesday: "Tirsdag",
  wednesday: "Onsdag",
  thursday: "Torsdag",
  friday: "Fredag",
  saturday: "Lørdag",
  sunday: "Søndag",
};

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
    id: "default-recipe-1",
    category: "recipes",
    kind: "article",
    title: "Proteinrik frokostbolle",
    description: "Enkel frokost etter morgenøkt.",
    body: "Gresk yoghurt, havregryn, bær, nøtter og litt honning. Topp med kanel og la den stå 5 minutter før servering.",
    tag: "15 min",
    author: "Motus",
    createdAt: "2026-05-01",
  },
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
];

function loadInspirationItems(): InspirationItem[] {
  if (typeof window === "undefined") return DEFAULT_ITEMS;
  try {
    const raw = window.localStorage.getItem(INSPIRATION_STORAGE_KEY);
    if (!raw) return DEFAULT_ITEMS;
    const parsed = JSON.parse(raw) as InspirationItem[];
    return Array.isArray(parsed) && parsed.length ? parsed : DEFAULT_ITEMS;
  } catch {
    return DEFAULT_ITEMS;
  }
}

type InspirationHubProps = {
  canManage?: boolean;
  authorName?: string;
  memberId?: string;
  memberName?: string;
  onAddProgram?: (program: ProgramTemplateInput) => void;
  onAddPeriodPlan?: (plan: PeriodSchedulePlan) => void;
};

export function InspirationHub({ canManage = false, authorName = "Motus", memberName = "Medlem", onAddProgram, onAddPeriodPlan }: InspirationHubProps) {
  const [items, setItems] = useState<InspirationItem[]>(() => loadInspirationItems());
  const [activeCategory, setActiveCategory] = useState<InspirationCategory | "all">("all");
  const [expandedItemId, setExpandedItemId] = useState<string | null>(null);
  const [actionStatus, setActionStatus] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [body, setBody] = useState("");
  const [tag, setTag] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [categoryDraft, setCategoryDraft] = useState<InspirationCategory>("recipes");
  const [kindDraft, setKindDraft] = useState<InspirationKind>("article");
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [programTemplateDraft, setProgramTemplateDraft] = useState<ProgramTemplateInput | null>(null);
  const [periodPlanTemplateDraft, setPeriodPlanTemplateDraft] = useState<PeriodSchedulePlan | null>(null);
  const [activePeriodWeekNumber, setActivePeriodWeekNumber] = useState(1);
  const carouselRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    saveInspirationItemsToStorage(items);
  }, [items]);

  useEffect(() => {
    if (canManage) return;
    notifyInspirationItemsChanged();
  }, [canManage]);

  const filteredItems = useMemo(() => {
    const sorted = [...items].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return activeCategory === "all" ? sorted : sorted.filter((item) => item.category === activeCategory);
  }, [activeCategory, items]);

  const featured = filteredItems[0] ?? items[0] ?? DEFAULT_ITEMS[0];
  const expandedItem = items.find((item) => item.id === expandedItemId) ?? null;

  function scrollCarousel(direction: "left" | "right") {
    const node = carouselRef.current;
    if (!node) return;
    const amount = Math.max(260, Math.round(node.clientWidth * 0.82));
    node.scrollBy({ left: direction === "left" ? -amount : amount, behavior: "smooth" });
  }

  function resetComposer() {
    setEditingItemId(null);
    setTitle("");
    setDescription("");
    setBody("");
    setTag("");
    setImageUrl("");
    setCategoryDraft("recipes");
    setKindDraft("article");
    setProgramTemplateDraft(null);
    setPeriodPlanTemplateDraft(null);
    setActivePeriodWeekNumber(1);
  }

  function beginEdit(item: InspirationItem) {
    setEditingItemId(item.id);
    setTitle(item.title);
    setDescription(item.description);
    setBody(item.body);
    setTag(item.tag);
    setImageUrl(item.imageUrl ?? "");
    setCategoryDraft(item.category);
    setKindDraft(item.kind);
    setProgramTemplateDraft(item.programTemplate ? structuredClone(item.programTemplate) : null);
    setPeriodPlanTemplateDraft(item.periodPlanTemplate ? structuredClone(item.periodPlanTemplate) : null);
    setActivePeriodWeekNumber(item.periodPlanTemplate?.weeklyPlans[0]?.weekNumber ?? 1);
    setExpandedItemId(item.id);
    setActionStatus(null);
  }

  function ensureProgramTemplateDraft(nextTitle: string, nextDescription: string, nextBody: string) {
    setProgramTemplateDraft((prev) => prev ?? createDefaultProgram(nextTitle, nextDescription, nextBody));
  }

  function ensurePeriodPlanTemplateDraft(nextTitle: string, nextBody: string) {
    setPeriodPlanTemplateDraft((prev) => prev ?? createDefaultPeriodPlan(nextTitle, nextBody));
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

  function addProgramExercise() {
    setProgramTemplateDraft((prev) => {
      const base = prev ?? createDefaultProgram(title.trim() || "Nytt program", description.trim(), body.trim());
      return { ...base, exercises: [...base.exercises, makeExercise("Ny øvelse")] };
    });
  }

  function removeProgramExercise(exerciseId: string) {
    setProgramTemplateDraft((prev) => {
      if (!prev) return prev;
      const next = prev.exercises.filter((exercise) => exercise.id !== exerciseId);
      return { ...prev, exercises: next.length ? next : [makeExercise("Ny øvelse")] };
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
      return { ...base, weeks: clamped, weeklyPlans };
    });
    setActivePeriodWeekNumber((current) => Math.min(current, clamped));
  }

  function updatePeriodPlanDay(weekNumber: number, day: WeekdayPlanKey, value: string) {
    setPeriodPlanTemplateDraft((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        weeklyPlans: prev.weeklyPlans.map((week) =>
          week.weekNumber === weekNumber ? { ...week, days: { ...week.days, [day]: value } } : week,
        ),
      };
    });
  }

  function saveItem() {
    const nextTitle = title.trim();
    const nextDescription = description.trim();
    const nextBody = body.trim();
    if (!nextTitle || !nextDescription || !nextBody) return;

    const kind = categoryDraft === "programs" ? kindDraft : "article";
    let programTemplate: ProgramTemplateInput | undefined;
    let periodPlanTemplate: PeriodSchedulePlan | undefined;

    if (kind === "program") {
      const draft = programTemplateDraft ?? createDefaultProgram(nextTitle, nextDescription, nextBody);
      programTemplate = {
        ...draft,
        title: nextTitle,
        goal: nextDescription,
        notes: nextBody,
        exercises: draft.exercises.length ? draft.exercises : createDefaultProgram(nextTitle, nextDescription, nextBody).exercises,
      };
    }
    if (kind === "periodPlan") {
      const draft = periodPlanTemplateDraft ?? createDefaultPeriodPlan(nextTitle, nextBody);
      periodPlanTemplate = {
        ...draft,
        title: nextTitle,
        notes: nextBody,
        weeks: draft.weeklyPlans.length || draft.weeks,
        weeklyPlans: draft.weeklyPlans.length ? draft.weeklyPlans : createDefaultPeriodPlan(nextTitle, nextBody).weeklyPlans,
      };
    }

    if (editingItemId) {
      setItems((prev) =>
        prev.map((item) =>
          item.id === editingItemId
            ? {
                ...item,
                category: categoryDraft,
                kind,
                title: nextTitle,
                description: nextDescription,
                body: nextBody,
                tag: tag.trim() || CATEGORY_META[categoryDraft].label,
                imageUrl: imageUrl.trim() || undefined,
                programTemplate: kind === "program" ? programTemplate : undefined,
                periodPlanTemplate: kind === "periodPlan" ? periodPlanTemplate : undefined,
              }
            : item,
        ),
      );
      setActionStatus("Endringene er lagret.");
    } else {
      const now = new Date();
      const next: InspirationItem = {
        id: `inspiration-${now.getTime()}`,
        category: categoryDraft,
        kind,
        title: nextTitle,
        description: nextDescription,
        body: nextBody,
        tag: tag.trim() || CATEGORY_META[categoryDraft].label,
        author: authorName.trim() || "Motus",
        createdAt: now.toISOString().slice(0, 10),
        imageUrl: imageUrl.trim() || undefined,
        programTemplate,
        periodPlanTemplate,
      };
      setItems((prev) => [next, ...prev]);
      setActionStatus("Innlegget er publisert.");
      setActiveCategory(categoryDraft);
      notifyInspirationItemsChanged();
    }
    resetComposer();
  }

  function confirmDeleteItem(id: string) {
    const item = items.find((entry) => entry.id === id);
    if (!item) return;
    if (!window.confirm(`Slette «${item.title}» fra inspirasjon?`)) return;
    setItems((prev) => prev.filter((entry) => entry.id !== id));
    if (editingItemId === id) resetComposer();
    if (expandedItemId === id) setExpandedItemId(null);
    setActionStatus("Innlegget er slettet.");
  }

  const activePeriodWeek =
    periodPlanTemplateDraft?.weeklyPlans.find((week) => week.weekNumber === activePeriodWeekNumber) ??
    periodPlanTemplateDraft?.weeklyPlans[0] ??
    null;

  function handleAddProgram(item: InspirationItem) {
    const template = item.programTemplate ?? createDefaultProgram(item.title, item.description, item.body);
    onAddProgram?.({ ...template, title: template.title || item.title, programCreatedByName: memberName });
    setActionStatus(`${item.title} er lagt til under Mine treningsprogram.`);
  }

  function handleAddPeriodPlan(item: InspirationItem) {
    const template = item.periodPlanTemplate ?? createDefaultPeriodPlan(item.title, item.body);
    onAddPeriodPlan?.({ ...template, title: template.title || item.title });
    setActionStatus(`${item.title} er lagt til under Mine periodeplaner.`);
  }

  function handleImageFile(file: File | null) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setImageUrl(typeof reader.result === "string" ? reader.result : "");
    reader.readAsDataURL(file);
  }

  return (
    <div className="space-y-4">
      <div
        className="overflow-hidden rounded-2xl border shadow-sm"
        style={{ borderColor: "rgba(48,227,190,0.20)", background: `linear-gradient(135deg, ${MOTUS.paleMint} 0%, #ffffff 48%, rgba(217,18,120,0.08) 100%)` }}
      >
        <div className="h-1.5" style={{ background: `linear-gradient(135deg, ${MOTUS.turquoise} 0%, ${MOTUS.pink} 100%)` }} />
        <div className="grid gap-4 p-4 sm:p-5 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-end">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full bg-white/80 px-3 py-1 text-xs font-semibold text-slate-700 ring-1 ring-white">
              <Sparkles className="h-3.5 w-3.5 text-teal-600" />
              Åpen for alle medlemmer og PT-er
            </div>
            <h2 className="mt-3 text-2xl font-bold tracking-tight text-slate-950">Inspirasjon</h2>
            <p className="mt-1 max-w-2xl text-sm leading-relaxed text-slate-600">
              Kort inspirasjon først. Trykk les mer for detaljer, eller legg programmer og ukesplaner rett inn i din egen trening.
            </p>
          </div>
          <div className="rounded-xl border bg-white/80 p-3 text-sm shadow-sm" style={{ borderColor: "rgba(15,23,42,0.08)" }}>
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Fremhevet nå</div>
            <div className="mt-1 font-semibold text-slate-900">{featured.title}</div>
            <div className="mt-1 text-xs text-slate-500">{featured.description}</div>
          </div>
        </div>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1">
        {(["all", "recipes", "programs", "tips", "news"] as const).map((category) => {
          const active = activeCategory === category;
          const label = category === "all" ? "Alt" : CATEGORY_META[category].plural;
          return (
            <button
              key={category}
              type="button"
              onClick={() => setActiveCategory(category)}
              className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                active ? "border-transparent text-white shadow-sm" : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
              }`}
              style={active ? { background: `linear-gradient(135deg, ${MOTUS.turquoise} 0%, ${MOTUS.pink} 100%)` } : undefined}
            >
              {label}
            </button>
          );
        })}
      </div>

      {actionStatus ? <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-900">{actionStatus}</div> : null}

      <div className="rounded-2xl border bg-white p-3 shadow-sm sm:p-4" style={{ borderColor: "rgba(15,23,42,0.08)" }}>
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <div className="text-sm font-semibold text-slate-900">Sveip for inspirasjon</div>
            <div className="text-xs text-slate-500">{filteredItems.length} innlegg</div>
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={() => scrollCarousel("left")} className="rounded-lg border border-slate-200 bg-white p-2 text-slate-600 hover:bg-slate-50" aria-label="Forrige">
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button type="button" onClick={() => scrollCarousel("right")} className="rounded-lg border border-slate-200 bg-white p-2 text-slate-600 hover:bg-slate-50" aria-label="Neste">
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
        <div ref={carouselRef} className="flex snap-x snap-mandatory gap-3 overflow-x-auto scroll-smooth pb-2">
          {filteredItems.map((item) => {
            const meta = CATEGORY_META[item.category];
            const Icon = meta.icon;
            return (
              <article key={item.id} className="relative w-[min(82vw,280px)] shrink-0 snap-start overflow-hidden rounded-xl border bg-white" style={{ borderColor: "rgba(15,23,42,0.08)" }}>
                {canManage ? (
                  <div className="absolute right-2 top-2 z-10 flex gap-1">
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
                <button type="button" onClick={() => setExpandedItemId(item.id)} className="block w-full text-left">
                  <div className="aspect-square w-full overflow-hidden bg-slate-100" style={!item.imageUrl ? { background: meta.image } : undefined}>
                    {item.imageUrl ? <img src={item.imageUrl} alt="" className="h-full w-full object-cover" loading="lazy" decoding="async" /> : null}
                    {!item.imageUrl ? (
                      <div className="flex h-full w-full items-center justify-center text-white/90">
                        <Icon className="h-12 w-12 drop-shadow-sm" />
                      </div>
                    ) : null}
                  </div>
                  <div className="p-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-bold ring-1 ${meta.accent}`}>
                        <Icon className="h-3 w-3" />
                        {item.kind === "periodPlan" ? "Ukesplan" : item.kind === "program" ? "Program" : meta.label}
                      </span>
                      <span className="text-[10px] text-slate-400">{item.tag}</span>
                    </div>
                    <h3 className="mt-2 line-clamp-2 text-base font-semibold leading-tight text-slate-950">{item.title}</h3>
                    <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-slate-500">{item.description}</p>
                    <div className="mt-3 text-xs font-semibold text-teal-700">Les mer</div>
                  </div>
                </button>
                <div className="border-t border-slate-100 p-3">
                  {item.kind === "program" && onAddProgram ? (
                    <GradientButton onClick={() => handleAddProgram(item)} className="w-full !px-3 !py-2 !text-xs">
                      Legg til program
                    </GradientButton>
                  ) : item.kind === "periodPlan" && onAddPeriodPlan ? (
                    <GradientButton onClick={() => handleAddPeriodPlan(item)} className="w-full !px-3 !py-2 !text-xs">
                      Legg til periodeplan
                    </GradientButton>
                  ) : (
                    <OutlineButton onClick={() => setExpandedItemId(item.id)} className="w-full !px-3 !py-2 !text-xs">
                      Les mer
                    </OutlineButton>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      </div>

      {expandedItem ? (
        <div className="rounded-2xl border bg-white p-4 shadow-sm" style={{ borderColor: "rgba(15,23,42,0.08)" }}>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Les mer</div>
              <h3 className="mt-1 text-xl font-semibold text-slate-950">{expandedItem.title}</h3>
              <p className="mt-1 text-sm text-slate-500">{expandedItem.description}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {canManage ? (
                <>
                  <OutlineButton onClick={() => beginEdit(expandedItem)} className="!px-3 !py-1.5 !text-xs">
                    Rediger
                  </OutlineButton>
                  <OutlineButton onClick={() => confirmDeleteItem(expandedItem.id)} className="!px-3 !py-1.5 !text-xs !text-rose-700 !border-rose-200 hover:!bg-rose-50">
                    Slett
                  </OutlineButton>
                </>
              ) : null}
              <button type="button" onClick={() => setExpandedItemId(null)} className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50">
                Lukk
              </button>
            </div>
          </div>
          <p className="mt-4 whitespace-pre-wrap text-sm leading-relaxed text-slate-700">{expandedItem.body}</p>
          {expandedItem.periodPlanTemplate ? (
            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              {Object.entries(expandedItem.periodPlanTemplate.weeklyPlans[0]?.days ?? {}).map(([day, entry]) => (
                <div key={day} className="rounded-lg bg-slate-50 px-3 py-2 text-sm">
                  <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{DAY_LABELS[day as WeekdayPlanKey]}</div>
                  <div className="mt-1 text-slate-800">{entry || "Ingen plan"}</div>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}

      {canManage ? (
        <div className="rounded-2xl border bg-white p-4 shadow-sm" style={{ borderColor: "rgba(15,23,42,0.08)" }}>
          <div className="flex items-center gap-2">
            <span className="rounded-lg p-2 text-white" style={{ background: `linear-gradient(135deg, ${MOTUS.turquoise} 0%, ${MOTUS.pink} 100%)` }}>
              {editingItemId ? <Pencil className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
            </span>
            <div>
              <div className="font-semibold text-slate-900">{editingItemId ? "Rediger inspirasjon" : "Legg ut inspirasjon"}</div>
              <div className="text-xs text-slate-500">
                {editingItemId
                  ? "Endre tekst, bilde, program eller ukesplan. Lagres for alle som bruker inspo."
                  : "Velg bilde og kort tekst. Detaljer vises når man trykker les mer."}
              </div>
            </div>
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <SelectBox
              value={categoryDraft}
              onChange={(value) => {
                const next = value as InspirationCategory;
                setCategoryDraft(next);
                if (next !== "programs") {
                  setKindDraft("article");
                  setProgramTemplateDraft(null);
                  setPeriodPlanTemplateDraft(null);
                }
              }}
              options={[
                { value: "recipes", label: "Oppskrift" },
                { value: "programs", label: "Trening / program / ukesplan" },
                { value: "tips", label: "Råd og tips" },
                { value: "news", label: "Nyhet på senteret" },
              ]}
            />
            {categoryDraft === "programs" ? (
              <SelectBox
                value={kindDraft}
                onChange={(value) => {
                  const next = value as InspirationKind;
                  setKindDraft(next);
                  if (next === "program") ensureProgramTemplateDraft(title.trim(), description.trim(), body.trim());
                  if (next === "periodPlan") ensurePeriodPlanTemplateDraft(title.trim(), body.trim());
                  if (next === "article") {
                    setProgramTemplateDraft(null);
                    setPeriodPlanTemplateDraft(null);
                  }
                }}
                options={[
                  { value: "article", label: "Bare inspirasjon" },
                  { value: "program", label: "Treningsprogram som kan legges til" },
                  { value: "periodPlan", label: "Ukesplan som kan legges til" },
                ]}
              />
            ) : (
              <TextInput value={tag} onChange={(event) => setTag(event.target.value)} placeholder="Tagg, f.eks. 20 min eller mobilitet" />
            )}
            <TextInput value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Tittel" />
            <TextInput value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Kort info under bildet" />
            <TextInput value={tag} onChange={(event) => setTag(event.target.value)} placeholder="Tagg" />
            <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100">
              <ImagePlus className="h-4 w-4" />
              <span>{imageUrl ? "Bilde valgt" : "Velg kvadratisk bilde"}</span>
              <input type="file" accept="image/*" className="hidden" onChange={(event) => handleImageFile(event.target.files?.[0] ?? null)} />
            </label>
          </div>
          <TextArea value={body} onChange={(event) => setBody(event.target.value)} className="mt-3 min-h-[110px]" placeholder="Detaljer som vises under Les mer" />

          {categoryDraft === "programs" && kindDraft === "program" ? (
            <div className="mt-4 space-y-3 rounded-xl border border-sky-100 bg-sky-50/50 p-3">
              <div className="flex items-center justify-between gap-2">
                <div className="text-sm font-semibold text-slate-900">Øvelser i programmet</div>
                <OutlineButton type="button" onClick={addProgramExercise} className="!px-2.5 !py-1.5 !text-xs">
                  Legg til øvelse
                </OutlineButton>
              </div>
              {(programTemplateDraft?.exercises ?? []).map((exercise) => (
                <div key={exercise.id} className="rounded-xl border bg-white p-3 space-y-2" style={{ borderColor: "rgba(15,23,42,0.08)" }}>
                  <div className="flex items-center justify-between gap-2">
                    <TextInput value={exercise.exerciseName} onChange={(event) => updateProgramExercise(exercise.id, "exerciseName", event.target.value)} placeholder="Øvelsesnavn" />
                    <button type="button" onClick={() => removeProgramExercise(exercise.id)} className="rounded-lg border border-rose-200 p-1.5 text-rose-700 hover:bg-rose-50" aria-label="Fjern øvelse">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-4">
                    <TextInput value={exercise.sets} onChange={(event) => updateProgramExercise(exercise.id, "sets", event.target.value)} placeholder="Sett" />
                    <TextInput value={exercise.reps} onChange={(event) => updateProgramExercise(exercise.id, "reps", event.target.value)} placeholder="Reps" />
                    <TextInput value={exercise.restSeconds} onChange={(event) => updateProgramExercise(exercise.id, "restSeconds", event.target.value)} placeholder="Hvile sek" />
                    <TextInput value={exercise.notes} onChange={(event) => updateProgramExercise(exercise.id, "notes", event.target.value)} placeholder="Notat" />
                  </div>
                </div>
              ))}
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
                <div className="flex flex-wrap gap-1.5">
                  {(periodPlanTemplateDraft?.weeklyPlans ?? []).map((week) => (
                    <button
                      key={week.id}
                      type="button"
                      onClick={() => setActivePeriodWeekNumber(week.weekNumber)}
                      className={`rounded-md border px-2.5 py-1 text-xs font-semibold ${
                        activePeriodWeekNumber === week.weekNumber ? "border-teal-400 bg-teal-100 text-teal-900" : "border-slate-200 bg-white text-slate-700"
                      }`}
                    >
                      Uke {week.weekNumber}
                    </button>
                  ))}
                </div>
              </div>
              {activePeriodWeek ? (
                <div className="grid gap-2 sm:grid-cols-2">
                  {WEEKDAY_PLAN_ORDER.map((day) => (
                    <label key={day} className="grid gap-1">
                      <span className="text-xs font-semibold text-slate-700">{WEEKDAY_PLAN_LABELS[day]}</span>
                      <TextInput
                        value={activePeriodWeek.days[day]}
                        onChange={(event) => updatePeriodPlanDay(activePeriodWeek.weekNumber, day, event.target.value)}
                        placeholder="Plan for dagen"
                      />
                    </label>
                  ))}
                </div>
              ) : null}
            </div>
          ) : null}

          <div className="mt-3 flex flex-wrap justify-end gap-2">
            {editingItemId ? (
              <OutlineButton type="button" onClick={resetComposer}>
                Avbryt redigering
              </OutlineButton>
            ) : null}
            <GradientButton onClick={saveItem} disabled={!title.trim() || !description.trim() || !body.trim()}>
              {editingItemId ? "Lagre endringer" : "Publiser"}
            </GradientButton>
          </div>
        </div>
      ) : null}
    </div>
  );
}
