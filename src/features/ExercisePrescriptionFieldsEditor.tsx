import {
  EXERCISE_PRESCRIPTION_FIELD_OPTIONS,
  exercisePrescriptionFieldDef,
  toggleExercisePrescriptionField,
} from "../app/exercisePrescriptionFields";
import type { ExercisePrescriptionFieldKey } from "../app/types";

type ExercisePrescriptionFieldsEditorProps = {
  value: ExercisePrescriptionFieldKey[];
  onChange: (next: ExercisePrescriptionFieldKey[]) => void;
  compact?: boolean;
  showHint?: boolean;
};

export function ExercisePrescriptionFieldsEditor({
  value,
  onChange,
  compact = false,
  showHint = true,
}: ExercisePrescriptionFieldsEditorProps) {
  return (
    <div className={compact ? "motus-exbank-field-compact" : "motus-exbank-field"}>
      {!compact ? <span className="motus-exbank-field-label">Variabler i program</span> : null}
      {showHint ? (
        <p className={`text-slate-500 ${compact ? "mb-1.5 text-[10px] leading-snug" : "mb-2 text-xs"}`}>
          {compact
            ? "Egne felt for denne øvelsen — lagres med en gang."
            : "Velg hvilke felt som vises når øvelsen legges i treningsprogram. Minst én variabel må være på."}
        </p>
      ) : null}
      <div className={`motus-exbank-chip-row flex-wrap ${compact ? "gap-1" : ""}`}>
        {EXERCISE_PRESCRIPTION_FIELD_OPTIONS.map((option) => {
          const active = value.includes(option.key);
          const label = compact ? exercisePrescriptionFieldDef(option.key).shortLabel : option.label;
          return (
            <button
              key={option.key}
              type="button"
              onClick={() => onChange(toggleExercisePrescriptionField(value, option.key))}
              className={`motus-exbank-chip ${active ? "motus-exbank-chip--active" : ""} ${compact ? "motus-exbank-chip--compact" : ""}`}
              aria-pressed={active}
              title={active ? `Fjern ${option.label}` : `Legg til ${option.label}`}
            >
              {active ? `${label} ×` : `+ ${label}`}
            </button>
          );
        })}
      </div>
    </div>
  );
}
