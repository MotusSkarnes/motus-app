import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Lightbulb, Newspaper, Plus, Soup, Sparkles, Trash2, ClipboardList } from "lucide-react";
import { MOTUS } from "../app/data";
import { GradientButton, SelectBox, TextArea, TextInput } from "../app/ui";

type InspirationCategory = "recipes" | "programs" | "tips" | "news";

type InspirationItem = {
  id: string;
  category: InspirationCategory;
  title: string;
  description: string;
  body: string;
  tag: string;
  author: string;
  createdAt: string;
};

const STORAGE_KEY = "motus.inspiration.items.v1";

const CATEGORY_META: Record<InspirationCategory, { label: string; plural: string; icon: typeof Soup; accent: string }> = {
  recipes: { label: "Oppskrift", plural: "Oppskrifter", icon: Soup, accent: "bg-emerald-50 text-emerald-800 ring-emerald-100" },
  programs: { label: "Treningsprogram", plural: "Treningsprogram", icon: ClipboardList, accent: "bg-sky-50 text-sky-800 ring-sky-100" },
  tips: { label: "Råd og tips", plural: "Råd og tips", icon: Lightbulb, accent: "bg-amber-50 text-amber-800 ring-amber-100" },
  news: { label: "Nyhet", plural: "Nyheter på senteret", icon: Newspaper, accent: "bg-pink-50 text-pink-800 ring-pink-100" },
};

const DEFAULT_ITEMS: InspirationItem[] = [
  {
    id: "default-recipe-1",
    category: "recipes",
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
    title: "Fullkropp 30 minutter",
    description: "Kort økt for travle dager.",
    body: "Knebøy, pushups, roing, hip thrust og planke. Kjør 3 runder med rolig oppvarming først.",
    tag: "Nybegynner",
    author: "Motus",
    createdAt: "2026-05-01",
  },
  {
    id: "default-tip-1",
    category: "tips",
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
};

export function InspirationHub({ canManage = false, authorName = "Motus" }: InspirationHubProps) {
  const [items, setItems] = useState<InspirationItem[]>(() => loadInspirationItems());
  const [activeCategory, setActiveCategory] = useState<InspirationCategory | "all">("all");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [body, setBody] = useState("");
  const [tag, setTag] = useState("");
  const [categoryDraft, setCategoryDraft] = useState<InspirationCategory>("recipes");
  const carouselRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    saveInspirationItems(items);
  }, [items]);

  const filteredItems = useMemo(() => {
    const sorted = [...items].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return activeCategory === "all" ? sorted : sorted.filter((item) => item.category === activeCategory);
  }, [activeCategory, items]);

  const featured = filteredItems[0] ?? items[0] ?? DEFAULT_ITEMS[0];

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
      title: nextTitle,
      description: nextDescription,
      body: nextBody,
      tag: tag.trim() || CATEGORY_META[categoryDraft].label,
      author: authorName.trim() || "Motus",
      createdAt: now.toISOString().slice(0, 10),
    };
    setItems((prev) => [next, ...prev]);
    setTitle("");
    setDescription("");
    setBody("");
    setTag("");
    setActiveCategory(categoryDraft);
  }

  function deleteItem(id: string) {
    setItems((prev) => prev.filter((item) => item.id !== id));
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
              Oppskrifter, treningsideer, råd og nyheter fra senteret samlet på ett sted.
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
              <article key={item.id} className="min-h-[250px] w-[min(82vw,330px)] shrink-0 snap-start rounded-xl border bg-slate-50 p-4" style={{ borderColor: "rgba(15,23,42,0.08)" }}>
                <div className="flex items-start justify-between gap-3">
                  <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold ring-1 ${meta.accent}`}>
                    <Icon className="h-3.5 w-3.5" />
                    {meta.label}
                  </span>
                  {canManage && !item.id.startsWith("default-") ? (
                    <button type="button" onClick={() => deleteItem(item.id)} className="rounded-lg border border-rose-200 bg-white p-1.5 text-rose-700 hover:bg-rose-50" aria-label="Slett innlegg">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  ) : null}
                </div>
                <h3 className="mt-4 text-lg font-semibold leading-tight text-slate-950">{item.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">{item.description}</p>
                <p className="mt-3 line-clamp-4 text-sm leading-relaxed text-slate-700">{item.body}</p>
                <div className="mt-4 flex items-center justify-between gap-3 text-xs text-slate-500">
                  <span className="rounded-full bg-white px-2 py-1 font-semibold text-slate-600 ring-1 ring-slate-200">{item.tag}</span>
                  <span>{item.author}</span>
                </div>
              </article>
            );
          })}
        </div>
      </div>

      {canManage ? (
        <div className="rounded-2xl border bg-white p-4 shadow-sm" style={{ borderColor: "rgba(15,23,42,0.08)" }}>
          <div className="flex items-center gap-2">
            <span className="rounded-lg p-2 text-white" style={{ background: `linear-gradient(135deg, ${MOTUS.turquoise} 0%, ${MOTUS.pink} 100%)` }}>
              <Plus className="h-4 w-4" />
            </span>
            <div>
              <div className="font-semibold text-slate-900">Legg ut inspirasjon</div>
              <div className="text-xs text-slate-500">Synlig for medlemmer og PT-er i denne appen.</div>
            </div>
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <SelectBox
              value={categoryDraft}
              onChange={(value) => setCategoryDraft(value as InspirationCategory)}
              options={[
                { value: "recipes", label: "Oppskrift" },
                { value: "programs", label: "Treningsprogram" },
                { value: "tips", label: "Råd og tips" },
                { value: "news", label: "Nyhet på senteret" },
              ]}
            />
            <TextInput value={tag} onChange={(event) => setTag(event.target.value)} placeholder="Tagg, f.eks. 20 min eller mobilitet" />
            <TextInput value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Tittel" />
            <TextInput value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Kort ingress" />
          </div>
          <TextArea value={body} onChange={(event) => setBody(event.target.value)} className="mt-3 min-h-[110px]" placeholder="Skriv innhold, fremgangsmåte eller tips" />
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
