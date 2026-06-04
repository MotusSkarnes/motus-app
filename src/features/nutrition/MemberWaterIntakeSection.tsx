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

const WATER_TARGET_L = 2.5;
const WATER_STEP_L = 0.2;

function todayKey(): string {
  return toIsoDateKey(new Date());
}

function sumWaterFromQuickLogs(entries: MemberQuickFoodLogEntry[], foodItems: FoodItem[]): number {
  const grams = entries.reduce((sum, entry) => {
    const resolvedNutrition = resolveNutritionFromFoodItems(entry.name, entry.nutritionPer100g, foodItems, entry.foodId);
    const waterPer100g = resolvedNutrition.water ?? 0;
    if (!Number.isFinite(waterPer100g) || waterPer100g <= 0) return sum;
    const scale = entry.grams > 0 ? entry.grams / 100 : 0;
    return sum + waterPer100g * scale;
  }, 0);
  return grams / 1000;
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
    <section className={`motus-matplan-water-controls ${className}`.trim()} aria-label="Vanninntak i dag">
      <div>
        <h3 className="motus-matplan-water-controls__title">Vann i dag</h3>
        <p className="motus-matplan-water-controls__hint">
          Drikke: {drinkLiters.toFixed(1)} L · Fra mat: {waterFromFoodLiters.toFixed(1)} L
        </p>
        <p className="motus-matplan-water-controls__hint">
          Totalt: {totalLiters.toFixed(1)} / {WATER_TARGET_L} L
        </p>
      </div>
      <div className="motus-matplan-water-controls__actions">
        <button
          type="button"
          className="motus-matplan-water-controls__btn motus-pressable"
          onClick={() => handleAdjust(-WATER_STEP_L)}
          aria-label="Trekk fra vann"
        >
          −
        </button>
        <button
          type="button"
          className="motus-matplan-water-controls__btn motus-matplan-water-controls__btn--add motus-pressable"
          onClick={() => handleAdjust(WATER_STEP_L)}
          aria-label="Legg til vann"
        >
          +
        </button>
      </div>
    </section>
  );
}

export { WATER_TARGET_L, WATER_STEP_L };
