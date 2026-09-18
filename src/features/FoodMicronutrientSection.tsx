import {
  FOOD_MICRONUTRIENT_FIELDS,
  formatMicronutrientValue,
  hasMicronutrientData,
  normalizeMicronutrients,
  readMicronutrientValue,
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
  const visible = fields.filter((field) => readMicronutrientValue(micronutrients, field.key) !== undefined);
  if (!visible.length) return null;
  return (
    <div>
      <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">{title}</h4>
      <dl className="motus-foodbank-nutrition-table">
        {visible.map((field) => (
          <div key={field.key}>
            <dt>{field.label}</dt>
            <dd>
              {(() => {
                const amount = readMicronutrientValue(micronutrients, field.key) ?? 0;
                return `${amount === 0 ? "0" : formatMicronutrientValue(amount, field.decimals)} ${field.unit}`;
              })()}
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
  const vitamins = FOOD_MICRONUTRIENT_FIELDS.filter((field) => field.group === "vitamins");
  const minerals = FOOD_MICRONUTRIENT_FIELDS.filter((field) => field.group === "minerals");
  return (
    <section className="motus-foodbank-form-span-all motus-foodbank-form-section">
      <h3 className="motus-foodbank-form-section__title">Vitaminer og mineraler (per 100 g)</h3>
      <p className="motus-foodbank-form-section__hint">
        Valgfritt. Fylles automatisk ved import fra Matvaretabellen. La feltet stå tomt hvis verdien er ukjent. Skriv 0
        hvis næringsstoffet er målt til 0.
      </p>
      <h4 className="motus-foodbank-form-section__subtitle">Vitaminer</h4>
      <div className="mt-2 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {vitamins.map((field) => (
          <MicronutrientInput key={field.key} field={field} value={values[field.key]} onChange={onChange} />
        ))}
      </div>
      <h4 className="motus-foodbank-form-section__subtitle">Mineraler og sporstoffer</h4>
      <div className="mt-2 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {minerals.map((field) => (
          <MicronutrientInput key={field.key} field={field} value={values[field.key]} onChange={onChange} />
        ))}
      </div>
    </section>
  );
}

function MicronutrientInput({
  field,
  value,
  onChange,
}: {
  field: (typeof FOOD_MICRONUTRIENT_FIELDS)[number];
  value: string;
  onChange: (key: FoodMicronutrientKey, value: string) => void;
}) {
  return (
    <label className="motus-foodbank-field">
      <span className="motus-foodbank-field-label">
        {field.label} ({field.unit})
      </span>
      <TextInput value={value} onChange={(event) => onChange(field.key, event.target.value)} placeholder="Ukjent" />
    </label>
  );
}

export function micronutrientFormDefaults(): Record<FoodMicronutrientKey, string> {
  return Object.fromEntries(FOOD_MICRONUTRIENT_FIELDS.map((field) => [field.key, ""])) as Record<
    FoodMicronutrientKey,
    string
  >;
}

export function micronutrientFormFromNutrition(nutrition: FoodNutrition): Record<FoodMicronutrientKey, string> {
  const normalized = normalizeMicronutrients(nutrition.micronutrients);
  return Object.fromEntries(
    FOOD_MICRONUTRIENT_FIELDS.map((field) => {
      const amount = readMicronutrientValue(normalized, field.key);
      return [field.key, amount === undefined ? "" : String(amount)];
    }),
  ) as Record<FoodMicronutrientKey, string>;
}

export function parseMicronutrientForm(values: Record<FoodMicronutrientKey, string>): FoodMicronutrients {
  const parsed: FoodMicronutrients = {};
  for (const field of FOOD_MICRONUTRIENT_FIELDS) {
    const raw = values[field.key]?.trim().replace(",", ".") ?? "";
    if (raw === "") continue;
    const amount = Number(raw);
    if (Number.isFinite(amount)) parsed[field.key] = amount;
  }
  return parsed;
}
