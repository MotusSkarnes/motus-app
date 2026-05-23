import { Check, Minus, Plus } from "lucide-react";
import { motusHaptic } from "../app/haptics";
import { isHoldBasedExerciseCategory } from "../app/exerciseCategories";
import { GradientButton, TextInput } from "../app/ui";
import type { Exercise, WorkoutModeState } from "../app/types";

export type WorkoutSetRow = WorkoutModeState["results"][number];

type UpdateField =
  | "performedWeight"
  | "performedReps"
  | "performedDurationMinutes"
  | "performedSpeed"
  | "performedIncline"
  | "completed";

type WorkoutCompactSetTableProps = {
  rows: WorkoutSetRow[];
  exerciseByName: Map<string, Exercise>;
  exerciseLabel?: string;
  showExerciseColumn?: boolean;
  onUpdate: (exerciseId: string, field: UpdateField, value: string | boolean) => void;
};

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
  return { isCardio, isStretch, isTreadmill };
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
          ? "border-teal-400 bg-teal-400 text-white"
          : "border-slate-200 bg-white text-transparent hover:border-teal-300"
      }`}
    >
      <Check className={icon} strokeWidth={3} aria-hidden />
    </button>
  );
}

export function WorkoutCompactSetTable({
  rows,
  exerciseByName,
  exerciseLabel,
  showExerciseColumn = false,
  onUpdate,
}: WorkoutCompactSetTableProps) {
  if (!rows.length) return null;

  const activeIndex = rows.findIndex((row) => !row.completed);
  const firstRow = rows[0]!;
  const { isCardio, isStretch, isTreadmill } = resolveRowKind(firstRow, exerciseByName);
  const col3Label = isCardio ? (isTreadmill ? "FART" : "MIN") : isStretch ? "SEK" : "VEKT (KG)";
  const gridCols = showExerciseColumn
    ? isCardio && isTreadmill
      ? "minmax(0,1.2fr) 2.5rem 1fr 1fr 1fr 2.5rem"
      : "minmax(0,1.2fr) 2.5rem 1fr 1fr 2.5rem"
    : isCardio && isTreadmill
      ? "2.5rem 1fr 1fr 1fr 2.5rem"
      : "2.5rem 1fr 1fr 2.5rem";

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
    const { isCardio: cardio, isStretch: stretch, isTreadmill: treadmill } = resolveRowKind(row, exerciseByName);
    if (cardio) {
      const duration = (row.performedDurationMinutes ?? "").trim();
      const speed = (row.performedSpeed ?? "").trim();
      return Number(duration) > 0 && (!treadmill || Number(speed) > 0);
    }
    if (stretch) return Number(row.performedWeight.trim()) > 0;
    return Number(row.performedWeight.trim()) > 0 && Number(row.performedReps.trim()) > 0;
  }

  function renderActiveSetControls(row: WorkoutSetRow) {
    const { isCardio: cardio, isStretch: stretch, isTreadmill: treadmill } = resolveRowKind(row, exerciseByName);

    if (cardio) {
      return (
        <div className="mt-2 space-y-1.5 rounded-lg border border-pink-200 bg-white p-2 sm:mt-3 sm:space-y-2 sm:rounded-xl sm:p-3">
          <div className={`grid gap-2 ${treadmill ? "grid-cols-3" : "grid-cols-1"}`}>
            <TextInput
              value={row.performedDurationMinutes ?? ""}
              onChange={(e) => handleInputChange(row, "performedDurationMinutes", e.target.value)}
              placeholder="Min"
              className="h-10 text-center text-sm"
              aria-label="Minutter"
            />
            {treadmill ? (
              <>
                <TextInput
                  value={row.performedSpeed ?? ""}
                  onChange={(e) => handleInputChange(row, "performedSpeed", e.target.value)}
                  placeholder="km/t"
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

    const step = stretch ? 5 : 2.5;
    return (
      <div className="mt-2 space-y-1.5 rounded-lg border border-pink-200 bg-white p-2 sm:mt-3 sm:space-y-2 sm:rounded-xl sm:p-3">
        <div className="flex items-center justify-center gap-3">
          <button
            type="button"
            onClick={() => handleInputChange(row, "performedWeight", stepWeightValue(row.performedWeight, -step))}
            className="inline-flex h-10 w-10 items-center justify-center rounded-lg border bg-slate-50"
            style={{ borderColor: "rgba(15,23,42,0.12)" }}
            aria-label={stretch ? "Trekk fra 5 sek" : "Trekk fra 2,5 kg"}
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
            placeholder="0"
            className="h-10 w-20 text-center text-lg font-semibold"
            aria-label={stretch ? "Sekunder" : "Kg"}
          />
          <button
            type="button"
            onClick={() => handleInputChange(row, "performedWeight", stepWeightValue(row.performedWeight, step))}
            className="inline-flex h-10 w-10 items-center justify-center rounded-lg border bg-slate-50"
            style={{ borderColor: "rgba(15,23,42,0.12)" }}
            aria-label={stretch ? "Legg til 5 sek" : "Legg til 2,5 kg"}
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
      <div className="overflow-hidden rounded-xl border bg-white" style={{ borderColor: "rgba(15,23,42,0.08)" }}>
        <div
          className="grid items-center gap-1.5 border-b px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-400 sm:gap-2 sm:px-3 sm:py-2"
          style={{ borderColor: "rgba(15,23,42,0.06)", gridTemplateColumns: gridCols }}
        >
          {showExerciseColumn ? <span>Øvelse</span> : null}
          <span>Sett</span>
          <span className="text-center">{isCardio ? "PLAN" : "Reps"}</span>
          {isCardio && isTreadmill ? <span className="text-center">Km/t</span> : null}
          <span className="text-center">{col3Label}</span>
          <span className="sr-only">Fullført</span>
        </div>
        {rows.map((row, index) => {
          const isActive = index === activeIndex;
          const isFuture = activeIndex >= 0 && index > activeIndex;
          const isDone = row.completed;
          const displayReps = isDone
            ? row.performedReps || row.plannedReps || "—"
            : isFuture
              ? row.plannedReps || "—"
              : row.performedReps || row.plannedReps || "";
          const displayWeight = isDone
            ? isCardio
              ? row.performedDurationMinutes || row.plannedDurationMinutes || "—"
              : row.performedWeight || row.plannedWeight || "—"
            : isFuture
              ? isCardio
                ? row.plannedDurationMinutes || "—"
                : row.plannedWeight || "—"
              : isCardio
                ? row.performedDurationMinutes || row.plannedDurationMinutes || ""
                : row.performedWeight || row.plannedWeight || "";
          const displaySpeed =
            isCardio && isTreadmill
              ? isDone
                ? row.performedSpeed || row.plannedSpeed || "—"
                : isFuture
                  ? row.plannedSpeed || "—"
                  : row.performedSpeed || row.plannedSpeed || ""
              : "";

          return (
            <div
              key={row.exerciseId}
              className={`grid items-center gap-1.5 border-b px-2 py-1.5 last:border-b-0 sm:gap-2 sm:px-3 sm:py-2 ${
                isActive ? "bg-pink-50/40 ring-1 ring-inset ring-pink-200" : ""
              } ${isFuture ? "opacity-55" : ""} ${isDone ? "motus-set-complete" : ""}`}
              style={{ borderColor: "rgba(15,23,42,0.06)", gridTemplateColumns: gridCols }}
            >
              {showExerciseColumn ? (
                <span className={`truncate text-xs font-medium ${isDone ? "text-slate-900" : "text-slate-500"}`}>
                  {row.exerciseName}
                </span>
              ) : null}
              <span className={`text-sm font-semibold ${isDone ? "text-slate-900" : "text-slate-500"}`}>
                {row.setNumber ?? row.blockRound ?? index + 1}
              </span>
              {isActive && !isCardio ? (
                <TextInput
                  value={row.performedReps}
                  onChange={(e) => handleInputChange(row, "performedReps", e.target.value)}
                  onFocus={(event) => event.currentTarget.select()}
                  onKeyDown={(e) => handleRepsFieldKeyDown(row, e)}
                  enterKeyHint="next"
                  placeholder={row.plannedReps || "0"}
                  className="h-9 text-center text-sm"
                  aria-label="Reps"
                />
              ) : (
                <span className={`text-center text-sm font-medium ${isDone ? "text-slate-900" : "text-slate-400"}`}>
                  {isCardio ? (row.plannedDurationMinutes ? `${row.plannedDurationMinutes} min` : "—") : displayReps}
                </span>
              )}
              {isCardio && isTreadmill ? (
                isActive ? (
                  <TextInput
                    value={row.performedSpeed ?? ""}
                    onChange={(e) => handleInputChange(row, "performedSpeed", e.target.value)}
                    placeholder={row.plannedSpeed || "0"}
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
                  placeholder={row.plannedDurationMinutes || "0"}
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
                  placeholder={row.plannedWeight || "0"}
                  className="h-9 text-center text-sm"
                  aria-label={isStretch ? "Sek" : "Kg"}
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
            </div>
          );
        })}
      </div>
      {activeIndex >= 0 ? renderActiveSetControls(rows[activeIndex]!) : null}
    </div>
  );
}
