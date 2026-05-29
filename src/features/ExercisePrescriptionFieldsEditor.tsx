import {
  EXERCISE_PRESCRIPTION_FIELD_OPTIONS,
  toggleExercisePrescriptionField,
} from "../app/exercisePrescriptionFields";
import type { ExercisePrescriptionFieldKey } from "../app/types";

type ExercisePrescriptionFieldsEditorProps = {
  value: ExercisePrescriptionFieldKey[];
  onChange: (next: ExercisePrescriptionFieldKey[]) => void;
};

export function ExercisePrescriptionFieldsEditor({ value, onChange }: ExercisePrescriptionFieldsEditorProps) {
  return (
    <div className="motus-exbank-field">
      <span className="motus-exbank-field-label">Variabler i program</span>
      <p className="mb-2 text-xs text-slate-500">
        Velg hvilke felt som vises når øvelsen legges i treningsprogram. Minst én variabel må være på.
      </p>
      <div className="motus-exbank-chip-row flex-wrap">
        {EXERCISE_PRESCRIPTION_FIELD_OPTIONS.map((option) => {
          const active = value.includes(option.key);
          return (
            <button
              key={option.key}
              type="button"
              onClick={() => onChange(toggleExercisePrescriptionField(value, option.key))}
              className={`motus-exbank-chip ${active ? "motus-exbank-chip--active" : ""}`}
              aria-pressed={active}
              title={active ? `Fjern ${option.label}` : `Legg til ${option.label}`}
            >
              {active ? `${option.label} ×` : `+ ${option.label}`}
            </button>
          );
        })}
      </div>
    </div>
  );
}
