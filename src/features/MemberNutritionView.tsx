import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { NutritionHubTab } from "./nutrition/NutritionHub";
import { Apple } from "lucide-react";
import { buildDefaultFoodBankItems } from "../app/foodBankSeed";
import { hydrateMealPlanFoodNutrition } from "../app/mealPlanFoodNutrition";
import { mealPlansEqual, syncMealPlanForMember } from "../app/mealPlanCloud";
import { useFoodBankItems } from "../app/useFoodBankItems";
import { MEAL_PLAN_CHANGED_EVENT } from "../app/mealPlanStorage";
import type { MealPlan } from "../app/mealPlanTypes";
import { Card } from "../app/ui";
import { pickCanonicalMemberRowForProfile, resolveMemberPersonalGoals } from "../app/memberOnboarding";
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
  const [nutritionTab, setNutritionTab] = useState<NutritionHubTab>("mealPlan");
  const memberId = member.id;
  const memberName = member.name;
  const memberEmail = member.email;
  const foodBankItems = useFoodBankItems();
  const foodItemsForMacros = useMemo(
    () => (foodBankItems.length > 0 ? foodBankItems : buildDefaultFoodBankItems()),
    [foodBankItems],
  );
  const [plan, setPlan] = useState<MealPlan | null>(null);
  const [loading, setLoading] = useState(true);
  const [cloudSynced, setCloudSynced] = useState(true);
  const reloadInFlightRef = useRef(false);
  const hasLoadedOnceRef = useRef(false);

  const reload = useCallback(async () => {
    if (!memberId.trim() || reloadInFlightRef.current) return;
    reloadInFlightRef.current = true;
    const showLoading = !hasLoadedOnceRef.current;
    if (showLoading) setLoading(true);
    try {
      const result = await syncMealPlanForMember(memberId, "", memberEmail);
      const hydrated = result.plan
        ? hydrateMealPlanFoodNutrition(result.plan, foodItemsForMacros)
        : null;
      setPlan((prev) => (mealPlansEqual(prev, hydrated) ? prev : hydrated));
      setCloudSynced(result.cloudSynced);
      hasLoadedOnceRef.current = true;
    } finally {
      reloadInFlightRef.current = false;
      if (showLoading) setLoading(false);
    }
  }, [memberId, memberEmail, foodItemsForMacros]);

  useEffect(() => {
    hasLoadedOnceRef.current = false;
    setPlan(null);
    setLoading(true);
    void reload();
  }, [memberId, memberEmail, reload]);

  useEffect(() => {
    const handler = () => void reload();
    window.addEventListener(MEAL_PLAN_CHANGED_EVENT, handler);
    return () => window.removeEventListener(MEAL_PLAN_CHANGED_EVENT, handler);
  }, [reload]);

  const mealPlanPanel = useMemo(() => {
    if (loading && !hasLoadedOnceRef.current) {
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
        <MemberMealPlanDashboard
          plan={plan}
          memberId={memberId}
          memberName={memberName}
          onOpenAvoidances={() => setNutritionTab("avoidances")}
        />
      </>
    );
  }, [loading, plan, cloudSynced, memberId, memberName, setNutritionTab]);

  const profileMember = pickCanonicalMemberRowForProfile(member, members);
  const resolvedPersonalGoals = useMemo(
    () => resolveMemberPersonalGoals(profileMember, members),
    [profileMember, members],
  );

  return (
    <NutritionHub
      tab={nutritionTab}
      onTabChange={setNutritionTab}
      mealPlan={mealPlanPanel}
      mealPlanTargets={plan?.targets}
      avoidances={
        <MemberFoodAvoidancesPanel
          memberId={profileMember.id}
          personalGoals={resolvedPersonalGoals}
          onSavePersonalGoals={onSavePersonalGoals}
        />
      }
    />
  );
}
