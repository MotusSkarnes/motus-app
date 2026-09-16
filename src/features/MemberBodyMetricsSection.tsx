import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Plus, Scale, ShieldCheck, Trash2 } from "lucide-react";
import { MOTUS } from "../app/data";
import {
  buildBodyMetricsTimeline,
  getShareBodyMetricsWithTrainer,
} from "../app/memberBodyMetrics";
import { MEMBER_STOP_GOAL_OPTIONS, type MemberStopGoal } from "../app/memberStopGoal";
import { GradientButton, OutlineButton, SelectBox, TextInput } from "../app/ui";
import { BodyMetricsCharts, formatBodyMetricValue } from "./BodyMetricsCharts";

const MOTUS_GRADIENT = `${MOTUS.gradient}`;

type MemberBodyMetricsSectionProps = {
  personalGoals: string | undefined;
  targetWeight?: string;
  onLog: (input: { weightKg?: number; bodyFatPct?: number; shareWithTrainer: boolean }) => void | Promise<void>;
  isSaving?: boolean;
  stopGoals: MemberStopGoal[];
  setStopGoals: (value: MemberStopGoal[]) => void;
  onSaveStopGoals: () => void | Promise<void>;
  stopGoalsSaveStatus?: string | null;
};

function parseDecimalInput(raw: string): number | undefined {
  const trimmed = raw.trim().replace(",", ".");
  if (!trimmed) return undefined;
  const n = Number.parseFloat(trimmed);
  if (!Number.isFinite(n) || n <= 0) return undefined;
  return n;
}

function createEmptyStopGoal(): MemberStopGoal {
  return { target: "", customTarget: "", startedAt: new Date().toISOString().slice(0, 10) };
}

export function MemberBodyMetricsSection({
  personalGoals,
  targetWeight,
  onLog,
  isSaving = false,
  stopGoals,
  setStopGoals,
  onSaveStopGoals,
  stopGoalsSaveStatus,
}: MemberBodyMetricsSectionProps) {
  const [weightInput, setWeightInput] = useState("");
  const [bodyFatInput, setBodyFatInput] = useState("");
  const [shareWithTrainer, setShareWithTrainer] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const timeline = useMemo(() => buildBodyMetricsTimeline(personalGoals), [personalGoals]);
  const storedShare = getShareBodyMetricsWithTrainer(personalGoals);
  const latestWeight = timeline.weightSeries[timeline.weightSeries.length - 1]?.value ?? null;
  const latestBodyFat = timeline.bodyFatSeries[timeline.bodyFatSeries.length - 1]?.value ?? null;
  const targetWeightNum = parseDecimalInput(targetWeight ?? "");

  useEffect(() => {
    setShareWithTrainer(storedShare);
  }, [storedShare]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const weightKg = parseDecimalInput(weightInput);
    const bodyFatPct = parseDecimalInput(bodyFatInput);
    if (weightKg === undefined && bodyFatPct === undefined) {
      setError("Oppgi vekt og/eller fettprosent.");
      return;
    }
    if (bodyFatPct !== undefined && bodyFatPct > 100) {
      setError("Fettprosent må være under 100.");
      return;
    }
    setError(null);
    await onLog({ weightKg, bodyFatPct, shareWithTrainer });
    setWeightInput("");
    setBodyFatInput("");
  }

  function updateStopGoal(index: number, patch: Partial<MemberStopGoal>) {
    const source = stopGoals.length ? stopGoals : [createEmptyStopGoal()];
    setStopGoals(
      source.map((goal, goalIndex) =>
        goalIndex === index
          ? {
              ...goal,
              ...patch,
            }
          : goal,
      ),
    );
  }

  function addStopGoal() {
    const source = stopGoals.length ? stopGoals : [createEmptyStopGoal()];
    setStopGoals([...source, createEmptyStopGoal()]);
  }

  function removeStopGoal(index: number) {
    const source = stopGoals.length ? stopGoals : [createEmptyStopGoal()];
    setStopGoals(source.filter((_, goalIndex) => goalIndex !== index));
  }

  return (
    <>
    <section className="motus-progress-section-card">
      <div className="flex items-start gap-3">
        <span className="inline-flex shrink-0 rounded-xl p-2.5 text-white shadow-sm" style={{ background: MOTUS_GRADIENT }}>
          <Scale className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold uppercase tracking-wide text-teal-700">Kroppssammensetning</p>
          <h3 className="mt-0.5 text-lg font-bold text-slate-900">Vekt og fettprosent</h3>
          <p className="mt-0.5 text-xs text-slate-500">
            Logg vekt selv når som helst. Tanita-målinger fra månedlig sjekk-inn vises automatisk i grafene.
          </p>
        </div>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
          <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Siste vekt</div>
          <div className="mt-1 text-xl font-bold text-slate-900">
            {latestWeight !== null ? formatBodyMetricValue(latestWeight, "kg") : "–"}
          </div>
          {targetWeightNum !== undefined ? (
            <div className="mt-1 text-xs text-slate-600">
              Målvekt: <span className="font-semibold">{formatBodyMetricValue(targetWeightNum, "kg")}</span>
              {latestWeight !== null ? (
                <span className="ml-1 text-slate-500">
                  ({latestWeight - targetWeightNum >= 0 ? "+" : ""}
                  {formatBodyMetricValue(latestWeight - targetWeightNum, "kg", true).replace(" kg", "")} kg)
                </span>
              ) : null}
            </div>
          ) : null}
        </div>
        <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
          <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Siste fettprosent</div>
          <div className="mt-1 text-xl font-bold text-slate-900">
            {latestBodyFat !== null ? formatBodyMetricValue(latestBodyFat, "%") : "–"}
          </div>
          <div className="mt-1 text-xs text-slate-500">Ofte fra Tanita ved sjekk-inn</div>
        </div>
      </div>

      <form className="mt-4 space-y-3 rounded-xl border border-slate-200 bg-white p-4" onSubmit={(event) => void handleSubmit(event)}>
        <p className="text-sm font-semibold text-slate-800">Logg ny måling</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-sm">
            <span className="mb-1 block font-medium text-slate-700">Vekt (kg)</span>
            <TextInput
              value={weightInput}
              onChange={(event) => setWeightInput(event.target.value)}
              inputMode="decimal"
              placeholder="f.eks. 78,5"
              disabled={isSaving}
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-medium text-slate-700">Fettprosent (%) — valgfritt</span>
            <TextInput
              value={bodyFatInput}
              onChange={(event) => setBodyFatInput(event.target.value)}
              inputMode="decimal"
              placeholder="f.eks. 18,2"
              disabled={isSaving}
            />
          </label>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={shareWithTrainer}
          disabled={isSaving}
          onClick={() => setShareWithTrainer((value) => !value)}
          className="motus-body-metric-share"
        >
          <span className="min-w-0 text-left">
            <span className="block text-sm font-semibold text-slate-800">Del med trener</span>
            <span className="mt-0.5 block text-xs text-slate-500">
              {shareWithTrainer
                ? "Treneren kan se vekt og fettprosent i progresjon."
                : "Treneren ser ikke vekt og fettprosent før du slår på deling."}
            </span>
          </span>
          <span className={`motus-body-metric-share-track${shareWithTrainer ? " is-on" : ""}`} aria-hidden>
            <span className="motus-body-metric-share-thumb" />
          </span>
        </button>
        {error ? <p className="text-sm text-rose-600">{error}</p> : null}
        <GradientButton type="submit" disabled={isSaving}>
          {isSaving ? "Lagrer…" : "Lagre måling"}
        </GradientButton>
      </form>

      <div className="mt-5">
        <BodyMetricsCharts
          weightSeries={timeline.weightSeries}
          bodyFatSeries={timeline.bodyFatSeries}
          idPrefix="member-body"
        />
      </div>
    </section>
    <section className="motus-progress-section-card">
      <div className="flex items-start gap-3">
        <span className="inline-flex shrink-0 rounded-xl p-2.5 text-white shadow-sm" style={{ background: MOTUS_GRADIENT }} aria-hidden>
          <ShieldCheck className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold uppercase tracking-wide text-teal-700">Profil</p>
          <h3 className="mt-0.5 text-lg font-bold text-slate-900">Stopp</h3>
          <p className="mt-0.5 text-xs text-slate-500">
            Legg til ett eller flere stopp. På forsiden kan du sveipe mellom dem.
          </p>
        </div>
      </div>
      <div className="mt-4 space-y-3">
        {(stopGoals.length ? stopGoals : [createEmptyStopGoal()]).map((goal, index) => (
          <div key={`${index}-${goal.startedAt}`} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
            <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
              Stopp {index + 1}
            </div>
            <div className="grid gap-3 sm:grid-cols-[1fr_1fr_10rem_auto] sm:items-end">
              <label className="space-y-1">
                <span className="text-xs font-semibold text-slate-700">Velg</span>
                <SelectBox
                  value={goal.target}
                  onChange={(value) => updateStopGoal(index, { target: value })}
                  options={[{ value: "", label: "Velg stopp" }, ...MEMBER_STOP_GOAL_OPTIONS.map((option) => ({ value: option, label: option }))]}
                />
              </label>
              <label className="space-y-1">
                <span className="text-xs font-semibold text-slate-700">Eget stopp</span>
                <TextInput
                  value={goal.customTarget}
                  onChange={(event) => updateStopGoal(index, { customTarget: event.target.value })}
                  placeholder="F.eks. kaffe"
                />
              </label>
              <label className="space-y-1">
                <span className="text-xs font-semibold text-slate-700">Startdato</span>
                <TextInput
                  type="date"
                  value={goal.startedAt}
                  onChange={(event) => updateStopGoal(index, { startedAt: event.target.value })}
                />
              </label>
              <button
                type="button"
                onClick={() => removeStopGoal(index)}
                className="inline-flex h-10 items-center justify-center rounded-xl border border-slate-200 bg-white px-3 text-slate-500 transition hover:border-rose-200 hover:bg-rose-50 hover:text-rose-700"
                aria-label="Fjern stopp"
                title="Fjern stopp"
              >
                <Trash2 className="h-4 w-4" aria-hidden />
              </button>
            </div>
          </div>
        ))}
      </div>
      <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center">
        <OutlineButton type="button" onClick={addStopGoal} className="w-full sm:w-auto">
          <span className="inline-flex items-center gap-2">
            <Plus className="h-4 w-4" aria-hidden />
            Legg til flere stopp
          </span>
        </OutlineButton>
        <GradientButton type="button" onClick={() => void onSaveStopGoals()} className="w-full sm:w-auto">
          Lagre stopp
        </GradientButton>
        {stopGoalsSaveStatus ? <span className="text-xs font-medium text-slate-600">{stopGoalsSaveStatus}</span> : null}
      </div>
    </section>
    </>
  );
}
