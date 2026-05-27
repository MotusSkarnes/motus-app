import { formatMacro } from "../app/foodBankTypes";
import type { RecipeMacroResult } from "../app/recipeMacros";
import "../foodbank.css";

type RecipeMacroSummaryProps = {
  result: RecipeMacroResult;
  compact?: boolean;
  hint?: string;
};

export function RecipeMacroSummary({ result, compact = false, hint }: RecipeMacroSummaryProps) {
  const { perServing } = result;

  return (
    <div className={compact ? "mt-2" : "mt-3"}>
      {hint ? <p className="mb-1 text-[10px] font-medium text-teal-800">{hint}</p> : null}
      <div
        className="motus-recipe-macro-summary flex flex-wrap gap-1.5"
        aria-label={hint ? `Næringsinnhold per porsjon — ${hint}` : "Næringsinnhold per porsjon"}
      >
      <MacroChip tone="kcal" label="kcal" value={perServing.kcal} decimals={0} />
      <MacroChip tone="protein" label="P" value={perServing.protein} decimals={0} unit="g" />
      <MacroChip tone="carbs" label="K" value={perServing.carbs} decimals={0} unit="g" />
      <MacroChip tone="fat" label="F" value={perServing.fat} decimals={0} unit="g" />
      </div>
    </div>
  );
}

function MacroChip({
  tone,
  label,
  value,
  decimals,
  unit,
}: {
  tone: string;
  label: string;
  value: number;
  decimals: number;
  unit?: string;
}) {
  return (
    <span className={`motus-recipe-macro-chip motus-recipe-macro-chip--${tone}`}>
      <span className="motus-recipe-macro-chip__label">{label}</span>
      <span className="motus-recipe-macro-chip__value">
        {formatMacro(value, decimals)}
        {unit ? <span className="motus-recipe-macro-chip__unit">{unit}</span> : null}
      </span>
    </span>
  );
}
