import type { MacroSplitField } from "../app/mealPlanMacroSplit";
import type { MacroSplitPercent } from "../app/mealPlanTypes";
import { formatMacroSplitSummary } from "../app/mealPlanMacroSplit";
import { TextInput } from "../app/ui";

const FIELD_LABELS: Record<MacroSplitField, string> = {
  protein: "Protein",
  carbs: "Karbohydrater",
  fat: "Fett (rest)",
};

type MacroSplitPercentControlsProps = {
  split: MacroSplitPercent;
  onChange: (field: MacroSplitField, value: string) => void;
  disabled?: boolean;
};

export function MacroSplitPercentControls({ split, onChange, disabled }: MacroSplitPercentControlsProps) {
  const maxProtein = Math.max(0, 100 - split.carbs);
  const maxCarbs = Math.max(0, 100 - split.protein);

  return (
    <div className="motus-macro-split">
      <div className="motus-macro-split-head">
        <span className="text-[11px] font-medium text-slate-700">Makrofordeling (% av kalorier)</span>
        <span className="motus-macro-split-total" aria-live="polite">
          Totalt {split.protein + split.carbs + split.fat} %
        </span>
      </div>
      <div className="motus-macro-split-grid">
        {(["protein", "carbs", "fat"] as const).map((field) => {
          const isFat = field === "fat";
          const max = field === "protein" ? maxProtein : field === "carbs" ? maxCarbs : split.fat;
          return (
            <label key={field} className={`motus-macro-split-field ${isFat ? "motus-macro-split-field--derived" : ""}`}>
              <span className="motus-macro-split-label">{FIELD_LABELS[field]}</span>
              <div className="motus-macro-split-input-wrap">
                <TextInput
                  value={String(split[field])}
                  onChange={(e) => onChange(field, e.target.value)}
                  inputMode="numeric"
                  disabled={disabled || isFat}
                  readOnly={isFat}
                  className="motus-macro-split-input"
                  aria-readonly={isFat}
                />
                <span className="motus-macro-split-suffix">%</span>
              </div>
              {!isFat ? (
                <input
                  type="range"
                  min={0}
                  max={max}
                  step={1}
                  value={split[field]}
                  disabled={disabled}
                  onChange={(e) => onChange(field, e.target.value)}
                  className="motus-macro-split-range"
                  aria-label={`${FIELD_LABELS[field]} prosent`}
                />
              ) : (
                <div className="motus-macro-split-fat-bar" aria-hidden>
                  <div className="motus-macro-split-fat-fill" style={{ width: `${split.fat}%` }} />
                </div>
              )}
            </label>
          );
        })}
      </div>
      <p className="motus-macro-split-hint">
        {formatMacroSplitSummary(split)} — sett <strong>protein</strong>, deretter <strong>karb</strong>.{" "}
        <strong>Fett</strong> fyller resten ({100 - split.protein - split.carbs} %).
      </p>
    </div>
  );
}
