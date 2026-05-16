import { useEffect, useMemo, useRef, useState } from "react";
import { CalendarRange, ChevronLeft, ChevronRight, ClipboardList, ImagePlus, Lightbulb, Newspaper, Plus, Soup, Sparkles, Trash2 } from "lucide-react";
import { MOTUS } from "../app/data";
import { uid } from "../app/storage";
import { GradientButton, OutlineButton, SelectBox, TextArea, TextInput } from "../app/ui";
import type { PeriodSchedulePlan, ProgramExercise, WeekdayPlanKey, WeeklyDayPlan } from "../app/types";
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

const STORAGE_KEY = "motus.inspiration.items.v2";

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
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_ITEMS;
    const parsed = JSON.parse(raw) as InspirationItem[];
    return Array.isArray(parsed) && parsed.length ? parsed : DEFAULT_ITEMS;
  } catch {
    return DEFAULT_ITEMS;
  }
}

function saveInspirationItems(items: InspirationItem[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
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
  const carouselRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    saveInspirationItems(items);
  }, [items]);

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

  function publishItem() {
    const nextTitle = title.trim();
    const nextDescription = description.trim();
    const nextBody = body.trim();
    if (!nextTitle || !nextDescription || !nextBody) return;
    const now = new Date();
    const next: InspirationItem = {
      id: `inspiration-${now.getTime()}`,
      category: categoryDraft,
      kind: categoryDraft === "programs" ? kindDraft : "article",
      title: nextTitle,
      description: nextDescription,
      body: nextBody,
      tag: tag.trim() || CATEGORY_META[categoryDraft].label,
      author: authorName.trim() || "Motus",
      createdAt: now.toISOString().slice(0, 10),
      imageUrl: imageUrl.trim() || undefined,
    };
    if (next.kind === "program") next.programTemplate = createDefaultProgram(nextTitle, nextDescription, nextBody);
    if (next.kind === "periodPlan") next.periodPlanTemplate = createDefaultPeriodPlan(nextTitle, nextBody);
    setItems((prev) => [next, ...prev]);
    setTitle("");
    setDescription("");
    setBody("");
    setTag("");
    setImageUrl("");
    setActiveCategory(categoryDraft);
  }

  function deleteItem(id: string) {
    setItems((prev) => prev.filter((item) => item.id !== id));
  }

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
              <article key={item.id} className="w-[min(82vw,280px)] shrink-0 snap-start overflow-hidden rounded-xl border bg-white" style={{ borderColor: "rgba(15,23,42,0.08)" }}>
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
            <button type="button" onClick={() => setExpandedItemId(null)} className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50">
              Lukk
            </button>
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
              <Plus className="h-4 w-4" />
            </span>
            <div>
              <div className="font-semibold text-slate-900">Legg ut inspirasjon</div>
              <div className="text-xs text-slate-500">Velg bilde og kort tekst. Detaljer vises når man trykker les mer.</div>
            </div>
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <SelectBox
              value={categoryDraft}
              onChange={(value) => {
                const next = value as InspirationCategory;
                setCategoryDraft(next);
                if (next !== "programs") setKindDraft("article");
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
                onChange={(value) => setKindDraft(value as InspirationKind)}
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
          <div className="mt-3 flex justify-end">
            <GradientButton onClick={publishItem} disabled={!title.trim() || !description.trim() || !body.trim()}>
              Publiser
            </GradientButton>
          </div>
        </div>
      ) : null}
    </div>
  );
}
