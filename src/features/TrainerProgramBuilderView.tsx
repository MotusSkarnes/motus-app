import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  ChevronDown,
  Clock,
  Dumbbell,
  Flame,
  GripVertical,
  Heart,
  LayoutGrid,
  LayoutList,
  MoreHorizontal,
  Pencil,
  Plus,
  Search,
  SlidersHorizontal,
  Trash2,
  Zap,
} from "lucide-react";
import {
  categoryForSubTab,
  emptyTemplatesMessage,
  exerciseCategoryAccentColor,
  EXERCISE_CATEGORY_OPTIONS,
  isHoldBasedExerciseCategory,
  programDraftUsesHoldFields,
  programExerciseHoldSeconds,
  defaultTemplateProgramTitle,
  isActivityTemplateSubTab,
  periodPlanTemplateBuilderDescription,
  periodPlanTemplateBuilderTitle,
  programsBuilderDescription,
  programsBuilderTitle,
  savedTemplatesTitle,
  TRAINING_SUB_TAB_OPTIONS,
  type TrainingSubTab,
} from "../app/exerciseCategories";
import {
  buildActivityTemplateNotes,
  isActivityTemplate,
  isPeriodPlanActivityTemplate,
  NO_PLAN_DAY_TEMPLATE_TITLE,
  periodPlanEntryForActivityTemplate,
} from "../app/activityTemplate";
import { programCustomCoverImageStyle } from "../app/imageFocalPoint";
import {
  CONDITIONING_TRAINING_COVER_IMAGE,
  MOBILITY_TRAINING_COVER_IMAGE,
  NO_PLAN_DAY_COVER_IMAGE,
  resolveProgramCoverDisplayUrl,
} from "../app/programImage";
import {
  computeProgramDraftStats,
  draftExercisePrescriptionLabel,
  programCategoryLabel,
} from "../app/programBuilderStats";
import { muscleGroupChipClass } from "../app/customWorkoutBuilder";
import { isPopularExercise, isRecommendedExercise } from "../app/exerciseBankStats";
import { splitMuscleGroupLabel } from "./muscleSplitStats";
import { ExerciseBankBadges } from "./ExerciseBankListCard";
import { ProgramCoverImageField } from "./ProgramCoverImageField";
import { ProgramExerciseBlockActions } from "./ProgramExerciseBlockActions";
import { TrainingProgramPreviewModal } from "./TrainingProgramPreviewModal";
import { resolveExercisePrescriptionFields } from "../app/exercisePrescriptionFields";
import { EmptyState, GradientButton, OutlineButton, PillButton, SelectBox, TextArea, TextInput } from "../app/ui";
import { useToast } from "../app/toast";
import type { Exercise, ProgramExercise, TrainingProgram } from "../app/types";
import type { CardioIntensityLevel } from "../app/cardioIntervalIntensity";
import { isCardioCooldownStepName, type CardioEquipmentId } from "../app/cardioEquipment";
import { CardioExerciseExtraFields } from "./CardioExerciseExtraFields";
import { ProgramExercisePrescriptionFields } from "./ProgramExercisePrescriptionFields";

type MuscleFilter = "all" | "bein" | "overkropp" | "kjerne";

const MUSCLE_FILTER_CHIPS: Array<{ id: MuscleFilter; label: string }> = [
  { id: "bein", label: "Bein" },
  { id: "overkropp", label: "Overkropp" },
  { id: "kjerne", label: "Kjerne" },
];

function exerciseMatchesMuscleFilter(exercise: Exercise, filter: MuscleFilter): boolean {
  if (filter === "all") return true;
  const groups = splitMuscleGroupLabel(exercise.group).join(" ").toLowerCase();
  if (filter === "bein") return /lår|legg|sete|hofte|ankel|bein/.test(groups);
  if (filter === "overkropp") return /bryst|rygg|skuldre|biceps|triceps|underarm|nakke|overkropp|arm/.test(groups);
  return /kjerne|mage|korsrygg|core/.test(groups);
}

function isCardioProgramRow(
  item: ProgramExercise,
  linkedExercise: Exercise | undefined,
  programsSubTab: TrainingSubTab,
): boolean {
  if (programsSubTab === "conditioning") return true;
  if (linkedExercise?.category === "Kondisjon") return true;
  const name = item.exerciseName.trim();
  if (/^oppvarming$/i.test(name) || isCardioCooldownStepName(name) || /^drag\b/i.test(name)) return true;
  return Boolean(String(item.durationMinutes ?? "").trim());
}

function cardioSetLabel(): string {
  return "Antall drag";
}

function cardioSetPlaceholder(): string {
  return "drag";
}

function defaultHoldBadgeSeconds(exercise: Exercise): string {
  if (isHoldBasedExerciseCategory(exercise.category)) return "45 sek";
  if (exercise.category === "Kondisjon") return "20 min";
  return "";
}

export type TrainerProgramBuilderViewProps = {
  programsSubTab: TrainingSubTab;
  onProgramsSubTabChange: (tab: TrainingSubTab) => void;
  templateProgramTitle: string;
  onTemplateProgramTitleChange: (value: string) => void;
  programFormImageUrl: string;
  onProgramFormImageUrlChange: (value: string) => void;
  onProgramImageUpload: (file: File) => void;
  isUploadingProgramImage: boolean;
  programExercisesDraft: ProgramExercise[];
  editingTemplateProgramId: string | null;
  exercises: Exercise[];
  exercisesById: Map<string, Exercise>;
  visibleProgramExercises: Exercise[];
  favoriteExerciseIds: string[];
  programExerciseSearch: string;
  onProgramExerciseSearchChange: (value: string) => void;
  exercisePopularityScores: Map<string, number>;
  isDraftDropZoneActive: boolean;
  onDraftDropZoneActiveChange: (active: boolean) => void;
  draggedExerciseIdFromLibrary: string | null;
  onDraggedExerciseIdFromLibraryChange: (id: string | null) => void;
  draggedDraftExerciseId: string | null;
  onDraggedDraftExerciseIdChange: (id: string | null) => void;
  dragOverDraftExerciseId: string | null;
  onDragOverDraftExerciseIdChange: (id: string | null) => void;
  onAddExercise: (exercise: Exercise) => void;
  onMoveDraftExercise: (sourceId: string, targetId: string) => void;
  onUpdateDraftExercise: (id: string, field: keyof ProgramExercise, value: string) => void;
  onRemoveDraftExercise: (id: string) => void;
  onProgramExercisesDraftChange: (next: ProgramExercise[]) => void;
  onSaveTemplate: () => void;
  onResetTemplate: () => void;
  getExercisePreviewSrc: (exercise: Exercise) => string;
  getExerciseSketchDataUri: (exercise: Exercise) => string;
  onToggleFavorite: (exerciseId: string) => void;
  activeTemplatePrograms: TrainingProgram[];
  expandedTemplateProgramId: string | null;
  onExpandedTemplateProgramIdChange: (id: string | null) => void;
  onStartEditTemplate: (program: TrainingProgram) => void;
  onDeleteTemplate: (program: TrainingProgram) => void;
  templateDescription?: string;
  onTemplateDescriptionChange?: (value: string) => void;
  noPlanDayCoverImageUrl?: string;
  onNoPlanDayCoverImageUrlChange?: (value: string) => void;
  onNoPlanDayCoverImageUpload?: (file: File) => void;
  onSaveNoPlanDayCover?: () => void;
  hasNoPlanDayCoverTemplate?: boolean;
  noPlanDayCoverSaveStatus?: string | null;
  editingNoPlanDayCover?: boolean;
  periodPlanTemplateSaveStatus?: string | null;
  programsSubTabConditioningExtras?: ReactNode;
  cardioIntervalIntensity?: CardioIntensityLevel;
  cardioEquipmentId?: CardioEquipmentId;
  assignTemplateSection: ReactNode;
};

export function TrainerProgramBuilderView({
  programsSubTab,
  onProgramsSubTabChange,
  templateProgramTitle,
  onTemplateProgramTitleChange,
  programFormImageUrl,
  onProgramFormImageUrlChange,
  onProgramImageUpload,
  isUploadingProgramImage,
  programExercisesDraft,
  editingTemplateProgramId,
  exercises,
  exercisesById,
  visibleProgramExercises,
  favoriteExerciseIds,
  programExerciseSearch,
  onProgramExerciseSearchChange,
  exercisePopularityScores,
  isDraftDropZoneActive,
  onDraftDropZoneActiveChange,
  draggedExerciseIdFromLibrary,
  onDraggedExerciseIdFromLibraryChange,
  draggedDraftExerciseId,
  onDraggedDraftExerciseIdChange,
  dragOverDraftExerciseId,
  onDragOverDraftExerciseIdChange,
  onAddExercise,
  onMoveDraftExercise,
  onUpdateDraftExercise,
  onRemoveDraftExercise,
  onProgramExercisesDraftChange,
  onSaveTemplate,
  onResetTemplate,
  getExercisePreviewSrc,
  getExerciseSketchDataUri,
  onToggleFavorite,
  activeTemplatePrograms,
  expandedTemplateProgramId,
  onExpandedTemplateProgramIdChange,
  onStartEditTemplate,
  onDeleteTemplate,
  templateDescription = "",
  onTemplateDescriptionChange,
  noPlanDayCoverImageUrl = "",
  onNoPlanDayCoverImageUrlChange,
  onNoPlanDayCoverImageUpload,
  onSaveNoPlanDayCover,
  hasNoPlanDayCoverTemplate = false,
  noPlanDayCoverSaveStatus = null,
  editingNoPlanDayCover = false,
  periodPlanTemplateSaveStatus = null,
  programsSubTabConditioningExtras,
  cardioIntervalIntensity,
  cardioEquipmentId = "rowing",
  assignTemplateSection,
}: TrainerProgramBuilderViewProps) {
  const { pushToast } = useToast();
  const isActivityTab = isActivityTemplateSubTab(programsSubTab);
  const noPlanCoverPreviewSrc = noPlanDayCoverImageUrl.trim()
    ? resolveProgramCoverDisplayUrl(noPlanDayCoverImageUrl.trim())
    : NO_PLAN_DAY_COVER_IMAGE;
  const noPlanCoverPreviewStyle = noPlanDayCoverImageUrl.trim()
    ? programCustomCoverImageStyle(noPlanDayCoverImageUrl)
    : undefined;
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [muscleFilter, setMuscleFilter] = useState<MuscleFilter>("all");
  const [categoryFilter, setCategoryFilter] = useState<"tab" | "all">("tab");
  const [sortOrder, setSortOrder] = useState<"default" | "name">("default");
  const [gridView, setGridView] = useState(true);
  const [expandedDraftId, setExpandedDraftId] = useState<string | null>(null);
  const [templatesOpen, setTemplatesOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [moreMenuOpen, setMoreMenuOpen] = useState(false);
  const editingPeriodPlanTemplate = Boolean(editingTemplateProgramId);
  const showPeriodPlanTemplateEditor =
    (programsSubTab === "group" || programsSubTab === "activity") && !editingNoPlanDayCover;
  const showNoPlanDayCoverEditor =
    programsSubTab === "activity" && !editingPeriodPlanTemplate;

  useEffect(() => {
    if (editingTemplateProgramId || editingNoPlanDayCover) {
      setTemplatesOpen(true);
    }
  }, [editingTemplateProgramId, editingNoPlanDayCover]);

  const stats = useMemo(
    () =>
      computeProgramDraftStats(programExercisesDraft, exercisesById, programsSubTab, {
        cardioIntensity: programsSubTab === "conditioning" ? cardioIntervalIntensity : undefined,
      }),
    [programExercisesDraft, exercisesById, programsSubTab, cardioIntervalIntensity],
  );

  const periodPlanTemplateCoverPreviewSrc = useMemo(() => {
    const trimmed = programFormImageUrl.trim();
    if (trimmed) return resolveProgramCoverDisplayUrl(trimmed);
    if (programsSubTab === "group") return CONDITIONING_TRAINING_COVER_IMAGE;
    if (programsSubTab === "activity") return MOBILITY_TRAINING_COVER_IMAGE;
    return null;
  }, [programFormImageUrl, programsSubTab]);

  const periodPlanTemplateCoverPreviewStyle = programFormImageUrl.trim()
    ? programCustomCoverImageStyle(programFormImageUrl)
    : undefined;

  const periodPlanTemplateEntryPreview = useMemo(() => {
    const title = templateProgramTitle.trim();
    if (!title || (programsSubTab !== "group" && programsSubTab !== "activity")) return "";
    return periodPlanEntryForActivityTemplate({
      title,
      notes: buildActivityTemplateNotes(programsSubTab === "group" ? "group" : "activity", ""),
    });
  }, [templateProgramTitle, programsSubTab]);

  const coverPreviewSrc = useMemo(() => {
    if (programFormImageUrl.trim()) return resolveProgramCoverDisplayUrl(programFormImageUrl.trim());
    if (isActivityTemplateSubTab(programsSubTab)) {
      return programsSubTab === "group" ? CONDITIONING_TRAINING_COVER_IMAGE : MOBILITY_TRAINING_COVER_IMAGE;
    }
    const first = programExercisesDraft[0];
    if (!first) return null;
    const linked = exercisesById.get(first.exerciseId);
    return linked ? getExercisePreviewSrc(linked) : null;
  }, [programFormImageUrl, programExercisesDraft, exercisesById, getExercisePreviewSrc, programsSubTab]);

  const previewProgram = useMemo((): TrainingProgram => {
    return {
      id: "preview-draft",
      memberId: "__template__",
      title: templateProgramTitle.trim() || defaultTemplateProgramTitle(programsSubTab),
      goal: "",
      notes: "",
      createdAt: "",
      exercises: programExercisesDraft,
      imageUrl: programFormImageUrl.trim() || undefined,
    };
  }, [templateProgramTitle, programsSubTab, programExercisesDraft, programFormImageUrl]);

  const displayedExercises = useMemo(() => {
    let list = visibleProgramExercises;
    if (favoritesOnly) list = list.filter((e) => favoriteExerciseIds.includes(e.id));
    if (muscleFilter !== "all") list = list.filter((e) => exerciseMatchesMuscleFilter(e, muscleFilter));
    if (categoryFilter === "all") {
      // keep tab filter from parent; "all" chip shows all categories within subtab filter
    }
    if (sortOrder === "name") list = [...list].sort((a, b) => a.name.localeCompare(b.name, "no"));
    return list;
  }, [visibleProgramExercises, favoritesOnly, muscleFilter, categoryFilter, sortOrder, favoriteExerciseIds]);

  function handleAddExercise(exercise: Exercise) {
    onAddExercise(exercise);
    pushToast({ title: "Program", message: "Øvelse lagt til", tone: "success" });
  }

  function handleLibraryDrop(exerciseId: string) {
    const exercise = exercises.find((item) => item.id === exerciseId);
    if (exercise) handleAddExercise(exercise);
    onDraggedExerciseIdFromLibraryChange(null);
    onDraftDropZoneActiveChange(false);
  }

  return (
    <div className="motus-prog-builder">
      <header className="motus-prog-builder-header">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="motus-prog-builder-title">{programsBuilderTitle(programsSubTab)}</h1>
            <span className="motus-prog-builder-badge">Utkast</span>
          </div>
          <p className="motus-prog-builder-subtitle">{programsBuilderDescription(programsSubTab)}</p>
        </div>
        {!isActivityTab ? (
          <OutlineButton type="button" onClick={() => setPreviewOpen(true)} disabled={programExercisesDraft.length === 0}>
            Forhåndsvis program
          </OutlineButton>
        ) : null}
      </header>

      <div className="flex flex-wrap gap-2">
        {TRAINING_SUB_TAB_OPTIONS.map((tab) => (
          <PillButton key={tab.id} active={programsSubTab === tab.id} onClick={() => onProgramsSubTabChange(tab.id)}>
            {tab.programsLabel}
          </PillButton>
        ))}
      </div>

      <button
        type="button"
        className="motus-prog-builder-templates-toggle"
        onClick={() => setTemplatesOpen((prev) => !prev)}
      >
        <span>
          {savedTemplatesTitle(programsSubTab)} ({activeTemplatePrograms.length})
        </span>
        <ChevronDown className={`h-4 w-4 transition ${templatesOpen ? "rotate-180" : ""}`} />
      </button>
      {templatesOpen ? (
        <div className="motus-prog-builder-templates-panel">
          {activeTemplatePrograms.length === 0 ? (
            <p className="text-sm text-slate-500">{emptyTemplatesMessage(programsSubTab)}</p>
          ) : (
            <div className="space-y-2 max-h-48 overflow-auto">
              {activeTemplatePrograms.map((program) => (
                <div key={program.id} className="motus-prog-builder-template-row">
                  <button
                    type="button"
                    className="min-w-0 flex-1 text-left"
                    onClick={() => onExpandedTemplateProgramIdChange(expandedTemplateProgramId === program.id ? null : program.id)}
                  >
                    <div className="truncate text-sm font-semibold text-slate-900">{program.title}</div>
                    <div className="text-xs text-slate-500">
                      {isPeriodPlanActivityTemplate(program)
                        ? "Periodeplan-mal"
                        : isActivityTemplate(program)
                          ? "Hjem — ingen plan"
                          : `${program.exercises.length} øvelser`}
                    </div>
                  </button>
                  <OutlineButton type="button" className="!px-2 !py-1 text-xs" onClick={() => onStartEditTemplate(program)}>
                    Rediger
                  </OutlineButton>
                  <OutlineButton type="button" className="!px-2 !py-1 text-xs text-rose-700" onClick={() => onDeleteTemplate(program)}>
                    Slett
                  </OutlineButton>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : null}

      {showPeriodPlanTemplateEditor ? (
        <div
          className={`motus-prog-builder-activity-template space-y-4 rounded-2xl border bg-white p-4 sm:p-5${
            editingPeriodPlanTemplate ? " ring-2 ring-violet-300" : ""
          }`}
          style={{ borderColor: editingPeriodPlanTemplate ? "rgba(139,92,246,0.35)" : "rgba(15,23,42,0.08)" }}
        >
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-base font-semibold text-slate-900">{periodPlanTemplateBuilderTitle(programsSubTab)}</h2>
              {editingPeriodPlanTemplate ? (
                <span className="motus-prog-builder-badge">Redigerer</span>
              ) : null}
            </div>
            <p className="mt-1 text-sm leading-relaxed text-slate-600">
              {editingPeriodPlanTemplate
                ? `Du redigerer «${templateProgramTitle.trim() || "mal"}». Endringer gjelder for alle trenere.`
                : periodPlanTemplateBuilderDescription(programsSubTab)}
            </p>
          </div>
          <div className="motus-prog-builder-hero max-w-xl">
            {periodPlanTemplateCoverPreviewSrc ? (
              <img
                src={periodPlanTemplateCoverPreviewSrc}
                alt=""
                className={`motus-prog-builder-hero-img${programFormImageUrl.trim() ? " motus-member-program-cover--custom" : ""}`}
                style={periodPlanTemplateCoverPreviewStyle}
                loading="lazy"
              />
            ) : (
              <div className="motus-prog-builder-hero-placeholder" />
            )}
            <div className="motus-prog-builder-hero-overlay">
              <TextInput
                value={templateProgramTitle}
                onChange={(e) => onTemplateProgramTitleChange(e.target.value)}
                placeholder={defaultTemplateProgramTitle(programsSubTab)}
                className="!border-0 !bg-white/95 !text-base !font-semibold"
              />
              {periodPlanTemplateEntryPreview ? (
                <p className="rounded-lg bg-white/90 px-3 py-1.5 text-xs font-medium text-slate-600">
                  I periodeplan: {periodPlanTemplateEntryPreview}
                </p>
              ) : null}
              <div className="motus-prog-builder-hero-tags">
                <span className="motus-prog-builder-hero-tag">{programCategoryLabel(programsSubTab)}</span>
                <span className="motus-prog-builder-hero-tag">Felles mal</span>
              </div>
            </div>
          </div>
          <ProgramCoverImageField
            imageUrl={programFormImageUrl}
            onImageUrlChange={onProgramFormImageUrlChange}
            onUploadFile={onProgramImageUpload}
            isUploading={isUploadingProgramImage}
          />
          <TextArea
            value={templateDescription}
            onChange={(e) => onTemplateDescriptionChange?.(e.target.value)}
            className="min-h-[96px]"
            placeholder="Kort beskrivelse (valgfritt) — vises for deg, ikke i periodeplan-cellen."
          />
          <div className="flex flex-wrap gap-2">
            <GradientButton type="button" onClick={onSaveTemplate}>
              {editingTemplateProgramId ? "Oppdater mal" : "Lagre mal"}
            </GradientButton>
            <OutlineButton type="button" onClick={onResetTemplate}>
              Nullstill
            </OutlineButton>
          </div>
          {periodPlanTemplateSaveStatus ? (
            <div className="rounded-xl border motus-brand-surface px-3 py-2 text-xs text-emerald-700">
              {periodPlanTemplateSaveStatus}
            </div>
          ) : null}
        </div>
      ) : null}

      {showNoPlanDayCoverEditor ? (
        <div
          className={`motus-prog-builder-activity-template space-y-4 rounded-2xl border bg-white p-4 sm:p-5${
            editingNoPlanDayCover ? " ring-2 ring-violet-300" : ""
          }`}
          style={{ borderColor: editingNoPlanDayCover ? "rgba(139,92,246,0.35)" : "rgba(15,23,42,0.08)" }}
        >
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-base font-semibold text-slate-900">Bilde: Ingen plan i dag</h2>
              {editingNoPlanDayCover ? <span className="motus-prog-builder-badge">Redigerer</span> : null}
            </div>
            <p className="mt-1 text-sm leading-relaxed text-slate-600">
              Vises på Hjem når kunden ikke har noe planlagt i dag (f.eks. uten periodeplan eller tom dag).
            </p>
          </div>
          <div className="motus-prog-builder-hero max-w-xl">
            <img
              src={noPlanCoverPreviewSrc}
              alt=""
              className={`motus-prog-builder-hero-img${noPlanDayCoverImageUrl.trim() ? " motus-member-program-cover--custom" : ""}`}
              style={noPlanCoverPreviewStyle}
              loading="lazy"
            />
            <div className="motus-prog-builder-hero-overlay">
              <p className="rounded-lg bg-white/95 px-3 py-2 text-base font-semibold text-slate-900">
                {NO_PLAN_DAY_TEMPLATE_TITLE}
              </p>
              <div className="motus-prog-builder-hero-tags">
                <span className="motus-prog-builder-hero-tag">Hjem</span>
                <span className="motus-prog-builder-hero-tag">Felles mal</span>
              </div>
            </div>
          </div>
          {onNoPlanDayCoverImageUrlChange && onNoPlanDayCoverImageUpload ? (
            <ProgramCoverImageField
              imageUrl={noPlanDayCoverImageUrl}
              onImageUrlChange={onNoPlanDayCoverImageUrlChange}
              onUploadFile={onNoPlanDayCoverImageUpload}
              isUploading={isUploadingProgramImage}
            />
          ) : null}
          {onSaveNoPlanDayCover ? (
            <GradientButton type="button" onClick={onSaveNoPlanDayCover}>
              {hasNoPlanDayCoverTemplate ? "Oppdater bilde" : "Lagre bilde"}
            </GradientButton>
          ) : null}
          {noPlanDayCoverSaveStatus ? (
            <div className="rounded-xl border motus-brand-surface px-3 py-2 text-xs text-emerald-700">
              {noPlanDayCoverSaveStatus}
            </div>
          ) : null}
        </div>
      ) : null}

      {!isActivityTab ? (
      <div className="motus-prog-builder-layout">
        <div className="motus-prog-builder-left">
          <div className="motus-prog-builder-hero">
            {coverPreviewSrc ? (
              <img src={coverPreviewSrc} alt="" className="motus-prog-builder-hero-img" />
            ) : (
              <div className="motus-prog-builder-hero-placeholder" />
            )}
            <div className="motus-prog-builder-hero-overlay">
              <TextInput
                value={templateProgramTitle}
                onChange={(e) => onTemplateProgramTitleChange(e.target.value)}
                placeholder={defaultTemplateProgramTitle(programsSubTab)}
                className="!border-0 !bg-white/95 !text-base !font-semibold"
              />
              <div className="motus-prog-builder-hero-tags">
                <span className="motus-prog-builder-hero-tag">{programCategoryLabel(programsSubTab)}</span>
                <span className="motus-prog-builder-hero-tag">Mal</span>
                {stats.totalMinutes > 0 ? (
                  <span className="motus-prog-builder-hero-tag">{stats.totalMinutes} min</span>
                ) : null}
              </div>
            </div>
          </div>

          <div className="motus-prog-builder-stats-row">
            <div className="motus-prog-builder-stat">
              <Dumbbell className="h-4 w-4 text-[#30e3be]" />
              <span>
                <strong>{stats.exerciseCount}</strong> øvelser
              </span>
            </div>
            <div className="motus-prog-builder-stat">
              <Clock className="h-4 w-4 text-[#30e3be]" />
              <span>
                <strong>{stats.totalMinutes || "—"}</strong> min
              </span>
            </div>
            <div className="motus-prog-builder-stat">
              <Flame className="h-4 w-4 text-[#d91278]" />
              <span>
                Intensitet <strong>{stats.intensityLabel}</strong>
              </span>
            </div>
          </div>

          <ProgramCoverImageField
            imageUrl={programFormImageUrl}
            onImageUrlChange={onProgramFormImageUrlChange}
            onUploadFile={onProgramImageUpload}
            isUploading={isUploadingProgramImage}
          />

          <div
            className={`motus-prog-builder-list ${isDraftDropZoneActive ? "motus-prog-builder-list--active" : ""}`}
            onDragOver={(event) => {
              event.preventDefault();
              if (draggedExerciseIdFromLibrary || draggedDraftExerciseId) onDraftDropZoneActiveChange(true);
            }}
            onDragLeave={() => onDraftDropZoneActiveChange(false)}
            onDrop={(event) => {
              event.preventDefault();
              if (draggedExerciseIdFromLibrary) {
                handleLibraryDrop(draggedExerciseIdFromLibrary);
                return;
              }
              onDraftDropZoneActiveChange(false);
            }}
          >
            {programExercisesDraft.map((item, index) => {
              const linkedExercise = exercisesById.get(item.exerciseId);
              const isExpanded = expandedDraftId === item.id;
              const isCardio = isCardioProgramRow(item, linkedExercise, programsSubTab);
              const prescriptionFields = resolveExercisePrescriptionFields(linkedExercise);
              const prescription = draftExercisePrescriptionLabel(item, index, programExercisesDraft, linkedExercise, programsSubTab);

              return (
                <div
                  key={item.id}
                  draggable
                  onDragStart={() => onDraggedDraftExerciseIdChange(item.id)}
                  onDragEnd={() => {
                    onDraggedDraftExerciseIdChange(null);
                    onDragOverDraftExerciseIdChange(null);
                  }}
                  onDragOver={(event) => {
                    event.preventDefault();
                    if (draggedDraftExerciseId) onDragOverDraftExerciseIdChange(item.id);
                  }}
                  onDragLeave={() => {
                    if (dragOverDraftExerciseId === item.id) onDragOverDraftExerciseIdChange(null);
                  }}
                  onDrop={(event) => {
                    event.preventDefault();
                    if (draggedDraftExerciseId) {
                      onMoveDraftExercise(draggedDraftExerciseId, item.id);
                      onDragOverDraftExerciseIdChange(null);
                    }
                  }}
                  className={`motus-prog-builder-row ${dragOverDraftExerciseId === item.id ? "motus-prog-builder-row--over" : ""}`}
                >
                  <div className="motus-prog-builder-row-main">
                    <GripVertical className="motus-prog-builder-grip h-4 w-4 shrink-0" aria-hidden />
                    <span className="motus-prog-builder-index">{index + 1}</span>
                    <img
                      src={linkedExercise ? getExercisePreviewSrc(linkedExercise) : getExerciseSketchDataUri({
                        id: item.exerciseId,
                        name: item.exerciseName,
                        category: "Styrke",
                        group: "",
                        equipment: "",
                        level: "Nybegynner",
                        description: "",
                      })}
                      alt=""
                      className="motus-prog-builder-row-thumb"
                      onError={(event) => {
                        if (linkedExercise) event.currentTarget.src = getExerciseSketchDataUri(linkedExercise);
                      }}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="font-semibold text-sm text-slate-900 truncate">{item.exerciseName}</div>
                      <div className="text-xs text-slate-500">{prescription}</div>
                      {linkedExercise ? (
                        <span className={`motus-exbank-tag mt-1 inline-block ${muscleGroupChipClass(splitMuscleGroupLabel(linkedExercise.group)[0] ?? linkedExercise.category)}`}>
                          {linkedExercise.category}
                        </span>
                      ) : null}
                    </div>
                    <button
                      type="button"
                      className="motus-prog-builder-row-btn"
                      onClick={() => setExpandedDraftId(isExpanded ? null : item.id)}
                      aria-label="Rediger øvelse"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      className="motus-prog-builder-row-btn motus-prog-builder-row-btn--danger"
                      onClick={() => onRemoveDraftExercise(item.id)}
                      aria-label="Fjern øvelse"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                  {isExpanded ? (
                    <div className="motus-prog-builder-row-edit">
                      <ProgramExerciseBlockActions exercises={programExercisesDraft} index={index} onChange={onProgramExercisesDraftChange} />
                      <ProgramExercisePrescriptionFields
                        fields={prescriptionFields}
                        item={item}
                        exercise={linkedExercise}
                        onUpdate={(field, value) => onUpdateDraftExercise(item.id, field, value)}
                        setsLabel={isCardio ? cardioSetLabel() : "Sett"}
                        setsPlaceholder={isCardio ? cardioSetPlaceholder() : "Sett"}
                        trailing={
                          isCardio ? (
                            <CardioExerciseExtraFields
                              item={item}
                              linkedExercise={linkedExercise}
                              fallbackEquipmentId={cardioEquipmentId}
                              cardioIntervalIntensity={cardioIntervalIntensity ?? "medium"}
                              intensityHint="Klassifisering for deg — feltene under følger valgt utstyr."
                              onUpdate={(field, value) => onUpdateDraftExercise(item.id, field, value)}
                              onReplaceItem={(next) =>
                                onProgramExercisesDraftChange(
                                  programExercisesDraft.map((row) => (row.id === item.id ? next : row)),
                                )
                              }
                            />
                          ) : null
                        }
                      />
                    </div>
                  ) : null}
                </div>
              );
            })}

            <div
              className="motus-prog-builder-dropzone"
              onDragOver={(event) => {
                event.preventDefault();
                onDraftDropZoneActiveChange(true);
              }}
              onDrop={(event) => {
                event.preventDefault();
                if (draggedExerciseIdFromLibrary) handleLibraryDrop(draggedExerciseIdFromLibrary);
              }}
            >
              <Plus className="h-5 w-5 text-slate-400" />
              Dra og slipp øvelser hit
            </div>
          </div>

          {programsSubTabConditioningExtras}

          <div className="motus-prog-builder-footer">
            <GradientButton type="button" onClick={onSaveTemplate} className="motus-prog-builder-save flex-1">
              {editingTemplateProgramId ? "Lagre endringer" : "Lagre program"}
            </GradientButton>
            <div className="relative">
              <button
                type="button"
                className="motus-prog-builder-more"
                onClick={() => setMoreMenuOpen((prev) => !prev)}
                aria-label="Flere handlinger"
              >
                <MoreHorizontal className="h-5 w-5" />
              </button>
              {moreMenuOpen ? (
                <div className="motus-prog-builder-more-menu">
                  <button type="button" onClick={() => { onResetTemplate(); setMoreMenuOpen(false); }}>
                    Nullstill utkast
                  </button>
                  <button type="button" onClick={() => { setPreviewOpen(true); setMoreMenuOpen(false); }}>
                    Forhåndsvis
                  </button>
                </div>
              ) : null}
            </div>
          </div>
          <p className="motus-prog-builder-autosave">
            <Zap className="h-3.5 w-3.5" aria-hidden />
            Programmet lagres når du trykker Lagre program
          </p>
        </div>

        <div className="motus-prog-builder-right">
          <div className="motus-prog-builder-search-wrap">
            <Search className="motus-prog-builder-search-icon h-4 w-4" />
            <input
              type="search"
              value={programExerciseSearch}
              onChange={(e) => onProgramExerciseSearchChange(e.target.value)}
              placeholder="Søk øvelse, muskelgruppe eller utstyr..."
              className="motus-prog-builder-search"
            />
            <button type="button" className="motus-prog-builder-filter-btn" aria-label="Filter">
              <SlidersHorizontal className="h-4 w-4" />
              Filter
            </button>
          </div>

          <div className="motus-exbank-chips">
            <button
              type="button"
              className={`motus-exbank-chip-filter ${categoryFilter === "tab" ? "motus-exbank-chip-filter--active" : ""}`}
              onClick={() => setCategoryFilter("tab")}
            >
              {programCategoryLabel(programsSubTab)}
            </button>
            {EXERCISE_CATEGORY_OPTIONS.filter((c) => c !== programCategoryLabel(programsSubTab)).slice(0, 4).map((cat) => (
              <button
                key={cat}
                type="button"
                className="motus-exbank-chip-filter"
                onClick={() => onProgramExerciseSearchChange(cat)}
              >
                {cat}
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
              <Heart className={`h-3.5 w-3.5 ${favoritesOnly ? "fill-current" : ""}`} />
              Favoritter
            </button>
          </div>

          <div className="motus-prog-builder-library-toolbar">
            <span className="text-sm text-slate-600">
              <strong>{displayedExercises.length}</strong> øvelser
            </span>
            <div className="flex items-center gap-2">
              <SelectBox
                value={sortOrder}
                onChange={(v) => setSortOrder(v as "default" | "name")}
                options={[
                  { value: "default", label: "Anbefalt" },
                  { value: "name", label: "Alfabetisk" },
                ]}
              />
              <div className="motus-exbank-view-toggle">
                <button type="button" className={gridView ? "motus-exbank-view-btn--active" : ""} onClick={() => setGridView(true)} aria-label="Rutenett">
                  <LayoutGrid className="h-4 w-4" />
                </button>
                <button type="button" className={!gridView ? "motus-exbank-view-btn--active" : ""} onClick={() => setGridView(false)} aria-label="Liste">
                  <LayoutList className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>

          {displayedExercises.length === 0 ? (
            <EmptyState icon="🔍" title="Ingen øvelser funnet" description="Prøv et annet søk eller filter." className="motus-exbank-empty" />
          ) : (
            <div className={gridView ? "motus-prog-builder-grid" : "motus-prog-builder-list-view"}>
              {displayedExercises.map((exercise) => {
                const isFavorite = favoriteExerciseIds.includes(exercise.id);
                const popularity = exercisePopularityScores.get(exercise.id) ?? 0;
                const badge = defaultHoldBadgeSeconds(exercise);
                const accent = exerciseCategoryAccentColor(exercise.category);
                return (
                  <article
                    key={exercise.id}
                    className="motus-prog-builder-lib-card"
                    draggable
                    onDragStart={() => onDraggedExerciseIdFromLibraryChange(exercise.id)}
                    onDragEnd={() => onDraggedExerciseIdFromLibraryChange(null)}
                  >
                    <div className="motus-prog-builder-lib-media">
                      <img
                        src={getExercisePreviewSrc(exercise)}
                        alt=""
                        className="motus-prog-builder-lib-img"
                        loading="lazy"
                        onError={(e) => {
                          e.currentTarget.src = getExerciseSketchDataUri(exercise);
                        }}
                      />
                      {badge ? <span className="motus-prog-builder-duration-badge">{badge}</span> : null}
                      <button
                        type="button"
                        className={`motus-prog-builder-lib-fav ${isFavorite ? "motus-prog-builder-lib-fav--on" : ""}`}
                        onClick={() => onToggleFavorite(exercise.id)}
                        aria-pressed={isFavorite}
                      >
                        <Heart className={`h-4 w-4 ${isFavorite ? "fill-current" : ""}`} />
                      </button>
                    </div>
                    <div className="motus-prog-builder-lib-body">
                      <div className="flex flex-wrap items-start gap-1">
                        <h3 className="motus-prog-builder-lib-title">{exercise.name}</h3>
                        {isRecommendedExercise(popularity, isFavorite) || isPopularExercise(popularity) ? (
                          <ExerciseBankBadges popularity={popularity} isFavorite={isFavorite} variant="trainer" />
                        ) : null}
                      </div>
                      <div className="motus-prog-builder-lib-tags">
                        <span className="motus-exbank-tag motus-exbank-tag--category" style={{ borderColor: `${accent}55`, color: accent }}>
                          {exercise.category}
                        </span>
                        {splitMuscleGroupLabel(exercise.group).slice(0, 1).map((part) => (
                          <span key={part} className={`motus-exbank-tag ${muscleGroupChipClass(part)}`}>
                            {part}
                          </span>
                        ))}
                      </div>
                      <button
                        type="button"
                        className="motus-prog-builder-lib-add"
                        onClick={() => handleAddExercise(exercise)}
                        aria-label={`Legg til ${exercise.name}`}
                      >
                        <Plus className="h-5 w-5" />
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>
      </div>
      ) : null}

      {assignTemplateSection}

      <TrainingProgramPreviewModal
        program={previewProgram}
        open={previewOpen}
        onClose={() => setPreviewOpen(false)}
        exerciseLibrary={exercises}
      />
    </div>
  );
}
