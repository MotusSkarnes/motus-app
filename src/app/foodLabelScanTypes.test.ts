import { describe, expect, it } from "vitest";
import { foodSubmissionDraftFromScan, parseFoodLabelScanResult } from "./foodLabelScanTypes";

describe("foodLabelScanTypes", () => {
  it("parser label JSON", () => {
    const parsed = parseFoodLabelScanResult({
      name: "Skyr naturell",
      portionLabel: "1 beger",
      portionGrams: 130,
      category: "meieriprodukter",
      kcal: 63,
      protein: 11,
      carbs: 4,
      fat: 0.2,
      fiber: 0,
      sugar: 4,
      saturatedFat: 0.1,
      sodium: 40,
    });
    expect(parsed?.name).toBe("Skyr naturell");
    expect(parsed?.portionGrams).toBe(130);
  });

  it("bygger draft fra scan", () => {
    const scan = parseFoodLabelScanResult({
      name: "Proteinbar",
      portionGrams: 60,
      category: "proteinkilder",
      kcal: 360,
      protein: 30,
      carbs: 35,
      fat: 12,
      fiber: 0,
      sugar: 0,
      saturatedFat: 0,
      sodium: 0,
    });
    expect(scan).not.toBeNull();
    if (!scan) return;
    const draft = foodSubmissionDraftFromScan(scan, "data:image/jpeg;base64,abc");
    expect(draft.name).toBe("Proteinbar");
    expect(draft.imageUrl).toContain("data:image");
  });
});
