import { useEffect, useMemo, useState } from "react";
import { GripVertical, Lightbulb, Plus, Search, Sparkles, Trash2 } from "lucide-react";
import {
  buildCustomWorkoutInsights,
  buildCustomWorkoutPreview,
  buildProgramExercisesFromCustomLines,
  programExercisesToCustomLines,
  type CustomWorkoutLine,
  muscleGroupChipClass,
  readMemberFavoriteExerciseIds,
  recommendExercisesForCustomWorkout,
  reorderCustomWorkoutLines,
  writeMemberFavoriteExerciseIds,
} from "../app/customWorkoutBuilder";
import { MOTUS } from "../app/data";
import { exerciseCategoryAccentColor, isHoldBasedExerciseCategory } from "../app/exerciseCategories";
import { resolveExerciseImageSrc } from "../app/exerciseIllustrations";
import { computeExercisePopularityScores, computeTrainerProgramExerciseIds } from "../app/exerciseBankStats";
import { programImageUrlForSave } from "../app/programImage";
import { uploadProgramCoverImageToSupabase } from "../app/programImageUpload";
import { isSupabaseConfigured, supabaseClient } from "../services/supabaseClient";
import { EXERCISE_IMAGE_SMALL_CLASS } from "../app/exerciseIllustrations/constants";
import type { Exercise, ProgramExercise, TrainingProgram, WorkoutLog } from "../app/types";
import { uid } from "../app/storage";
import { Card, EmptyState, GradientButton, MotusSectionIcon, OutlineButton, PillButton, StatusMessage, TextInput } from "../app/ui";
import { ProgramCoverImageField } from "./ProgramCoverImageField";
import { ExerciseBankListCard } from "./ExerciseBankListCard";
import { splitMuscleGroupLabel } from "./muscleSplitStats";

const BANK_PREVIEW = 40;

type StartWorkoutModeOptions = {
  suggestedWeightByProgramExerciseId: Record<string, string>;
};

type CustomWorkoutBuilderProps = {
  exercises: Exercise[];
  completedLogs: WorkoutLog[];
  memberPrograms?: TrainingProgram[];
  activeMemberId: string;
  memberDisplayName: string;
  currentUserEmail: string;
  nowDate: Date;
  startCustomWorkout: (input: { memberId: string; exercises: ProgramExercise[] }, options: StartWorkoutModeOptions) => void;
  saveProgramForMember: (input: {
    id?: string;
    title: string;
    goal: string;
    notes: string;
    memberId: string;
    exercises: ProgramExercise[];
    imageUrl?: string;
    programCreatedBy?: "member" | "trainer";
    programCreatedByName?: string;
    onPersisted?: (result: { ok: boolean; message?: string }) => void;
  }) => void;
  deleteProgramById: (programId: string) => void;
  refreshRemoteHydration?: () => void | Promise<void>;
  findSuggestedWeightForExercise: (exerciseName: string) => string;
  editingProgram?: TrainingProgram | null;
  onCancelEdit?: () => void;
  onEditSaved?: () => void;
};

function MuscleGroupChips({ group }: { group: string }) {
  const parts = splitMuscleGroupLabel(group);
  if (!parts.length) return null;
  return (
    <div className="flex flex-wrap gap-1">
      {parts.map((part) => (
        <span key={part} className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${muscleGroupChipClass(part)}`}>
          {part}
        </span>
      ))}
    </div>
  );
}

export function CustomWorkoutBuilder({
  exercises,
  completedLogs,
  memberPrograms = [],
  activeMemberId,
  memberDisplayName,
  currentUserEmail,
  nowDate,
  startCustomWorkout,
  saveProgramForMember,
  deleteProgramById,
  refreshRemoteHydration,
  findSuggestedWeightForExercise,
  editingProgram = null,
  onCancelEdit,
  onEditSaved,
}: CustomWorkoutBuilderProps) {
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [muscleFilter, setMuscleFilter] = useState<string>("all");
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [showAllBank, setShowAllBank] = useState(false);
  const [lines, setLines] = useState<CustomWorkoutLine[]>([]);
  const [programTitle, setProgramTitle] = useState("Mitt treningsprogram");
  const [programFormImageUrl, setProgramFormImageUrl] = useState("");
  const [programCoverCleared, setProgramCoverCleared] = useState(false);
  const [isUploadingProgramImage, setIsUploadingProgramImage] = useState(false);
  const [saveStatus, setSaveStatus] = useState<string | null>(null);
  const [favoriteExerciseIds, setFavoriteExerciseIds] = useState<string[]>([]);
  const [draggedLineKey, setDraggedLineKey] = useState<string | null>(null);
  const [dragOverLineKey, setDragOverLineKey] = useState<string | null>(null);

  useEffect(() => {
    setFavoriteExerciseIds(readMemberFavoriteExerciseIds(activeMemberId));
  }, [activeMemberId]);

  useEffect(() => {
    writeMemberFavoriteExerciseIds(activeMemberId, favoriteExerciseIds);
  }, [activeMemberId, favoriteExerciseIds]);

  useEffect(() => {
    setShowAllBank(false);
  }, [search, categoryFilter, muscleFilter, favoritesOnly]);

  useEffect(() => {
    if (!editingProgram) {
      setLines([]);
      setProgramTitle("Mitt treningsprogram");
      setProgramFormImageUrl("");
      setProgramCoverCleared(false);
      setSaveStatus(null);
      return;
    }
    setLines(programExercisesToCustomLines(editingProgram.exercises));
    setProgramTitle(editingProgram.title);
    setProgramFormImageUrl(editingProgram.imageUrl ?? "");
    setProgramCoverCleared(false);
    setSaveStatus(null);
  }, [editingProgram?.id]);

  const categories = useMemo(() => {
    return Array.from(new Set(exercises.map((exercise) => exercise.category.trim()).filter(Boolean))).sort((a, b) =>
      a.localeCompare(b, "nb"),
    );
  }, [exercises]);

  const muscleGroups = useMemo(() => {
    const groups = new Set<string>();
    for (const exercise of exercises) {
      for (const part of splitMuscleGroupLabel(exercise.group)) {
        groups.add(part);
      }
    }
    return Array.from(groups).sort((a, b) => a.localeCompare(b, "nb"));
  }, [exercises]);

  const draftExerciseIds = useMemo(() => new Set(lines.map((line) => line.exerciseId)), [lines]);

  const exercisePopularityScores = useMemo(
    () => computeExercisePopularityScores(exercises, memberPrograms, completedLogs),
    [completedLogs, exercises, memberPrograms],
  );

  const trainerProgramExerciseIds = useMemo(
    () => computeTrainerProgramExerciseIds(memberPrograms, activeMemberId),
    [activeMemberId, memberPrograms],
  );

  const draftExercises = useMemo(
    () =>
      lines
        .map((line) => exercises.find((exercise) => exercise.id === line.exerciseId))
        .filter((exercise): exercise is Exercise => Boolean(exercise)),
    [exercises, lines],
  );

  const insights = useMemo(
    () =>
      buildCustomWorkoutInsights({
        draftExercises,
        completedLogs,
        allExercises: exercises,
        nowDate,
      }),
    [completedLogs, draftExercises, exercises, nowDate],
  );

  const preview = useMemo(() => buildCustomWorkoutPreview(lines, exercises), [exercises, lines]);

  const recommendedExercises = useMemo(
    () =>
      recommendExercisesForCustomWorkout({
        allExercises: exercises,
        draftExerciseIds,
        completedLogs,
        insights,
      }),
    [completedLogs, draftExerciseIds, exercises, insights],
  );

  const bankFiltered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return exercises.filter((exercise) => {
      if (favoritesOnly && !favoriteExerciseIds.includes(exercise.id)) return false;
      if (categoryFilter !== "all" && exercise.category !== categoryFilter) return false;
      if (muscleFilter !== "all" && !splitMuscleGroupLabel(exercise.group).includes(muscleFilter)) return false;
      if (!query) return true;
      return (
        exercise.name.toLowerCase().includes(query) ||
        exercise.group.toLowerCase().includes(query) ||
        exercise.equipment.toLowerCase().includes(query)
      );
    });
  }, [categoryFilter, exercises, favoriteExerciseIds, favoritesOnly, muscleFilter, search]);

  const bankSorted = useMemo(() => {
    return [...bankFiltered].sort((a, b) => {
      const aFavorite = favoriteExerciseIds.includes(a.id) ? 1 : 0;
      const bFavorite = favoriteExerciseIds.includes(b.id) ? 1 : 0;
      if (aFavorite !== bFavorite) return bFavorite - aFavorite;
      const aTrainer = trainerProgramExerciseIds.has(a.id) ? 1 : 0;
      const bTrainer = trainerProgramExerciseIds.has(b.id) ? 1 : 0;
      if (aTrainer !== bTrainer) return bTrainer - aTrainer;
      const aScore = exercisePopularityScores.get(a.id) ?? 0;
      const bScore = exercisePopularityScores.get(b.id) ?? 0;
      if (aScore !== bScore) return bScore - aScore;
      return a.name.localeCompare(b.name, "nb");
    });
  }, [bankFiltered, exercisePopularityScores, favoriteExerciseIds, trainerProgramExerciseIds]);

  const bankVisible = useMemo(() => {
    if (showAllBank || search.trim()) return bankSorted;
    return bankSorted.slice(0, BANK_PREVIEW);
  }, [bankSorted, search, showAllBank]);

  const bankOverflow = Math.max(0, bankSorted.length - BANK_PREVIEW);

  function toggleFavorite(exerciseId: string) {
    setFavoriteExerciseIds((previous) =>
      previous.includes(exerciseId) ? previous.filter((id) => id !== exerciseId) : [...previous, exerciseId],
    );
  }

  function addLine(exerciseId: string) {
    const id = exerciseId.trim();
    if (!id) return;
    setLines((previous) => {
      if (previous.some((line) => line.exerciseId === id)) return previous;
      const exercise = exercises.find((item) => item.id === id);
      const isStretch = Boolean(exercise?.category && isHoldBasedExerciseCategory(exercise.category));
      const weightHint = exercise && !isStretch ? findSuggestedWeightForExercise(exercise.name) : "";
      const secHint = exercise && isStretch ? findSuggestedWeightForExercise(exercise.name) : "";
      return [
        ...previous,
        {
          key: uid("row"),
          exerciseId: id,
          sets: isStretch ? "2" : "3",
          reps: isStretch ? "1" : "10",
          weight: isStretch ? "" : weightHint,
          holdSeconds: isStretch ? secHint || "30" : "",
        },
      ];
    });
  }

  function updateLine(key: string, patch: Partial<CustomWorkoutLine>) {
    setLines((previous) => previous.map((line) => (line.key === key ? { ...line, ...patch } : line)));
  }

  function removeLine(key: string) {
    setLines((previous) => previous.filter((line) => line.key !== key));
  }

  function buildProgramExercises(): ProgramExercise[] | null {
    const built = buildProgramExercisesFromCustomLines(lines, exercises, uid);
    if (!built.length) return null;
    if (!editingProgram) return built;
    return built.map((exercise, index) => {
      const line = lines[index];
      const existing = editingProgram.exercises.find(
        (row) => (line?.key && row.id === line.key) || row.exerciseId === exercise.exerciseId,
      );
      if (!existing) return exercise;
      return {
        ...existing,
        ...exercise,
        id: existing.id,
        durationMinutes: existing.durationMinutes,
        speed: existing.speed,
        incline: existing.incline,
        restSeconds: existing.restSeconds ?? exercise.restSeconds,
        notes: existing.notes ?? exercise.notes,
      };
    });
  }

  function buildStartWorkoutOptions(program: TrainingProgram): StartWorkoutModeOptions {
    const suggestedWeightByProgramExerciseId: Record<string, string> = {};
    program.exercises.forEach((exercise) => {
      if (Number(exercise.durationMinutes) > 0) return;
      const meta = exercises.find((e) => e.id === exercise.exerciseId);
      if (meta?.category === "Kondisjon") return;
      const suggestedWeight = findSuggestedWeightForExercise(exercise.exerciseName).trim();
      if (!suggestedWeight) return;
      suggestedWeightByProgramExerciseId[exercise.id] = suggestedWeight;
    });
    return { suggestedWeightByProgramExerciseId };
  }

  function handleStart() {
    const built = buildProgramExercises();
    if (!built || !activeMemberId.trim()) return;
    const tempProgram: TrainingProgram = {
      id: "",
      memberId: activeMemberId,
      title: "Egen økt",
      goal: "",
      notes: "",
      createdAt: "",
      exercises: built,
    };
    startCustomWorkout({ memberId: activeMemberId, exercises: built }, buildStartWorkoutOptions(tempProgram));
    setLines([]);
    setSearch("");
  }

  function handleSave() {
    const built = buildProgramExercises();
    if (!built || !activeMemberId.trim()) return;
    const title = programTitle.trim() || "Mitt treningsprogram";
    const authorFull = memberDisplayName.trim() || currentUserEmail.trim() || "Medlem";
    const isEditing = Boolean(editingProgram?.id);
    const programId = isEditing ? editingProgram!.id : uid("program");
    saveProgramForMember({
      id: programId,
      title,
      goal: isEditing ? editingProgram!.goal ?? "" : "",
      notes: isEditing ? editingProgram!.notes ?? "" : "",
      memberId: activeMemberId,
      exercises: isEditing ? built : built.map((exercise) => ({ ...exercise, id: uid("prog-ex") })),
      imageUrl: programImageUrlForSave(programFormImageUrl, programCoverCleared),
      programCreatedBy: isEditing ? editingProgram!.programCreatedBy ?? "member" : "member",
      programCreatedByName: isEditing ? editingProgram!.programCreatedByName ?? authorFull : authorFull,
      onPersisted: (result) => {
        if (!result.ok) {
          if (!isEditing) deleteProgramById(programId);
          setSaveStatus(`Kunne ikke lagre i skyen: ${result.message?.trim() || "Prøv igjen."}`);
          return;
        }
        if (isEditing) {
          setSaveStatus(`«${title}» er oppdatert.`);
          onEditSaved?.();
        } else {
          setSaveStatus(`«${title}» er lagret og synkronisert.`);
          setLines([]);
          setSearch("");
          setProgramFormImageUrl("");
          setProgramCoverCleared(false);
        }
        void refreshRemoteHydration?.();
      },
    });
    setSaveStatus(isEditing ? `Oppdaterer «${title}»…` : `Lagrer «${title}» i skyen…`);
  }

  async function handleProgramImageUpload(file: File) {
    if (!isSupabaseConfigured || !supabaseClient) {
      setSaveStatus("Bildefunksjonen er ikke tilgjengelig akkurat nå.");
      return;
    }
    setIsUploadingProgramImage(true);
    setSaveStatus("Laster opp programbilde…");
    try {
      const result = await uploadProgramCoverImageToSupabase(file, supabaseClient);
      if (!result.ok) {
        setSaveStatus(result.message);
        return;
      }
      setProgramFormImageUrl(result.publicUrl);
      setProgramCoverCleared(false);
      setSaveStatus("Programbilde lastet opp. Husk å lagre programmet.");
    } catch {
      setSaveStatus("Kunne ikke laste opp bilde akkurat nå.");
    } finally {
      setIsUploadingProgramImage(false);
    }
  }

  return (
    <Card className="motus-custom-workout overflow-hidden p-0">
      <div className="border-b bg-white motus-custom-workout-panel">
        <div className="flex items-start gap-3">
          <MotusSectionIcon>
            <Sparkles className="h-5 w-5" />
          </MotusSectionIcon>
          <div>
            <div className="motus-section-label text-teal-700">{editingProgram ? "Rediger program" : "Lag egen økt"}</div>
            <h2 className="mt-1 text-xl font-semibold tracking-tight text-slate-950">
              {editingProgram ? editingProgram.title : "Bygg økten visuelt"}
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              {editingProgram
                ? "Endre øvelser, navn og programbilde. Lagre når du er ferdig."
                : "Dra øvelser inn, se forhåndsvisning live og få smarte forslag underveis."}
            </p>
            {editingProgram && onCancelEdit ? (
              <OutlineButton type="button" onClick={onCancelEdit} className="mt-3">
                Avbryt redigering
              </OutlineButton>
            ) : null}
          </div>
        </div>

        {insights.length ? (
          <div className="mt-4 flex flex-wrap gap-2">
            {insights.map((insight) => (
              <div
                key={insight.id}
                className={`inline-flex items-center gap-1.5 motus-surface-chip px-3 py-2 ${
                  insight.tone === "suggest" ? "motus-surface-chip--muted" : ""
                }`}
              >
                <Lightbulb className="h-3.5 w-3.5 shrink-0" />
                {insight.message}
              </div>
            ))}
          </div>
        ) : null}
      </div>

      <div className="grid min-w-0 max-w-full gap-0 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
        <div
          className="motus-custom-workout-panel space-y-5 border-b lg:border-b-0 lg:border-r"
          style={{ borderColor: "rgba(15,23,42,0.08)" }}
        >
          <div>
            <div className="flex items-center justify-between gap-2">
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Din økt</div>
              {preview.exerciseCount ? (
                <div className="text-xs text-slate-500">{preview.totalSets} sett totalt</div>
              ) : null}
            </div>

            {lines.length === 0 ? (
              <div
                className="mt-3"
                onDragOver={(event) => event.preventDefault()}
                onDrop={(event) => {
                  event.preventDefault();
                  const transferExerciseId = event.dataTransfer.getData("text/plain");
                  if (transferExerciseId) addLine(transferExerciseId);
                }}
              >
                <EmptyState
                  icon="🏋️"
                  title="Dra inn eller trykk på øvelser"
                  description="Bygg økten nedenfor — rekkefølgen bestemmer flyten i øktmodus."
                  className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/70"
                />
              </div>
            ) : (
              <div className="mt-3 space-y-3">
                {lines.map((line, index) => {
                  const exercise = exercises.find((item) => item.id === line.exerciseId);
                  const isStretch = Boolean(exercise?.category && isHoldBasedExerciseCategory(exercise.category));
                  const dragActive = draggedLineKey === line.key;
                  const dragOver = dragOverLineKey === line.key && draggedLineKey !== line.key;
                  return (
                    <div
                      key={line.key}
                      draggable
                      onDragStart={() => setDraggedLineKey(line.key)}
                      onDragEnd={() => {
                        setDraggedLineKey(null);
                        setDragOverLineKey(null);
                      }}
                      onDragOver={(event) => {
                        event.preventDefault();
                        setDragOverLineKey(line.key);
                      }}
                      onDrop={(event) => {
                        event.preventDefault();
                        const transferExerciseId = event.dataTransfer.getData("text/plain");
                        if (transferExerciseId && exercises.some((item) => item.id === transferExerciseId)) {
                          addLine(transferExerciseId);
                        } else if (draggedLineKey && lines.some((item) => item.key === draggedLineKey)) {
                          setLines((previous) => reorderCustomWorkoutLines(previous, draggedLineKey, line.key));
                        }
                        setDraggedLineKey(null);
                        setDragOverLineKey(null);
                      }}
                      className={`motus-custom-workout-line rounded-2xl border bg-white p-2.5 shadow-sm transition sm:p-3 ${
                        dragActive ? "opacity-60" : ""
                      } ${dragOver ? "border-teal-300 ring-2 ring-teal-100" : ""}`}
                      style={{ borderColor: dragOver ? undefined : "rgba(15,23,42,0.1)" }}
                    >
                      <div className="flex min-w-0 items-start gap-2 sm:gap-3">
                        <button
                          type="button"
                          className="mt-0.5 shrink-0 cursor-grab text-slate-400 active:cursor-grabbing sm:mt-1"
                          aria-label={`Flytt øvelse ${index + 1}`}
                        >
                          <GripVertical className="h-5 w-5" />
                        </button>
                        {exercise ? (
                          <img
                            src={resolveExerciseImageSrc(exercise)}
                            alt=""
                            className={`${EXERCISE_IMAGE_SMALL_CLASS} shrink-0 rounded-xl sm:h-20 sm:w-20 sm:max-h-20 sm:max-w-20`}
                            style={{ borderColor: exerciseCategoryAccentColor(exercise.category) }}
                          />
                        ) : null}
                        <div className="min-w-0 flex-1">
                          <div className="flex min-w-0 items-start justify-between gap-2">
                            <div className="min-w-0">
                              <div className="truncate font-semibold text-slate-900">{exercise?.name ?? "Ukjent øvelse"}</div>
                              {exercise ? <MuscleGroupChips group={exercise.group} /> : null}
                            </div>
                            <button
                              type="button"
                              onClick={() => removeLine(line.key)}
                              className="shrink-0 rounded-lg p-1.5 text-slate-400 transition hover:bg-rose-50 hover:text-rose-600"
                              aria-label="Fjern øvelse"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                          <div
                            className={`motus-custom-workout-input-grid mt-3 ${
                              isStretch ? "motus-custom-workout-input-grid--two" : "motus-custom-workout-input-grid--three"
                            }`}
                          >
                            <label className="min-w-0 space-y-1">
                              <span className="text-[11px] font-semibold text-slate-600">Sett</span>
                              <TextInput value={line.sets} onChange={(event) => updateLine(line.key, { sets: event.target.value })} placeholder="3" />
                            </label>
                            {!isStretch ? (
                              <label className="min-w-0 space-y-1">
                                <span className="text-[11px] font-semibold text-slate-600">Reps</span>
                                <TextInput value={line.reps} onChange={(event) => updateLine(line.key, { reps: event.target.value })} placeholder="10" />
                              </label>
                            ) : null}
                            <label className="min-w-0 space-y-1">
                              <span className="text-[11px] font-semibold text-slate-600">{isStretch ? "Sek. (hold)" : "kg"}</span>
                              <TextInput
                                value={isStretch ? (line.holdSeconds ?? "") : line.weight}
                                onChange={(event) =>
                                  updateLine(line.key, isStretch ? { holdSeconds: event.target.value } : { weight: event.target.value })
                                }
                                placeholder={isStretch ? "30" : "–"}
                              />
                            </label>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            <label className="mt-4 block w-full min-w-0 space-y-1">
              <span className="text-[11px] font-semibold text-slate-600">Programnavn (ved lagring)</span>
              <TextInput value={programTitle} onChange={(event) => setProgramTitle(event.target.value)} placeholder="Mitt treningsprogram" />
            </label>
            <div className="mt-3 w-full min-w-0">
              <ProgramCoverImageField
                imageUrl={programFormImageUrl}
                onImageUrlChange={(url, options) => {
                  setProgramFormImageUrl(url);
                  if (options?.removed) setProgramCoverCleared(true);
                  else if (url.trim()) setProgramCoverCleared(false);
                }}
                onUploadFile={handleProgramImageUpload}
                isUploading={isUploadingProgramImage}
              />
            </div>
            <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
              <GradientButton onClick={handleStart} disabled={!lines.length || !activeMemberId.trim()} className="w-full sm:w-auto">
                {lines.length ? `Start egen økt (${lines.length})` : "Legg til øvelser for å starte"}
              </GradientButton>
              <OutlineButton type="button" onClick={handleSave} disabled={!lines.length || !activeMemberId.trim()} className="w-full sm:w-auto">
                {editingProgram ? "Lagre endringer" : "Lagre som treningsprogram"}
              </OutlineButton>
            </div>
            {saveStatus ? <StatusMessage message={saveStatus} tone="success" className="mt-2 !rounded-xl !px-3 !py-2 !text-xs" /> : null}
          </div>

          {recommendedExercises.length ? (
            <div>
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Anbefalt for deg</div>
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                {recommendedExercises.slice(0, 4).map((exercise) => (
                  <ExerciseBankListCard
                    key={`rec-${exercise.id}`}
                    exercise={exercise}
                    compact
                    added={draftExerciseIds.has(exercise.id)}
                    popularity={exercisePopularityScores.get(exercise.id) ?? 0}
                    isTrainerProgram={trainerProgramExerciseIds.has(exercise.id)}
                    onToggleFavorite={() => toggleFavorite(exercise.id)}
                    onAdd={() => addLine(exercise.id)}
                  />
                ))}
              </div>
            </div>
          ) : null}
        </div>

        <div className="motus-custom-workout-panel min-w-0 space-y-5">
          <div className="motus-card bg-[#F7F8FA] p-4">
            <div className="motus-section-label text-teal-700">Live forhåndsvisning</div>
            <div className="mt-2 text-2xl font-bold text-slate-950">{preview.exerciseCount || 0} øvelser</div>
            <div className="mt-1 text-sm text-slate-600">{preview.totalSets || 0} sett planlagt</div>
            {preview.muscleGroups.length ? (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {preview.muscleGroups.map((group) => (
                  <span key={group} className="rounded-full bg-white px-2.5 py-1 text-[11px] font-medium text-slate-700 ring-1 ring-slate-200/80">
                    {group}
                  </span>
                ))}
              </div>
            ) : (
              <p className="mt-3 text-sm text-slate-500">Muskelgrupper vises her når du legger til øvelser.</p>
            )}
            {lines.length ? (
              <ol className="mt-4 space-y-1 border-t border-white/10 pt-3 text-sm text-slate-200">
                {lines.map((line, index) => {
                  const exercise = exercises.find((item) => item.id === line.exerciseId);
                  return (
                    <li key={line.key}>
                      {index + 1}. {exercise?.name ?? "Øvelse"}
                    </li>
                  );
                })}
              </ol>
            ) : null}
          </div>

          <div>
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Øvelsesbank</div>
            <div className="relative mt-3">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden />
              <TextInput value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Søk etter øvelse…" className="pl-10" />
            </div>

            <div className="motus-custom-workout-filters mt-3">
              <PillButton active={favoritesOnly} onClick={() => setFavoritesOnly((previous) => !previous)}>
                ★ Favoritter
              </PillButton>
              <PillButton active={categoryFilter === "all"} onClick={() => setCategoryFilter("all")}>
                Alle
              </PillButton>
              {categories.map((category) => (
                <PillButton key={category} active={categoryFilter === category} onClick={() => setCategoryFilter(category)}>
                  {category}
                </PillButton>
              ))}
            </div>

            {muscleGroups.length ? (
              <div className="motus-custom-workout-filters mt-2">
                <PillButton active={muscleFilter === "all"} onClick={() => setMuscleFilter("all")}>
                  Alle muskler
                </PillButton>
                {muscleGroups.slice(0, 8).map((group) => (
                  <PillButton key={group} active={muscleFilter === group} onClick={() => setMuscleFilter(group)}>
                    {group}
                  </PillButton>
                ))}
              </div>
            ) : null}

            {exercises.length === 0 ? (
              <div className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 px-3 py-3 text-sm text-amber-900">
                Øvelsesbanken er tom. Oppdater siden eller kontakt treneren din.
              </div>
            ) : (
              <div className="mt-3 max-h-[min(52vh,420px)] space-y-2 overflow-y-auto pr-1">
                {bankVisible.map((exercise) => (
                  <ExerciseBankListCard
                    key={exercise.id}
                    exercise={exercise}
                    added={draftExerciseIds.has(exercise.id)}
                    popularity={exercisePopularityScores.get(exercise.id) ?? 0}
                    isFavorite={favoriteExerciseIds.includes(exercise.id)}
                    isTrainerProgram={trainerProgramExerciseIds.has(exercise.id)}
                    onToggleFavorite={() => toggleFavorite(exercise.id)}
                    onAdd={() => addLine(exercise.id)}
                    draggable
                    onDragStart={() => setDraggedLineKey(`bank:${exercise.id}`)}
                  />
                ))}
              </div>
            )}

            {!search.trim() && !showAllBank && bankOverflow > 0 ? (
              <OutlineButton type="button" onClick={() => setShowAllBank(true)} className="mt-3 w-full sm:w-auto">
                Vis alle ({bankSorted.length})
              </OutlineButton>
            ) : null}
          </div>
        </div>
      </div>
    </Card>
  );
}
