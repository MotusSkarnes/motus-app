import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { NutritionHubTab } from "./nutrition/NutritionHub";
import { scheduleMemberFoodBankSync } from "../app/foodBankCloud";
import { buildDefaultFoodBankItems } from "../app/foodBankSeed";
import { hydrateMealPlanFoodNutrition } from "../app/mealPlanFoodNutrition";
import { countMealPlanFoodItems, mealPlansEqual, syncMealPlanForMember } from "../app/mealPlanCloud";
import { useFoodBankItems } from "../app/useFoodBankItems";
import type { FoodItem } from "../app/foodBankTypes";
import { MEAL_PLAN_CHANGED_EVENT } from "../app/mealPlanStorage";
import type { MealPlan } from "../app/mealPlanTypes";
import { Card } from "../app/ui";
import { pickCanonicalMemberRowForProfile, resolveMemberPersonalGoals } from "../app/memberOnboarding";
import type { Member } from "../app/types";
import { MemberFoodAvoidancesPanel } from "./nutrition/MemberFoodAvoidancesPanel";
import { LogMealPanel } from "./nutrition/LogMealPanel";
import { MemberSubmitFoodPanel } from "./MemberSubmitFoodPanel";
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
  const foodItemsRef = useRef<FoodItem[]>(foodBankItems);
  foodItemsRef.current = foodBankItems;

  const foodItemsForMacros = useMemo(
    () => (foodBankItems.length > 0 ? foodBankItems : buildDefaultFoodBankItems()),
    [foodBankItems],
  );

  const [plan, setPlan] = useState<MealPlan | null>(null);
  const [loading, setLoading] = useState(true);
  const [cloudSynced, setCloudSynced] = useState(true);
  const reloadInFlightRef = useRef(false);
  const hasLoadedOnceRef = useRef(false);

  const reload = useCallback(
    async (options?: { silent?: boolean }) => {
      if (!memberId.trim() || reloadInFlightRef.current) return;
      reloadInFlightRef.current = true;
      const showLoading = !options?.silent && !hasLoadedOnceRef.current;
      if (showLoading) setLoading(true);
      try {
        const result = await syncMealPlanForMember(memberId, "", memberEmail);
        const hydrated = result.plan
          ? hydrateMealPlanFoodNutrition(result.plan, foodItemsRef.current)
          : null;
        setPlan((prev) => (mealPlansEqual(prev, hydrated) ? prev : hydrated));
        setCloudSynced(result.cloudSynced);
        hasLoadedOnceRef.current = true;
      } finally {
        reloadInFlightRef.current = false;
        if (showLoading) setLoading(false);
      }
    },
    [memberId, memberEmail],
  );

  const refreshMemberFoodBank = useCallback(() => {
    const ptOwnerUserId = member.ownerUserId?.trim() ?? "";
    if (!ptOwnerUserId) return;
    scheduleMemberFoodBankSync(ptOwnerUserId, member.id);
  }, [member.ownerUserId, member.id]);

  useEffect(() => {
    refreshMemberFoodBank();
    const onVisible = () => {
      if (document.visibilityState === "visible") refreshMemberFoodBank();
    };
    window.addEventListener("focus", refreshMemberFoodBank);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.removeEventListener("focus", refreshMemberFoodBank);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [refreshMemberFoodBank]);

  useEffect(() => {
    hasLoadedOnceRef.current = false;
    setPlan(null);
    setLoading(true);
    void reload();
  }, [memberId, memberEmail, reload]);

  useEffect(() => {
    if (!hasLoadedOnceRef.current) return;
    setPlan((prev) => {
      if (!prev) return prev;
      const hydrated = hydrateMealPlanFoodNutrition(prev, foodItemsForMacros);
      return mealPlansEqual(prev, hydrated) ? prev : hydrated;
    });
  }, [foodItemsForMacros]);

  useEffect(() => {
    const handler = () => void reload({ silent: true });
    window.addEventListener(MEAL_PLAN_CHANGED_EVENT, handler);
    return () => window.removeEventListener(MEAL_PLAN_CHANGED_EVENT, handler);
  }, [reload]);

  const mealPlanContent = useMemo(() => {
    if (loading && !hasLoadedOnceRef.current) {
      return <Card className="p-6 text-center text-sm text-slate-600">Laster din matplan …</Card>;
    }
    const planHasAssignedFood = countMealPlanFoodItems(plan) > 0;
    if (!planHasAssignedFood) {
      return (
        <div className="space-y-3">
          {!cloudSynced ? (
            <Card className="border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
              Kunne ikke hente matplan fra sky ennå. Sjekk nett og oppdater siden, eller be PT trykke «Lagre» på matplanen din.
            </Card>
          ) : null}
          <LogMealPanel
            memberId={memberId}
            mealPlanTargets={plan?.targets}
            onRefreshFoodBank={refreshMemberFoodBank}
          />
        </div>
      );
    }
    return (
      <div className="space-y-4">
        {!cloudSynced ? (
          <Card className="border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
            Kunne ikke hente matplan fra sky ennå. Sjekk nett og oppdater siden, eller be PT trykke «Lagre» på matplanen din.
          </Card>
        ) : null}
        <MemberMealPlanDashboard
          plan={plan!}
          memberId={memberId}
          memberName={memberName}
          onOpenAvoidances={() => setNutritionTab("avoidances")}
          onRefreshFoodBank={refreshMemberFoodBank}
        />
      </div>
    );
  }, [loading, plan, cloudSynced, memberId, memberName, setNutritionTab, refreshMemberFoodBank]);

  const profileMember = pickCanonicalMemberRowForProfile(member, members);
  const resolvedPersonalGoals = useMemo(
    () => resolveMemberPersonalGoals(profileMember, members),
    [profileMember, members],
  );

  return (
    <NutritionHub
      tab={nutritionTab}
      onTabChange={setNutritionTab}
      mealPlan={
        <>
          {mealPlanContent}
          <MemberSubmitFoodPanel member={member} onRefreshFoodBank={refreshMemberFoodBank} />
        </>
      }
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
