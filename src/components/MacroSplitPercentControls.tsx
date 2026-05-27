import type { MacroSplitField } from "../app/mealPlanMacroSplit";
import type { MacroSplitPercent } from "../app/mealPlanTypes";
import { formatMacroSplitSummary } from "../app/mealPlanMacroSplit";
import { TextInput } from "../app/ui";

const FIELD_LABELS: Record<MacroSplitField, string> = {
  protein: "Protein",
  carbs: "Karbohydrater",
  fat: "Fett",
};

type MacroSplitPercentControlsProps = {
  split: MacroSplitPercent;
  onChange: (field: MacroSplitField, value: string) => void;
  disabled?: boolean;
};

export function MacroSplitPercentControls({ split, onChange, disabled }: MacroSplitPercentControlsProps) {
  const total = split.protein + split.carbs + split.fat;

  return (
    <div className="motus-macro-split">
      <div className="motus-macro-split-head">
        <span className="text-[11px] font-medium text-slate-700">Makrofordeling (% av kalorier)</span>
        <span className="motus-macro-split-total" aria-live="polite">
          Totalt {total} %
        </span>
      </div>
      <div className="motus-macro-split-grid">
        {(["protein", "carbs", "fat"] as const).map((field) => (
          <label key={field} className="motus-macro-split-field">
            <span className="motus-macro-split-label">{FIELD_LABELS[field]}</span>
            <div className="motus-macro-split-input-wrap">
              <TextInput
                value={String(split[field])}
                onChange={(e) => onChange(field, e.target.value)}
                inputMode="numeric"
                disabled={disabled}
                className="motus-macro-split-input"
              />
              <span className="motus-macro-split-suffix">%</span>
            </div>
            <input
              type="range"
              min={0}
              max={100}
              step={1}
              value={split[field]}
              disabled={disabled}
              onChange={(e) => onChange(field, e.target.value)}
              className="motus-macro-split-range"
              aria-label={`${FIELD_LABELS[field]} prosent`}
            />
          </label>
        ))}
      </div>
      <p className="motus-macro-split-hint">{formatMacroSplitSummary(split)} — summen holdes alltid på 100 %.</p>
    </div>
  );
}
