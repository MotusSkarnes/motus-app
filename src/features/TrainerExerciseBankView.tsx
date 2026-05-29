import { useMemo, useRef, useState, type ReactNode } from "react";
import {
  ClipboardList,
  Copy,
  Dumbbell,
  Eye,
  FileText,
  Grid3X3,
  Heart,
  ImageIcon,
  LayoutList,
  Pencil,
  Plus,
  Search,
  Trash2,
  Upload,
} from "lucide-react";
import {
  EXERCISE_BANK_TAB_OPTIONS,
  EXERCISE_CATEGORY_OPTIONS,
  exerciseCategoryTagClass,
  emptyExerciseBankMessage,
  type ExerciseBankSubTab,
} from "../app/exerciseCategories";
import { isPopularExercise, isRecommendedExercise } from "../app/exerciseBankStats";
import { splitMuscleGroupLabel } from "./muscleSplitStats";
import { defaultPrescriptionFieldsForCategory } from "../app/exercisePrescriptionFields";
import { ExerciseBankBadges } from "./ExerciseBankListCard";
import { ExercisePrescriptionFieldsEditor } from "./ExercisePrescriptionFieldsEditor";
import { EmptyState, GradientButton, OutlineButton, SelectBox, TextArea, TextInput } from "../app/ui";
import type { Exercise, ExercisePrescriptionFieldKey } from "../app/types";

function splitMultiValue(value: string): string[] {
  return Array.from(
    new Set(
      value
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean),
    ),
  );
}

function joinMultiValues(values: string[]): string {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean))).join(", ");
}

function addMultiValue(current: string, nextValue: string): string {
  const normalizedNextValue = nextValue.trim();
  if (!normalizedNextValue) return current;
  return joinMultiValues([...splitMultiValue(current), normalizedNextValue]);
}

function removeMultiValue(current: string, valueToRemove: string): string {
  const normalizedValueToRemove = valueToRemove.trim().toLowerCase();
  return joinMultiValues(splitMultiValue(current).filter((value) => value.toLowerCase() !== normalizedValueToRemove));
}

function multiValueIncludes(value: string, candidate: string): boolean {
  const normalizedCandidate = candidate.trim().toLowerCase();
  return splitMultiValue(value).some((item) => item.toLowerCase() === normalizedCandidate);
}

type MuscleFilter = "all" | "bein" | "overkropp" | "kjerne";

const MUSCLE_FILTER_CHIPS: Array<{ id: MuscleFilter; label: string }> = [
  { id: "bein", label: "Bein" },
  { id: "overkropp", label: "Overkropp" },
  { id: "kjerne", label: "Kjerne" },
];

function exerciseMatchesMuscleFilter(exercise: Exercise, filter: MuscleFilter): boolean {
  if (filter === "all") return true;
  const groups = splitMuscleGroupLabel(exercise.group).join(" ").toLowerCase();
  if (filter === "bein") {
    return /lår|legg|sete|hofte|ankel|bein/.test(groups);
  }
  if (filter === "overkropp") {
    return /bryst|rygg|skuldre|biceps|triceps|underarm|nakke|overkropp|arm/.test(groups);
  }
  return /kjerne|mage|korsrygg|core/.test(groups);
}

function FormSection({
  icon,
  title,
  children,
}: {
  icon: ReactNode;
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="motus-exbank-form-section">
      <div className="motus-exbank-form-section-head">
        <span className="motus-exbank-form-section-icon">{icon}</span>
        <h3 className="motus-exbank-form-section-title">{title}</h3>
      </div>
      <div className="motus-exbank-form-section-body">{children}</div>
    </section>
  );
}

export type TrainerExerciseBankViewProps = {
  exerciseBankSubTab: ExerciseBankSubTab;
  onExerciseBankSubTabChange: (tab: ExerciseBankSubTab) => void;
  exercises: Exercise[];
  visibleExercises: Exercise[];
  favoriteExerciseIds: string[];
  exerciseSearch: string;
  onExerciseSearchChange: (value: string) => void;
  editingExerciseId: string | null;
  exerciseFormName: string;
  onExerciseFormNameChange: (value: string) => void;
  exerciseFormCategory: Exercise["category"];
  onExerciseFormCategoryChange: (value: Exercise["category"]) => void;
  exerciseFormLevel: Exercise["level"];
  onExerciseFormLevelChange: (value: Exercise["level"]) => void;
  exerciseFormGroup: string;
  onExerciseFormGroupChange: (value: string) => void;
  exerciseFormEquipment: string;
  onExerciseFormEquipmentChange: (value: string) => void;
  exerciseFormImageUrl: string;
  onExerciseFormImageUrlChange: (value: string) => void;
  exerciseFormDescription: string;
  onExerciseFormDescriptionChange: (value: string) => void;
  exerciseFormPrescriptionFields: ExercisePrescriptionFieldKey[];
  onExerciseFormPrescriptionFieldsChange: (value: ExercisePrescriptionFieldKey[]) => void;
  exerciseFormGroupOptions: string[];
  exerciseFormEquipmentOptions: string[];
  exerciseFormStatus: string | null;
  isUploadingExerciseImage: boolean;
  onImageUpload: (file: File | null) => void;
  onSubmit: () => void;
  onReset: () => void;
  onStartEdit: (exercise: Exercise) => void;
  onDuplicate: (exercise: Exercise) => void;
  onDelete: (exercise: Exercise) => void;
  onToggleFavorite: (exerciseId: string) => void;
  getExercisePreviewSrc: (exercise: Exercise) => string;
  getExerciseSketchDataUri: (exercise: Exercise) => string;
  exercisePopularityScores: Map<string, number>;
};

export function TrainerExerciseBankView({
  exerciseBankSubTab,
  onExerciseBankSubTabChange,
  exercises,
  visibleExercises,
  favoriteExerciseIds,
  exerciseSearch,
  onExerciseSearchChange,
  editingExerciseId,
  exerciseFormName,
  onExerciseFormNameChange,
  exerciseFormCategory,
  onExerciseFormCategoryChange,
  exerciseFormLevel,
  onExerciseFormLevelChange,
  exerciseFormGroup,
  onExerciseFormGroupChange,
  exerciseFormEquipment,
  onExerciseFormEquipmentChange,
  exerciseFormImageUrl,
  onExerciseFormImageUrlChange,
  exerciseFormDescription,
  onExerciseFormDescriptionChange,
  exerciseFormPrescriptionFields,
  onExerciseFormPrescriptionFieldsChange,
  exerciseFormGroupOptions,
  exerciseFormEquipmentOptions,
  exerciseFormStatus,
  isUploadingExerciseImage,
  onImageUpload,
  onSubmit,
  onReset,
  onStartEdit,
  onDuplicate,
  onDelete,
  onToggleFavorite,
  getExercisePreviewSrc,
  getExerciseSketchDataUri,
  exercisePopularityScores,
}: TrainerExerciseBankViewProps) {
  const formRef = useRef<HTMLDivElement>(null);
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [muscleFilter, setMuscleFilter] = useState<MuscleFilter>("all");
  const [sortOrder, setSortOrder] = useState<"default" | "name">("default");
  const [gridView, setGridView] = useState(true);

  const stats = useMemo(() => {
    const categorySet = new Set(exercises.map((e) => e.category));
    const favoriteCount = favoriteExerciseIds.filter((id) => exercises.some((e) => e.id === id)).length;
    return {
      total: exercises.length,
      favorites: favoriteCount,
      categories: categorySet.size,
    };
  }, [exercises, favoriteExerciseIds]);

  const displayedExercises = useMemo(() => {
    let list = visibleExercises;
    if (favoritesOnly) {
      list = list.filter((exercise) => favoriteExerciseIds.includes(exercise.id));
    }
    if (muscleFilter !== "all") {
      list = list.filter((exercise) => exerciseMatchesMuscleFilter(exercise, muscleFilter));
    }
    if (sortOrder === "name") {
      list = [...list].sort((a, b) => a.name.localeCompare(b.name, "no"));
    }
    return list;
  }, [visibleExercises, favoritesOnly, muscleFilter, sortOrder, favoriteExerciseIds]);

  function scrollToForm() {
    formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function handleNewExercise() {
    onReset();
    scrollToForm();
  }

  function handleStartEdit(exercise: Exercise) {
    onStartEdit(exercise);
    scrollToForm();
  }

  function renderMultiSelectField({
    label,
    value,
    options,
    onChange,
    placeholder,
    emptyText,
    required = false,
  }: {
    label: string;
    value: string;
    options: string[];
    onChange: (value: string) => void;
    placeholder: string;
    emptyText: string;
    required?: boolean;
  }) {
    const selectedValues = splitMultiValue(value);
    const availableOptions = options.filter((option) => !multiValueIncludes(value, option));
    return (
      <label className="motus-exbank-field">
        <span className="motus-exbank-field-label">
          {label}
          {required ? " *" : ""}
        </span>
        <SelectBox
          value=""
          onChange={(nextValue) => {
            if (!nextValue) return;
            onChange(addMultiValue(value, nextValue));
          }}
          options={[
            { value: "", label: placeholder },
            ...availableOptions.map((option) => ({ value: option, label: option })),
          ]}
        />
        <div className="motus-exbank-chip-row">
          {selectedValues.map((selectedValue) => (
            <button
              key={selectedValue}
              type="button"
              onClick={() => onChange(removeMultiValue(value, selectedValue))}
              className="motus-exbank-chip motus-exbank-chip--removable"
              title={`Fjern ${selectedValue}`}
            >
              {selectedValue} ×
            </button>
          ))}
          {selectedValues.length === 0 ? <span className="text-xs text-slate-400">{emptyText}</span> : null}
        </div>
      </label>
    );
  }

  const previewSketch = getExerciseSketchDataUri({
    id: "preview",
    name: exerciseFormName || "preview",
    category: exerciseFormCategory,
    group: exerciseFormGroup || "",
    equipment: exerciseFormEquipment || "",
    level: exerciseFormLevel,
    description: exerciseFormDescription || "",
  });

  return (
    <div className="motus-exbank">
      <header className="motus-exbank-header">
        <div className="min-w-0">
          <h1 className="motus-exbank-title">Øvelsesbank</h1>
          <p className="motus-exbank-subtitle">
            Opprett, organiser og administrer øvelser for alle trenere og kunder.
          </p>
        </div>
        <div className="motus-exbank-stats motus-exbank-stats--header">
          <div className="motus-exbank-stat motus-exbank-stat--mint">
            <Dumbbell className="h-5 w-5" aria-hidden />
            <div>
              <div className="motus-exbank-stat-value">{stats.total}</div>
              <div className="motus-exbank-stat-label">Totalt øvelser</div>
            </div>
          </div>
          <div className="motus-exbank-stat motus-exbank-stat--pink">
            <Heart className="h-5 w-5" aria-hidden />
            <div>
              <div className="motus-exbank-stat-value">{stats.favorites}</div>
              <div className="motus-exbank-stat-label">Favoritter</div>
            </div>
          </div>
          <div className="motus-exbank-stat motus-exbank-stat--blue">
            <Grid3X3 className="h-5 w-5" aria-hidden />
            <div>
              <div className="motus-exbank-stat-value">{stats.categories}</div>
              <div className="motus-exbank-stat-label">Kategorier</div>
            </div>
          </div>
        </div>
        <GradientButton type="button" onClick={handleNewExercise} className="motus-exbank-new-btn shrink-0">
          <Plus className="h-4 w-4" aria-hidden />
          Ny øvelse
        </GradientButton>
      </header>

      <div className="motus-exbank-stats motus-exbank-stats--panel">
        <div className="motus-exbank-stat motus-exbank-stat--mint">
          <Dumbbell className="h-5 w-5" aria-hidden />
          <div>
            <div className="motus-exbank-stat-value">{stats.total}</div>
            <div className="motus-exbank-stat-label">Totalt øvelser</div>
          </div>
        </div>
        <div className="motus-exbank-stat motus-exbank-stat--pink">
          <Heart className="h-5 w-5" aria-hidden />
          <div>
            <div className="motus-exbank-stat-value">{stats.favorites}</div>
            <div className="motus-exbank-stat-label">Favoritter</div>
          </div>
        </div>
        <div className="motus-exbank-stat motus-exbank-stat--blue">
          <Grid3X3 className="h-5 w-5" aria-hidden />
          <div>
            <div className="motus-exbank-stat-value">{stats.categories}</div>
            <div className="motus-exbank-stat-label">Kategorier</div>
          </div>
        </div>
      </div>

      <div className="motus-exbank-layout">
        <aside ref={formRef} className="motus-exbank-form-col">
          <div className="motus-exbank-form-card motus-exbank-form-card--fit">
            <h2 className="motus-exbank-form-heading">{editingExerciseId ? "Rediger øvelse" : "Ny øvelse"}</h2>

            <FormSection icon={<Dumbbell className="h-4 w-4" />} title="Øvelse">
              <label className="motus-exbank-field">
                <span className="motus-exbank-field-label">Navn *</span>
                <TextInput value={exerciseFormName} onChange={(e) => onExerciseFormNameChange(e.target.value)} placeholder="F.eks. Knebøy" />
              </label>
              <div className="motus-exbank-field-grid">
                <label className="motus-exbank-field">
                  <span className="motus-exbank-field-label">Type</span>
                  <SelectBox
                    value={exerciseFormCategory}
                    onChange={(value) => {
                      const nextCategory = value as Exercise["category"];
                      onExerciseFormCategoryChange(nextCategory);
                      if (!editingExerciseId) {
                        onExerciseFormPrescriptionFieldsChange(defaultPrescriptionFieldsForCategory(nextCategory));
                      }
                    }}
                    options={EXERCISE_CATEGORY_OPTIONS}
                  />
                </label>
                <label className="motus-exbank-field">
                  <span className="motus-exbank-field-label">Nivå</span>
                  <SelectBox
                    value={exerciseFormLevel}
                    onChange={(value) => onExerciseFormLevelChange(value as Exercise["level"])}
                    options={["Nybegynner", "Litt øvet", "Øvet"]}
                  />
                </label>
              </div>
            </FormSection>

            <FormSection icon={<Dumbbell className="h-4 w-4" />} title="Muskelgruppe & utstyr">
              {renderMultiSelectField({
                label: "Primær muskelgruppe",
                value: exerciseFormGroup,
                options: exerciseFormGroupOptions,
                onChange: onExerciseFormGroupChange,
                placeholder: "Velg muskelgruppe",
                emptyText: "Ingen valgt",
                required: true,
              })}
              {renderMultiSelectField({
                label: "Utstyr",
                value: exerciseFormEquipment,
                options: exerciseFormEquipmentOptions,
                onChange: onExerciseFormEquipmentChange,
                placeholder: "Velg utstyr",
                emptyText: "Valgfritt",
              })}
            </FormSection>

            <FormSection icon={<ClipboardList className="h-4 w-4" />} title="Programvariabler">
              <ExercisePrescriptionFieldsEditor
                value={exerciseFormPrescriptionFields}
                onChange={onExerciseFormPrescriptionFieldsChange}
              />
            </FormSection>

            <FormSection icon={<ImageIcon className="h-4 w-4" />} title="Media">
              <label className="motus-exbank-upload-zone">
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={(event) => {
                    const file = event.currentTarget.files?.[0] ?? null;
                    onImageUpload(file);
                    event.currentTarget.value = "";
                  }}
                  disabled={isUploadingExerciseImage}
                />
                {exerciseFormImageUrl.trim() ? (
                  <img
                    src={exerciseFormImageUrl}
                    alt=""
                    className="motus-exbank-upload-preview"
                    onError={(event) => {
                      event.currentTarget.src = previewSketch;
                    }}
                  />
                ) : (
                  <div className="motus-exbank-upload-placeholder">
                    <Upload className="h-6 w-6 text-slate-400" aria-hidden />
                    <span>{isUploadingExerciseImage ? "Laster opp..." : "Dra bilde hit eller klikk for å laste opp"}</span>
                    <span className="text-xs text-slate-400">JPG, PNG eller WEBP · maks 5 MB</span>
                  </div>
                )}
              </label>
              <TextInput
                value={exerciseFormImageUrl}
                onChange={(e) => onExerciseFormImageUrlChange(e.target.value)}
                placeholder="Eller lim inn bilde-URL"
                className="mt-2"
              />
            </FormSection>

            <FormSection icon={<FileText className="h-4 w-4" />} title="Instruksjoner">
              <label className="motus-exbank-field">
                <span className="motus-exbank-field-label">Forklaring, tips og vanlige feil</span>
                <TextArea
                  value={exerciseFormDescription}
                  onChange={(e) => onExerciseFormDescriptionChange(e.target.value)}
                  className="motus-exbank-description-input min-h-[120px]"
                  placeholder="Beskriv teknikk, tips og vanlige feil..."
                />
              </label>
            </FormSection>

            {exerciseFormStatus ? (
              <div className="motus-exbank-form-status">{exerciseFormStatus}</div>
            ) : null}

            <div className="motus-exbank-form-actions">
              {editingExerciseId ? (
                <OutlineButton type="button" onClick={onReset} className="w-full">
                  Avbryt
                </OutlineButton>
              ) : null}
              <GradientButton type="button" onClick={onSubmit} className="w-full">
                {editingExerciseId ? "Lagre øvelse" : "Lagre øvelse"}
              </GradientButton>
            </div>
          </div>
        </aside>

        <div className="motus-exbank-library-col">
          <div className="motus-exbank-search-wrap">
            <Search className="motus-exbank-search-icon h-4 w-4" aria-hidden />
            <input
              type="search"
              value={exerciseSearch}
              onChange={(e) => onExerciseSearchChange(e.target.value)}
              placeholder="Søk på navn, muskelgruppe eller utstyr..."
              className="motus-exbank-search"
            />
          </div>

          <div className="motus-exbank-chips">
            {EXERCISE_BANK_TAB_OPTIONS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                className={`motus-exbank-chip-filter ${exerciseBankSubTab === tab.id ? "motus-exbank-chip-filter--active" : ""}`}
                onClick={() => onExerciseBankSubTabChange(tab.id)}
              >
                {tab.label}
              </button>
            ))}
            {MUSCLE_FILTER_CHIPS.map((chip) => (
              <button
                key={chip.id}
                type="button"
                className={`motus-exbank-chip-filter ${muscleFilter === chip.id ? "motus-exbank-chip-filter--active" : ""}`}
                onClick={() => setMuscleFilter((prev) => (prev === chip.id ? "all" : chip.id))}
              >
                {chip.label}
              </button>
            ))}
            <button
              type="button"
              className={`motus-exbank-chip-filter motus-exbank-chip-filter--fav ${favoritesOnly ? "motus-exbank-chip-filter--fav-active" : ""}`}
              onClick={() => setFavoritesOnly((prev) => !prev)}
            >
              <Heart className={`h-3.5 w-3.5 ${favoritesOnly ? "fill-current" : ""}`} aria-hidden />
              Favoritter
            </button>
          </div>

          <div className="motus-exbank-library-toolbar">
            <span className="text-sm text-slate-600">
              <strong className="text-slate-900">{displayedExercises.length}</strong> øvelser funnet
            </span>
            <div className="flex items-center gap-2">
              <SelectBox
                value={sortOrder}
                onChange={(value) => setSortOrder(value as "default" | "name")}
                options={[
                  { value: "default", label: "Anbefalt rekkefølge" },
                  { value: "name", label: "Navn A–Å" },
                ]}
              />
              <div className="motus-exbank-view-toggle">
                <button
                  type="button"
                  className={gridView ? "motus-exbank-view-btn--active" : ""}
                  onClick={() => setGridView(true)}
                  aria-label="Rutenett"
                >
                  <Grid3X3 className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  className={!gridView ? "motus-exbank-view-btn--active" : ""}
                  onClick={() => setGridView(false)}
                  aria-label="Liste"
                >
                  <LayoutList className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>

          {displayedExercises.length === 0 ? (
            <EmptyState
              icon="🏋️"
              title={emptyExerciseBankMessage(exerciseBankSubTab)}
              description="Juster filtre eller opprett en ny øvelse."
              className="motus-exbank-empty"
              action={
                <GradientButton type="button" onClick={handleNewExercise}>
                  Legg til øvelse
                </GradientButton>
              }
            />
          ) : (
            <div className={gridView ? "motus-exbank-grid" : "motus-exbank-list"}>
              {displayedExercises.map((exercise) => {
                const isFavorite = favoriteExerciseIds.includes(exercise.id);
                const popularity = exercisePopularityScores.get(exercise.id) ?? 0;
                const categoryTagClass = exerciseCategoryTagClass(exercise.category);
                const muscleParts = splitMuscleGroupLabel(exercise.group).slice(0, gridView ? 1 : 2);
                const descriptionPreview = exercise.description.trim().slice(0, 120);

                return (
                  <article
                    key={exercise.id}
                    className={`motus-exbank-card ${editingExerciseId === exercise.id ? "motus-exbank-card--editing" : ""}`}
                  >
                    <div className="motus-exbank-card-media">
                      <img
                        src={getExercisePreviewSrc(exercise)}
                        alt=""
                        className="motus-exbank-card-img"
                        loading="lazy"
                        decoding="async"
                        onError={(event) => {
                          event.currentTarget.src = getExerciseSketchDataUri(exercise);
                        }}
                      />
                      <button
                        type="button"
                        className={`motus-exbank-card-fav ${isFavorite ? "motus-exbank-card-fav--active" : ""}`}
                        onClick={() => onToggleFavorite(exercise.id)}
                        aria-pressed={isFavorite}
                        aria-label={isFavorite ? "Fjern favoritt" : "Legg til favoritt"}
                      >
                        <Heart className={`h-4 w-4 ${isFavorite ? "fill-current" : ""}`} aria-hidden />
                      </button>
                    </div>
                    <div className="motus-exbank-card-body">
                      <div className="flex flex-wrap items-start gap-1.5">
                        <h3 className="motus-exbank-card-title">{exercise.name}</h3>
                        {isRecommendedExercise(popularity, isFavorite) || isPopularExercise(popularity) ? (
                          <ExerciseBankBadges popularity={popularity} isFavorite={isFavorite} variant="trainer" />
                        ) : null}
                      </div>
                      {descriptionPreview ? (
                        <p className="motus-exbank-card-desc">{descriptionPreview}{exercise.description.length > 120 ? "…" : ""}</p>
                      ) : (
                        <p className="motus-exbank-card-desc motus-exbank-card-desc--muted">Ingen beskrivelse ennå.</p>
                      )}
                      <div className="motus-exbank-card-tags">
                        <span className={`motus-exbank-tag motus-exbank-tag--category ${categoryTagClass}`}>
                          {exercise.category}
                        </span>
                        {muscleParts.map((part) => (
                          <span key={part} className="motus-exbank-tag motus-exbank-tag--muscle">
                            {part}
                          </span>
                        ))}
                        {exercise.equipment ? (
                          <span className="motus-exbank-tag motus-exbank-tag--equipment">{splitMultiValue(exercise.equipment)[0]}</span>
                        ) : null}
                      </div>
                      <div className="motus-exbank-card-actions">
                        <button type="button" className="motus-exbank-card-action" onClick={() => handleStartEdit(exercise)} aria-label="Rediger">
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button type="button" className="motus-exbank-card-action" onClick={() => onDuplicate(exercise)} aria-label="Dupliser">
                          <Copy className="h-4 w-4" />
                        </button>
                        <button type="button" className="motus-exbank-card-action motus-exbank-card-action--danger" onClick={() => onDelete(exercise)} aria-label="Skjul">
                          <Trash2 className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          className="motus-exbank-card-action"
                          onClick={() => handleStartEdit(exercise)}
                          aria-label="Vis detaljer"
                        >
                          <Eye className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
