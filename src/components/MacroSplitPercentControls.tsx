import { Lock, Unlock } from "lucide-react";
import type { MacroSplitField } from "../app/mealPlanMacroSplit";
import {
  canToggleMacroSplitLock,
  describeMacroSplitLocks,
  formatMacroSplitSummary,
  isMacroFieldDerived,
  isMacroFieldLocked,
  macroSplitFieldMax,
  MAX_MACRO_SPLIT_LOCKS,
} from "../app/mealPlanMacroSplit";
import type { MacroSplitPercent } from "../app/mealPlanTypes";
import { TextInput } from "../app/ui";

const FIELD_LABELS: Record<MacroSplitField, string> = {
  protein: "Protein",
  carbs: "Karbohydrater",
  fat: "Fett",
};

type MacroSplitPercentControlsProps = {
  split: MacroSplitPercent;
  locked: MacroSplitField[];
  onChange: (field: MacroSplitField, value: string) => void;
  onToggleLock: (field: MacroSplitField) => void;
  disabled?: boolean;
};

export function MacroSplitPercentControls({
  split,
  locked,
  onChange,
  onToggleLock,
  disabled,
}: MacroSplitPercentControlsProps) {
  const lockCount = locked.length;

  return (
    <div className="motus-macro-split">
      <div className="motus-macro-split-head">
        <span className="text-[11px] font-medium text-slate-700">Makrofordeling (% av kalorier)</span>
        <span className="motus-macro-split-total" aria-live="polite">
          Totalt {split.protein + split.carbs + split.fat} %
          {lockCount > 0 ? ` · ${lockCount}/${MAX_MACRO_SPLIT_LOCKS} låst` : null}
        </span>
      </div>
      <div className="motus-macro-split-grid">
        {(["protein", "carbs", "fat"] as const).map((field) => {
          const isDerived = isMacroFieldDerived(field, locked);
          const isLocked = isMacroFieldLocked(field, locked);
          const canLock = canToggleMacroSplitLock(field, locked);
          const max = macroSplitFieldMax(split, field, locked);
          const label =
            isDerived && !isLocked
              ? `${FIELD_LABELS[field]} (rest)`
              : isLocked
                ? `${FIELD_LABELS[field]} (låst)`
                : FIELD_LABELS[field];

          return (
            <label
              key={field}
              className={`motus-macro-split-field ${isDerived ? "motus-macro-split-field--derived" : ""} ${
                isLocked ? "motus-macro-split-field--locked" : ""
              }`}
            >
              <div className="motus-macro-split-label-row">
                <span className="motus-macro-split-label">{label}</span>
                <button
                  type="button"
                  className={`motus-macro-split-lock-btn ${isLocked ? "motus-macro-split-lock-btn--active" : ""}`}
                  onClick={() => onToggleLock(field)}
                  disabled={disabled || (!canLock && !isLocked)}
                  aria-pressed={isLocked}
                  aria-label={
                    isLocked
                      ? `Lås opp ${FIELD_LABELS[field].toLowerCase()}`
                      : canLock
                        ? `Lås ${FIELD_LABELS[field].toLowerCase()}`
                        : `Maks ${MAX_MACRO_SPLIT_LOCKS} makroer kan låses`
                  }
                  title={
                    !canLock && !isLocked
                      ? `Du kan maks låse ${MAX_MACRO_SPLIT_LOCKS} makroer`
                      : isLocked
                        ? "Lås opp"
                        : "Lås prosent"
                  }
                >
                  {isLocked ? <Lock className="h-3.5 w-3.5" aria-hidden /> : <Unlock className="h-3.5 w-3.5" aria-hidden />}
                </button>
              </div>
              <div className="motus-macro-split-input-wrap">
                <TextInput
                  value={String(split[field])}
                  onChange={(e) => onChange(field, e.target.value)}
                  inputMode="numeric"
                  disabled={disabled || isDerived}
                  readOnly={isDerived}
                  className="motus-macro-split-input"
                  aria-readonly={isDerived}
                />
                <span className="motus-macro-split-suffix">%</span>
              </div>
              {!isDerived ? (
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
                  <div
                    className="motus-macro-split-fat-fill"
                    style={{ width: `${Math.max(0, Math.min(100, split[field]))}%` }}
                  />
                </div>
              )}
            </label>
          );
        })}
      </div>
      <p className="motus-macro-split-hint">
        {formatMacroSplitSummary(split)} — {describeMacroSplitLocks(locked)}
      </p>
    </div>
  );
}
