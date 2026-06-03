import { useEffect, useRef, useState } from "react";
import { Check, Minus, Plus, Trash2, Trophy } from "lucide-react";
import { motusHaptic } from "../app/haptics";
import { isHoldBasedExerciseCategory } from "../app/exerciseCategories";
import {
  formatWorkoutPlannedLoadDisplay,
  formatWorkoutPlannedRepsDisplay,
  resolveWorkoutLoadUnit,
  resolveWorkoutRepsUnit,
} from "../app/workoutResultUnits";
import { GradientButton, TextInput } from "../app/ui";
import type { Exercise, WorkoutModeState } from "../app/types";

export type WorkoutSetRow = WorkoutModeState["results"][number];

type UpdateField =
  | "performedWeight"
  | "performedReps"
  | "performedDurationMinutes"
  | "performedSpeed"
  | "performedIncline"
  | "performedLoadUnit"
  | "completed";

type LastSessionEntry = {
  weight?: string;
  reps?: string;
  durationMinutes?: string;
  speed?: string;
  incline?: string;
};

type WorkoutCompactSetTableProps = {
  rows: WorkoutSetRow[];
  exerciseByName: Map<string, Exercise>;
  exerciseLabel?: string;
  /** Full planlinje (samme format som programforhåndsvisning). */
  planHint?: string;
  showExerciseColumn?: boolean;
  onUpdate: (exerciseId: string, field: UpdateField, value: string | boolean) => void;
  /** Beste poengsum (vekt × max(reps, 1)) per øvelse fra tidligere fullførte logger. Brukes til å vise «Ny rekord!» når et sett slår tidligere historikk. */
  previousPersonalBests?: Map<string, number>;
  /** Kalles når et sett markeres som fullført og slår tidligere rekord. */
  onSetPersonalRecord?: (exerciseName: string) => void;
  /** Siste utførte sett per øvelse (lowercase navn) og settnummer. Brukes til å vise «siste gang»-verdier i grått. */
  lastSessionByExercise?: Map<string, Map<number, LastSessionEntry>>;
  /** Vis søppelkasse på siste sett-rad (ekstra sett lagt til under økta). */
  showRemoveLastSet?: boolean;
  onRemoveLastSet?: () => void;
};

const PR_BADGE_VISIBLE_MS = 4500;

function parseNumInput(value: string): number {
  const n = Number(String(value ?? "").replace(",", ".").trim());
  return Number.isFinite(n) ? n : 0;
}

function stepWeightValue(current: string, delta: number): string {
  const next = Math.max(0, Math.round((parseNumInput(current) + delta) * 10) / 10);
  if (next <= 0) return "";
  return Number.isInteger(next) ? String(next) : String(next);
}

function resolveRowKind(row: WorkoutSetRow, exerciseByName: Map<string, Exercise>) {
  const resolvedExercise = exerciseByName.get(row.exerciseName.trim().toLowerCase());
  const isCardio = (row.exerciseCategory ?? resolvedExercise?.category) === "Kondisjon";
  const holdCategory = row.exerciseCategory ?? resolvedExercise?.category;
  const isStretch = Boolean(holdCategory && isHoldBasedExerciseCategory(holdCategory));
  const isTreadmill = (row.exerciseEquipment ?? resolvedExercise?.equipment ?? "").toLowerCase().includes("tredem");
  const loadUnit = resolveWorkoutLoadUnit(row);
  const isStrengthSeconds = !isCardio && !isStretch && loadUnit === "sec";
  return { isCardio, isStretch, isTreadmill, loadUnit, isStrengthSeconds };
}

function SetCheckToggle({
  completed,
  onToggle,
  size = "md",
}: {
  completed: boolean;
  onToggle: () => void;
  size?: "md" | "sm";
}) {
  const dim = size === "sm" ? "h-8 w-8" : "h-9 w-9";
  const icon = size === "sm" ? "h-4 w-4" : "h-5 w-5";
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={completed ? "Sett fullført" : "Huk av sett som fullført"}
      aria-pressed={completed}
      className={`inline-flex shrink-0 items-center justify-center rounded-full border-2 transition ${dim} ${
        completed
          ? "motus-brand-fill border-[var(--motus-brand-border-strong)]"
          : "border-slate-200 bg-white text-transparent hover:border-teal-300"
      }`}
    >
      <Check className={icon} strokeWidth={3} aria-hidden />
    </button>
  );
}

function rowPersonalRecordScore(row: WorkoutSetRow): number {
  if (row.exerciseCategory && isHoldBasedExerciseCategory(row.exerciseCategory)) return 0;
  const weight = parseNumInput(row.performedWeight);
  const reps = parseNumInput(row.performedReps);
  if (weight <= 0 || reps <= 0) return 0;
  return weight * Math.max(reps, 1);
}

function normalizeExerciseKey(name: string): string {
  return name.trim().toLowerCase();
}

export function WorkoutCompactSetTable({
  rows,
  exerciseByName,
  exerciseLabel,
  planHint,
  showExerciseColumn = false,
  onUpdate,
  previousPersonalBests,
  onSetPersonalRecord,
  lastSessionByExercise,
  showRemoveLastSet = false,
  onRemoveLastSet,
}: WorkoutCompactSetTableProps) {
  function lookupLastSession(row: WorkoutSetRow): LastSessionEntry | null {
    if (!lastSessionByExercise) return null;
    const key = normalizeExerciseKey(row.exerciseName);
    const setMap = lastSessionByExercise.get(key);
    if (!setMap) return null;
    const setNumber = row.setNumber ?? row.blockRound ?? 1;
    const exact = setMap.get(setNumber);
    if (exact) return exact;
    // Fallback: any entry from last session (use first available set), so user always sees previous data even if set numbers differ.
    const first = setMap.values().next();
    return first.done ? null : first.value;
  }

  function lastWeightFor(row: WorkoutSetRow): string | undefined {
    const entry = lookupLastSession(row);
    return entry?.weight?.trim() ? entry.weight : undefined;
  }

  function lastRepsFor(row: WorkoutSetRow): string | undefined {
    const entry = lookupLastSession(row);
    return entry?.reps?.trim() ? entry.reps : undefined;
  }

  function lastDurationFor(row: WorkoutSetRow): string | undefined {
    const entry = lookupLastSession(row);
    return entry?.durationMinutes?.trim() ? entry.durationMinutes : undefined;
  }

  function lastSpeedFor(row: WorkoutSetRow): string | undefined {
    const entry = lookupLastSession(row);
    return entry?.speed?.trim() ? entry.speed : undefined;
  }
  const sessionBestRef = useRef<Map<string, number>>(new Map());
  const completedRowsRef = useRef<Set<string>>(new Set());
  const [prRows, setPrRows] = useState<Record<string, number>>({});

  useEffect(() => {
    const nextCompleted = new Set<string>();
    rows.forEach((row) => {
      if (!row.completed) return;
      nextCompleted.add(row.exerciseId);
      if (completedRowsRef.current.has(row.exerciseId)) return;
      const score = rowPersonalRecordScore(row);
      if (score <= 0) return;
      const key = normalizeExerciseKey(row.exerciseName);
      const historical = previousPersonalBests?.get(key) ?? 0;
      const sessionBest = sessionBestRef.current.get(key) ?? 0;
      const previous = Math.max(historical, sessionBest);
      if (score > previous) {
        sessionBestRef.current.set(key, score);
        const expireAt = Date.now() + PR_BADGE_VISIBLE_MS;
        setPrRows((prev) => ({ ...prev, [row.exerciseId]: expireAt }));
        try {
          motusHaptic("success");
        } catch {
          // haptic optional
        }
        onSetPersonalRecord?.(row.exerciseName);
      }
    });
    completedRowsRef.current = nextCompleted;
  }, [rows, previousPersonalBests, onSetPersonalRecord]);

  useEffect(() => {
    if (Object.keys(prRows).length === 0) return;
    const earliest = Math.min(...Object.values(prRows));
    const delay = Math.max(0, earliest - Date.now());
    const timer = window.setTimeout(() => {
      const now = Date.now();
      setPrRows((prev) => {
        const next: Record<string, number> = {};
        for (const [key, value] of Object.entries(prev)) {
          if (value > now) next[key] = value;
        }
        return next;
      });
    }, delay + 60);
    return () => window.clearTimeout(timer);
  }, [prRows]);

  if (!rows.length) return null;

  const activeIndex = rows.findIndex((row) => !row.completed);
  const firstRow = rows[0]!;
  const { isCardio, isStretch, isTreadmill, isStrengthSeconds } = resolveRowKind(firstRow, exerciseByName);
  const repsUnitLabel = resolveWorkoutRepsUnit(firstRow) === "min" ? "MIN" : "REPS";
  const loadUnitLabel = isStretch || isStrengthSeconds ? "SEK" : "KG";
  const col3Label = isCardio ? (isTreadmill ? "FART" : "MIN") : `VEKT (${loadUnitLabel})`;
  const removeCol = showRemoveLastSet && onRemoveLastSet ? "2.25rem" : "";
  const gridCols = showExerciseColumn
    ? isCardio && isTreadmill
      ? `minmax(0,1.2fr) 2.5rem 1fr 1fr 1fr 2.5rem${removeCol ? ` ${removeCol}` : ""}`
      : `minmax(0,1.2fr) 2.5rem 1fr 1fr 2.5rem${removeCol ? ` ${removeCol}` : ""}`
    : isCardio && isTreadmill
      ? `2.5rem 1fr 1fr 1fr 2.5rem${removeCol ? ` ${removeCol}` : ""}`
      : `2.5rem 1fr 1fr 2.5rem${removeCol ? ` ${removeCol}` : ""}`;

  function handleInputChange(row: WorkoutSetRow, field: Exclude<UpdateField, "completed">, value: string) {
    onUpdate(row.exerciseId, field, value);
  }

  function tryCompleteSet(row: WorkoutSetRow) {
    if (!row.completed && rowIsLoggable(row)) {
      motusHaptic("success");
      onUpdate(row.exerciseId, "completed", true);
    }
  }

  function focusWeightInput(exerciseId: string) {
    const el = document.querySelector<HTMLInputElement>(`[data-workout-weight="${exerciseId}"]`);
    el?.focus();
    el?.select();
  }

  function handleRepsFieldKeyDown(row: WorkoutSetRow, event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key !== "Enter") return;
    event.preventDefault();
    focusWeightInput(row.exerciseId);
  }

  function handleWeightFieldKeyDown(row: WorkoutSetRow, event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key !== "Enter") return;
    event.preventDefault();
    tryCompleteSet(row);
  }

  function rowIsLoggable(row: WorkoutSetRow): boolean {
    const { isCardio: cardio, isStretch: stretch, isTreadmill: treadmill, isStrengthSeconds } = resolveRowKind(row, exerciseByName);
    if (cardio) {
      const duration = (row.performedDurationMinutes ?? "").trim();
      const speed = (row.performedSpeed ?? "").trim();
      return Number(duration) > 0 && (!treadmill || Number(speed) > 0);
    }
    if (isStrengthSeconds) return Number(row.performedWeight.trim()) > 0;
    if (stretch) return Number(row.performedWeight.trim()) > 0;
    return Number(row.performedWeight.trim()) > 0 && Number(row.performedReps.trim()) > 0;
  }

  function renderActiveSetControls(row: WorkoutSetRow) {
    const { isCardio: cardio, isStretch: stretch, isTreadmill: treadmill, isStrengthSeconds } = resolveRowKind(row, exerciseByName);
    const activeLastWeight = lastWeightFor(row);
    const activeLastDuration = lastDurationFor(row);
    const activeLastSpeed = lastSpeedFor(row);
    const activeWeightPlaceholder = activeLastWeight || row.plannedWeight || "0";
    const activeDurationPlaceholder = activeLastDuration || row.plannedDurationMinutes || "Min";
    const activeSpeedPlaceholder = activeLastSpeed || row.plannedSpeed || "km/t";

    if (cardio) {
      return (
        <div className="mt-2 space-y-1.5 rounded-lg border border-pink-200 bg-white p-2 sm:mt-3 sm:space-y-2 sm:rounded-xl sm:p-3">
          <div className={`grid gap-2 ${treadmill ? "grid-cols-3" : "grid-cols-1"}`}>
            <TextInput
              value={row.performedDurationMinutes ?? ""}
              onChange={(e) => handleInputChange(row, "performedDurationMinutes", e.target.value)}
              placeholder={activeDurationPlaceholder}
              className="h-10 text-center text-sm"
              aria-label="Minutter"
            />
            {treadmill ? (
              <>
                <TextInput
                  value={row.performedSpeed ?? ""}
                  onChange={(e) => handleInputChange(row, "performedSpeed", e.target.value)}
                  placeholder={activeSpeedPlaceholder}
                  className="h-10 text-center text-sm"
                  aria-label="Fart"
                />
                <TextInput
                  value={row.performedIncline ?? ""}
                  onChange={(e) => handleInputChange(row, "performedIncline", e.target.value)}
                  placeholder="Incline"
                  className="h-10 text-center text-sm"
                  aria-label="Stigning"
                />
              </>
            ) : null}
          </div>
          <div className="flex items-center gap-2">
            <GradientButton
              type="button"
              className="flex-1"
              onClick={() => {
                if (rowIsLoggable(row) && !row.completed) onUpdate(row.exerciseId, "completed", true);
              }}
            >
              Lagre sett
            </GradientButton>
            <SetCheckToggle
              completed={row.completed}
              onToggle={() => onUpdate(row.exerciseId, "completed", !row.completed)}
            />
          </div>
        </div>
      );
    }

    const step = stretch || isStrengthSeconds ? 5 : 2.5;
    return (
      <div className="mt-2 space-y-1.5 rounded-lg border border-pink-200 bg-white p-2 sm:mt-3 sm:space-y-2 sm:rounded-xl sm:p-3">
        {!stretch ? (
          <div className="grid gap-1">
            <label className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Måleenhet</label>
            <select
              value={isStrengthSeconds ? "sec" : "kg"}
              onChange={(event) => {
                const next = event.target.value === "sec" ? "sec" : "kg";
                onUpdate(row.exerciseId, "performedLoadUnit", next);
              }}
              className="h-9 rounded-lg border border-slate-200 bg-white px-2 text-xs font-semibold text-slate-700"
              aria-label="Velg måleenhet"
            >
              <option value="kg">Kg</option>
              <option value="sec">Sekunder</option>
            </select>
          </div>
        ) : null}
        <div className="flex items-center justify-center gap-3">
          <button
            type="button"
            onClick={() => handleInputChange(row, "performedWeight", stepWeightValue(row.performedWeight, -step))}
            className="inline-flex h-10 w-10 items-center justify-center rounded-lg border bg-slate-50"
            style={{ borderColor: "rgba(15,23,42,0.12)" }}
            aria-label={stretch || isStrengthSeconds ? "Trekk fra 5 sek" : "Trekk fra 2,5 kg"}
          >
            <Minus className="h-4 w-4" aria-hidden />
          </button>
          <TextInput
            value={row.performedWeight}
            onChange={(e) => handleInputChange(row, "performedWeight", e.target.value)}
            onFocus={(event) => event.currentTarget.select()}
            onKeyDown={(e) => handleWeightFieldKeyDown(row, e)}
            enterKeyHint="done"
            data-workout-weight={row.exerciseId}
            placeholder={activeWeightPlaceholder}
            className="h-10 w-20 text-center text-lg font-semibold"
            aria-label={stretch || isStrengthSeconds ? "Sekunder" : "Kg"}
          />
          <button
            type="button"
            onClick={() => handleInputChange(row, "performedWeight", stepWeightValue(row.performedWeight, step))}
            className="inline-flex h-10 w-10 items-center justify-center rounded-lg border bg-slate-50"
            style={{ borderColor: "rgba(15,23,42,0.12)" }}
            aria-label={stretch || isStrengthSeconds ? "Legg til 5 sek" : "Legg til 2,5 kg"}
          >
            <Plus className="h-4 w-4" aria-hidden />
          </button>
        </div>
        <div className="flex items-center gap-2">
          <GradientButton
            type="button"
            className="flex-1"
            onClick={() => {
              if (rowIsLoggable(row) && !row.completed) onUpdate(row.exerciseId, "completed", true);
            }}
          >
            Lagre sett
          </GradientButton>
          <SetCheckToggle
            completed={row.completed}
            onToggle={() => onUpdate(row.exerciseId, "completed", !row.completed)}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-0">
      {exerciseLabel ? <div className="mb-2 text-xs font-semibold text-slate-700">{exerciseLabel}</div> : null}
      {planHint ? <div className="mb-2 text-[11px] leading-snug text-slate-500">Plan: {planHint}</div> : null}
      <div className="overflow-hidden rounded-xl border bg-white" style={{ borderColor: "rgba(15,23,42,0.08)" }}>
        <div
          className="grid items-center gap-1.5 border-b px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-400 sm:gap-2 sm:px-3 sm:py-2"
          style={{ borderColor: "rgba(15,23,42,0.06)", gridTemplateColumns: gridCols }}
        >
          {showExerciseColumn ? <span>Øvelse</span> : null}
          <span>Sett</span>
          <span className="text-center">{isCardio ? "PLAN" : repsUnitLabel}</span>
          {isCardio && isTreadmill ? <span className="text-center">Km/t</span> : null}
          <span className="text-center">{col3Label}</span>
          <span className="sr-only">Fullført</span>
          {removeCol ? <span className="sr-only">Fjern</span> : null}
        </div>
        {rows.map((row, index) => {
          const isActive = index === activeIndex;
          const isFuture = activeIndex >= 0 && index > activeIndex;
          const isDone = row.completed;
          const isLastRow = index === rows.length - 1;
          const showRowRemove = Boolean(showRemoveLastSet && onRemoveLastSet && isLastRow);
          const isPr = Boolean(prRows[row.exerciseId]);
          const { isStrengthSeconds: rowStrengthSeconds, isStretch: rowStretch, isCardio: rowCardio } = resolveRowKind(
            row,
            exerciseByName,
          );
          const rowRepsUnit = resolveWorkoutRepsUnit(row);
          const rowLoadUnit = resolveWorkoutLoadUnit(row);
          const lastWeight = lastWeightFor(row);
          const lastReps = lastRepsFor(row);
          const lastDuration = lastDurationFor(row);
          const lastSpeed = lastSpeedFor(row);
          // Last-session values override programmed plan as the inactive/placeholder hint.
          const repsFallback = lastReps || row.plannedReps || "";
          const weightFallback = lastWeight || row.plannedWeight || "";
          const durationFallback = lastDuration || row.plannedDurationMinutes || "";
          const speedFallback = lastSpeed || row.plannedSpeed || "";
          const plannedRepsDisplay = formatWorkoutPlannedRepsDisplay(row);
          const plannedLoadDisplay = formatWorkoutPlannedLoadDisplay(row, { isCardio: rowCardio });
          const displayRepsRaw = isDone
            ? row.performedReps || repsFallback || "—"
            : isFuture
              ? plannedRepsDisplay
              : row.performedReps || repsFallback || "";
          const displayReps =
            !isFuture && rowRepsUnit === "min" && displayRepsRaw && displayRepsRaw !== "—"
              ? `${displayRepsRaw} min`
              : displayRepsRaw;
          const performedLoadRaw = row.performedWeight.trim();
          const performedLoadDisplay =
            performedLoadRaw && rowLoadUnit === "sec"
              ? `${performedLoadRaw} sek`
              : performedLoadRaw
                ? `${performedLoadRaw} kg`
                : "—";
          const displayWeight = isDone
            ? rowCardio
              ? row.performedDurationMinutes?.trim()
                ? `${row.performedDurationMinutes} min`
                : durationFallback
                  ? `${durationFallback} min`
                  : "—"
              : performedLoadDisplay
            : isFuture
              ? plannedLoadDisplay
              : rowCardio
                ? row.performedDurationMinutes || durationFallback || ""
                : row.performedWeight || weightFallback || "";
          const displaySpeed =
            isCardio && isTreadmill
              ? isDone
                ? row.performedSpeed || speedFallback || "—"
                : isFuture
                  ? speedFallback || "—"
                  : row.performedSpeed || speedFallback || ""
              : "";

          return (
            <div
              key={row.exerciseId}
              className={`relative grid items-center gap-1.5 border-b px-2 py-1.5 last:border-b-0 sm:gap-2 sm:px-3 sm:py-2 ${
                isActive ? "bg-pink-50/40 ring-1 ring-inset ring-pink-200" : ""
              } ${isFuture ? "opacity-55" : ""} ${isDone ? "motus-set-complete" : ""} ${isPr ? "motus-set-pr" : ""}`}
              style={{ borderColor: "rgba(15,23,42,0.06)", gridTemplateColumns: gridCols }}
            >
              {isPr ? (
                <span className="motus-set-pr-badge" role="status" aria-live="polite">
                  <Trophy className="h-3 w-3" strokeWidth={2.75} aria-hidden />
                  Ny rekord!
                </span>
              ) : null}
              {showExerciseColumn ? (
                <span className={`truncate text-xs font-medium ${isDone ? "text-slate-900" : "text-slate-500"}`}>
                  {row.exerciseName}
                </span>
              ) : null}
              <span className={`text-sm font-semibold ${isDone ? "text-slate-900" : "text-slate-500"}`}>
                {row.setNumber ?? row.blockRound ?? index + 1}
              </span>
              {isActive && !isCardio && !rowStrengthSeconds ? (
                <TextInput
                  value={row.performedReps}
                  onChange={(e) => handleInputChange(row, "performedReps", e.target.value)}
                  onFocus={(event) => event.currentTarget.select()}
                  onKeyDown={(e) => handleRepsFieldKeyDown(row, e)}
                  enterKeyHint="next"
                  placeholder={repsFallback || "0"}
                  className="h-9 text-center text-sm"
                  aria-label={rowRepsUnit === "min" ? "Minutter" : "Reps"}
                />
              ) : (
                <span className={`text-center text-sm font-medium ${isDone ? "text-slate-900" : "text-slate-400"}`}>
                  {rowCardio ? plannedLoadDisplay : rowStrengthSeconds ? "—" : displayReps}
                </span>
              )}
              {isCardio && isTreadmill ? (
                isActive ? (
                  <TextInput
                    value={row.performedSpeed ?? ""}
                    onChange={(e) => handleInputChange(row, "performedSpeed", e.target.value)}
                    placeholder={speedFallback || "0"}
                    className="h-9 text-center text-sm"
                    aria-label="Fart"
                  />
                ) : (
                  <span className={`text-center text-sm font-medium ${isDone ? "text-slate-900" : "text-slate-400"}`}>
                    {displaySpeed}
                  </span>
                )
              ) : null}
              {isActive && isCardio ? (
                <TextInput
                  value={row.performedDurationMinutes ?? ""}
                  onChange={(e) => handleInputChange(row, "performedDurationMinutes", e.target.value)}
                  placeholder={durationFallback || "0"}
                  className="h-9 text-center text-sm"
                  aria-label="Minutter"
                />
              ) : isActive && !isCardio ? (
                <TextInput
                  value={row.performedWeight}
                  onChange={(e) => handleInputChange(row, "performedWeight", e.target.value)}
                  onFocus={(event) => event.currentTarget.select()}
                  onKeyDown={(e) => handleWeightFieldKeyDown(row, e)}
                  enterKeyHint="done"
                  data-workout-weight={row.exerciseId}
                  placeholder={weightFallback || "0"}
                  className="h-9 text-center text-sm"
                  aria-label={rowStretch || rowStrengthSeconds || rowLoadUnit === "sec" ? "Sekunder" : "Kg"}
                />
              ) : (
                <span className={`text-center text-sm font-medium ${isDone ? "text-slate-900" : "text-slate-400"}`}>
                  {displayWeight}
                </span>
              )}
              <SetCheckToggle
                size="sm"
                completed={row.completed}
                onToggle={() => {
                  const nextCompleted = !row.completed;
                  if (nextCompleted) motusHaptic("success");
                  onUpdate(row.exerciseId, "completed", nextCompleted);
                }}
              />
              {showRowRemove ? (
                <button
                  type="button"
                  onClick={onRemoveLastSet}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 transition hover:bg-rose-50 hover:text-rose-700"
                  aria-label="Fjern siste ekstra sett"
                  title="Fjern siste sett"
                >
                  <Trash2 className="h-4 w-4" aria-hidden />
                </button>
              ) : removeCol ? (
                <span aria-hidden />
              ) : null}
            </div>
          );
        })}
      </div>
      {activeIndex >= 0 ? renderActiveSetControls(rows[activeIndex]!) : null}
    </div>
  );
}
