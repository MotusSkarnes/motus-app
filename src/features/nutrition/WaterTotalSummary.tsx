import { GlassWater } from "lucide-react";
import { WATER_TARGET_L } from "./MemberWaterIntakeSection";

type WaterTotalSummaryProps = {
  totalLiters: number;
  targetLiters?: number;
  className?: string;
};

export function WaterTotalSummary({
  totalLiters,
  targetLiters = WATER_TARGET_L,
  className = "",
}: WaterTotalSummaryProps) {
  return (
    <p
      className={`motus-log-meal-macros__water ${className}`.trim()}
      aria-label={`Vann totalt ${totalLiters.toFixed(1)} liter`}
    >
      <GlassWater className="motus-log-meal-macros__water-icon" aria-hidden />
      Vann {totalLiters.toFixed(1)} / {targetLiters} L
    </p>
  );
}
