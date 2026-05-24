import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Clock3,
  Grid3X3,
  LayoutList,
  Plus,
  Search,
  SlidersHorizontal,
  Star,
  Upload,
  UserRound,
  X,
} from "lucide-react";
import { filterFoodBankItems, sortFoodBankItems } from "../app/foodBankFilter";
import {
  FOOD_BANK_CHANGED_EVENT,
  deleteFoodItem,
  loadFavoriteFoodIds,
  loadFoodBankItems,
  loadRecentFoodIds,
  persistFavoriteFoodIds,
  persistFoodBankItems,
  touchRecentFoodId,
  upsertFoodItem,
} from "../app/foodBankStorage";
import { compressImageFile } from "../app/imageCompress";
import {
  EMPTY_MACRO_FILTER,
  FOOD_BANK_CATEGORIES,
  foodCategoryMeta,
  foodItemMayDelete,
  foodSourceLabel,
  formatMacro,
  type FoodBankFilterChip,
  type FoodCategoryId,
  type FoodItem,
  type FoodMacroFilter,
  type FoodSource,
} from "../app/foodBankTypes";
import { uid } from "../app/storage";
import { GradientButton, OutlineButton, SelectBox, TextInput } from "../app/ui";
import { FoodBankImportModal } from "./FoodBankImportModal";
import { FoodImageField } from "./FoodImageField";
import "../foodbank.css";

const MAX_FOOD_IMAGE_BYTES = 5 * 1024 * 1024;

const PAGE_SIZE = 16;

const FILTER_CHIPS: Array<{ id: FoodBankFilterChip; label: string; icon?: typeof Star }> = [
  { id: "all", label: "Alle" },
  { id: "favorites", label: "Favoritter", icon: Star },
  { id: "mine", label: "Mine matvarer", icon: UserRound },
  { id: "recent", label: "Nylig brukt", icon: Clock3 },
  ...FOOD_BANK_CATEGORIES.map((category) => ({
    id: category.id as FoodBankFilterChip,
    label: category.label,
  })),
];

type TrainerFoodBankViewProps = {
  trainerName: string;
};

type FoodFormState = {
  id: string | null;
  name: string;
  portionLabel: string;
  portionGrams: string;
  category: FoodCategoryId;
  origin: string;
  source: FoodSource;
  imageEmoji: string;
  imageUrl: string;
  kcal: string;
  protein: string;
  carbs: string;
  fat: string;
  fiber: string;
  sugar: string;
  saturatedFat: string;
  sodium: string;
};

function emptyForm(): FoodFormState {
  return {
    id: null,
    name: "",
    portionLabel: "100 g",
    portionGrams: "100",
    category: "proteinkilder",
    origin: "",
    source: "egen",
    imageEmoji: "🍽️",
    imageUrl: "",
    kcal: "",
    protein: "",
    carbs: "",
    fat: "",
    fiber: "0",
    sugar: "0",
    saturatedFat: "0",
    sodium: "0",
  };
}

function formFromFood(item: FoodItem): FoodFormState {
  return {
    id: item.id,
    name: item.name,
    portionLabel: item.portionLabel,
    portionGrams: String(item.portionGrams),
    category: item.category,
    origin: item.origin,
    source: item.source,
    imageEmoji: item.imageEmoji ?? "🍽️",
    imageUrl: item.imageUrl ?? "",
    kcal: String(item.nutritionPer100g.kcal),
    protein: String(item.nutritionPer100g.protein),
    carbs: String(item.nutritionPer100g.carbs),
    fat: String(item.nutritionPer100g.fat),
    fiber: String(item.nutritionPer100g.fiber),
    sugar: String(item.nutritionPer100g.sugar),
    saturatedFat: String(item.nutritionPer100g.saturatedFat),
    sodium: String(item.nutritionPer100g.sodium),
  };
}

function parseNumber(value: string): number {
  const parsed = Number(value.trim().replace(",", "."));
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatDateLabel(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "–";
  return date.toLocaleDateString("nb-NO", { day: "numeric", month: "short", year: "numeric" });
}

function FoodThumb({ item }: { item: FoodItem }) {
  const meta = foodCategoryMeta(item.category);
  const photo = item.imageUrl?.trim();
  return (
    <div
      className="motus-foodbank-thumb"
      style={{ background: photo ? "#f8fafc" : `linear-gradient(145deg, ${meta.accent}22 0%, ${meta.accent}08 100%)` }}
      aria-hidden
    >
      {photo ? (
        <img src={photo} alt="" className="motus-foodbank-thumb-photo" />
      ) : (
        <span className="motus-foodbank-thumb-emoji">{item.imageEmoji ?? meta.emoji}</span>
      )}
    </div>
  );
}

function MacroStrip({ item, compact = false }: { item: FoodItem; compact?: boolean }) {
  const n = item.nutritionPer100g;
  return (
    <div className={`motus-foodbank-macros ${compact ? "motus-foodbank-macros--compact" : ""}`}>
      <span><strong>{formatMacro(n.kcal)}</strong> kcal</span>
      <span><strong>{formatMacro(n.protein, 1)}</strong> protein</span>
      <span><strong>{formatMacro(n.carbs, 1)}</strong> karb</span>
      <span><strong>{formatMacro(n.fat, 1)}</strong> fett</span>
    </div>
  );
}

export function TrainerFoodBankView({ trainerName }: TrainerFoodBankViewProps) {
  const [items, setItems] = useState<FoodItem[]>(() => loadFoodBankItems());
  const [favoriteIds, setFavoriteIds] = useState<string[]>(() => loadFavoriteFoodIds());
  const [recentIds, setRecentIds] = useState<string[]>(() => loadRecentFoodIds());
  const [search, setSearch] = useState("");
  const [chip, setChip] = useState<FoodBankFilterChip>("all");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [filterOpen, setFilterOpen] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState<FoodFormState>(emptyForm);
  const [formStatus, setFormStatus] = useState<string | null>(null);
  const [imageUploading, setImageUploading] = useState(false);
  const [sources, setSources] = useState<FoodSource[]>([]);
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [mineOnly, setMineOnly] = useState(false);
  const [macroFilter, setMacroFilter] = useState<FoodMacroFilter>(EMPTY_MACRO_FILTER);
  const [mealPlanNotice, setMealPlanNotice] = useState<string | null>(null);
  const [importOpen, setImportOpen] = useState(false);

  const reload = useCallback(() => {
    setItems(loadFoodBankItems());
    setFavoriteIds(loadFavoriteFoodIds());
    setRecentIds(loadRecentFoodIds());
  }, []);

  useEffect(() => {
    reload();
    const handler = () => reload();
    window.addEventListener(FOOD_BANK_CHANGED_EVENT, handler);
    return () => window.removeEventListener(FOOD_BANK_CHANGED_EVENT, handler);
  }, [reload]);

  useEffect(() => {
    setPage(1);
  }, [search, chip, sources, favoritesOnly, mineOnly, macroFilter, viewMode]);

  const favoriteSet = useMemo(() => new Set(favoriteIds), [favoriteIds]);

  const filteredItems = useMemo(() => {
    const filtered = filterFoodBankItems(items, {
      chip,
      search,
      favoriteIds: favoriteSet,
      recentIds,
      sources,
      favoritesOnly,
      mineOnly,
      macro: macroFilter,
      trainerName,
    });
    return sortFoodBankItems(filtered, chip, recentIds);
  }, [items, chip, search, favoriteSet, recentIds, sources, favoritesOnly, mineOnly, macroFilter, trainerName]);

  const pageCount = Math.max(1, Math.ceil(filteredItems.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const pageItems = filteredItems.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const selectedItem = items.find((item) => item.id === selectedId) ?? null;

  const toggleFavorite = (foodId: string) => {
    const next = favoriteSet.has(foodId)
      ? favoriteIds.filter((id) => id !== foodId)
      : [foodId, ...favoriteIds];
    setFavoriteIds(next);
    persistFavoriteFoodIds(next);
  };

  const openFood = (item: FoodItem) => {
    setSelectedId(item.id);
    setRecentIds(touchRecentFoodId(item.id));
  };

  const openCreateForm = () => {
    setForm(emptyForm());
    setFormStatus(null);
    setImageUploading(false);
    setFormOpen(true);
  };

  const openEditForm = (item: FoodItem) => {
    setForm(formFromFood(item));
    setFormStatus(null);
    setImageUploading(false);
    setFormOpen(true);
  };

  const handleFoodImageUpload = async (file: File) => {
    if (!file.type.startsWith("image/")) {
      setFormStatus("Velg en bildefil (JPG, PNG eller WEBP).");
      return;
    }
    if (file.size > MAX_FOOD_IMAGE_BYTES) {
      setFormStatus("Bildet er for stort (maks 5 MB).");
      return;
    }
    setImageUploading(true);
    setFormStatus(null);
    try {
      const dataUrl = await compressImageFile(file, 720, 0.85);
      setForm((current) => ({ ...current, imageUrl: dataUrl }));
    } catch {
      setFormStatus("Kunne ikke laste opp bildet. Prøv en annen fil.");
    } finally {
      setImageUploading(false);
    }
  };

  const saveForm = () => {
    if (!form.name.trim()) {
      setFormStatus("Navn må fylles ut.");
      return;
    }
    const existing = form.id ? items.find((row) => row.id === form.id) : undefined;
    const imageUrl = form.imageUrl.trim() || undefined;
    const nextItem: FoodItem = {
      id: form.id ?? uid("food"),
      name: form.name.trim(),
      portionLabel: form.portionLabel.trim() || "100 g",
      portionGrams: parseNumber(form.portionGrams) || 100,
      category: form.category,
      origin: form.origin.trim() || foodCategoryMeta(form.category).originHint,
      source: form.source,
      createdBy: existing?.createdBy ?? trainerName,
      createdAt: existing?.createdAt ?? new Date().toISOString(),
      imageUrl,
      imageEmoji: imageUrl ? undefined : form.imageEmoji.trim() || foodCategoryMeta(form.category).emoji,
      isCustom: form.source === "egen" || Boolean(existing?.isCustom),
      isEdited: existing ? existing.isEdited === true || existing.isCustom !== true : false,
      nutritionPer100g: {
        kcal: parseNumber(form.kcal),
        protein: parseNumber(form.protein),
        carbs: parseNumber(form.carbs),
        fat: parseNumber(form.fat),
        fiber: parseNumber(form.fiber),
        sugar: parseNumber(form.sugar),
        saturatedFat: parseNumber(form.saturatedFat),
        sodium: parseNumber(form.sodium),
      },
    };
    const nextItems = upsertFoodItem(items, nextItem);
    setItems(nextItems);
    persistFoodBankItems(nextItems);
    setSelectedId(nextItem.id);
    setFormOpen(false);
    setFormStatus(null);
  };


  const handleAddToMealPlan = (item: FoodItem) => {
    setMealPlanNotice(`${item.name} er klar — matplan-redigering kobles på i neste steg.`);
    window.setTimeout(() => setMealPlanNotice(null), 3500);
  };

  return (
    <div className="motus-foodbank">
      <header className="motus-foodbank-header">
        <div>
          <h1 className="motus-foodbank-title">Matvarebank</h1>
          <p className="motus-foodbank-subtitle">Din komplette database med matvarer og næringsinnhold.</p>
        </div>
        <div className="motus-foodbank-header-actions">
          <GradientButton onClick={openCreateForm} className="motus-foodbank-add-btn">
            <Plus className="h-4 w-4" aria-hidden />
            Legg til matvare
          </GradientButton>
          <OutlineButton onClick={() => setImportOpen(true)}>
            <Upload className="h-4 w-4" aria-hidden />
            Importer matvarer
          </OutlineButton>
        </div>
      </header>

      {mealPlanNotice ? <div className="motus-foodbank-notice">{mealPlanNotice}</div> : null}

      <div className="motus-foodbank-toolbar">
        <label className="motus-foodbank-search">
          <Search className="h-4 w-4 text-slate-400" aria-hidden />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Søk etter matvarer..."
            aria-label="Søk etter matvarer"
          />
        </label>
        <OutlineButton onClick={() => setFilterOpen(true)} aria-label="Åpne filtre">
          <SlidersHorizontal className="h-4 w-4" aria-hidden />
          Filtre
        </OutlineButton>
      </div>

      <div className="motus-foodbank-chips scrollbar-none" role="tablist" aria-label="Matvarekategorier">
        {FILTER_CHIPS.map((entry) => {
          const Icon = entry.icon;
          return (
            <button
              key={entry.id}
              type="button"
              role="tab"
              aria-selected={chip === entry.id}
              className={`motus-foodbank-chip ${chip === entry.id ? "is-active" : ""}`}
              onClick={() => setChip(entry.id)}
            >
              {Icon ? <Icon className="h-3.5 w-3.5" aria-hidden /> : null}
              {entry.label}
            </button>
          );
        })}
      </div>

      <div className="motus-foodbank-meta-row">
        <span>{filteredItems.length} matvarer</span>
        <div className="motus-foodbank-view-toggle" role="group" aria-label="Visning">
          <button type="button" className={viewMode === "grid" ? "is-active" : ""} onClick={() => setViewMode("grid")} aria-pressed={viewMode === "grid"}>
            <Grid3X3 className="h-4 w-4" aria-hidden />
            Rutenett
          </button>
          <button type="button" className={viewMode === "list" ? "is-active" : ""} onClick={() => setViewMode("list")} aria-pressed={viewMode === "list"}>
            <LayoutList className="h-4 w-4" aria-hidden />
            Liste
          </button>
        </div>
      </div>

      <div className={`motus-foodbank-layout ${selectedItem ? "motus-foodbank-layout--detail-open" : ""}`}>
        <section className="motus-foodbank-main" aria-label="Matvarer">
          {viewMode === "grid" ? (
            <div className="motus-foodbank-grid">
              {pageItems.map((item) => (
                <div
                  key={item.id}
                  role="button"
                  tabIndex={0}
                  className={`motus-foodbank-card ${selectedId === item.id ? "is-selected" : ""}`}
                  onClick={() => openFood(item)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      openFood(item);
                    }
                  }}
                >
                  <div className="motus-foodbank-card-media">
                    <FoodThumb item={item} />
                    <button
                      type="button"
                      className={`motus-foodbank-fav ${favoriteSet.has(item.id) ? "is-active" : ""}`}
                      aria-label={favoriteSet.has(item.id) ? "Fjern favoritt" : "Legg til favoritt"}
                      onClick={(event) => {
                        event.stopPropagation();
                        toggleFavorite(item.id);
                      }}
                    >
                      <Star className="h-4 w-4" aria-hidden />
                    </button>
                  </div>
                  <div className="motus-foodbank-card-body">
                    <h3>{item.name}</h3>
                    <p>{item.portionLabel}</p>
                    <MacroStrip item={item} compact />
                  </div>
                </div>
              ))}
              <button type="button" className="motus-foodbank-card motus-foodbank-card--add" onClick={openCreateForm}>
                <Plus className="h-8 w-8 text-teal-600" aria-hidden />
                <span>Klikk for å legge til ny matvare</span>
              </button>
            </div>
          ) : (
            <div className="motus-foodbank-list">
              {pageItems.map((item) => (
                <button key={item.id} type="button" className={`motus-foodbank-list-row ${selectedId === item.id ? "is-selected" : ""}`} onClick={() => openFood(item)}>
                  <FoodThumb item={item} />
                  <div className="min-w-0 flex-1 text-left">
                    <div className="font-semibold text-slate-900">{item.name}</div>
                    <div className="text-xs text-slate-500">{item.portionLabel} · {foodCategoryMeta(item.category).label}</div>
                  </div>
                  <MacroStrip item={item} compact />
                </button>
              ))}
            </div>
          )}

          {pageCount > 1 ? (
            <nav className="motus-foodbank-pagination" aria-label="Paginering">
              <button type="button" disabled={currentPage <= 1} onClick={() => setPage((value) => Math.max(1, value - 1))} aria-label="Forrige side">
                <ChevronLeft className="h-4 w-4" />
              </button>
              {Array.from({ length: Math.min(pageCount, 5) }, (_, index) => {
                const pageNumber = index + 1;
                return (
                  <button key={pageNumber} type="button" className={currentPage === pageNumber ? "is-active" : ""} onClick={() => setPage(pageNumber)}>
                    {pageNumber}
                  </button>
                );
              })}
              {pageCount > 5 ? <span>…</span> : null}
              <button type="button" disabled={currentPage >= pageCount} onClick={() => setPage((value) => Math.min(pageCount, value + 1))} aria-label="Neste side">
                <ChevronRight className="h-4 w-4" />
              </button>
            </nav>
          ) : null}
        </section>

        {selectedItem ? (
          <aside className="motus-foodbank-detail" aria-label="Matvaredetaljer">
            <div className="motus-foodbank-detail-head">
              <button type="button" className="motus-foodbank-icon-btn" onClick={() => setSelectedId(null)} aria-label="Lukk detaljer">
                <X className="h-4 w-4" />
              </button>
              <button
                type="button"
                className={`motus-foodbank-icon-btn ${favoriteSet.has(selectedItem.id) ? "is-active" : ""}`}
                onClick={() => toggleFavorite(selectedItem.id)}
                aria-label="Favoritt"
              >
                <Star className="h-4 w-4" />
              </button>
            </div>
            <div className="motus-foodbank-detail-hero">
              <FoodThumb item={selectedItem} />
            </div>
            <h2>{selectedItem.name}</h2>
            <p className="motus-foodbank-detail-portion">{selectedItem.portionLabel}</p>
            <MacroStrip item={selectedItem} />

            <section className="motus-foodbank-detail-section">
              <h3>Næringsinnhold</h3>
              <dl className="motus-foodbank-nutrition-table">
                <div><dt>Kalorier</dt><dd>{formatMacro(selectedItem.nutritionPer100g.kcal)} kcal</dd></div>
                <div><dt>Protein</dt><dd>{formatMacro(selectedItem.nutritionPer100g.protein, 1)} g</dd></div>
                <div><dt>Karbohydrater</dt><dd>{formatMacro(selectedItem.nutritionPer100g.carbs, 1)} g</dd></div>
                <div className="is-nested"><dt>Sukkerarter</dt><dd>{formatMacro(selectedItem.nutritionPer100g.sugar, 1)} g</dd></div>
                <div><dt>Fett</dt><dd>{formatMacro(selectedItem.nutritionPer100g.fat, 1)} g</dd></div>
                <div className="is-nested"><dt>Mettet fett</dt><dd>{formatMacro(selectedItem.nutritionPer100g.saturatedFat, 1)} g</dd></div>
                <div><dt>Kostfiber</dt><dd>{formatMacro(selectedItem.nutritionPer100g.fiber, 1)} g</dd></div>
                <div><dt>Natrium</dt><dd>{formatMacro(selectedItem.nutritionPer100g.sodium)} mg</dd></div>
              </dl>
              <p className="motus-foodbank-detail-note">Verdier per 100 g</p>
            </section>

            <section className="motus-foodbank-detail-section">
              <h3>Detaljer</h3>
              <dl className="motus-foodbank-meta-table">
                <div><dt>Matvaregruppe</dt><dd>{foodCategoryMeta(selectedItem.category).label}</dd></div>
                <div><dt>Opprinnelse</dt><dd>{selectedItem.origin}</dd></div>
                <div><dt>Kilde</dt><dd>{foodSourceLabel(selectedItem.source)}</dd></div>
                <div><dt>Opprettet av</dt><dd>{selectedItem.createdBy}</dd></div>
                <div><dt>Dato lagt til</dt><dd>{formatDateLabel(selectedItem.createdAt)}</dd></div>
              </dl>
            </section>

            <div className="motus-foodbank-detail-actions">
              <GradientButton className="w-full" onClick={() => handleAddToMealPlan(selectedItem)}>
                <Plus className="h-4 w-4" aria-hidden />
                Legg til i matplan
              </GradientButton>
              <OutlineButton className="w-full" onClick={() => openEditForm(selectedItem)}>
                Rediger matvare
              </OutlineButton>
              {foodItemMayDelete(selectedItem) ? (
                <OutlineButton
                  className="w-full"
                  onClick={() => {
                    const nextItems = deleteFoodItem(items, selectedItem.id);
                    setItems(nextItems);
                    persistFoodBankItems(nextItems);
                    setSelectedId(null);
                  }}
                >
                  Slett matvare
                </OutlineButton>
              ) : null}
            </div>
          </aside>
        ) : null}
      </div>

      {filterOpen ? (
        <div className="motus-foodbank-modal-backdrop" role="presentation" onClick={() => setFilterOpen(false)}>
          <div className="motus-foodbank-modal" role="dialog" aria-labelledby="food-filter-title" onClick={(event) => event.stopPropagation()}>
            <div className="motus-foodbank-modal-head">
              <h2 id="food-filter-title">Filtre</h2>
              <button type="button" className="motus-foodbank-icon-btn" onClick={() => setFilterOpen(false)} aria-label="Lukk">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="motus-foodbank-modal-body">
              <label className="motus-foodbank-check"><input type="checkbox" checked={favoritesOnly} onChange={(event) => setFavoritesOnly(event.target.checked)} /> Kun favoritter</label>
              <label className="motus-foodbank-check"><input type="checkbox" checked={mineOnly} onChange={(event) => setMineOnly(event.target.checked)} /> Kun mine matvarer</label>
              <div className="motus-foodbank-field">
                <span className="motus-foodbank-field-label">Kilde</span>
                <div className="motus-foodbank-source-row">
                  {(["matvaretabell", "usda", "egen"] as FoodSource[]).map((source) => (
                    <label key={source} className="motus-foodbank-check">
                      <input
                        type="checkbox"
                        checked={sources.includes(source)}
                        onChange={(event) =>
                          setSources((current) =>
                            event.target.checked ? [...current, source] : current.filter((row) => row !== source),
                          )
                        }
                      />
                      {foodSourceLabel(source)}
                    </label>
                  ))}
                </div>
              </div>
              <div className="motus-foodbank-field">
                <span className="motus-foodbank-field-label">Makrofiltre (per 100 g)</span>
                <div className="motus-foodbank-macro-grid">
                  {(["kcal", "protein", "carbs", "fat"] as const).map((key) => (
                    <div key={key} className="motus-foodbank-macro-filter">
                      <span>{key === "kcal" ? "Kalorier" : key === "protein" ? "Protein" : key === "carbs" ? "Karbohydrater" : "Fett"}</span>
                      <TextInput
                        value={macroFilter[`${key}Min`]}
                        onChange={(event) => setMacroFilter((current) => ({ ...current, [`${key}Min`]: event.target.value }))}
                        placeholder="Min"
                      />
                      <TextInput
                        value={macroFilter[`${key}Max`]}
                        onChange={(event) => setMacroFilter((current) => ({ ...current, [`${key}Max`]: event.target.value }))}
                        placeholder="Max"
                      />
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="motus-foodbank-modal-actions">
              <OutlineButton
                onClick={() => {
                  setSources([]);
                  setFavoritesOnly(false);
                  setMineOnly(false);
                  setMacroFilter(EMPTY_MACRO_FILTER);
                }}
              >
                Nullstill
              </OutlineButton>
              <GradientButton onClick={() => setFilterOpen(false)}>Bruk filtre</GradientButton>
            </div>
          </div>
        </div>
      ) : null}

      {importOpen ? (
        <FoodBankImportModal
          trainerName={trainerName}
          existingItems={items}
          onClose={() => setImportOpen(false)}
          onImported={(nextItems, summary) => {
            setItems(nextItems);
            persistFoodBankItems(nextItems);
            setMealPlanNotice(summary);
            window.setTimeout(() => setMealPlanNotice(null), 5000);
          }}
        />
      ) : null}

      {formOpen ? (
        <div className="motus-foodbank-modal-backdrop" role="presentation" onClick={() => setFormOpen(false)}>
          <div className="motus-foodbank-modal motus-foodbank-modal--wide" role="dialog" aria-labelledby="food-form-title" onClick={(event) => event.stopPropagation()}>
            <div className="motus-foodbank-modal-head">
              <h2 id="food-form-title">{form.id ? "Rediger matvare" : "Ny matvare"}</h2>
              <button type="button" className="motus-foodbank-icon-btn" onClick={() => setFormOpen(false)} aria-label="Lukk">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="motus-foodbank-modal-body motus-foodbank-form-grid">
              <div className="motus-foodbank-form-span-all">
                <FoodImageField
                  imageUrl={form.imageUrl}
                  imageEmoji={form.imageEmoji}
                  onImageUrlChange={(imageUrl) => setForm((current) => ({ ...current, imageUrl }))}
                  onImageEmojiChange={(imageEmoji) => setForm((current) => ({ ...current, imageEmoji }))}
                  onUploadFile={handleFoodImageUpload}
                  isUploading={imageUploading}
                />
              </div>
              <label className="motus-foodbank-field">
                <span className="motus-foodbank-field-label">Navn</span>
                <TextInput value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} />
              </label>
              <label className="motus-foodbank-field">
                <span className="motus-foodbank-field-label">Kategori</span>
                <SelectBox
                  value={form.category}
                  onChange={(value) => setForm((current) => ({ ...current, category: value as FoodCategoryId }))}
                  options={FOOD_BANK_CATEGORIES.map((category) => ({ value: category.id, label: category.label }))}
                />
              </label>
              <label className="motus-foodbank-field">
                <span className="motus-foodbank-field-label">Opprinnelse</span>
                <TextInput value={form.origin} onChange={(event) => setForm((current) => ({ ...current, origin: event.target.value }))} />
              </label>
              <label className="motus-foodbank-field">
                <span className="motus-foodbank-field-label">Kilde</span>
                <SelectBox
                  value={form.source}
                  onChange={(value) => setForm((current) => ({ ...current, source: value as FoodSource }))}
                  options={[
                    { value: "matvaretabell", label: "Norsk matvaretabell" },
                    { value: "usda", label: "USDA" },
                    { value: "egen", label: "Egen" },
                  ]}
                />
              </label>
              <label className="motus-foodbank-field">
                <span className="motus-foodbank-field-label">Standard porsjon</span>
                <TextInput value={form.portionLabel} onChange={(event) => setForm((current) => ({ ...current, portionLabel: event.target.value }))} />
              </label>
              <label className="motus-foodbank-field">
                <span className="motus-foodbank-field-label">Gram/ml</span>
                <TextInput value={form.portionGrams} onChange={(event) => setForm((current) => ({ ...current, portionGrams: event.target.value }))} />
              </label>
              <label className="motus-foodbank-field">
                <span className="motus-foodbank-field-label">Kalorier per 100 g</span>
                <TextInput value={form.kcal} onChange={(event) => setForm((current) => ({ ...current, kcal: event.target.value }))} />
              </label>
              <label className="motus-foodbank-field">
                <span className="motus-foodbank-field-label">Protein (g)</span>
                <TextInput value={form.protein} onChange={(event) => setForm((current) => ({ ...current, protein: event.target.value }))} />
              </label>
              <label className="motus-foodbank-field">
                <span className="motus-foodbank-field-label">Karbohydrater (g)</span>
                <TextInput value={form.carbs} onChange={(event) => setForm((current) => ({ ...current, carbs: event.target.value }))} />
              </label>
              <label className="motus-foodbank-field">
                <span className="motus-foodbank-field-label">Fett (g)</span>
                <TextInput value={form.fat} onChange={(event) => setForm((current) => ({ ...current, fat: event.target.value }))} />
              </label>
              <label className="motus-foodbank-field">
                <span className="motus-foodbank-field-label">Kostfiber (g)</span>
                <TextInput value={form.fiber} onChange={(event) => setForm((current) => ({ ...current, fiber: event.target.value }))} />
              </label>
              <label className="motus-foodbank-field">
                <span className="motus-foodbank-field-label">Sukker (g)</span>
                <TextInput value={form.sugar} onChange={(event) => setForm((current) => ({ ...current, sugar: event.target.value }))} />
              </label>
              <label className="motus-foodbank-field">
                <span className="motus-foodbank-field-label">Mettet fett (g)</span>
                <TextInput value={form.saturatedFat} onChange={(event) => setForm((current) => ({ ...current, saturatedFat: event.target.value }))} />
              </label>
              <label className="motus-foodbank-field">
                <span className="motus-foodbank-field-label">Natrium (mg)</span>
                <TextInput value={form.sodium} onChange={(event) => setForm((current) => ({ ...current, sodium: event.target.value }))} />
              </label>
            </div>
            {formStatus ? <p className="motus-foodbank-form-status">{formStatus}</p> : null}
            <div className="motus-foodbank-modal-actions">
              <OutlineButton onClick={() => setFormOpen(false)}>Avbryt</OutlineButton>
              <GradientButton onClick={saveForm}>{form.id ? "Lagre endringer" : "Legg til matvare"}</GradientButton>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
