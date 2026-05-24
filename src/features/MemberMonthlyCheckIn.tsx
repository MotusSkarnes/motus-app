import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { MOTUS } from "../app/data";
import {
  CHECK_IN_PAGE_COUNT,
  CHECK_IN_PAGE_THEMES,
  MET_EXPECTATIONS_LABELS,
  TRAINING_GOING_LABELS,
  TRAINING_NEED_OPTIONS,
  type CheckInWindow,
  type MemberMonthlyCheckInAnswers,
  createEmptyCheckInDraft,
} from "../app/memberMonthlyCheckIn";
import { Card, GradientButton, OutlineButton, TextArea } from "../app/ui";

type Draft = Omit<MemberMonthlyCheckInAnswers, "completedAt" | "version">;

type MemberMonthlyCheckInProps = {
  memberName: string;
  window: CheckInWindow;
  onComplete: (answers: MemberMonthlyCheckInAnswers) => void | Promise<void>;
  onClose: () => void;
};

function ScalePicker({
  value,
  labels,
  onChange,
}: {
  value: number;
  labels: readonly string[];
  onChange: (next: number) => void;
}) {
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-5 gap-1.5">
        {labels.map((label, index) => {
          const score = index + 1;
          const active = value === score;
          return (
            <button
              key={label}
              type="button"
              onClick={() => onChange(score)}
              className={`rounded-xl border px-1 py-2 text-center text-[10px] font-semibold leading-tight transition sm:text-xs ${
                active
                  ? "border-transparent text-white shadow-sm"
                  : "border-slate-200 bg-white text-slate-600 hover:border-teal-200"
              }`}
              style={active ? { background: `${MOTUS.gradient}` } : undefined}
            >
              {score}
            </button>
          );
        })}
      </div>
      <div className="text-center text-xs font-medium text-slate-600">{labels[value - 1]}</div>
    </div>
  );
}

function Chip({ active, label, onClick }: { active: boolean; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border px-3 py-1.5 text-left text-sm font-medium transition ${
        active ? "border-transparent text-white shadow-sm" : "border-slate-200 bg-white text-slate-700 hover:bg-teal-50/50"
      }`}
      style={active ? { background: `${MOTUS.gradient}` } : undefined}
    >
      {label}
    </button>
  );
}

export function MemberMonthlyCheckIn({ memberName, window, onComplete, onClose }: MemberMonthlyCheckInProps) {
  const [pageIndex, setPageIndex] = useState(0);
  const [draft, setDraft] = useState<Draft>(() => createEmptyCheckInDraft(window.monthKey));
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const theme = CHECK_IN_PAGE_THEMES[pageIndex];
  const isLastPage = pageIndex === CHECK_IN_PAGE_COUNT - 1;

  const pageValidationMessage = useMemo(() => {
    if (pageIndex === 1 && draft.trainingNeeds.length === 0 && !draft.trainingNeedsNotes.trim()) {
      return "Velg minst ett behov, eller skriv et kort notat.";
    }
    return null;
  }, [pageIndex, draft.trainingNeeds, draft.trainingNeedsNotes]);

  function patchDraft(changes: Partial<Draft>) {
    setDraft((prev) => ({ ...prev, ...changes }));
  }

  function toggleNeed(value: string) {
    setDraft((prev) => ({
      ...prev,
      trainingNeeds: prev.trainingNeeds.includes(value)
        ? prev.trainingNeeds.filter((item) => item !== value)
        : [...prev.trainingNeeds, value],
    }));
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
      await onComplete({
        ...draft,
        version: 1,
        completedAt: new Date().toISOString(),
      });
    } catch {
      setError("Kunne ikke lagre. Prøv igjen.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[10050] flex flex-col bg-white">
      <div className="h-1.5 shrink-0" style={{ background: `linear-gradient(90deg, ${MOTUS.turquoise} 0%, ${MOTUS.pink} 100%)` }} />
      <div className="mx-auto flex w-full max-w-lg flex-1 flex-col px-4 py-5 sm:px-6">
        <div className="mb-4 flex items-center justify-between gap-3 text-xs font-semibold text-slate-500">
          <span>
            Side {pageIndex + 1} av {CHECK_IN_PAGE_COUNT} · {window.daysRemaining} dager igjen
          </span>
          <button type="button" onClick={onClose} className="text-slate-500 underline-offset-2 hover:text-slate-800 hover:underline">
            Lukk
          </button>
        </div>
        <div className="mb-2 h-1.5 overflow-hidden rounded-full bg-slate-100">
          <div
            className="h-full rounded-full transition-all duration-300"
            style={{
              width: `${((pageIndex + 1) / CHECK_IN_PAGE_COUNT) * 100}%`,
              background: `linear-gradient(90deg, ${MOTUS.turquoise} 0%, ${MOTUS.pink} 100%)`,
            }}
          />
        </div>

        <Card className="flex flex-1 flex-col overflow-hidden border-0 shadow-lg ring-1 ring-slate-200/80">
          <div className="border-b border-slate-100 px-4 py-4 sm:px-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-teal-700">Månedlig sjekk-inn · {window.monthLabel}</p>
            <h1 className="mt-1 text-xl font-bold text-slate-950 sm:text-2xl">Hei {memberName.split(" ")[0] || "der"}!</h1>
            <p className="mt-1 text-sm text-slate-600">{theme.subtitle}</p>
          </div>

          <div className="flex-1 overflow-y-auto px-4 py-4 sm:px-5">
            {pageIndex === 0 ? (
              <div className="space-y-5">
                <div>
                  <p className="text-sm font-medium text-slate-800">Hvordan går treningen?</p>
                  <div className="mt-3">
                    <ScalePicker value={draft.trainingGoing} labels={TRAINING_GOING_LABELS} onChange={(trainingGoing) => patchDraft({ trainingGoing })} />
                  </div>
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-800">Har treningen gått som forventet?</p>
                  <div className="mt-3">
                    <ScalePicker
                      value={draft.metExpectations}
                      labels={MET_EXPECTATIONS_LABELS}
                      onChange={(metExpectations) => patchDraft({ metExpectations })}
                    />
                  </div>
                </div>
              </div>
            ) : null}

            {pageIndex === 1 ? (
              <div className="space-y-4">
                <div>
                  <p className="text-sm font-medium text-slate-800">Hva trenger du av trening fremover?</p>
                  <p className="mt-0.5 text-xs text-slate-500">Velg ett eller flere.</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {TRAINING_NEED_OPTIONS.map((option) => (
                      <Chip key={option} label={option} active={draft.trainingNeeds.includes(option)} onClick={() => toggleNeed(option)} />
                    ))}
                  </div>
                </div>
                <label className="block space-y-1">
                  <span className="text-sm font-medium text-slate-800">Utdyp gjerne (valgfritt)</span>
                  <TextArea
                    value={draft.trainingNeedsNotes}
                    onChange={(event) => patchDraft({ trainingNeedsNotes: event.target.value })}
                    className="min-h-[72px]"
                    placeholder="F.eks. mer fokus på core, færre tunge knebøy…"
                  />
                </label>
              </div>
            ) : null}

            {pageIndex === 2 ? (
              <div className="space-y-4">
                <label className="block space-y-1">
                  <span className="text-sm font-medium text-slate-800">Hva gjorde det utfordrende denne måneden?</span>
                  <TextArea
                    value={draft.challengingNotes}
                    onChange={(event) => patchDraft({ challengingNotes: event.target.value })}
                    className="min-h-[90px]"
                    placeholder="Tid, motivasjon, skader, reise… (valgfritt)"
                  />
                </label>
                <label className="block space-y-1">
                  <span className="text-sm font-medium text-slate-800">Noe mer til treneren? (valgfritt)</span>
                  <TextArea
                    value={draft.coachNotes}
                    onChange={(event) => patchDraft({ coachNotes: event.target.value })}
                    className="min-h-[72px]"
                    placeholder="Kort beskjed som PT kan lese på kundekortet."
                  />
                </label>
              </div>
            ) : null}

            {error ? <p className="mt-3 text-sm text-rose-600">{error}</p> : null}
          </div>

          <div
            className="flex gap-2 border-t border-slate-100 px-4 py-4 sm:px-5"
            style={{ paddingBottom: "max(1rem, env(safe-area-inset-bottom))" }}
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
                {isLastPage ? (submitting ? "Lagrer…" : "Send inn") : "Neste"}
                {!isLastPage ? <ChevronRight className="h-4 w-4" /> : null}
              </span>
            </GradientButton>
          </div>
        </Card>
      </div>
    </div>
  );
}
