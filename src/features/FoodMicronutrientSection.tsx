import {
  FOOD_MICRONUTRIENT_FIELDS,
  formatMicronutrientValue,
  hasMicronutrientData,
  normalizeMicronutrients,
  type FoodMicronutrientKey,
  type FoodMicronutrients,
} from "../app/foodBankMicronutrients";
import type { FoodNutrition } from "../app/foodBankTypes";
import { TextInput } from "../app/ui";

type FoodMicronutrientReadonlyProps = {
  nutrition: FoodNutrition;
  className?: string;
};

export function FoodMicronutrientTable({ nutrition, className = "" }: FoodMicronutrientReadonlyProps) {
  const micronutrients = normalizeMicronutrients(nutrition.micronutrients);
  if (!hasMicronutrientData(micronutrients)) {
    return (
      <p className={`text-sm text-slate-500 ${className}`.trim()}>
        Ingen mikronæringsdata registrert. Importer fra Matvaretabellen eller fyll inn manuelt ved redigering.
      </p>
    );
  }

  const vitamins = FOOD_MICRONUTRIENT_FIELDS.filter((field) => field.group === "vitamins");
  const minerals = FOOD_MICRONUTRIENT_FIELDS.filter((field) => field.group === "minerals");

  return (
    <div className={`space-y-4 ${className}`.trim()}>
      <MicronutrientGroup title="Vitaminer" fields={vitamins} micronutrients={micronutrients} />
      <MicronutrientGroup title="Mineraler og sporstoffer" fields={minerals} micronutrients={micronutrients} />
    </div>
  );
}

function MicronutrientGroup({
  title,
  fields,
  micronutrients,
}: {
  title: string;
  fields: typeof FOOD_MICRONUTRIENT_FIELDS;
  micronutrients: FoodMicronutrients;
}) {
  const visible = fields.filter((field) => micronutrients[field.key] > 0);
  if (!visible.length) return null;
  return (
    <div>
      <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">{title}</h4>
      <dl className="motus-foodbank-nutrition-table">
        {visible.map((field) => (
          <div key={field.key}>
            <dt>{field.label}</dt>
            <dd>
              {formatMicronutrientValue(micronutrients[field.key], field.decimals)} {field.unit}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

type FoodMicronutrientFormFieldsProps = {
  values: Record<FoodMicronutrientKey, string>;
  onChange: (key: FoodMicronutrientKey, value: string) => void;
};

export function FoodMicronutrientFormFields({ values, onChange }: FoodMicronutrientFormFieldsProps) {
  return (
    <details className="motus-foodbank-form-span-all rounded-xl border border-slate-200/80 bg-slate-50/80 p-3">
      <summary className="cursor-pointer text-sm font-semibold text-slate-800">Mikronæringsstoffer (per 100 g)</summary>
      <p className="mt-2 text-xs text-slate-500">
        Valgfritt. Fylles automatisk ved import fra Matvaretabellen. La stå 0 hvis ukjent.
      </p>
      <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {FOOD_MICRONUTRIENT_FIELDS.map((field) => (
          <label key={field.key} className="motus-foodbank-field">
            <span className="motus-foodbank-field-label">
              {field.label} ({field.unit})
            </span>
            <TextInput
              value={values[field.key]}
              onChange={(event) => onChange(field.key, event.target.value)}
              placeholder="0"
            />
          </label>
        ))}
      </div>
    </details>
  );
}

export function micronutrientFormDefaults(): Record<FoodMicronutrientKey, string> {
  return Object.fromEntries(FOOD_MICRONUTRIENT_FIELDS.map((field) => [field.key, "0"])) as Record<
    FoodMicronutrientKey,
    string
  >;
}

export function micronutrientFormFromNutrition(nutrition: FoodNutrition): Record<FoodMicronutrientKey, string> {
  const normalized = normalizeMicronutrients(nutrition.micronutrients);
  return Object.fromEntries(
    FOOD_MICRONUTRIENT_FIELDS.map((field) => [field.key, String(normalized[field.key])]),
  ) as Record<FoodMicronutrientKey, string>;
}

export function parseMicronutrientForm(values: Record<FoodMicronutrientKey, string>): FoodMicronutrients {
  const parsed: Partial<FoodMicronutrients> = {};
  for (const field of FOOD_MICRONUTRIENT_FIELDS) {
    const raw = values[field.key]?.trim().replace(",", ".") ?? "";
    const amount = raw === "" ? 0 : Number(raw);
    parsed[field.key] = Number.isFinite(amount) ? amount : 0;
  }
  return normalizeMicronutrients(parsed);
}
