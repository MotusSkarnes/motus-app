import {
  EXERCISE_PRESCRIPTION_FIELD_OPTIONS,
  resolvePrescriptionFieldLabel,
  toggleExercisePrescriptionField,
} from "../app/exercisePrescriptionFields";
import type { ExercisePrescriptionFieldKey } from "../app/types";
import { TextInput } from "../app/ui";

type ExercisePrescriptionFieldsEditorProps = {
  value: ExercisePrescriptionFieldKey[];
  onChange: (next: ExercisePrescriptionFieldKey[]) => void;
  customField1Label: string;
  customField2Label: string;
  onCustomField1LabelChange: (value: string) => void;
  onCustomField2LabelChange: (value: string) => void;
  compact?: boolean;
  showHint?: boolean;
};

export function ExercisePrescriptionFieldsEditor({
  value,
  onChange,
  customField1Label,
  customField2Label,
  onCustomField1LabelChange,
  onCustomField2LabelChange,
  compact = false,
  showHint = true,
}: ExercisePrescriptionFieldsEditorProps) {
  const labelPreview = {
    customField1Label: customField1Label.trim(),
    customField2Label: customField2Label.trim(),
  };

  return (
    <div className={compact ? "motus-exbank-field-compact" : "motus-exbank-field"}>
      {!compact ? <span className="motus-exbank-field-label">Variabler i program</span> : null}
      {showHint ? (
        <p className={`text-slate-500 ${compact ? "mb-1.5 text-[10px] leading-snug" : "mb-2 text-xs"}`}>
          Velg standardfelt, eller gi egne variabler et navn og slå dem på. Minst én variabel må være aktiv.
        </p>
      ) : null}
      <div className="mb-3 grid gap-2 sm:grid-cols-2">
        <label className="motus-exbank-field">
          <span className="motus-exbank-field-label">Egendefinert variabel 1</span>
          <TextInput
            value={customField1Label}
            onChange={(e) => onCustomField1LabelChange(e.target.value)}
            placeholder="F.eks. Tempo, ROM, puls"
          />
        </label>
        <label className="motus-exbank-field">
          <span className="motus-exbank-field-label">Egendefinert variabel 2</span>
          <TextInput
            value={customField2Label}
            onChange={(e) => onCustomField2LabelChange(e.target.value)}
            placeholder="F.eks. Notat til maskin"
          />
        </label>
      </div>
      <div className={`motus-exbank-chip-row flex-wrap ${compact ? "gap-1" : ""}`}>
        {EXERCISE_PRESCRIPTION_FIELD_OPTIONS.map((option) => {
          const active = value.includes(option.key);
          const label = resolvePrescriptionFieldLabel(option.key, labelPreview);
          const chipText = compact && option.key !== "custom1" && option.key !== "custom2"
            ? label.slice(0, 6)
            : label;
          return (
            <button
              key={option.key}
              type="button"
              onClick={() => onChange(toggleExercisePrescriptionField(value, option.key))}
              className={`motus-exbank-chip ${active ? "motus-exbank-chip--active" : ""} ${compact ? "motus-exbank-chip--compact" : ""}`}
              aria-pressed={active}
              title={active ? `Fjern ${label}` : `Legg til ${label}`}
            >
              {active ? `${chipText} ×` : `+ ${chipText}`}
            </button>
          );
        })}
      </div>
    </div>
  );
}
