import { useState, type ReactNode } from "react";
import { PillButton } from "../../app/ui";
import { NutritionRecipesPanel } from "./NutritionRecipesPanel";

export type NutritionHubTab = "mealPlan" | "recipes";

type NutritionHubProps = {
  mealPlan: ReactNode;
  defaultTab?: NutritionHubTab;
};

export function NutritionHub({ mealPlan, defaultTab = "mealPlan" }: NutritionHubProps) {
  const [tab, setTab] = useState<NutritionHubTab>(defaultTab);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <PillButton active={tab === "mealPlan"} onClick={() => setTab("mealPlan")}>
          Matplan
        </PillButton>
        <PillButton active={tab === "recipes"} onClick={() => setTab("recipes")}>
          Oppskrifter
        </PillButton>
      </div>
      {tab === "mealPlan" ? mealPlan : <NutritionRecipesPanel />}
    </div>
  );
}
