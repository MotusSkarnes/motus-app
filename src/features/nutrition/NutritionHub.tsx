import { useState, type ReactNode } from "react";
import type { MealPlanTargets } from "../../app/mealPlanTypes";
import { PillButton } from "../../app/ui";
import { NutritionRecipesPanel } from "./NutritionRecipesPanel";

export type NutritionHubTab = "mealPlan" | "recipes" | "avoidances";

type NutritionHubProps = {
  mealPlan: ReactNode;
  avoidances?: ReactNode;
  defaultTab?: NutritionHubTab;
  tab?: NutritionHubTab;
  onTabChange?: (tab: NutritionHubTab) => void;
  mealPlanTargets?: MealPlanTargets;
};

export function NutritionHub({
  mealPlan,
  avoidances,
  defaultTab = "mealPlan",
  tab: controlledTab,
  onTabChange,
  mealPlanTargets,
}: NutritionHubProps) {
  const [internalTab, setInternalTab] = useState<NutritionHubTab>(defaultTab);
  const tab = controlledTab ?? internalTab;
  const setTab = (next: NutritionHubTab) => {
    if (controlledTab === undefined) setInternalTab(next);
    onTabChange?.(next);
  };

  return (
    <div className="motus-nutrition-hub motus-nutrition-hub--member space-y-4">
      <div className="motus-nutrition-hub-tabs flex flex-wrap gap-1 border-b border-slate-200/80 pb-0">
        <PillButton active={tab === "mealPlan"} onClick={() => setTab("mealPlan")}>
          Matplan
        </PillButton>
        <PillButton active={tab === "recipes"} onClick={() => setTab("recipes")}>
          Oppskrifter
        </PillButton>
        {avoidances ? (
          <PillButton active={tab === "avoidances"} onClick={() => setTab("avoidances")}>
            Unngår
          </PillButton>
        ) : null}
      </div>
      {tab === "mealPlan" ? mealPlan : tab === "avoidances" ? avoidances : <NutritionRecipesPanel mealPlanTargets={mealPlanTargets} />}
    </div>
  );
}
