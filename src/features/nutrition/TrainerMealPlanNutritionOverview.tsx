import { formatMacro } from "../../app/foodBankTypes";
import { formatMicronutrientValue } from "../../app/foodBankMicronutrients";
import type { MacroTotals } from "../../app/mealPlanMacros";
import type { MealPlanNutritionReference, MealPlanTargets } from "../../app/mealPlanTypes";
import type { MicronutrientDailyRow } from "../../app/quickFoodLogNutrition";
import {
  nutritionReferenceFootnote,
  type NutritionReferenceContext,
} from "../../app/personalizedNutritionReferences";
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
  averageFiber?: number;
  targets?: MealPlanTargets;
  micronutrients?: MicronutrientOverviewRow[];
  referenceContext?: NutritionReferenceContext;
  reference?: MealPlanNutritionReference | null;
  profileAvailable?: boolean;
  onReferenceChange?: (next: MealPlanNutritionReference) => void;
  compact?: boolean;
  tableCaption?: string;
};

function defaultReferenceMode(
  stored: MealPlanNutritionReference | null | undefined,
  profileAvailable: boolean,
): MealPlanNutritionReference["mode"] {
  return stored?.mode ?? (profileAvailable ? "profile" : "highest");
}

function formatTargetMacro(value: number): string {
  if (!value) return "–";
  return formatMacro(value, 0);
}

export function macroCoverageTone(value: number, target: number): MicronutrientDailyRow["statusTone"] {
  if (!(target > 0)) return "muted";
  const pct = (value / target) * 100;
  if (pct < 50) return "danger";
  if (pct < 80) return "warn";
  if (pct > 150) return "danger";
  if (pct > 120) return "warn";
  return "ok";
}

export function TrainerMealPlanNutritionOverview({
  averageUsed,
  averageFiber = 0,
  targets,
  micronutrients = [],
  referenceContext,
  reference,
  profileAvailable = false,
  onReferenceChange,
  compact = false,
  tableCaption,
}: TrainerMealPlanNutritionOverviewProps) {
  const targetKcal = targets?.kcal ?? 0;
  const targetProtein = targets?.protein ?? 0;
  const targetCarbs = targets?.carbs ?? 0;
  const targetFat = targets?.fat ?? 0;
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

  const macroRows = [
    {
      key: "kcal",
      label: "Kalorier",
      unit: "kcal",
      plan: formatMacro(averageUsed.kcal, 0),
      recommended: formatTargetMacro(targetKcal),
      tone: macroCoverageTone(averageUsed.kcal, targetKcal),
    },
    {
      key: "protein",
      label: "Protein",
      unit: "g",
      plan: formatMacro(averageUsed.protein, 0),
      recommended: formatTargetMacro(targetProtein),
      tone: macroCoverageTone(averageUsed.protein, targetProtein),
    },
    {
      key: "carbs",
      label: "Karbohydrater",
      unit: "g",
      plan: formatMacro(averageUsed.carbs, 0),
      recommended: formatTargetMacro(targetCarbs),
      tone: macroCoverageTone(averageUsed.carbs, targetCarbs),
    },
    {
      key: "fat",
      label: "Fett",
      unit: "g",
      plan: formatMacro(averageUsed.fat, 0),
      recommended: formatTargetMacro(targetFat),
      tone: macroCoverageTone(averageUsed.fat, targetFat),
    },
    {
      key: "fiber",
      label: "Fiber",
      unit: "g",
      plan: formatMacro(averageFiber, 1),
      recommended: formatMacro(referenceContext?.otherDaily.fiber ?? 25, 0),
      tone: macroCoverageTone(averageFiber, referenceContext?.otherDaily.fiber ?? 25),
    },
  ];

  return (
    <div className={`motus-pt-planner-nutrition${compact ? " motus-pt-planner-nutrition--compact" : ""}`}>
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

      <table className="motus-pt-planner-nutrition-table">
        <caption className="motus-pt-planner-nutrition-table__caption">{tableCaption ?? "Snitt per dag"}</caption>
        <thead>
          <tr>
            <th scope="col">Næringsstoff</th>
            <th scope="col">Plan</th>
            <th scope="col">Anbefalt</th>
          </tr>
        </thead>
        <tbody>
          {macroRows.map((row) => (
            <tr key={row.key} className={`is-${row.tone}`}>
              <th scope="row">
                {row.label}
                <span className="motus-pt-planner-nutrition-table__unit"> {row.unit}</span>
              </th>
              <td>{row.plan}</td>
              <td>{row.recommended}</td>
            </tr>
          ))}
          {micronutrients.map((row) => {
            const decimals = row.decimals ?? 1;
            const tone = row.statusTone ?? "muted";
            return (
              <tr key={row.key} className={`is-${tone}`} title={row.statusLabel}>
                <th scope="row">
                  {row.label}
                  <span className="motus-pt-planner-nutrition-table__unit"> {row.unit}</span>
                </th>
                <td>{formatMicronutrientValue(row.value, decimals)}</td>
                <td>{formatMicronutrientValue(row.target, decimals)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="motus-pt-planner-nutrition__footnote">
        {referenceContext ? nutritionReferenceFootnote(referenceContext) : "Anbefalte dagsmengder er generelle voksenreferanser."}
      </p>
    </div>
  );
}
