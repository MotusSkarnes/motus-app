import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { MOTUS } from "../app/data";
import {
  createEmptyOnboardingDraft,
  CURRENT_WEEKLY_SESSION_OPTIONS,
  DROPOUT_REASON_OPTIONS,
  ENERGY_LEVEL_OPTIONS,
  MOTIVATION_OPTIONS,
  ONBOARDING_PAGE_COUNT,
  ONBOARDING_PAGE_THEMES,
  PREFERRED_TIME_OPTIONS,
  SESSION_LENGTH_OPTIONS,
  SESSIONS_PER_WEEK_OPTIONS,
  TRAINER_STRUCTURE_OPTIONS,
  TRAINING_FORM_OPTIONS,
  TRAINING_GOAL_OPTIONS,
  type MemberExperienceLevel,
  type MemberOnboardingAnswers,
  experienceLevelToMemberLevel,
} from "../app/memberOnboarding";
import { Card, GradientButton, OutlineButton, TextArea, TextInput } from "../app/ui";

type Draft = Omit<MemberOnboardingAnswers, "completedAt" | "version">;

type MemberOnboardingProps = {
  memberName: string;
  initialDraft?: Draft;
  onComplete: (answers: MemberOnboardingAnswers) => void | Promise<void>;
  onClose?: () => void;
};

function toggleInList(list: string[], value: string): string[] {
  return list.includes(value) ? list.filter((item) => item !== value) : [...list, value];
}

function Chip({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border px-2.5 py-1 text-left text-xs font-medium transition sm:px-3 sm:py-1.5 sm:text-sm ${
        active
          ? "border-transparent text-white shadow-sm"
          : "border-slate-200 bg-white text-slate-700 hover:border-teal-200 hover:bg-teal-50/50"
      }`}
      style={active ? { background: `linear-gradient(135deg, ${MOTUS.turquoise} 0%, ${MOTUS.pink} 100%)` } : undefined}
    >
      {label}
    </button>
  );
}

function ImportanceSlider({ value, onChange }: { value: number; onChange: (next: number) => void }) {
  return (
    <div className="space-y-2 sm:space-y-3">
      <div className="flex items-center justify-between gap-2 text-xs sm:text-sm">
        <span className="text-slate-600">Lite viktig</span>
        <span className="text-xl font-bold tabular-nums text-slate-900 sm:text-2xl">{value}</span>
        <span className="text-slate-600">Svært viktig</span>
      </div>
      <input
        type="range"
        min={1}
        max={10}
        step={1}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="h-2 w-full cursor-pointer appearance-none rounded-full"
        style={{
          background: `linear-gradient(90deg, ${MOTUS.turquoise} 0%, ${MOTUS.pink} 100%)`,
        }}
      />
      <div className="hidden justify-between text-[11px] text-slate-400 sm:flex">
        {Array.from({ length: 10 }, (_, index) => (
          <span key={index + 1}>{index + 1}</span>
        ))}
      </div>
    </div>
  );
}

export function MemberOnboarding({ memberName, initialDraft, onComplete, onClose }: MemberOnboardingProps) {
  const [pageIndex, setPageIndex] = useState(0);
  const [draft, setDraft] = useState<Draft>(() => initialDraft ?? createEmptyOnboardingDraft());
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const theme = ONBOARDING_PAGE_THEMES[pageIndex];
  const isLastPage = pageIndex === ONBOARDING_PAGE_COUNT - 1;

  const pageValidationMessage = useMemo(() => {
    if (pageIndex === 0 && draft.trainingGoals.length === 0) return "Velg minst ett treningsmål.";
    if (pageIndex === 1 && !draft.currentWeeklySessions) return "Fortell hvor mye du trener i dag.";
    if (pageIndex === 2 && !draft.sessionsPerWeekTarget) return "Velg hvor mange ganger du vil trene per uke.";
    if (pageIndex === 3 && draft.motivations.length === 0) return "Velg minst én motivasjon.";
    if (pageIndex === 3 && !draft.energyInTraining) return "Velg hvordan energinivået ditt er i trening.";
    return null;
  }, [pageIndex, draft]);

  function patchDraft(changes: Partial<Draft>) {
    setDraft((prev) => ({ ...prev, ...changes }));
  }

  function setExperienceLevel(level: MemberExperienceLevel) {
    patchDraft({ experienceLevel: level, level: experienceLevelToMemberLevel(level) });
  }

  async function handleNext() {
    if (pageValidationMessage) {
      setError(pageValidationMessage);
      return;
    }
    setError(null);
    if (!isLastPage) {
      setPageIndex((prev) => prev + 1);
      return;
    }
    setSubmitting(true);
    try {
      const completed: MemberOnboardingAnswers = {
        ...draft,
        version: 1,
        completedAt: new Date().toISOString(),
      };
      await onComplete(completed);
      setSaved(true);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Kunne ikke lagre svarene til skyen. Sjekk nettverk og prøv igjen.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (saved) {
    return (
      <div className="fixed inset-0 z-[10050] flex flex-col items-center justify-center bg-white px-6">
        <Card className="max-w-md p-6 text-center">
          <div className="text-lg font-semibold text-slate-900">Takk — svarene er lagret</div>
          <p className="mt-2 text-sm text-slate-600">PT kan nå se oppstartsskjemaet ditt på kundekortet.</p>
          {onClose ? (
            <GradientButton
              type="button"
              className="mt-4 w-full"
              onClick={() => {
                onClose();
              }}
            >
              Lukk
            </GradientButton>
          ) : null}
        </Card>
      </div>
    );
  }

  return (
    <div
      className="fixed inset-0 z-[10050] flex min-h-0 flex-col bg-white"
      style={{ paddingTop: "env(safe-area-inset-top)" }}
    >
      <div className="h-1.5 shrink-0" style={{ background: `linear-gradient(90deg, ${MOTUS.turquoise} 0%, ${MOTUS.pink} 100%)` }} />
      <div className="mx-auto flex min-h-0 w-full max-w-lg flex-1 flex-col px-4 py-3 sm:px-6 sm:py-5">
        <div className="mb-2 flex shrink-0 items-center justify-between gap-3 text-xs font-semibold text-slate-500 sm:mb-4">
          <span>
            Side {pageIndex + 1} av {ONBOARDING_PAGE_COUNT}
          </span>
          {onClose ? (
            <button type="button" onClick={onClose} className="text-slate-500 underline-offset-2 hover:text-slate-800 hover:underline">
              Lukk
            </button>
          ) : null}
        </div>
        <div className="mb-2 h-1.5 shrink-0 overflow-hidden rounded-full bg-slate-100">
          <div
            className="h-full rounded-full transition-all duration-300"
            style={{
              width: `${((pageIndex + 1) / ONBOARDING_PAGE_COUNT) * 100}%`,
              background: `linear-gradient(90deg, ${MOTUS.turquoise} 0%, ${MOTUS.pink} 100%)`,
            }}
          />
        </div>

        <Card className="flex min-h-0 flex-1 flex-col overflow-hidden border-0 shadow-lg ring-1 ring-slate-200/80">
          <div className="shrink-0 border-b border-slate-100 px-4 py-3 sm:px-5 sm:py-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-teal-700">{theme.title}</p>
            <h1 className="mt-0.5 text-lg font-bold text-slate-950 sm:mt-1 sm:text-2xl">Hei {memberName.split(" ")[0] || "der"}!</h1>
            <p className="mt-0.5 text-xs text-slate-600 sm:mt-1 sm:text-sm">{theme.subtitle}</p>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-3 sm:px-5 sm:py-4">
            {pageIndex === 0 ? (
              <div className="space-y-3 sm:space-y-4">
                <div>
                  <p className="text-sm font-medium text-slate-800">Hva er målene dine med trening?</p>
                  <p className="mt-0.5 text-xs text-slate-500">Velg ett eller flere.</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {TRAINING_GOAL_OPTIONS.map((goal) => (
                      <Chip
                        key={goal}
                        label={goal}
                        active={draft.trainingGoals.includes(goal)}
                        onClick={() => patchDraft({ trainingGoals: toggleInList(draft.trainingGoals, goal) })}
                      />
                    ))}
                  </div>
                </div>
                <label className="block space-y-1">
                  <span className="text-sm font-medium text-slate-800">Hva vil du oppnå de neste månedene? (valgfritt)</span>
                  <TextArea
                    value={draft.goalsNotes}
                    onChange={(event) => patchDraft({ goalsNotes: event.target.value })}
                    className="min-h-[56px] sm:min-h-[80px]"
                    placeholder="F.eks. sterkere i markløft, mer energi i hverdagen…"
                  />
                </label>
                <div>
                  <p className="text-sm font-medium text-slate-800">Hvor viktig er dette for deg akkurat nå?</p>
                  <p className="mt-0.5 text-xs text-slate-500">Dra markøren fra 1 til 10.</p>
                  <div className="mt-2">
                    <ImportanceSlider value={draft.importanceNow} onChange={(importanceNow) => patchDraft({ importanceNow })} />
                  </div>
                </div>
              </div>
            ) : null}

            {pageIndex === 1 ? (
              <div className="space-y-4">
                <div>
                  <p className="text-sm font-medium text-slate-800">Hvilket nivå er du på?</p>
                  <div className="mt-2 grid gap-2">
                    {(["Nybegynner", "Litt erfaren", "Erfaren"] as const).map((level) => (
                      <button
                        key={level}
                        type="button"
                        onClick={() => setExperienceLevel(level)}
                        className={`rounded-xl border px-4 py-3 text-left text-sm font-medium transition ${
                          draft.experienceLevel === level
                            ? "border-teal-300 bg-teal-50 text-teal-950 ring-2 ring-teal-200"
                            : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                        }`}
                      >
                        {level}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-800">Hvor mye trener du i dag?</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {CURRENT_WEEKLY_SESSION_OPTIONS.map((option) => (
                      <Chip
                        key={option}
                        label={option}
                        active={draft.currentWeeklySessions === option}
                        onClick={() => patchDraft({ currentWeeklySessions: option })}
                      />
                    ))}
                  </div>
                </div>
              </div>
            ) : null}

            {pageIndex === 2 ? (
              <div className="space-y-4">
                <div>
                  <p className="text-sm font-medium text-slate-800">Hvor mange ganger vil du trene per uke?</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {SESSIONS_PER_WEEK_OPTIONS.map((option) => (
                      <Chip
                        key={option}
                        label={`${option}×`}
                        active={draft.sessionsPerWeekTarget === option}
                        onClick={() => patchDraft({ sessionsPerWeekTarget: option })}
                      />
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-800">Hvor lange økter ønsker du?</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {SESSION_LENGTH_OPTIONS.map((option) => (
                      <Chip
                        key={option}
                        label={option}
                        active={draft.preferredSessionMinutes === option}
                        onClick={() => patchDraft({ preferredSessionMinutes: option })}
                      />
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-800">Hvilke treningsformer liker du?</p>
                  <p className="mt-0.5 text-xs text-slate-500">Velg alt som passer.</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {TRAINING_FORM_OPTIONS.map((option) => (
                      <Chip
                        key={option}
                        label={option}
                        active={draft.trainingForms.includes(option)}
                        onClick={() => patchDraft({ trainingForms: toggleInList(draft.trainingForms, option) })}
                      />
                    ))}
                  </div>
                </div>
              </div>
            ) : null}

            {pageIndex === 3 ? (
              <div className="space-y-4">
                <div>
                  <p className="text-sm font-medium text-slate-800">Hva motiverer deg mest?</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {MOTIVATION_OPTIONS.map((option) => (
                      <Chip
                        key={option}
                        label={option}
                        active={draft.motivations.includes(option)}
                        onClick={() => patchDraft({ motivations: toggleInList(draft.motivations, option) })}
                      />
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-800">Hvordan opplever du energinivået ditt i trening?</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {ENERGY_LEVEL_OPTIONS.map((option) => (
                      <Chip
                        key={option}
                        label={option}
                        active={draft.energyInTraining === option}
                        onClick={() => patchDraft({ energyInTraining: option })}
                      />
                    ))}
                  </div>
                </div>
                <label className="block space-y-1">
                  <span className="text-sm font-medium text-slate-800">Hva hjelper deg å holde rutinen? (valgfritt)</span>
                  <TextArea
                    value={draft.consistencyHelpers}
                    onChange={(event) => patchDraft({ consistencyHelpers: event.target.value })}
                    className="min-h-[72px]"
                    placeholder="F.eks. fast tid på morgenen, trene med venn…"
                  />
                </label>
              </div>
            ) : null}

            {pageIndex === 4 ? (
              <div className="space-y-4">
                <label className="block space-y-1">
                  <span className="text-sm font-medium text-slate-800">Har du skader eller hensyn treneren bør vite om?</span>
                  <TextArea
                    value={draft.injuries}
                    onChange={(event) => patchDraft({ injuries: event.target.value })}
                    className="min-h-[90px]"
                    placeholder="F.eks. tidligere kneoperasjon, dårlig rygg… Skriv «Ingen» hvis ikke aktuelt."
                  />
                </label>
                <div>
                  <p className="text-sm font-medium text-slate-800">Hva gjør at du vanligvis faller fra?</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {DROPOUT_REASON_OPTIONS.map((option) => (
                      <Chip
                        key={option}
                        label={option}
                        active={draft.dropoutReasons.includes(option)}
                        onClick={() => patchDraft({ dropoutReasons: toggleInList(draft.dropoutReasons, option) })}
                      />
                    ))}
                  </div>
                </div>
                <label className="block space-y-1">
                  <span className="text-sm font-medium text-slate-800">Utdyp gjerne (valgfritt)</span>
                  <TextInput
                    value={draft.dropoutNotes}
                    onChange={(event) => patchDraft({ dropoutNotes: event.target.value })}
                    placeholder="Kort forklaring…"
                  />
                </label>
              </div>
            ) : null}

            {pageIndex === 5 ? (
              <div className="space-y-4">
                <div>
                  <p className="text-sm font-medium text-slate-800">Når passer det best å trene?</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {PREFERRED_TIME_OPTIONS.map((option) => (
                      <Chip
                        key={option}
                        label={option}
                        active={draft.preferredTrainingTime === option}
                        onClick={() => patchDraft({ preferredTrainingTime: option })}
                      />
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-800">Hvor mye struktur ønsker du fra trener?</p>
                  <div className="mt-2 grid gap-2">
                    {TRAINER_STRUCTURE_OPTIONS.map((option) => (
                      <button
                        key={option}
                        type="button"
                        onClick={() => patchDraft({ wantsTrainerStructure: option })}
                        className={`rounded-xl border px-4 py-3 text-left text-sm font-medium transition ${
                          draft.wantsTrainerStructure === option
                            ? "border-teal-300 bg-teal-50 text-teal-950 ring-2 ring-teal-200"
                            : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                        }`}
                      >
                        {option}
                      </button>
                    ))}
                  </div>
                </div>
                <label className="block space-y-1">
                  <span className="text-sm font-medium text-slate-800">Noe mer du vil at treneren skal vite? (valgfritt)</span>
                  <TextArea
                    value={draft.coachNotesFromMember}
                    onChange={(event) => patchDraft({ coachNotesFromMember: event.target.value })}
                    className="min-h-[80px]"
                    placeholder="F.eks. reiser mye i jobb, foretrekker korte økter…"
                  />
                </label>
              </div>
            ) : null}

            {error ? <p className="mt-3 text-sm text-rose-600">{error}</p> : null}
          </div>

          <div
            className="flex shrink-0 gap-2 border-t border-slate-100 px-4 py-3 sm:px-5 sm:py-4"
            style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}
          >
            <OutlineButton
              type="button"
              onClick={() => {
                setError(null);
                setPageIndex((prev) => Math.max(0, prev - 1));
              }}
              disabled={pageIndex === 0 || submitting}
              className="flex-1 sm:flex-none"
            >
              <span className="inline-flex items-center gap-1">
                <ChevronLeft className="h-4 w-4" />
                Tilbake
              </span>
            </OutlineButton>
            <GradientButton type="button" onClick={() => void handleNext()} disabled={submitting} className="flex-1 sm:flex-none">
              <span className="inline-flex items-center gap-1">
                {isLastPage ? (submitting ? "Lagrer…" : "Fullfør") : "Neste"}
                {!isLastPage ? <ChevronRight className="h-4 w-4" /> : null}
              </span>
            </GradientButton>
          </div>
        </Card>
      </div>
    </div>
  );
}

