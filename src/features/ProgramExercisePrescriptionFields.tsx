import { exercisePrescriptionFieldDef, programExerciseFieldValue } from "../app/exercisePrescriptionFields";
import type { ExercisePrescriptionFieldKey } from "../app/types";
import type { ReactNode } from "react";
import { TextInput } from "../app/ui";
import type { ProgramExercise } from "../app/types";

type ProgramExercisePrescriptionFieldsProps = {
  fields: ExercisePrescriptionFieldKey[];
  item: ProgramExercise;
  onUpdate: (field: keyof ProgramExercise, value: string) => void;
  showSets?: boolean;
  setsLabel?: string;
  setsPlaceholder?: string;
  showNotes?: boolean;
  trailing?: ReactNode;
};

export function ProgramExercisePrescriptionFields({
  fields,
  item,
  onUpdate,
  showSets = true,
  setsLabel = "Sett",
  setsPlaceholder = "Sett",
  showNotes = true,
  trailing = null,
}: ProgramExercisePrescriptionFieldsProps) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {showSets ? (
        <div className="space-y-1">
          <div className="text-[11px] font-medium text-slate-500">{setsLabel}</div>
          <TextInput value={item.sets} onChange={(e) => onUpdate("sets", e.target.value)} placeholder={setsPlaceholder} />
        </div>
      ) : null}
      {fields.map((key) => {
        const def = exercisePrescriptionFieldDef(key);
        return (
          <div key={key} className="space-y-1">
            <div className="text-[11px] font-medium text-slate-500">{def.label}</div>
            <TextInput
              value={programExerciseFieldValue(item, key)}
              onChange={(e) => onUpdate(def.programField, e.target.value)}
              placeholder={def.placeholder}
            />
          </div>
        );
      })}
      {trailing}
      {showNotes ? (
        <div className={`space-y-1 ${fields.length > 2 ? "sm:col-span-2 xl:col-span-3" : "sm:col-span-2"}`}>
          <div className="text-[11px] font-medium text-slate-500">Notat</div>
          <TextInput value={item.notes} onChange={(e) => onUpdate("notes", e.target.value)} placeholder="Notat" />
        </div>
      ) : null}
    </div>
  );
}
