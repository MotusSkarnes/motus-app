import { GlassWater } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { FoodItem } from "../../app/foodBankTypes";
import {
  MEAL_PLAN_STATE_CHANGED_EVENT,
  loadMemberMealPlanState,
  type MemberMealPlanState,
  type MemberQuickFoodLogEntry,
} from "../../app/memberMealPlanState";
import { syncMemberMealPlanState } from "../../app/memberMealPlanStateCloud";
import { setWaterLiters, toIsoDateKey } from "../../app/memberMealPlanTracking";
import { resolveNutritionFromFoodItems } from "../../app/memberNutritionRehydrate";

export const WATER_TARGET_L = 2.5;
export const WATER_STEP_L = 0.2;

function todayKey(): string {
  return toIsoDateKey(new Date());
}

export function sumWaterFromQuickLogs(entries: MemberQuickFoodLogEntry[], foodItems: FoodItem[]): number {
  const grams = entries.reduce((sum, entry) => {
    const resolvedNutrition = resolveNutritionFromFoodItems(entry.name, entry.nutritionPer100g, foodItems, entry.foodId);
    const waterPer100g = resolvedNutrition.water ?? 0;
    if (!Number.isFinite(waterPer100g) || waterPer100g <= 0) return sum;
    const scale = entry.grams > 0 ? entry.grams / 100 : 0;
    return sum + waterPer100g * scale;
  }, 0);
  return grams / 1000;
}

export function computeTotalWaterLiters(
  tracking: MemberMealPlanState,
  dateKey: string,
  foodItems: FoodItem[],
  planFoodWaterLiters = 0,
): number {
  const drinkLiters = tracking.waterLiters[dateKey] ?? 0;
  const quickLogs = tracking.quickFoodLogs[dateKey] ?? [];
  return drinkLiters + sumWaterFromQuickLogs(quickLogs, foodItems) + planFoodWaterLiters;
}

type MemberWaterIntakeSectionProps = {
  memberId: string;
  foodItems: FoodItem[];
  /** Vann fra avhuket matplan-mat (kun med matplan). */
  planFoodWaterLiters?: number;
  className?: string;
};

export function MemberWaterIntakeSection({
  memberId,
  foodItems,
  planFoodWaterLiters = 0,
  className = "",
}: MemberWaterIntakeSectionProps) {
  const dateKey = todayKey();
  const [tracking, setTracking] = useState<MemberMealPlanState>(() => loadMemberMealPlanState(memberId));

  useEffect(() => {
    let mounted = true;
    void (async () => {
      const synced = await syncMemberMealPlanState(memberId);
      if (mounted) setTracking(synced);
    })();
    return () => {
      mounted = false;
    };
  }, [memberId]);

  useEffect(() => {
    const handler = () => setTracking(loadMemberMealPlanState(memberId));
    window.addEventListener(MEAL_PLAN_STATE_CHANGED_EVENT, handler);
    return () => window.removeEventListener(MEAL_PLAN_STATE_CHANGED_EVENT, handler);
  }, [memberId]);

  const quickLogsToday = tracking.quickFoodLogs[dateKey] ?? [];
  const drinkLiters = tracking.waterLiters[dateKey] ?? 0;
  const waterFromQuickLogsLiters = useMemo(
    () => sumWaterFromQuickLogs(quickLogsToday, foodItems),
    [foodItems, quickLogsToday],
  );
  const waterFromFoodLiters = waterFromQuickLogsLiters + planFoodWaterLiters;
  const totalLiters = drinkLiters + waterFromFoodLiters;

  const handleAdjust = useCallback(
    (delta: number) => {
      const next = Math.min(WATER_TARGET_L * 1.5, Math.max(0, drinkLiters + delta));
      setTracking((prev) => setWaterLiters(memberId, prev, dateKey, Math.round(next * 10) / 10));
    },
    [dateKey, drinkLiters, memberId],
  );

  return (
    <section className={`motus-water-intake ${className}`.trim()} aria-label="Vanninntak i dag">
      <header className="motus-water-intake__head">
        <span className="motus-water-intake__icon" aria-hidden>
          <GlassWater className="h-4 w-4" />
        </span>
        <div className="min-w-0">
          <h3 className="motus-water-intake__title">Vann i dag</h3>
          <p className="motus-water-intake__total">
            {totalLiters.toFixed(1)} / {WATER_TARGET_L} L totalt
          </p>
        </div>
        <div className="motus-water-intake__actions">
          <button
            type="button"
            className="motus-water-intake__btn motus-pressable"
            onClick={() => handleAdjust(-WATER_STEP_L)}
            aria-label="Trekk fra vann"
          >
            −
          </button>
          <button
            type="button"
            className="motus-water-intake__btn motus-water-intake__btn--add motus-pressable"
            onClick={() => handleAdjust(WATER_STEP_L)}
            aria-label="Legg til vann"
          >
            +
          </button>
        </div>
      </header>
      <p className="motus-water-intake__meta">
        Drikke {drinkLiters.toFixed(1)} L · Fra mat {waterFromFoodLiters.toFixed(1)} L
      </p>
    </section>
  );
}
