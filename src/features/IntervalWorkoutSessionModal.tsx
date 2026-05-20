import { useEffect, useMemo, useState } from "react";
import { MOTUS } from "../app/data";
import { useDeadlineIntervalTimer } from "../app/useDeadlineIntervalTimer";
import { expandProgramExercisesToWorkoutResults, isLegacyIntervalCooldownDrag, parseProgramSetCount } from "../app/programBlocks";
import { GradientButton, OutlineButton, StatusMessage, TextArea, TextInput } from "../app/ui";
import type { Exercise, TrainingProgram, WorkoutExerciseResult, WorkoutReflection } from "../app/types";
import type { LogIntervalWorkoutInput } from "../services/appRepository";

type IntervalTimerStep = {
  headline: string;
  phaseBadge: string;
  afterExerciseName?: string;
  durationSeconds: number;
  speedHint: string;
  inclineHint: string;
  hrHint: string;
  tone: "warmup" | "work" | "rest" | "cooldown";
  sourceExerciseIndex?: number;
};

export type IntervalWorkoutSessionModalProps = {
  open: boolean;
  program: TrainingProgram | null;
  exercises: Exercise[];
  memberId: string;
  onClose: () => void;
  onSaved?: () => void;
  logIntervalWorkout: (input: LogIntervalWorkoutInput) => void;
};

function formatSeconds(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function formatIntervalTimerHrHint(targetHrPercent: string | undefined): string {
  const raw = String(targetHrPercent ?? "").trim();
  if (!raw) return "";
  if (/%|HF|hf|maks|makspuls|pul/i.test(raw)) return raw;
  return `${raw} % av makspuls`;
}

function computeIntervalPhaseBadge(tone: IntervalTimerStep["tone"], headlineForBadge: string): string {
  if (tone === "warmup") return "Oppvarming";
  if (tone === "cooldown") return "Nedjogg";
  if (tone === "rest") return "Pause";
  const lower = headlineForBadge.trim().toLowerCase();
  if (lower.startsWith("drag")) return "Drag";
  if (lower.includes("tempo")) return "Tempo";
  if (lower.includes("tabata")) return "Tabata";
  return "Intervall";
}

function intervalTimerBadgeToneClass(tone: IntervalTimerStep["tone"]): string {
  switch (tone) {
    case "warmup":
      return "bg-emerald-500/35 text-emerald-50 ring-1 ring-emerald-300/50";
    case "cooldown":
      return "bg-sky-500/35 text-sky-50 ring-1 ring-sky-300/45";
    case "rest":
      return "bg-amber-500/40 text-amber-950 ring-1 ring-amber-200/50";
    default:
      return "bg-white/20 text-white ring-1 ring-white/35";
  }
}

function parseIntervalSpeedKmHint(hint: string): string {
  const match = String(hint ?? "").match(/([\d]+(?:[.,]\d+)?)/);
  return match ? match[1].replace(",", ".") : "";
}

function parseIntervalInclinePercentHint(hint: string): string {
  const match = String(hint ?? "").match(/([\d]+(?:[.,]\d+)?)/);
  return match ? match[1].replace(",", ".") : "";
}

function intervalStepAllowsSpeedInclineEdit(step: IntervalTimerStep | null): boolean {
  if (!step || step.tone === "rest") return false;
  return step.speedHint !== "-" || step.inclineHint !== "-";
}

function isIntervalCooldownName(name: string): boolean {
  const lower = name.trim().toLowerCase();
  return lower.includes("nedjogg") || lower.includes("nedtrapp") || lower.includes("cooldown");
}

function getReflectionEmoji(level: 1 | 2 | 3 | 4 | 5): string {
  if (level <= 1) return "🥳";
  if (level === 2) return "🙂";
  if (level === 3) return "😌";
  if (level === 4) return "😮‍💨";
  return "🥵";
}

function buildIntervalProgramSteps(program: TrainingProgram): IntervalTimerStep[] {
  const programTitle = program.title;
  const steps: IntervalTimerStep[] = [];
  let workOrdinal = 0;
  let dragOrdinal = 0;
  let lastWorkHeadline = "";

  for (let index = 0; index < program.exercises.length; index++) {
    const exercise = program.exercises[index];
    const workDurationSeconds = Math.max(0, Math.round((Number(exercise.durationMinutes) || 0) * 60));
    const rawRestStr = String(exercise.restSeconds ?? "").trim();
    const rawRestParsed = rawRestStr === "" ? NaN : Number(rawRestStr);
    const rawRestValue = Number.isFinite(rawRestParsed) ? rawRestParsed : 0;
    const normalizedRestSeconds =
      rawRestValue > 0 && rawRestValue <= 15 ? Math.round(rawRestValue * 60) : Math.round(rawRestValue);

    const lowerName = exercise.exerciseName.toLowerCase();
    const isCooldown = isIntervalCooldownName(exercise.exerciseName) || isLegacyIntervalCooldownDrag(program.exercises, index);
    let tone: IntervalTimerStep["tone"] =
      lowerName.includes("oppvarm") ? "warmup" : isCooldown ? "cooldown" : "work";
    const nameImpliesExplicitWorkSegment =
      /\bdrag\b/i.test(exercise.exerciseName) || lowerName.includes("tempo") || lowerName.includes("tabata");
    if (index === 0 && tone === "work" && !nameImpliesExplicitWorkSegment) {
      tone = "warmup";
    }
    const isDragSlot =
      tone === "work" &&
      !lowerName.includes("tempo") &&
      !lowerName.includes("tabata") &&
      (/\bdrag\b/i.test(exercise.exerciseName) ||
        /\bintervall\b/i.test(exercise.exerciseName) ||
        /4x4/i.test(programTitle));
    const repeatCount = isDragSlot ? parseProgramSetCount(exercise.sets) : 1;

    if (workDurationSeconds > 0) {
      const isClassic4x4Drag = /4x4/i.test(programTitle) && /drag/i.test(exercise.exerciseName);
      const legacy4x4DragPauseSeconds = rawRestStr === "" && isClassic4x4Drag ? 180 : 0;
      const restDurationSeconds = normalizedRestSeconds > 0 ? normalizedRestSeconds : legacy4x4DragPauseSeconds;

      let headline: string;
      if (tone === "warmup") headline = "Oppvarming";
      else if (tone === "cooldown") headline = "Nedjogg";
      else if (tone === "work") {
        workOrdinal += 1;
        if (lowerName.includes("tabata")) headline = `Tabata ${workOrdinal}`;
        else if (lowerName.includes("tempo")) headline = `Tempo ${workOrdinal}`;
        else if (isDragSlot) headline = "Drag";
        else headline = `Intervall ${workOrdinal}`;
      } else headline = exercise.exerciseName.trim() || `Intervall ${index + 1}`;

      for (let repeatIndex = 1; repeatIndex <= repeatCount; repeatIndex += 1) {
        const repeatedHeadline =
          isDragSlot
            ? `Drag ${++dragOrdinal}`
            : repeatCount > 1 && tone === "work"
              ? `${headline} ${repeatIndex}`
              : headline;
        lastWorkHeadline = repeatedHeadline;
        steps.push({
          headline: repeatedHeadline,
          phaseBadge: computeIntervalPhaseBadge(tone, repeatedHeadline),
          durationSeconds: workDurationSeconds,
          speedHint: exercise.speed ? `${exercise.speed} km/t` : "-",
          inclineHint: exercise.incline ? `${exercise.incline}%` : "-",
          hrHint: formatIntervalTimerHrHint(exercise.targetHrPercent),
          tone,
          sourceExerciseIndex: index,
        });

        if (restDurationSeconds > 0 && repeatIndex < repeatCount) {
          steps.push({
            headline: "Pause",
            phaseBadge: "Pause",
            afterExerciseName: repeatedHeadline,
            durationSeconds: restDurationSeconds,
            speedHint: "Rolig",
            inclineHint: "0-1%",
            hrHint: "",
            tone: "rest",
          });
        }
      }
    }

    const hasNextStep = index < program.exercises.length - 1;
    const nextExerciseName = program.exercises[index + 1]?.exerciseName ?? "";
    const nextIsCooldown = isIntervalCooldownName(nextExerciseName) || isLegacyIntervalCooldownDrag(program.exercises, index + 1);
    const restAfterRow = normalizedRestSeconds > 0 && (!isDragSlot || repeatCount <= 1) && hasNextStep && !nextIsCooldown;
    if (restAfterRow) {
      const afterLabel = lastWorkHeadline || exercise.exerciseName.trim() || `Steg ${index + 1}`;
      steps.push({
        headline: "Pause",
        phaseBadge: "Pause",
        afterExerciseName: afterLabel,
        durationSeconds: normalizedRestSeconds,
        speedHint: "Rolig",
        inclineHint: "0-1%",
        hrHint: "",
        tone: "rest",
      });
    }
  }

  return steps;
}

function buildIntervalSessionResults(
  program: TrainingProgram,
  exercises: Exercise[],
  steps: IntervalTimerStep[],
  stepOverrides: Record<number, { speed: string; incline: string }>,
): WorkoutExerciseResult[] {
  const base = expandProgramExercisesToWorkoutResults(program.exercises, exercises);
  const overrideByExerciseIndex = new Map<number, { speed: string; incline: string }>();
  steps.forEach((step, stepIndex) => {
    if (step.sourceExerciseIndex === undefined) return;
    const override = stepOverrides[stepIndex];
    if (override) overrideByExerciseIndex.set(step.sourceExerciseIndex, override);
  });
  return base
    .map((row) => {
      const exerciseIndex = program.exercises.findIndex((item) => item.id === row.programExerciseId);
      const exercise = exerciseIndex >= 0 ? program.exercises[exerciseIndex] : null;
      const workMinutes = Number(exercise?.durationMinutes ?? row.plannedDurationMinutes ?? 0);
      if (workMinutes <= 0) return null;
      const override = exerciseIndex >= 0 ? overrideByExerciseIndex.get(exerciseIndex) : undefined;
      return {
        ...row,
        completed: true,
        performedDurationMinutes: String(workMinutes),
        performedSpeed: override?.speed?.trim() || row.plannedSpeed || "",
        performedIncline: override?.incline?.trim() || row.plannedIncline || "",
      };
    })
    .filter((row): row is WorkoutExerciseResult => row !== null);
}

export function IntervalWorkoutSessionModal({
  open,
  program,
  exercises,
  memberId,
  onClose,
  onSaved,
  logIntervalWorkout,
}: IntervalWorkoutSessionModalProps) {
  const intervalProgramSteps = useMemo(() => (program ? buildIntervalProgramSteps(program) : []), [program]);

  const [isRunning, setIsRunning] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [stepOverrides, setStepOverrides] = useState<Record<number, { speed: string; incline: string }>>({});
  const [showComplete, setShowComplete] = useState(false);
  const [sessionNote, setSessionNote] = useState("");
  const [energyLevel, setEnergyLevel] = useState<1 | 2 | 3 | 4 | 5>(3);
  const [difficultyLevel, setDifficultyLevel] = useState<1 | 2 | 3 | 4 | 5>(3);
  const [motivationLevel, setMotivationLevel] = useState<1 | 2 | 3 | 4 | 5>(3);
  const [reflectionNote, setReflectionNote] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const intervalTimer = useDeadlineIntervalTimer({
    steps: intervalProgramSteps,
    isRunning,
    isPaused,
    onAllStepsComplete: () => {
      setIsRunning(false);
      setIsPaused(false);
      setShowComplete(true);
      setStatus("Intervalløkten er fullført. Logg hvordan det gikk.");
    },
  });
  const { stepIndex, remainingSeconds, resetToStep, start: startIntervalTimer, skipToNext, clearDeadline } = intervalTimer;

  const currentStep = intervalProgramSteps[stepIndex] ?? null;
  const totalSeconds = useMemo(
    () => intervalProgramSteps.reduce((sum, step) => sum + step.durationSeconds, 0),
    [intervalProgramSteps],
  );
  const elapsedSeconds = useMemo(() => {
    const completed = intervalProgramSteps.slice(0, stepIndex).reduce((sum, step) => sum + step.durationSeconds, 0);
    const currentStepDuration = currentStep?.durationSeconds ?? 0;
    const currentProgress = Math.max(0, currentStepDuration - remainingSeconds);
    return Math.min(totalSeconds, completed + currentProgress);
  }, [intervalProgramSteps, stepIndex, currentStep, remainingSeconds, totalSeconds]);
  const progressPercent = totalSeconds > 0 ? Math.min(100, Math.round((elapsedSeconds / totalSeconds) * 100)) : 0;

  function resetDraft() {
    setStepOverrides({});
    setShowComplete(false);
    setSessionNote("");
    setEnergyLevel(3);
    setDifficultyLevel(3);
    setMotivationLevel(3);
    setReflectionNote("");
    setIsSaving(false);
    setStatus(null);
  }

  function resetTimer() {
    setIsRunning(false);
    setIsPaused(false);
    resetToStep(0);
    resetDraft();
  }

  useEffect(() => {
    if (!open) return;
    resetTimer();
  }, [open, program?.id]);

  useEffect(() => {
    if (!open || !currentStep) return;
    setStepOverrides((previous) => {
      if (previous[stepIndex]) return previous;
      return {
        ...previous,
        [stepIndex]: {
          speed: parseIntervalSpeedKmHint(currentStep.speedHint),
          incline: parseIntervalInclinePercentHint(currentStep.inclineHint),
        },
      };
    });
  }, [open, stepIndex, currentStep]);

  function openComplete() {
    clearDeadline();
    setIsRunning(false);
    setIsPaused(false);
    setShowComplete(true);
    setStatus("Intervalløkten er fullført. Logg hvordan det gikk.");
  }

  function handleStart() {
    if (!intervalProgramSteps.length) return;
    setStatus(null);
    setShowComplete(false);
    setIsPaused(false);
    startIntervalTimer();
    setIsRunning(true);
  }

  function handleSkip() {
    if (!intervalProgramSteps.length) return;
    const nextStep = skipToNext() as IntervalTimerStep | null;
    if (!nextStep) return;
    setStatus(`Hoppet til: ${nextStep.headline}`);
  }

  function buildReflection(): WorkoutReflection {
    return {
      energyLevel,
      difficultyLevel,
      motivationLevel,
      note: reflectionNote.trim(),
    };
  }

  function handleSave() {
    if (!program || !memberId.trim() || isSaving) return;
    setIsSaving(true);
    logIntervalWorkout({
      memberId: memberId.trim(),
      programId: program.id,
      results: buildIntervalSessionResults(program, exercises, intervalProgramSteps, stepOverrides),
      note: sessionNote.trim(),
      reflection: buildReflection(),
    });
    setStatus("Kondisjonsøkten er lagret. PT kan se den i loggen.");
    onSaved?.();
    window.setTimeout(() => {
      setIsSaving(false);
      onClose();
    }, 300);
  }

  if (!open || !program) return null;

  const currentOverride = stepOverrides[stepIndex] ?? { speed: "", incline: "" };
  const canEditSpeedIncline = intervalStepAllowsSpeedInclineEdit(currentStep);

  return (
    <div className="motus-modal-insets fixed inset-0 z-[10012] overscroll-contain bg-slate-900/60">
      <div className="mx-auto flex h-full w-full max-w-2xl flex-col rounded-2xl bg-white shadow-lg">
        <div className="border-b p-4 sm:p-5" style={{ borderColor: "rgba(15,23,42,0.08)" }}>
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-xs uppercase tracking-wide text-slate-400">Intervallvindu</div>
              <div className="text-xl font-semibold text-slate-900">{program.title}</div>
              <div className="mt-1 text-xs text-slate-500">{program.goal || "Nedtelling per intervallsteg"}</div>
            </div>
            <OutlineButton onClick={() => { resetTimer(); onClose(); }}>Lukk</OutlineButton>
          </div>
        </div>

        <div className="motus-scroll-touch flex-1 space-y-4 overflow-auto p-4 sm:p-6">
          {showComplete ? (
            <div className="rounded-xl border bg-slate-50 p-4 space-y-4" style={{ borderColor: "rgba(15,23,42,0.08)" }}>
              <div>
                <div className="text-sm font-semibold text-slate-800">Etter økta</div>
                <div className="text-xs text-slate-500">Svar med emoji og eventuell kommentar. PT ser dette i øktloggen.</div>
              </div>
              <label className="block space-y-1">
                <span className="text-xs font-semibold text-slate-700">Kommentar til økten (valgfritt)</span>
                <TextArea
                  value={sessionNote}
                  onChange={(event) => setSessionNote(event.target.value)}
                  className="min-h-[90px]"
                  placeholder="Hvordan gikk kondisjonsøkten?"
                />
              </label>
              {[
                { key: "energy", question: "Hvordan føles energinivået nå?", value: energyLevel, setValue: setEnergyLevel },
                { key: "difficulty", question: "Hvor tung opplevdes økta?", value: difficultyLevel, setValue: setDifficultyLevel },
                { key: "motivation", question: "Hvordan er motivasjonen videre?", value: motivationLevel, setValue: setMotivationLevel },
              ].map((item) => (
                <div key={item.key} className="space-y-2">
                  <div className="text-xs font-medium text-slate-700">{item.question}</div>
                  <div className="grid grid-cols-5 gap-2">
                    {[1, 2, 3, 4, 5].map((level) => {
                      const numericLevel = level as 1 | 2 | 3 | 4 | 5;
                      const active = item.value === numericLevel;
                      return (
                        <button
                          key={level}
                          type="button"
                          onClick={() => item.setValue(numericLevel)}
                          className={`rounded-xl border px-2 py-2 text-lg transition ${
                            active ? "border-emerald-400 bg-emerald-50" : "border-slate-200 bg-white hover:bg-slate-50"
                          }`}
                          aria-label={`Velg nivå ${level}`}
                        >
                          {getReflectionEmoji(numericLevel)}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
              <label className="block space-y-1">
                <span className="text-xs font-semibold text-slate-700">Notat til PT (valgfritt)</span>
                <TextArea
                  value={reflectionNote}
                  onChange={(event) => setReflectionNote(event.target.value)}
                  className="min-h-[90px]"
                  placeholder="Noe du vil at PT skal vite?"
                />
              </label>
            </div>
          ) : (
            <>
              <div
                className="overflow-hidden rounded-2xl text-white shadow-md ring-1 ring-black/10"
                style={{ background: `linear-gradient(155deg, ${MOTUS.turquoise} 0%, ${MOTUS.pink} 100%)` }}
              >
                {currentStep ? (
                  <>
                    <div className="flex flex-wrap items-center justify-between gap-2 px-4 pt-4 sm:px-5 sm:pt-5">
                      <span
                        className={`inline-flex rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-wide ${intervalTimerBadgeToneClass(
                          currentStep.tone,
                        )}`}
                      >
                        {currentStep.phaseBadge}
                      </span>
                      <span className="text-[11px] font-semibold text-white/90 tabular-nums">
                        Steg {Math.min(stepIndex + 1, intervalProgramSteps.length || 1)} av {intervalProgramSteps.length || 0}
                      </span>
                    </div>
                    <div className="px-4 pt-3 sm:px-5">
                      <h3 className="text-2xl font-bold leading-tight tracking-tight sm:text-3xl">{currentStep.headline}</h3>
                      {currentStep.tone === "rest" && currentStep.afterExerciseName ? (
                        <p className="mt-2 text-sm leading-snug text-white/90">Etter {currentStep.afterExerciseName}</p>
                      ) : null}
                    </div>
                    <div className="flex justify-center px-4 py-1 sm:px-5 sm:py-2">
                      <div className="text-6xl font-black tabular-nums tracking-tight sm:text-8xl">{formatSeconds(remainingSeconds)}</div>
                    </div>
                    <div className="mx-4 mb-1 rounded-xl bg-black/18 backdrop-blur-[2px] sm:mx-5">
                      {canEditSpeedIncline ? (
                        <div className="grid gap-3 border-b border-white/15 px-3 py-3 sm:grid-cols-2 sm:px-4">
                          <label className="space-y-1">
                            <span className="text-xs text-white/75">Fart (km/t)</span>
                            <TextInput
                              value={currentOverride.speed}
                              onChange={(event) =>
                                setStepOverrides((previous) => ({
                                  ...previous,
                                  [stepIndex]: { ...currentOverride, speed: event.target.value },
                                }))
                              }
                              className="h-10 border-white/20 bg-white/95 text-slate-900"
                              placeholder="0"
                            />
                          </label>
                          <label className="space-y-1">
                            <span className="text-xs text-white/75">Stigning (%)</span>
                            <TextInput
                              value={currentOverride.incline}
                              onChange={(event) =>
                                setStepOverrides((previous) => ({
                                  ...previous,
                                  [stepIndex]: { ...currentOverride, incline: event.target.value },
                                }))
                              }
                              className="h-10 border-white/20 bg-white/95 text-slate-900"
                              placeholder="0"
                            />
                          </label>
                        </div>
                      ) : null}
                      {currentStep.hrHint ? (
                        <div className="flex items-start justify-between gap-4 px-3 py-2.5 text-sm sm:px-4">
                          <span className="shrink-0 text-white/75">Målpuls</span>
                          <span className="text-right font-semibold">{currentStep.hrHint}</span>
                        </div>
                      ) : null}
                      {!canEditSpeedIncline && !currentStep.hrHint ? (
                        <div className="px-3 py-3 text-center text-sm text-white/75 sm:px-4">Ingen ekstra instrukser for dette steget.</div>
                      ) : null}
                    </div>
                    {(() => {
                      const nextSt = intervalProgramSteps[stepIndex + 1];
                      if (!nextSt) {
                        return (
                          <div className="border-t border-white/15 px-4 py-3 text-center text-sm font-medium text-white/85 sm:px-5">
                            Siste steg i økta
                          </div>
                        );
                      }
                      return (
                        <div className="border-t border-white/15 px-4 py-3 sm:px-5">
                          <div className="text-[10px] font-bold uppercase tracking-wider text-white/70">Neste</div>
                          <div className="mt-1 flex flex-wrap items-baseline justify-between gap-2">
                            <div className="text-base font-semibold leading-snug">{nextSt.headline}</div>
                            <div className="text-sm text-white/90 tabular-nums">
                              {nextSt.phaseBadge} · {formatSeconds(nextSt.durationSeconds)}
                            </div>
                          </div>
                        </div>
                      );
                    })()}
                  </>
                ) : (
                  <div className="p-8 text-center text-sm text-white/90">Ingen steg i programmet.</div>
                )}
              </div>
              <div className="rounded-xl border bg-slate-50 p-3" style={{ borderColor: "rgba(15,23,42,0.08)" }}>
                <div className="flex items-center justify-between text-xs font-semibold text-slate-600">
                  <span>
                    Steg {Math.min(stepIndex + 1, intervalProgramSteps.length || 1)} / {intervalProgramSteps.length || 1}
                  </span>
                  <span>{progressPercent}%</span>
                </div>
                <div className="mt-2 h-3 rounded-full bg-slate-200">
                  <div
                    className="h-3 rounded-full"
                    style={{
                      width: `${progressPercent}%`,
                      background: `linear-gradient(90deg, ${MOTUS.turquoise} 0%, ${MOTUS.pink} 100%)`,
                    }}
                  />
                </div>
                <div className="mt-2 text-xs text-slate-500">
                  Total tid: {formatSeconds(elapsedSeconds)} / {formatSeconds(totalSeconds)}
                </div>
              </div>
            </>
          )}
          {status ? (
            <StatusMessage
              message={status}
              tone={status.toLowerCase().includes("lagret") || status.toLowerCase().includes("fullført") ? "success" : "info"}
              className="!rounded-xl !px-3 !py-2 !text-xs"
            />
          ) : null}
        </div>

        <div className="border-t p-4 sm:p-5" style={{ borderColor: "rgba(15,23,42,0.08)" }}>
          {showComplete ? (
            <div className="grid gap-2 sm:grid-cols-2">
              <OutlineButton onClick={() => setShowComplete(false)} className="w-full">
                Tilbake til timer
              </OutlineButton>
              <GradientButton onClick={handleSave} disabled={isSaving} className="w-full">
                {isSaving ? "Lagrer..." : "Lagre økt"}
              </GradientButton>
            </div>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
              <GradientButton onClick={handleStart} disabled={!intervalProgramSteps.length} className="w-full">
                Start økt
              </GradientButton>
              <OutlineButton onClick={() => setIsPaused((previous) => !previous)} disabled={!isRunning} className="w-full">
                {isPaused ? "Fortsett" : "Pause"}
              </OutlineButton>
              <OutlineButton onClick={handleSkip} disabled={!intervalProgramSteps.length} className="w-full">
                Hopp over
              </OutlineButton>
              <OutlineButton
                onClick={() => {
                  resetTimer();
                  setStatus("Intervalløkten er nullstilt.");
                }}
                disabled={!intervalProgramSteps.length}
                className="w-full"
              >
                Nullstill
              </OutlineButton>
              <GradientButton onClick={openComplete} disabled={!intervalProgramSteps.length} className="w-full">
                Fullfør økt
              </GradientButton>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
