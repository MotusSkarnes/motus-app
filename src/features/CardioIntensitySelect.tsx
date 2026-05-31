import {
  CARDIO_INTENSITY_OPTIONS,
  type CardioIntensityLevel,
} from "../app/cardioIntervalIntensity";
import { PillButton } from "../app/ui";

type CardioIntensitySelectProps = {
  value: CardioIntensityLevel | null;
  onChange: (level: CardioIntensityLevel) => void;
  className?: string;
  hint?: string;
};

export function CardioIntensitySelect({ value, onChange, className = "", hint }: CardioIntensitySelectProps) {
  return (
    <div className={className}>
      <div className="text-[11px] font-medium text-slate-500">Intensitet</div>
      <div className="mt-1.5 flex flex-wrap gap-2">
        {CARDIO_INTENSITY_OPTIONS.map((option) => (
          <PillButton key={option.id} active={value === option.id} onClick={() => onChange(option.id)}>
            {option.label}
          </PillButton>
        ))}
      </div>
      {hint ? <p className="mt-1.5 text-[11px] text-slate-500 leading-relaxed">{hint}</p> : null}
    </div>
  );
}
