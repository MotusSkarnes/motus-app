import { formatMacro } from "../app/foodBankTypes";
import type { MacroTotals } from "../app/mealPlanMacros";
import { formatMacroTotals } from "../app/mealPlanMacros";
import type { MacroRemaining } from "../app/mealPlanTrainerMacros";
import type { MealMacroAdjustmentSuggestion } from "../app/mealPlanTrainerMacros";
import { macroUsagePct } from "../app/mealPlanTrainerMacros";
import type { MealPlanTargets } from "../app/mealPlanTypes";
import { OutlineButton } from "../app/ui";
import { MOTUS } from "../app/data";

type MacroBarProps = {
  label: string;
  used: number;
  target: number;
  unit?: string;
  tone?: "mint" | "pink";
};

function MacroBar({ label, used, target, unit = "", tone = "mint" }: MacroBarProps) {
  const pct = macroUsagePct(used, target);
  const remaining = target - used;
  const over = remaining < 0;
  const color = tone === "pink" ? MOTUS.pink : MOTUS.turquoise;

  return (
    <div className="motus-pt-macro-bar">
      <div className="motus-pt-macro-bar-head">
        <span className="motus-pt-macro-bar-label">{label}</span>
        <span className={`motus-pt-macro-bar-remaining ${over ? "is-over" : ""}`}>
          {over ? `${formatMacro(Math.abs(remaining), 0)} over` : `${formatMacro(remaining, 0)} igjen`}
          {unit ? ` ${unit}` : ""}
        </span>
      </div>
      <div className="motus-pt-macro-bar-track" aria-hidden>
        <div
          className="motus-pt-macro-bar-fill"
          style={{ width: `${Math.min(100, pct)}%`, background: over ? "#f43f5e" : color }}
        />
      </div>
      <div className="motus-pt-macro-bar-meta">
        <span>
          {formatMacro(used, 0)} / {formatMacro(target, 0)}
          {unit}
        </span>
        <span>{pct}%</span>
      </div>
    </div>
  );
}

type TrainerMealPlanMacroPanelProps = {
  dayLabel: string;
  dailyTargets?: MealPlanTargets;
  dayUsed: MacroTotals;
  dayRemaining: MacroRemaining;
  onDistribute: (mode: "equal" | "standard") => void;
  onClearMealTargets: () => void;
  adjustmentSuggestions?: MealMacroAdjustmentSuggestion[];
  onApplySuggestion?: (suggestion: MealMacroAdjustmentSuggestion) => void;
};

export function TrainerMealPlanMacroPanel({
  dayLabel,
  dailyTargets,
  dayUsed,
  dayRemaining,
  onDistribute,
  onClearMealTargets,
  adjustmentSuggestions = [],
  onApplySuggestion,
}: TrainerMealPlanMacroPanelProps) {
  if (!dayRemaining.hasTargets || !dailyTargets) {
    return (
      <div className="motus-pt-macro-panel motus-pt-macro-panel--empty">
        <p className="text-xs text-slate-600">
          Fyll inn <strong>daglige makromål</strong> over for å se nedtelling og forslag når du legger til matvarer for {dayLabel}.
        </p>
      </div>
    );
  }

  return (
    <section className="motus-pt-macro-panel" aria-label={`Makro for ${dayLabel}`}>
      <div className="motus-pt-macro-panel-head">
        <div>
          <h3 className="motus-pt-macro-panel-title">Makro · {dayLabel}</h3>
          <p className="motus-pt-macro-panel-sub">
            Planlagt: {formatMacroTotals(dayUsed)} — teller ned når du legger til matvarer
          </p>
        </div>
        <div className="motus-pt-macro-panel-actions">
          <OutlineButton type="button" className="text-[11px] !px-2 !py-1" onClick={() => onDistribute("standard")}>
            Fordel på måltid
          </OutlineButton>
          <OutlineButton type="button" className="text-[11px] !px-2 !py-1" onClick={() => onDistribute("equal")}>
            Lik fordeling
          </OutlineButton>
          <OutlineButton type="button" className="text-[11px] !px-2 !py-1" onClick={onClearMealTargets}>
            Fjern måltidsmål
          </OutlineButton>
        </div>
      </div>
      <div className="motus-pt-macro-bar-grid">
        {dailyTargets.kcal ? (
          <MacroBar label="Kalorier" used={dayUsed.kcal} target={dailyTargets.kcal} unit="kcal" />
        ) : null}
        {dailyTargets.protein ? (
          <MacroBar label="Protein" used={dayUsed.protein} target={dailyTargets.protein} unit="g" />
        ) : null}
        {dailyTargets.carbs ? (
          <MacroBar label="Karbohydrater" used={dayUsed.carbs} target={dailyTargets.carbs} unit="g" tone="pink" />
        ) : null}
        {dailyTargets.fat ? (
          <MacroBar label="Fett" used={dayUsed.fat} target={dailyTargets.fat} unit="g" tone="pink" />
        ) : null}
      </div>
      {adjustmentSuggestions.length > 0 ? (
        <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50/70 px-3 py-2">
          <p className="text-xs font-semibold text-amber-900">Forslag for å nå makromål</p>
          <ul className="mt-1 space-y-1 text-xs text-amber-900">
            {adjustmentSuggestions.map((row) => (
              <li key={`${row.mealId}-${row.foodId}`} className="flex flex-wrap items-center justify-between gap-2">
                <span>
                  Legg til ca. {formatMacro(row.grams, 0)} g {row.foodName} i {row.mealName.toLowerCase()} {row.reason}.
                </span>
                {onApplySuggestion ? (
                  <OutlineButton
                    type="button"
                    className="text-[11px] !px-2 !py-1"
                    onClick={() => onApplySuggestion(row)}
                  >
                    Legg til
                  </OutlineButton>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}

export function MealMacroMiniBar({
  mealName,
  used,
  targets,
}: {
  mealName: string;
  used: MacroTotals;
  targets?: MealPlanTargets;
}) {
  if (!targets?.kcal && !targets?.protein) return null;
  const kcalTarget = targets.kcal ?? 0;
  const pct = kcalTarget > 0 ? macroUsagePct(used.kcal, kcalTarget) : 0;

  return (
    <div className="motus-pt-meal-budget" title={`Måltidsbudsjett for ${mealName}`}>
      <span className="motus-pt-meal-budget-label">Budsjett</span>
      <div className="motus-pt-meal-budget-track">
        <div className="motus-pt-meal-budget-fill" style={{ width: `${Math.min(100, pct)}%` }} />
      </div>
      <span className="motus-pt-meal-budget-text">
        {formatMacro(used.kcal, 0)}
        {kcalTarget > 0 ? ` / ${formatMacro(kcalTarget, 0)} kcal` : ""}
      </span>
    </div>
  );
}
