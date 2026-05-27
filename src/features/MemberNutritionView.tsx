import { useCallback, useEffect, useRef, useState } from "react";
import { Apple } from "lucide-react";
import { syncMealPlanForMember } from "../app/mealPlanCloud";
import { MEAL_PLAN_CHANGED_EVENT } from "../app/mealPlanStorage";
import type { MealPlan } from "../app/mealPlanTypes";
import { Card } from "../app/ui";
import { pickCanonicalMemberRowForProfile } from "../app/memberOnboarding";
import type { Member } from "../app/types";
import { MemberFoodAvoidancesPanel } from "./nutrition/MemberFoodAvoidancesPanel";
import { MemberMealPlanDashboard } from "./nutrition/MemberMealPlanDashboard";
import { NutritionHub } from "./nutrition/NutritionHub";

type MemberNutritionViewProps = {
  member: Member;
  members: Member[];
  onSavePersonalGoals: (personalGoals: string) => void;
};

export function MemberNutritionView({ member, members, onSavePersonalGoals }: MemberNutritionViewProps) {
  const memberId = member.id;
  const memberName = member.name;
  const memberEmail = member.email;
  const [plan, setPlan] = useState<MealPlan | null>(null);
  const [loading, setLoading] = useState(true);
  const [cloudSynced, setCloudSynced] = useState(true);
  const reloadInFlightRef = useRef(false);

  const reload = useCallback(async () => {
    if (!memberId.trim() || reloadInFlightRef.current) return;
    reloadInFlightRef.current = true;
    setLoading(true);
    try {
      const result = await syncMealPlanForMember(memberId, "", memberEmail);
      setPlan(result.plan);
      setCloudSynced(result.cloudSynced);
    } finally {
      reloadInFlightRef.current = false;
      setLoading(false);
    }
  }, [memberId, memberEmail]);

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
    const hasFood = plan.days.some((day) => day.meals.some((meal) => meal.items.length > 0));
    return (
      <>
        {!cloudSynced && !hasFood ? (
          <Card className="mb-3 border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
            Kunne ikke hente matplan fra sky ennå. Sjekk nett og oppdater siden, eller be PT trykke «Lagre» på matplanen din.
          </Card>
        ) : null}
        <MemberMealPlanDashboard plan={plan} memberId={memberId} memberName={memberName} />
      </>
    );
  })();

  const profileMember = pickCanonicalMemberRowForProfile(member, members);

  return (
    <NutritionHub
      mealPlan={mealPlanPanel}
      mealPlanTargets={plan?.targets}
      avoidances={
        <MemberFoodAvoidancesPanel
          memberId={memberId}
          personalGoals={profileMember.personalGoals ?? member.personalGoals ?? ""}
          onSavePersonalGoals={onSavePersonalGoals}
        />
      }
    />
  );
}
