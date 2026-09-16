import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { applyNutritionTargetEdit } from "../../app/mealPlanTargetBalance";
import type { NutritionTargetEditField } from "../../app/mealPlanTargetBalance";
import type { MealPlanTargets } from "../../app/mealPlanTypes";
import { TrainerNutritionTargetsPanel } from "./TrainerNutritionTargetsPanel";

afterEach(() => {
  cleanup();
});

function PanelHarness() {
  const [targets, setTargets] = useState<MealPlanTargets>({});

  function onEdit(field: NutritionTargetEditField, value: string | boolean) {
    setTargets(applyNutritionTargetEdit(targets, field, value, 80).targets);
  }

  return <TrainerNutritionTargetsPanel targets={targets} bodyWeightKg={80} onEdit={onEdit} />;
}

function TemplateWeightHarness() {
  const [targets, setTargets] = useState<MealPlanTargets>({});
  const weight = typeof targets.planningWeightKg === "number" ? targets.planningWeightKg : null;

  function onEdit(field: NutritionTargetEditField, value: string | boolean) {
    setTargets(applyNutritionTargetEdit(targets, field, value, weight).targets);
  }

  return (
    <TrainerNutritionTargetsPanel
      targets={targets}
      bodyWeightKg={weight}
      weightEditable
      onEdit={onEdit}
    />
  );
}

describe("TrainerNutritionTargetsPanel", () => {
  it("lar comma og punktum stå i protein g/kg til desimalen er ferdig", async () => {
    const user = userEvent.setup();
    render(<PanelHarness />);

    const perKg = screen.getByLabelText("Protein (g/kg)");
    await user.clear(perKg);
    await user.type(perKg, "1,6");

    expect(perKg).toHaveValue("1,6");
    expect(screen.getByLabelText(/Protein \(g\)/)).toHaveValue("128");
  });

  it("godtar punktum som desimaltegn i protein gram", async () => {
    const user = userEvent.setup();
    render(<PanelHarness />);

    const proteinG = screen.getByLabelText(/Protein \(g\)/);
    await user.clear(proteinG);
    await user.type(proteinG, "120.5");

    expect(proteinG).toHaveValue("120.5");
    await user.tab();
    expect(proteinG).toHaveValue("120,5");
  });

  it("lar treneren skrive vekt på mal og beregne protein i g/kg", async () => {
    const user = userEvent.setup();
    render(<TemplateWeightHarness />);

    const weight = screen.getByLabelText("Vekt (kg)");
    await user.type(weight, "75");
    const perKg = screen.getByLabelText("Protein (g/kg)");
    await user.type(perKg, "1,6");

    expect(weight).toHaveValue("75");
    expect(screen.getByLabelText(/Protein \(g\)/)).toHaveValue("120");
  });
});
