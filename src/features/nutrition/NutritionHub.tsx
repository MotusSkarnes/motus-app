import { useState, type ReactNode } from "react";
import type { MealPlanTargets } from "../../app/mealPlanTypes";
import { PillButton } from "../../app/ui";
import { NutritionRecipesPanel } from "./NutritionRecipesPanel";

export type NutritionHubTab = "mealPlan" | "recipes" | "avoidances";

type NutritionHubProps = {
  mealPlan: ReactNode;
  avoidances?: ReactNode;
  defaultTab?: NutritionHubTab;
  mealPlanTargets?: MealPlanTargets;
};

export function NutritionHub({ mealPlan, avoidances, defaultTab = "mealPlan", mealPlanTargets }: NutritionHubProps) {
  const [tab, setTab] = useState<NutritionHubTab>(defaultTab);

  return (
    <div className="motus-nutrition-hub space-y-4">
      <div className="motus-nutrition-hub-tabs flex flex-wrap gap-2">
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
