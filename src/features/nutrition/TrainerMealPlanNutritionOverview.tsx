import { Check } from "lucide-react";
import { formatMacro } from "../../app/foodBankTypes";
import { formatMicronutrientValue } from "../../app/foodBankMicronutrients";
import type { MacroTotals } from "../../app/mealPlanMacros";
import { planMatchesTargets } from "../../app/mealPlanWeekPlanner";
import type { MealPlanNutritionReference, MealPlanTargets } from "../../app/mealPlanTypes";
import type { MicronutrientDailyRow } from "../../app/quickFoodLogNutrition";
import {
  nutritionReferenceFootnote,
  type NutritionReferenceContext,
} from "../../app/personalizedNutritionReferences";
import { MacroProgressBar } from "./MacroProgressBar";
import { MacroProgressRing } from "./MacroProgressRing";
import { TextInput } from "../../app/ui";
export { MICRONUTRIENT_DAILY_TARGETS } from "../../app/healthDirectorateNutritionReferences";

export type MicronutrientOverviewRow = {
  key: MicronutrientDailyRow["key"];
  label: string;
  unit: string;
  value: number;
  target: number;
  coveragePct: number;
  statusTone?: MicronutrientDailyRow["statusTone"];
  statusLabel?: string;
  decimals?: number;
};

type TrainerMealPlanNutritionOverviewProps = {
  averageUsed: MacroTotals;
  targets?: MealPlanTargets;
  micronutrients?: MicronutrientOverviewRow[];
  referenceContext?: NutritionReferenceContext;
  reference?: MealPlanNutritionReference | null;
  profileAvailable?: boolean;
  onReferenceChange?: (next: MealPlanNutritionReference) => void;
};

function defaultReferenceMode(
  stored: MealPlanNutritionReference | null | undefined,
  profileAvailable: boolean,
): MealPlanNutritionReference["mode"] {
  return stored?.mode ?? (profileAvailable ? "profile" : "highest");
}

export function TrainerMealPlanNutritionOverview({
  averageUsed,
  targets,
  micronutrients = [],
  referenceContext,
  reference,
  profileAvailable = false,
  onReferenceChange,
}: TrainerMealPlanNutritionOverviewProps) {
  const targetKcal = targets?.kcal ?? 0;
  const targetProtein = targets?.protein ?? 0;
  const targetCarbs = targets?.carbs ?? 0;
  const targetFat = targets?.fat ?? 0;
  const onTrack = planMatchesTargets(averageUsed, targets);
  const hasFood = averageUsed.kcal > 0 || micronutrients.some((row) => row.value > 0);
  const withinCount = micronutrients.filter((row) => row.statusTone === "ok").length;
  const mode = defaultReferenceMode(reference, profileAvailable);
  const customAge = reference?.ageYears ?? referenceContext?.ageYears ?? 30;
  const customGender = reference?.gender ?? (referenceContext?.gender === "male" || referenceContext?.gender === "female"
    ? referenceContext.gender
    : "female");

  function setMode(nextMode: MealPlanNutritionReference["mode"]) {
    if (!onReferenceChange) return;
    if (nextMode === "custom") {
      onReferenceChange({ mode: "custom", ageYears: customAge, gender: customGender });
      return;
    }
    onReferenceChange({ mode: nextMode });
  }

  return (
    <div className="motus-pt-planner-nutrition">
      {onReferenceChange ? (
        <div className="motus-pt-planner-nutrition__ref">
          <p className="motus-pt-planner-nutrition__ref-label">Anbefalinger for mikronæringsstoffer</p>
          <div className="motus-pt-planner-nutrition__ref-modes" role="group" aria-label="Velg anbefaling">
            {profileAvailable ? (
              <button
                type="button"
                className={`motus-pt-planner-nutrition__ref-btn ${mode === "profile" ? "is-active" : ""}`}
                aria-pressed={mode === "profile"}
                onClick={() => setMode("profile")}
              >
                Klientens profil
              </button>
            ) : null}
            <button
              type="button"
              className={`motus-pt-planner-nutrition__ref-btn ${mode === "highest" ? "is-active" : ""}`}
              aria-pressed={mode === "highest"}
              onClick={() => setMode("highest")}
            >
              Høyeste anbefaling
            </button>
            <button
              type="button"
              className={`motus-pt-planner-nutrition__ref-btn ${mode === "custom" ? "is-active" : ""}`}
              aria-pressed={mode === "custom"}
              onClick={() => setMode("custom")}
            >
              Alder og kjønn
            </button>
          </div>
          {mode === "custom" ? (
            <div className="motus-pt-planner-nutrition__ref-custom">
              <label className="motus-pt-planner-nutrition__ref-field">
                <span>Alder</span>
                <TextInput
                  type="number"
                  min={1}
                  max={119}
                  value={String(customAge)}
                  onChange={(event) => {
                    const ageYears = Number(event.target.value);
                    onReferenceChange({
                      mode: "custom",
                      ageYears: Number.isFinite(ageYears) ? ageYears : undefined,
                      gender: customGender,
                    });
                  }}
                />
              </label>
              <label className="motus-pt-planner-nutrition__ref-field">
                <span>Kjønn</span>
                <select
                  value={customGender}
                  onChange={(event) =>
                    onReferenceChange({
                      mode: "custom",
                      ageYears: customAge,
                      gender: event.target.value === "male" ? "male" : "female",
                    })
                  }
                >
                  <option value="female">Kvinne</option>
                  <option value="male">Mann</option>
                </select>
              </label>
            </div>
          ) : null}
        </div>
      ) : null}

      {targetKcal ? (
        <>
          <div className="motus-pt-planner-nutrition__body">
            <MacroProgressRing
              label="Kalorier"
              current={averageUsed.kcal}
              target={targetKcal}
              unit="kcal"
              size="xl"
              hideLabel
            />
            <div className="motus-pt-planner-nutrition__bars">
              <MacroProgressBar label="Protein" current={averageUsed.protein} target={targetProtein} />
              <MacroProgressBar label="Karbohydrater" current={averageUsed.carbs} target={targetCarbs} />
              <MacroProgressBar label="Fett" current={averageUsed.fat} target={targetFat} />
            </div>
          </div>
          <p className={`motus-pt-planner-nutrition__status ${onTrack ? "is-ok" : ""}`}>
            {onTrack ? (
              <>
                <Check className="h-4 w-4" aria-hidden />
                Planen er i tråd med makromålene
              </>
            ) : (
              <>
                Gjennomsnitt: {formatMacro(averageUsed.kcal, 0)} kcal · mål {formatMacro(targetKcal, 0)} kcal
              </>
            )}
          </p>
        </>
      ) : (
        <p className="text-sm text-slate-600">
          Fyll inn daglige makromål i steg 1 for å sammenligne kalorier og makroer. Mikronæringsstoffer oppdateres
          likevel etter hvert som du legger til mat.
        </p>
      )}

      <div className="motus-pt-planner-nutrition__micros">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">Mikronæringsstoffer (snitt per dag)</p>
          {hasFood && micronutrients.length ? (
            <p className="text-[11px] text-slate-500">
              {withinCount} av {micronutrients.length} innenfor anbefalt
            </p>
          ) : null}
        </div>
        {!hasFood ? (
          <p className="mt-2 text-xs text-slate-500">Legg til matvarer — da fylles stolpene mot anbefalt inntak.</p>
        ) : (
          <div className="mt-2 space-y-1.5">
            {micronutrients.map((row) => {
              const pct = Math.max(0, Math.round(row.coveragePct));
              const barPct = Math.min(100, pct);
              const tone = row.statusTone ?? (pct >= 80 ? "ok" : pct >= 50 ? "warn" : "danger");
              const decimals = row.decimals ?? 1;
              return (
                <div key={row.key} className="motus-pt-planner-micro">
                  <div className="motus-pt-planner-micro__head">
                    <span className="motus-pt-planner-micro__label">{row.label}</span>
                    <span className={`motus-pt-planner-micro__status is-${tone}`}>
                      {row.statusLabel ?? `${pct}%`}
                    </span>
                  </div>
                  <div className="motus-pt-planner-micro__track" aria-hidden>
                    <div className={`motus-pt-planner-micro__fill is-${tone}`} style={{ width: `${barPct}%` }} />
                  </div>
                  <p className="motus-pt-planner-micro__values">
                    {formatMicronutrientValue(row.value, decimals)} {row.unit} av{" "}
                    {formatMicronutrientValue(row.target, decimals)} {row.unit} ({formatMacro(row.coveragePct, 0)}%)
                  </p>
                </div>
              );
            })}
          </div>
        )}
        <p className="mt-2 text-[11px] text-slate-500">
          {referenceContext ? nutritionReferenceFootnote(referenceContext) : "Anbefalte dagsmengder er generelle voksenreferanser."}
        </p>
      </div>
    </div>
  );
}
