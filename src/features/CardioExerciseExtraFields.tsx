import type { ProgramExercise } from "../app/types";
import {
  inferCardioEquipmentIdFromExercise,
  type CardioEquipmentId,
} from "../app/cardioEquipment";
import type { Exercise } from "../app/types";
import { TextInput } from "../app/ui";
import { CardioIntensitySelect } from "./CardioIntensitySelect";
import type { CardioIntensityLevel } from "../app/cardioIntervalIntensity";
import { applyCardioIntensityToExercise } from "../app/cardioIntervalIntensity";

type CardioExerciseExtraFieldsProps = {
  item: ProgramExercise;
  linkedExercise?: Exercise;
  fallbackEquipmentId?: CardioEquipmentId;
  cardioIntervalIntensity?: CardioIntensityLevel;
  className?: string;
  intensityHint?: string;
  onUpdate: (field: keyof ProgramExercise, value: string) => void;
  onReplaceItem: (next: ProgramExercise) => void;
};

export function CardioExerciseExtraFields({
  item,
  linkedExercise,
  fallbackEquipmentId = "treadmill",
  cardioIntervalIntensity = "medium",
  className = "",
  intensityHint,
  onUpdate,
  onReplaceItem,
}: CardioExerciseExtraFieldsProps) {
  const equipmentId =
    inferCardioEquipmentIdFromExercise(linkedExercise ?? { category: "Kondisjon", equipment: "", name: "" }) ??
    fallbackEquipmentId;

  return (
    <div className={`space-y-3 ${className}`.trim()}>
      <CardioIntensitySelect
        className="sm:col-span-2 xl:col-span-3"
        value={item.cardioIntensity ?? cardioIntervalIntensity}
        onChange={(level) => onReplaceItem(applyCardioIntensityToExercise(item, level))}
        hint={intensityHint}
      />
      <div className="space-y-1">
        <div className="text-[11px] font-medium text-slate-500">Puls (% av makspuls)</div>
        <TextInput
          value={item.targetHrPercent ?? ""}
          onChange={(e) => onUpdate("targetHrPercent", e.target.value)}
          placeholder="f.eks. 85–90"
        />
      </div>
      {equipmentId === "treadmill" ? (
        <>
          <div className="space-y-1">
            <div className="text-[11px] font-medium text-slate-500">Fart (km/t)</div>
            <TextInput value={item.speed ?? ""} onChange={(e) => onUpdate("speed", e.target.value)} placeholder="8" />
          </div>
          <div className="space-y-1">
            <div className="text-[11px] font-medium text-slate-500">Stigning (%)</div>
            <TextInput value={item.incline ?? ""} onChange={(e) => onUpdate("incline", e.target.value)} placeholder="1" />
          </div>
        </>
      ) : null}
      {equipmentId === "rowing" ? (
        <>
          <div className="space-y-1">
            <div className="text-[11px] font-medium text-slate-500">Split (min / 500 m)</div>
            <TextInput value={item.customField1 ?? ""} onChange={(e) => onUpdate("customField1", e.target.value)} placeholder="2:05" />
          </div>
          <div className="space-y-1">
            <div className="text-[11px] font-medium text-slate-500">Taktfrekvens (spm)</div>
            <TextInput value={item.customField2 ?? ""} onChange={(e) => onUpdate("customField2", e.target.value)} placeholder="26" />
          </div>
          <div className="space-y-1">
            <div className="text-[11px] font-medium text-slate-500">Dempfer</div>
            <TextInput value={item.seatSetting ?? ""} onChange={(e) => onUpdate("seatSetting", e.target.value)} placeholder="5" />
          </div>
        </>
      ) : null}
      {equipmentId === "bike" ? (
        <>
          <div className="space-y-1">
            <div className="text-[11px] font-medium text-slate-500">Motstand / watt</div>
            <TextInput value={item.customField1 ?? ""} onChange={(e) => onUpdate("customField1", e.target.value)} placeholder="180" />
          </div>
          <div className="space-y-1">
            <div className="text-[11px] font-medium text-slate-500">Kadens (rpm)</div>
            <TextInput value={item.customField2 ?? ""} onChange={(e) => onUpdate("customField2", e.target.value)} placeholder="85" />
          </div>
        </>
      ) : null}
      {equipmentId === "airbike" ? (
        <>
          <div className="space-y-1">
            <div className="text-[11px] font-medium text-slate-500">RPM</div>
            <TextInput value={item.customField2 ?? ""} onChange={(e) => onUpdate("customField2", e.target.value)} placeholder="55" />
          </div>
          <div className="space-y-1">
            <div className="text-[11px] font-medium text-slate-500">Motstand (valgfritt)</div>
            <TextInput value={item.customField1 ?? ""} onChange={(e) => onUpdate("customField1", e.target.value)} placeholder="Middels" />
          </div>
        </>
      ) : null}
    </div>
  );
}
