import { useCallback, useEffect, useRef, useState } from "react";
import { Apple } from "lucide-react";
import { syncMealPlanForMember } from "../app/mealPlanCloud";
import { MEAL_PLAN_CHANGED_EVENT } from "../app/mealPlanStorage";
import type { MealPlan } from "../app/mealPlanTypes";
import { Card } from "../app/ui";
import { MealPlanDisplay } from "./MealPlanDisplay";

type MemberNutritionViewProps = {
  memberId: string;
  memberName: string;
};

export function MemberNutritionView({ memberId, memberName }: MemberNutritionViewProps) {
  const [plan, setPlan] = useState<MealPlan | null>(null);
  const [activeDayId, setActiveDayId] = useState("");
  const [loading, setLoading] = useState(true);
  const reloadInFlightRef = useRef(false);

  const reload = useCallback(async () => {
    if (!memberId.trim() || reloadInFlightRef.current) return;
    reloadInFlightRef.current = true;
    setLoading(true);
    try {
      const result = await syncMealPlanForMember(memberId, "");
      setPlan(result.plan);
      setActiveDayId((prev) => prev || result.plan.days[0]?.id || "");
    } finally {
      reloadInFlightRef.current = false;
      setLoading(false);
    }
  }, [memberId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  useEffect(() => {
    const handler = () => void reload();
    window.addEventListener(MEAL_PLAN_CHANGED_EVENT, handler);
    return () => window.removeEventListener(MEAL_PLAN_CHANGED_EVENT, handler);
  }, [reload]);

  if (loading) {
    return (
      <Card className="p-6 text-center text-sm text-slate-600">Laster din matplan …</Card>
    );
  }

  if (!plan) {
    return (
      <Card className="p-6 text-center">
        <Apple className="mx-auto h-10 w-10 text-teal-500" aria-hidden />
        <h2 className="mt-3 text-lg font-bold text-slate-900">Ernæring</h2>
        <p className="mt-2 text-sm text-slate-600">Treneren har ikke lagt ut en matplan til deg ennå.</p>
      </Card>
    );
  }

  const hasFood = plan.days.some((day) => day.meals.some((meal) => meal.items.length > 0));

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border bg-gradient-to-br from-teal-50 to-white p-4" style={{ borderColor: "rgba(15,23,42,0.08)" }}>
        <div className="flex items-center gap-2 text-teal-800">
          <Apple className="h-5 w-5" aria-hidden />
          <span className="text-sm font-semibold">Din matplan</span>
        </div>
        <p className="mt-1 text-sm text-slate-600">
          {hasFood
            ? `Hei ${memberName.split(" ")[0] || memberName} — her er måltidene treneren har satt opp.`
            : "Planen er opprettet, men måltidene fylles fortsatt ut av treneren."}
        </p>
      </div>
      <MealPlanDisplay plan={plan} activeDayId={activeDayId} onActiveDayIdChange={setActiveDayId} readOnly />
    </div>
  );
}
