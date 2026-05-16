import { describe, expect, it } from "vitest";
import { buildPeriodPlanProgramSelectOptions } from "./periodPlanBuilder";

describe("buildPeriodPlanProgramSelectOptions", () => {
  it("includes base options and program templates", () => {
    const options = buildPeriodPlanProgramSelectOptions(["Fullkropp A", "Fullkropp A"]);
    expect(options.some((option) => option.value === "Hvile / restitusjon")).toBe(true);
    expect(options.some((option) => option.value === "Fullkropp A")).toBe(true);
    expect(options.filter((option) => option.value === "Fullkropp A")).toHaveLength(1);
  });
});
