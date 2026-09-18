import {
  FOOD_FATTY_ACID_FIELDS,
  compactFattyAcids,
  hasStoredFattyAcids,
  readFattyAcidValue,
  type FoodFattyAcidKey,
  type FoodFattyAcids,
} from "../app/foodBankFattyAcids";
import type { FoodNutrition } from "../app/foodBankTypes";
import { TextInput } from "../app/ui";

type FoodFattyAcidReadonlyProps = {
  nutrition: FoodNutrition;
  className?: string;
};

export function FoodFattyAcidTable({ nutrition, className = "" }: FoodFattyAcidReadonlyProps) {
  const fattyAcids = compactFattyAcids(nutrition.fattyAcids);
  if (!hasStoredFattyAcids(fattyAcids)) {
    return (
      <p className={`text-sm text-slate-500 ${className}`.trim()}>
        Ingen omega-/fettsyreverdier registrert. Fyll inn manuelt ved redigering, eller importer fra Matvaretabellen.
      </p>
    );
  }

  return (
    <dl className={`motus-foodbank-nutrition-table ${className}`.trim()}>
      {FOOD_FATTY_ACID_FIELDS.map((field) => {
        const amount = readFattyAcidValue(fattyAcids, field.key);
        if (amount === undefined) return null;
        return (
          <div key={field.key}>
            <dt>{field.label}</dt>
            <dd>
              {amount === 0 ? "0" : amount.toFixed(field.decimals).replace(/\.?0+$/, "")} {field.unit}
            </dd>
          </div>
        );
      })}
    </dl>
  );
}

type FoodFattyAcidFormFieldsProps = {
  values: Record<FoodFattyAcidKey, string>;
  onChange: (key: FoodFattyAcidKey, value: string) => void;
};

export function FoodFattyAcidFormFields({ values, onChange }: FoodFattyAcidFormFieldsProps) {
  return (
    <section className="motus-foodbank-form-span-all motus-foodbank-form-section">
      <h3 className="motus-foodbank-form-section__title">Omega og fettsyrer (per 100 g)</h3>
      <p className="motus-foodbank-form-section__hint">
        Valgfritt. La feltet stå tomt hvis verdien er ukjent. Skriv 0 hvis næringsstoffet er målt til 0.
      </p>
      <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {FOOD_FATTY_ACID_FIELDS.map((field) => (
          <label key={field.key} className="motus-foodbank-field">
            <span className="motus-foodbank-field-label">
              {field.label} ({field.unit})
            </span>
            <TextInput
              value={values[field.key]}
              onChange={(event) => onChange(field.key, event.target.value)}
              placeholder="Ukjent"
            />
          </label>
        ))}
      </div>
    </section>
  );
}

export function fattyAcidFormDefaults(): Record<FoodFattyAcidKey, string> {
  return Object.fromEntries(FOOD_FATTY_ACID_FIELDS.map((field) => [field.key, ""])) as Record<FoodFattyAcidKey, string>;
}

export function fattyAcidFormFromNutrition(nutrition: FoodNutrition): Record<FoodFattyAcidKey, string> {
  const stored = compactFattyAcids(nutrition.fattyAcids);
  return Object.fromEntries(
    FOOD_FATTY_ACID_FIELDS.map((field) => {
      const amount = readFattyAcidValue(stored, field.key);
      return [field.key, amount === undefined ? "" : String(amount)];
    }),
  ) as Record<FoodFattyAcidKey, string>;
}

export function parseFattyAcidForm(values: Record<FoodFattyAcidKey, string>): FoodFattyAcids | undefined {
  const parsed: Partial<FoodFattyAcids> = {};
  for (const field of FOOD_FATTY_ACID_FIELDS) {
    const raw = values[field.key]?.trim().replace(",", ".") ?? "";
    if (raw === "") continue;
    const amount = Number(raw);
    if (Number.isFinite(amount)) parsed[field.key] = amount;
  }
  return Object.keys(parsed).length ? (parsed as FoodFattyAcids) : undefined;
}
