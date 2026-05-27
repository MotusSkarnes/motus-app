import { formatMacro } from "../app/foodBankTypes";
import type { MacroTotals } from "../app/mealPlanMacros";
import type { RecipeMacroResult } from "../app/recipeMacros";
import "../foodbank.css";

type RecipeMacroBlocksProps = {
  result: RecipeMacroResult;
};

const BLOCKS = [
  { key: "kcal" as const, label: "Energi", unit: "kcal", decimals: 0, tone: "kcal" },
  { key: "protein" as const, label: "Protein", unit: "g", decimals: 0, tone: "protein" },
  { key: "carbs" as const, label: "Karbohydrater", unit: "g", decimals: 0, tone: "carbs" },
  { key: "fat" as const, label: "Fett", unit: "g", decimals: 0, tone: "fat" },
];

export function RecipeMacroBlocks({ result }: RecipeMacroBlocksProps) {
  const { perServing, servings, matchedCount, ingredientCount } = result;
  const partial = matchedCount < ingredientCount;

  return (
    <div className="motus-recipe-macros mt-6 border-t border-slate-100 pt-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-sm font-semibold text-slate-900">Næringsinnhold per porsjon</h2>
        {servings > 1 ? (
          <span className="text-[11px] font-medium text-slate-500">Oppskriften er til {servings} porsjoner</span>
        ) : null}
      </div>
      {partial ? (
        <p className="mt-1 text-[11px] text-slate-500">
          Beregnet fra {matchedCount} av {ingredientCount} ingredienser (matvarebanken). Krydder og små mengder er utelatt.
        </p>
      ) : null}
      <div className="motus-recipe-macros-grid mt-3">
        {BLOCKS.map((block) => (
          <MacroBlock key={block.key} label={block.label} tone={block.tone} value={perServing[block.key]} unit={block.unit} decimals={block.decimals} />
        ))}
      </div>
    </div>
  );
}

function MacroBlock({
  label,
  tone,
  value,
  unit,
  decimals,
}: {
  label: string;
  tone: string;
  value: number;
  unit: string;
  decimals: number;
}) {
  return (
    <div className={`motus-recipe-macro-block motus-recipe-macro-block--${tone}`}>
      <span className="motus-recipe-macro-block__label">{label}</span>
      <strong className="motus-recipe-macro-block__value">
        {formatMacro(value, decimals)}
        <span className="motus-recipe-macro-block__unit">{unit}</span>
      </strong>
    </div>
  );
}
