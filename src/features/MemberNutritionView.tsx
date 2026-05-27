import { useCallback, useEffect, useRef, useState } from "react";
import { Apple } from "lucide-react";
import { syncMealPlanForMember } from "../app/mealPlanCloud";
import { MEAL_PLAN_CHANGED_EVENT } from "../app/mealPlanStorage";
import type { MealPlan } from "../app/mealPlanTypes";
import { Card } from "../app/ui";
import { MemberMealPlanDashboard } from "./nutrition/MemberMealPlanDashboard";
import { NutritionHub } from "./nutrition/NutritionHub";

type MemberNutritionViewProps = {
  memberId: string;
  memberName: string;
};

export function MemberNutritionView({ memberId, memberName }: MemberNutritionViewProps) {
  const [plan, setPlan] = useState<MealPlan | null>(null);
  const [loading, setLoading] = useState(true);
  const reloadInFlightRef = useRef(false);

  const reload = useCallback(async () => {
    if (!memberId.trim() || reloadInFlightRef.current) return;
    reloadInFlightRef.current = true;
    setLoading(true);
    try {
      const result = await syncMealPlanForMember(memberId, "");
      setPlan(result.plan);
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

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === "visible") void reload();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [reload]);

  const mealPlanPanel = (() => {
    if (loading) {
      return <Card className="p-6 text-center text-sm text-slate-600">Laster din matplan …</Card>;
    }
    if (!plan) {
      return (
        <Card className="p-6 text-center">
          <Apple className="mx-auto h-10 w-10 text-teal-500" aria-hidden />
          <h2 className="mt-3 text-lg font-bold text-slate-900">Matplan</h2>
          <p className="mt-2 text-sm text-slate-600">Treneren har ikke lagt ut en matplan til deg ennå.</p>
        </Card>
      );
    }
    return <MemberMealPlanDashboard plan={plan} memberId={memberId} memberName={memberName} />;
  })();

  return <NutritionHub mealPlan={mealPlanPanel} />;
}
