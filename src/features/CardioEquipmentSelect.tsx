import { CARDIO_EQUIPMENT_OPTIONS, type CardioEquipmentId } from "../app/cardioEquipment";
import { PillButton } from "../app/ui";

type CardioEquipmentSelectProps = {
  value: CardioEquipmentId;
  onChange: (equipmentId: CardioEquipmentId) => void;
  className?: string;
};

export function CardioEquipmentSelect({ value, onChange, className = "" }: CardioEquipmentSelectProps) {
  const active = CARDIO_EQUIPMENT_OPTIONS.find((option) => option.id === value);
  return (
    <div className={className}>
      <div className="text-[11px] font-medium text-slate-500">Utstyr</div>
      <div className="mt-1.5 flex flex-wrap gap-2">
        {CARDIO_EQUIPMENT_OPTIONS.map((option) => (
          <PillButton key={option.id} active={value === option.id} onClick={() => onChange(option.id)}>
            {option.label}
          </PillButton>
        ))}
      </div>
      {active ? <p className="mt-1.5 text-[11px] text-slate-500 leading-relaxed">{active.hint} — bilder og felter i programmet følger valget.</p> : null}
    </div>
  );
}
