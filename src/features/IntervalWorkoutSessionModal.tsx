import { ArrowLeft, Check } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { MOTUS } from "../app/data";
import { useDeadlineIntervalTimer } from "../app/useDeadlineIntervalTimer";
import { useScreenWakeLock } from "../app/useScreenWakeLock";
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
  memberEmail?: string;
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
      return "bg-teal-100 text-teal-800 ring-1 ring-teal-200";
    case "cooldown":
      return "bg-sky-100 text-sky-800 ring-1 ring-sky-200";
    case "rest":
      return "bg-amber-100 text-amber-900 ring-1 ring-amber-200";
    default:
      return "bg-slate-100 text-slate-800 ring-1 ring-slate-200";
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
    const minutesPart = (Number(exercise.durationMinutes) || 0) * 60;
    const secondsPart = Number(exercise.holdSeconds) || 0;
    const workDurationSeconds = Math.max(0, Math.round(minutesPart + secondsPart));
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
  memberEmail,
  onClose,
  onSaved,
  logIntervalWorkout,
}: IntervalWorkoutSessionModalProps) {
  useScreenWakeLock(open);
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
  const completeSectionRef = useRef<HTMLDivElement>(null);
  const hasStartedRef = useRef(false);

  const intervalTimer = useDeadlineIntervalTimer({
    steps: intervalProgramSteps,
    isRunning,
    isPaused,
    onAllStepsComplete: () => {
      setIsRunning(false);
      setIsPaused(false);
      setShowComplete(true);
      setStatus("Intervalløkten er fullført. Trykk Lagre økt.");
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
    hasStartedRef.current = false;
    resetToStep(0);
    resetDraft();
  }

  useEffect(() => {
    if (!open) return;
    resetTimer();
  }, [open, program?.id]);

  useEffect(() => {
    if (!open || !program) return;
    if (intervalProgramSteps.length > 0) return;
    setIsRunning(false);
    setIsPaused(false);
    setShowComplete(true);
    setStatus("Ingen nedtelling i programmet — du kan logge økten nå.");
  }, [open, program, intervalProgramSteps.length]);

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

  useEffect(() => {
    if (!open || showComplete || !intervalProgramSteps.length) return;
    if (stepIndex < intervalProgramSteps.length) return;
    clearDeadline();
    setIsRunning(false);
    setIsPaused(false);
    setShowComplete(true);
    setStatus("Intervalløkten er fullført. Logg hvordan det gikk.");
  }, [open, showComplete, stepIndex, intervalProgramSteps.length, clearDeadline]);

  useEffect(() => {
    if (!showComplete) return;
    completeSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [showComplete]);

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
    hasStartedRef.current = true;
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
    if (typeof logIntervalWorkout !== "function") {
      setStatus("Lagring er ikke tilkoblet. Oppdater siden (Ctrl+F5) og prøv igjen.");
      return;
    }
    setIsSaving(true);
    setStatus(null);

    const finish = (result: { ok: boolean; message?: string }) => {
      window.clearTimeout(timeoutId);
      setIsSaving(false);
      if (!result.ok) {
        setStatus(result.message?.trim() || "Kunne ikke lagre økten i skyen. Prøv igjen.");
        return;
      }
      const successMessage = "Kondisjonsøkten er lagret. PT kan se den i loggen.";
      setStatus(successMessage);
      if (onSaved) {
        onSaved();
        return;
      }
      window.setTimeout(() => onClose(), 1800);
    };

    const timeoutId = window.setTimeout(() => {
      setIsSaving(false);
      setStatus(
        "Økten er lagret lokalt under Fremgang. Sky-synk tar lengre tid — prøv lagre igjen, eller sjekk F12 → Console for feilmelding.",
      );
    }, 28_000);

    logIntervalWorkout({
      memberId: memberId.trim(),
      programId: program.id,
      programTitle: program.title,
      ownerUserId: program.ownerUserId,
      targetEmail: memberEmail?.trim().toLowerCase(),
      keepCurrentTab: true,
      results: buildIntervalSessionResults(program, exercises, intervalProgramSteps, stepOverrides),
      note: sessionNote.trim(),
      reflection: buildReflection(),
      onPersisted: finish,
    });
  }

  if (!open || !program) return null;

  const currentOverride = stepOverrides[stepIndex] ?? { speed: "", incline: "" };
  const canEditSpeedIncline = intervalStepAllowsSpeedInclineEdit(currentStep);
  const timerFinished =
    showComplete ||
    (intervalProgramSteps.length > 0 && stepIndex >= intervalProgramSteps.length) ||
    (hasStartedRef.current && !isRunning && intervalProgramSteps.length > 0 && remainingSeconds <= 0 && stepIndex >= intervalProgramSteps.length - 1);

  const progressDegrees = (progressPercent / 100) * 360;
  const nextStep = intervalProgramSteps[stepIndex + 1] ?? null;
  const intervalFooterBtn =
    "w-full !min-h-8 !h-8 !px-1.5 !py-1 !text-[10px] !font-semibold !leading-tight sm:!min-h-9 sm:!text-[11px]";

  function handleLeave() {
    resetTimer();
    onClose();
  }

  const modal = (
    <div className="motus-workout-focus motus-modal-insets fixed inset-0 z-[10030] overscroll-contain bg-black">
      <div className="motus-workout-focus-panel mx-auto flex h-full w-full max-w-3xl flex-col overflow-hidden bg-slate-950 text-white shadow-2xl sm:rounded-3xl">
        <div className="relative overflow-hidden border-b border-white/10 bg-slate-900 px-3 pb-2 pt-[max(0.5rem,env(safe-area-inset-top))] sm:px-5 sm:pb-4 sm:pt-5">
          <div className="flex items-center justify-between gap-2 sm:gap-3">
            <button
              type="button"
              onClick={handleLeave}
              className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/15 sm:h-10 sm:w-10"
              aria-label="Lukk intervalløkt"
            >
              <ArrowLeft className="h-4 w-4 sm:h-5 sm:w-5" aria-hidden />
            </button>
            <div className="min-w-0 flex-1 text-center">
              <div className="text-[10px] font-black uppercase tracking-[0.14em] motus-brand-on-dark sm:text-xs sm:tracking-[0.16em]">
                Intervalløkt
              </div>
              <div className="mt-0.5 truncate text-sm font-bold tracking-tight text-white sm:mt-1 sm:text-lg sm:font-black">
                {program.title}
              </div>
              <div className="mt-0.5 truncate text-[10px] text-white/60 sm:text-xs">
                {program.goal || "Nedtelling per intervallsteg"}
              </div>
            </div>
            <button
              type="button"
              onClick={handleLeave}
              className="shrink-0 rounded-full bg-white/10 px-2.5 py-1.5 text-[11px] font-bold text-white shadow-sm transition hover:bg-white/15 sm:px-3 sm:py-2 sm:text-xs"
            >
              Avslutt
            </button>
          </div>

          {!timerFinished ? (
            <>
              <div className="mt-2 sm:hidden">
                <div className="flex items-center justify-between gap-2 text-[11px] font-semibold text-white/65">
                  <span className="tabular-nums">{progressPercent}% fullført</span>
                  <span className="tabular-nums">
                    Steg {Math.min(stepIndex + 1, intervalProgramSteps.length || 1)} av {intervalProgramSteps.length || 0}
                  </span>
                </div>
                <div className="motus-progress-track mt-1.5 h-1 rounded-full">
                  <div
                    className="motus-progress-fill h-full rounded-full transition-all duration-300"
                    style={{
                      width: `${progressPercent}%`,
                      background: `linear-gradient(90deg, ${MOTUS.turquoise}, ${MOTUS.pink})`,
                    }}
                  />
                </div>
              </div>

              <div className="mt-5 hidden gap-4 sm:grid sm:grid-cols-[8.5rem_1fr] sm:items-center">
                <div
                  className="mx-auto flex h-32 w-32 items-center justify-center rounded-full p-2 shadow-2xl shadow-teal-500/20"
                  style={{
                    background: `conic-gradient(${MOTUS.turquoise} 0deg, ${MOTUS.pink} ${progressDegrees}deg, rgba(255,255,255,0.14) ${progressDegrees}deg 360deg)`,
                  }}
                >
                  <div className="flex h-full w-full flex-col items-center justify-center rounded-full bg-slate-950 text-center ring-1 ring-white/10">
                    <span className="text-3xl font-black tabular-nums text-white">{progressPercent}%</span>
                    <span className="mt-0.5 text-[10px] font-bold uppercase tracking-wide text-white/50">fullført</span>
                  </div>
                </div>
                <div className="min-w-0 text-center sm:text-left">
                  <div className="text-xs font-black uppercase tracking-wide motus-brand-on-dark-muted">Nå</div>
                  <div className="mt-1 truncate text-3xl font-black tracking-tight text-white sm:text-4xl">
                    {currentStep?.headline ?? "Klar til start"}
                  </div>
                  <div className="mt-2 flex flex-wrap justify-center gap-2 text-xs font-semibold text-white/70 sm:justify-start">
                    <span className="rounded-full bg-white/10 px-3 py-1">
                      Steg {Math.min(stepIndex + 1, intervalProgramSteps.length || 1)} av {intervalProgramSteps.length || 0}
                    </span>
                    {isRunning ? (
                      <span className="rounded-full bg-white/10 px-3 py-1">
                        {isPaused ? "Pause" : "Nedtelling pågår"}
                      </span>
                    ) : null}
                    <span className="rounded-full bg-white/10 px-3 py-1 tabular-nums">
                      {formatSeconds(elapsedSeconds)} / {formatSeconds(totalSeconds)}
                    </span>
                  </div>
                </div>
              </div>

              <div className="motus-progress-track mt-3 hidden h-1 rounded-full sm:block">
                <div
                  className="motus-progress-fill h-full rounded-full transition-all duration-300"
                  style={{
                    width: `${progressPercent}%`,
                    background: `linear-gradient(90deg, ${MOTUS.turquoise}, ${MOTUS.pink})`,
                  }}
                />
              </div>
            </>
          ) : null}
        </div>

        <div className="motus-scroll-touch flex-1 space-y-2 overflow-auto bg-slate-950 p-2 sm:space-y-3 sm:p-4">
          {timerFinished ? (
            <div
              ref={completeSectionRef}
              className="w-full rounded-xl border border-white/10 bg-white p-2.5 text-left text-slate-900 shadow-xl shadow-black/20 sm:rounded-2xl sm:p-4"
            >
              <div>
                <div className="text-sm font-semibold text-slate-900">Økta er fullført</div>
                <div className="mt-0.5 text-xs text-slate-500">Svar med emoji og eventuell kommentar, deretter lagre nederst.</div>
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
                            active ? "border-teal-400 bg-emerald-50" : "border-slate-200 bg-white hover:bg-slate-50"
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
          ) : currentStep ? (
            <div className="w-full rounded-xl border border-white/10 bg-white p-2.5 text-left text-slate-900 shadow-xl shadow-black/20 sm:rounded-2xl sm:p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div
                    className={`inline-flex rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide sm:text-[11px] ${intervalTimerBadgeToneClass(
                      currentStep.tone,
                    )}`}
                  >
                    {currentStep.phaseBadge}
                  </div>
                  <h2 className="mt-1.5 text-xl font-bold leading-tight text-slate-900 sm:text-2xl">{currentStep.headline}</h2>
                  {currentStep.tone === "rest" && currentStep.afterExerciseName ? (
                    <p className="mt-0.5 text-xs text-slate-600 sm:text-sm">Etter {currentStep.afterExerciseName}</p>
                  ) : null}
                  <p className="mt-1 text-[11px] text-slate-500 sm:text-xs">
                    Steg {Math.min(stepIndex + 1, intervalProgramSteps.length || 1)} av {intervalProgramSteps.length || 0}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Gjenstår</div>
                  <div className="text-4xl font-black tabular-nums tracking-tight text-slate-900 sm:text-5xl">
                    {formatSeconds(remainingSeconds)}
                  </div>
                </div>
              </div>

              {canEditSpeedIncline || currentStep.hrHint ? (
                <div className="mt-3 rounded-xl border bg-slate-50 p-3" style={{ borderColor: "rgba(15,23,42,0.08)" }}>
                  {canEditSpeedIncline ? (
                    <div className="grid gap-3 sm:grid-cols-2">
                      <label className="space-y-1">
                        <span className="text-xs font-medium text-slate-600">Fart (km/t)</span>
                        <TextInput
                          value={currentOverride.speed}
                          onChange={(event) =>
                            setStepOverrides((previous) => ({
                              ...previous,
                              [stepIndex]: { ...currentOverride, speed: event.target.value },
                            }))
                          }
                          placeholder="0"
                        />
                      </label>
                      <label className="space-y-1">
                        <span className="text-xs font-medium text-slate-600">Stigning (%)</span>
                        <TextInput
                          value={currentOverride.incline}
                          onChange={(event) =>
                            setStepOverrides((previous) => ({
                              ...previous,
                              [stepIndex]: { ...currentOverride, incline: event.target.value },
                            }))
                          }
                          placeholder="0"
                        />
                      </label>
                    </div>
                  ) : null}
                  {currentStep.hrHint ? (
                    <div
                      className={`flex items-start justify-between gap-4 text-sm ${canEditSpeedIncline ? "mt-3 border-t border-slate-200 pt-3" : ""}`}
                    >
                      <span className="shrink-0 text-slate-600">Målpuls</span>
                      <span className="text-right font-semibold text-slate-900">{currentStep.hrHint}</span>
                    </div>
                  ) : null}
                </div>
              ) : null}

              {nextStep ? (
                <div className="mt-3 border-t border-slate-200 pt-2.5">
                  <div className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Neste</div>
                  <div className="mt-1 flex items-baseline justify-between gap-2">
                    <div className="min-w-0 truncate text-sm font-semibold text-slate-900">{nextStep.headline}</div>
                    <div className="shrink-0 text-xs tabular-nums text-slate-600">
                      {nextStep.phaseBadge} · {formatSeconds(nextStep.durationSeconds)}
                    </div>
                  </div>
                </div>
              ) : !timerFinished && currentStep ? (
                <div className="mt-3 border-t border-slate-200 pt-2.5 text-center text-xs text-slate-500">Siste steg i økta</div>
              ) : null}
            </div>
          ) : (
            <div className="rounded-xl border border-white/10 bg-white p-6 text-center text-sm text-slate-600 shadow-xl shadow-black/20">
              Ingen steg i programmet.
            </div>
          )}
          {status ? (
            <StatusMessage
              message={status}
              tone={status.toLowerCase().includes("lagret") || status.toLowerCase().includes("fullført") ? "success" : "info"}
              className="!rounded-xl !px-3 !py-2 !text-xs"
            />
          ) : null}
        </div>

        <div className="sticky bottom-0 shrink-0 border-t border-white/10 bg-slate-950 p-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] shadow-lg">
          <div className="grid grid-cols-2 gap-1.5">
            {timerFinished ? (
              <>
                <GradientButton type="button" className={intervalFooterBtn} onClick={handleSave} disabled={isSaving}>
                  <span className="inline-flex items-center justify-center gap-1">
                    <Check className="h-3.5 w-3.5 shrink-0" strokeWidth={2.5} aria-hidden />
                    {isSaving ? "Lagrer..." : "Lagre økt"}
                  </span>
                </GradientButton>
                <OutlineButton
                  type="button"
                  className={intervalFooterBtn}
                  onClick={() => {
                    if (intervalProgramSteps.length > 0) {
                      setShowComplete(false);
                      setStatus(null);
                    } else {
                      handleLeave();
                    }
                  }}
                >
                  Tilbake
                </OutlineButton>
              </>
            ) : (
              <>
                {isRunning ? (
                  <OutlineButton
                    type="button"
                    disabled
                    aria-pressed="true"
                    aria-label="Økten er startet"
                    className={`${intervalFooterBtn} !cursor-default !motus-brand-surface !border-[var(--motus-brand-border-strong)] !opacity-100`}
                  >
                    <span className="inline-flex items-center justify-center gap-1">
                      <Check className="h-3 w-3 shrink-0" strokeWidth={2.5} aria-hidden />
                      Startet
                    </span>
                  </OutlineButton>
                ) : (
                  <GradientButton
                    type="button"
                    onClick={handleStart}
                    disabled={!intervalProgramSteps.length}
                    className={intervalFooterBtn}
                  >
                    Start økt
                  </GradientButton>
                )}
                <OutlineButton
                  type="button"
                  onClick={() => setIsPaused((previous) => !previous)}
                  disabled={!isRunning}
                  className={intervalFooterBtn}
                >
                  {isPaused ? "Fortsett" : "Pause"}
                </OutlineButton>
                <OutlineButton
                  type="button"
                  onClick={handleSkip}
                  disabled={!intervalProgramSteps.length}
                  className={intervalFooterBtn}
                >
                  Hopp over
                </OutlineButton>
                <GradientButton
                  type="button"
                  onClick={openComplete}
                  disabled={!intervalProgramSteps.length}
                  className={intervalFooterBtn}
                >
                  <span className="inline-flex items-center justify-center gap-1">
                    <Check className="h-3 w-3 shrink-0" strokeWidth={2.5} aria-hidden />
                    Fullfør
                  </span>
                </GradientButton>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );

  if (typeof document === "undefined") return modal;
  return createPortal(modal, document.body);
}
