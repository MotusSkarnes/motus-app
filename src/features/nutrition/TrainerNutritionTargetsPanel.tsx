import { Lock, Unlock } from "lucide-react";
import type { MacroTargetField } from "../../app/mealPlanTargetBalance";
import type { NutritionTargetEditField } from "../../app/mealPlanTargetBalance";
import type { MealPlanTargets } from "../../app/mealPlanTypes";
import type { MemberWeightSource } from "../../app/memberNutritionTargets";
import { TextInput } from "../../app/ui";

type TrainerNutritionTargetsPanelProps = {
  targets?: MealPlanTargets;
  bodyWeightKg: number | null;
  weightSource?: MemberWeightSource | null;
  derivedField?: MacroTargetField | null;
  warning?: string | null;
  hint?: string | null;
  onEdit: (field: NutritionTargetEditField, value: string | boolean) => void;
};

function fieldValue(targets: MealPlanTargets | undefined, field: keyof MealPlanTargets): string {
  const value = targets?.[field];
  return typeof value === "number" && Number.isFinite(value) ? String(value) : "";
}

export function TrainerNutritionTargetsPanel({
  targets,
  bodyWeightKg,
  weightSource,
  derivedField = null,
  warning,
  hint,
  onEdit,
}: TrainerNutritionTargetsPanelProps) {
  const kcalLocked = targets?.kcalLocked === true;
  const weightLabel =
    bodyWeightKg != null
      ? `${String(bodyWeightKg).replace(".", ",")} kg${weightSource === "metrics" ? " · siste måling" : " · fra klientkort"}`
      : null;
  const proteinFromPerKg =
    bodyWeightKg != null && typeof targets?.proteinPerKg === "number"
      ? Math.round(targets.proteinPerKg * bodyWeightKg * 10) / 10
      : null;

  return (
    <section className="motus-nutrition-targets" aria-label="Daglige mål">
      <div className="motus-nutrition-targets__head">
        <div>
          <h3 className="motus-nutrition-targets__title">Daglige mål</h3>
          <p className="motus-nutrition-targets__sub">
            Kan settes uten ukeplan. Protein i g/kg, kalorier i kcal, karbo og fett i gram.
          </p>
        </div>
      </div>

      <p className="motus-nutrition-targets__weight">
        {weightLabel ? (
          <>Vekt: {weightLabel}</>
        ) : (
          <>Ingen vekt funnet — sett vekt på klientkortet eller i kroppsmål for å bruke g/kg.</>
        )}
      </p>

      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
        <label className="space-y-1 text-[11px] font-medium text-slate-600">
          <span className="flex items-center justify-between gap-1">
            Kalorier (kcal)
            <button
              type="button"
              className={`motus-macro-split-lock-btn ${kcalLocked ? "motus-macro-split-lock-btn--active" : ""}`}
              onClick={() => onEdit("kcalLocked", !kcalLocked)}
              aria-pressed={kcalLocked}
              aria-label={kcalLocked ? "Lås opp kcal" : "Lås kcal"}
              title={kcalLocked ? "Lås opp kcal" : "Lås kcal — karbo og fett justeres etter protein"}
            >
              {kcalLocked ? <Lock className="h-3.5 w-3.5" aria-hidden /> : <Unlock className="h-3.5 w-3.5" aria-hidden />}
            </button>
          </span>
          <TextInput
            value={fieldValue(targets, "kcal")}
            onChange={(e) => onEdit("kcal", e.target.value)}
            inputMode="decimal"
            className={kcalLocked ? "border-teal-200 bg-teal-50/50" : undefined}
          />
        </label>

        <label className="space-y-1 text-[11px] font-medium text-slate-600">
          <span>Protein (g/kg)</span>
          <TextInput
            value={fieldValue(targets, "proteinPerKg")}
            onChange={(e) => onEdit("proteinPerKg", e.target.value)}
            inputMode="decimal"
            placeholder={bodyWeightKg == null ? "Trenger vekt" : "f.eks. 1,6"}
          />
        </label>

        <label className="space-y-1 text-[11px] font-medium text-slate-600">
          <span>
            Protein (g)
            {derivedField === "protein" ? <span className="ml-1 font-normal text-teal-700">(beregnet)</span> : null}
          </span>
          <TextInput
            value={fieldValue(targets, "protein")}
            onChange={(e) => onEdit("protein", e.target.value)}
            inputMode="decimal"
            className={derivedField === "protein" ? "border-teal-200 bg-teal-50/50" : undefined}
          />
        </label>

        <label className="space-y-1 text-[11px] font-medium text-slate-600">
          <span>
            Karbohydrater (g)
            {derivedField === "carbs" ? <span className="ml-1 font-normal text-teal-700">(beregnet)</span> : null}
          </span>
          <TextInput
            value={fieldValue(targets, "carbs")}
            onChange={(e) => onEdit("carbs", e.target.value)}
            inputMode="decimal"
            className={derivedField === "carbs" ? "border-teal-200 bg-teal-50/50" : undefined}
          />
        </label>

        <label className="space-y-1 text-[11px] font-medium text-slate-600">
          <span>
            Fett (g)
            {derivedField === "fat" ? <span className="ml-1 font-normal text-teal-700">(beregnet)</span> : null}
          </span>
          <TextInput
            value={fieldValue(targets, "fat")}
            onChange={(e) => onEdit("fat", e.target.value)}
            inputMode="decimal"
            className={derivedField === "fat" ? "border-teal-200 bg-teal-50/50" : undefined}
          />
        </label>
      </div>

      {proteinFromPerKg != null ? (
        <p className="mt-2 text-[11px] text-slate-500">
          {String(targets?.proteinPerKg).replace(".", ",")} g/kg × {String(bodyWeightKg).replace(".", ",")} kg ={" "}
          {String(proteinFromPerKg).replace(".", ",")} g protein
        </p>
      ) : null}

      {kcalLocked ? (
        <p className="mt-2 text-[11px] text-teal-800">
          Kcal er låst. Når du endrer protein, justeres karbohydrater og fett slik at kalorimålet holder.
        </p>
      ) : (
        <p className="mt-2 text-[11px] text-slate-500">
          Lås kcal for å holde kalorimålet fast mens karbo og fett fyller resten etter protein.
        </p>
      )}

      {warning ? (
        <p className="mt-2 text-[11px] font-medium text-rose-700">{warning}</p>
      ) : hint ? (
        <p className="mt-2 text-[11px] text-slate-600">{hint}</p>
      ) : null}
    </section>
  );
}
