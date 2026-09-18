import { describe, expect, it } from "vitest";
import { appendMissingSeedFoodItems } from "./foodBankSeed";
import { dedupeFoodBankItems, findFoodItemById, foodNutritionSignature } from "./foodBankDedup";
import type { FoodItem, FoodNutrition } from "./foodBankTypes";

function item(partial: Partial<FoodItem> & { name: string; nutritionPer100g: FoodNutrition }): FoodItem {
  return {
    id: partial.id ?? `food-test-${partial.name}`,
    portionLabel: "100 g",
    portionGrams: 100,
    category: partial.category ?? "karbohydrater",
    origin: "Test",
    source: partial.source ?? "matvaretabell",
    createdBy: "test",
    createdAt: "2024-01-01T00:00:00.000Z",
    ...partial,
  };
}

describe("foodBankDedup", () => {
  it("merger identisk navn med norsk ø", () => {
    const n: FoodNutrition = {
      kcal: 220,
      protein: 8,
      carbs: 42,
      fat: 2,
      fiber: 6,
      sugar: 3,
      saturatedFat: 0.4,
      sodium: 430,
    };
    const result = dedupeFoodBankItems([
      item({ id: "food-a", name: "Rugbrød", nutritionPer100g: n }),
      item({ id: "food-b", name: "Rugbrød", nutritionPer100g: n }),
    ]);
    expect(result.items).toHaveLength(1);
    expect(result.removedCount).toBe(1);
  });

  it("merger identisk navn", () => {
    const n: FoodNutrition = {
      kcal: 220,
      protein: 8,
      carbs: 42,
      fat: 2,
      fiber: 6,
      sugar: 3,
      saturatedFat: 0.4,
      sodium: 430,
    };
    const result = dedupeFoodBankItems([
      item({ id: "food-a", name: "Rugbrød", nutritionPer100g: n }),
      item({ id: "food-b", name: "  rugbrød ", nutritionPer100g: n }),
    ]);
    expect(result.items).toHaveLength(1);
    expect(result.idRemap["food-b"]).toBe("food-a");
  });

  it("merger ulikt navn ved identisk næring", () => {
    const n: FoodNutrition = {
      kcal: 248,
      protein: 8.6,
      carbs: 45.3,
      fat: 2.2,
      fiber: 6,
      sugar: 3,
      saturatedFat: 0.4,
      sodium: 430,
    };
    const result = dedupeFoodBankItems([
      item({ id: "food-a", name: "Rundstykke, grovt, kjøpt", nutritionPer100g: n }),
      item({
        id: "food-b",
        name: "Rundstykke, grovt, med salt tilsatt jod, kjøpt",
        nutritionPer100g: { ...n },
      }),
    ]);
    expect(result.items).toHaveLength(1);
    expect(result.idRemap["food-b"]).toBeTruthy();
  });

  it("beholder ulike varer med ulik næring (rugbrød vs grovt brød)", () => {
    const result = dedupeFoodBankItems([
      item({
        id: "food-rug",
        name: "Rugbrød",
        nutritionPer100g: {
          kcal: 220,
          protein: 8,
          carbs: 42,
          fat: 2,
          fiber: 6,
          sugar: 3,
          saturatedFat: 0.4,
          sodium: 430,
        },
      }),
      item({
        id: "food-grov",
        name: "Grovt brød",
        nutritionPer100g: {
          kcal: 247,
          protein: 9,
          carbs: 43,
          fat: 3.5,
          fiber: 7,
          sugar: 4,
          saturatedFat: 0.6,
          sodium: 400,
        },
      }),
    ]);
    expect(result.items).toHaveLength(2);
    expect(result.removedCount).toBe(0);
  });

  it("slår ikke sammen næringsløse rader med samme null-signatur", () => {
    const empty: FoodNutrition = {
      kcal: 0,
      protein: 0,
      carbs: 0,
      fat: 0,
      fiber: 0,
      sugar: 0,
      saturatedFat: 0,
      sodium: 0,
    };
    const result = dedupeFoodBankItems([
      item({ id: "food-a", name: "Vann A", nutritionPer100g: empty }),
      item({ id: "food-b", name: "Vann B", nutritionPer100g: empty }),
    ]);
    expect(result.items).toHaveLength(2);
    expect(foodNutritionSignature(empty)).toBe("0|0.0|0.0|0.0|0.0|0.0|0.0|0");
  });

  it("beholder egen porsjon når samme navn finnes som 100 g-duplikat", () => {
    const n: FoodNutrition = {
      kcal: 350,
      protein: 5,
      carbs: 80,
      fat: 1,
      fiber: 0,
      sugar: 70,
      saturatedFat: 0,
      sodium: 0,
    };
    const result = dedupeFoodBankItems([
      item({
        id: "food-old",
        name: "Vitaminbamser",
        category: "karbohydrater",
        isCustom: true,
        source: "egen",
        portionLabel: "100 g",
        portionGrams: 100,
        nutritionPer100g: n,
      }),
      item({
        id: "food-new",
        name: "Vitaminbamser",
        category: "karbohydrater",
        isCustom: true,
        source: "egen",
        portionLabel: "1 stk",
        portionGrams: 1,
        nutritionPer100g: n,
      }),
    ]);
    expect(result.items).toHaveLength(1);
    expect(result.items[0]?.id).toBe("food-new");
    expect(result.items[0]?.portionGrams).toBe(1);
  });

  it("slår Motus-gulrot inn i Matvaretabellens gulrot, rå", () => {
    const n: FoodNutrition = {
      kcal: 41,
      protein: 0.9,
      carbs: 10,
      fat: 0.2,
      fiber: 2.8,
      sugar: 4.7,
      saturatedFat: 0,
      sodium: 69,
    };
    const result = dedupeFoodBankItems([
      item({
        id: "food-seed-74-abc",
        name: "Gulrot",
        category: "gronnsaker",
        nutritionPer100g: n,
      }),
      item({
        id: "food-matvaretabell-gulrot-norsk-ra",
        name: "Gulrot, norsk, rå",
        category: "gronnsaker",
        nutritionPer100g: { ...n, kcal: 39 },
      }),
      item({
        id: "food-matvaretabell-gulrot-kokt",
        name: "Gulrot, kokt",
        category: "gronnsaker",
        nutritionPer100g: { ...n, kcal: 28 },
      }),
      item({
        id: "food-matvaretabell-gulrotkake",
        name: "Gulrotkake",
        category: "karbohydrater",
        nutritionPer100g: { ...n, kcal: 320 },
      }),
    ]);
    const names = result.items.map((row) => row.name);
    expect(names).toContain("Gulrot, norsk, rå");
    expect(names).toContain("Gulrot, kokt");
    expect(names).toContain("Gulrotkake");
    expect(names).not.toContain("Gulrot");
    expect(result.idRemap["food-seed-74-abc"]).toBe("food-matvaretabell-gulrot-norsk-ra");
    const table = result.items.find((row) => row.id === "food-matvaretabell-gulrot-norsk-ra");
    expect(table?.aliasIds).toContain("food-seed-74-abc");
    expect(findFoodItemById(result.items, "food-seed-74-abc")?.id).toBe("food-matvaretabell-gulrot-norsk-ra");
  });

  it("beholder egen kort matvare og starter uten tabelltreff", () => {
    const n: FoodNutrition = {
      kcal: 360,
      protein: 30,
      carbs: 35,
      fat: 12,
      fiber: 5,
      sugar: 18,
      saturatedFat: 5,
      sodium: 180,
    };
    const custom = dedupeFoodBankItems([
      item({
        id: "food-seed-1",
        name: "Gulrot",
        category: "gronnsaker",
        isCustom: true,
        source: "egen",
        nutritionPer100g: n,
      }),
      item({
        id: "food-matvaretabell-gulrot-norsk-ra",
        name: "Gulrot, norsk, rå",
        category: "gronnsaker",
        nutritionPer100g: { ...n, kcal: 41 },
      }),
    ]);
    expect(custom.items.map((row) => row.name).sort()).toEqual(["Gulrot", "Gulrot, norsk, rå"]);

    const onlySeed = dedupeFoodBankItems([
      item({ id: "food-seed-2", name: "Proteinbar", category: "proteinkilder", nutritionPer100g: n }),
    ]);
    expect(onlySeed.items).toHaveLength(1);
    expect(onlySeed.items[0]?.name).toBe("Proteinbar");
  });

  it("slår Banana-seed inn i Banan fra tabellen", () => {
    const n: FoodNutrition = {
      kcal: 89,
      protein: 1.1,
      carbs: 23,
      fat: 0.3,
      fiber: 2.6,
      sugar: 12,
      saturatedFat: 0.1,
      sodium: 1,
    };
    const result = dedupeFoodBankItems([
      item({ id: "food-seed-banana", name: "Banana", category: "karbohydrater", nutritionPer100g: n }),
      item({
        id: "food-matvaretabell-banan-ra",
        name: "Banan, rå",
        category: "frukt-baer",
        nutritionPer100g: { ...n, kcal: 88 },
      }),
    ]);
    expect(result.items.map((row) => row.name)).toEqual(["Banan, rå"]);
    expect(result.idRemap["food-seed-banana"]).toBe("food-matvaretabell-banan-ra");
  });

  it("beholder tabellvaren ved identisk næring og husker seed-id", () => {
    const n: FoodNutrition = {
      kcal: 41,
      protein: 0.9,
      carbs: 10,
      fat: 0.2,
      fiber: 2.8,
      sugar: 4.7,
      saturatedFat: 0,
      sodium: 69,
    };
    const result = dedupeFoodBankItems([
      item({ id: "food-seed-gulrot", name: "Gulrot", category: "gronnsaker", nutritionPer100g: n }),
      item({
        id: "food-matvaretabell-gulrot-norsk-ra",
        name: "Gulrot, norsk, rå",
        category: "gronnsaker",
        nutritionPer100g: n,
      }),
    ]);
    expect(result.items.map((row) => row.name)).toEqual(["Gulrot, norsk, rå"]);
    expect(result.items[0]?.aliasIds).toContain("food-seed-gulrot");
    expect(findFoodItemById(result.items, "food-seed-gulrot")?.name).toBe("Gulrot, norsk, rå");
  });

  it("slår Motus-gulrot inn i redigert tabellvare", () => {
    const n: FoodNutrition = {
      kcal: 41,
      protein: 0.9,
      carbs: 10,
      fat: 0.2,
      fiber: 2.8,
      sugar: 4.7,
      saturatedFat: 0,
      sodium: 69,
    };
    const result = dedupeFoodBankItems([
      item({ id: "food-seed-gulrot", name: "Gulrot", category: "gronnsaker", nutritionPer100g: n }),
      item({
        id: "food-matvaretabell-gulrot-ra",
        name: "Gulrot, rå",
        category: "gronnsaker",
        isEdited: true,
        nutritionPer100g: { ...n, kcal: 39 },
      }),
    ]);
    expect(result.items.map((row) => row.name)).toEqual(["Gulrot, rå"]);
    expect(result.idRemap["food-seed-gulrot"]).toBe("food-matvaretabell-gulrot-ra");
  });

  it("legger ikke tilbake Motus-gulrot når tabellen allerede dekker navnet", () => {
    const n: FoodNutrition = {
      kcal: 41,
      protein: 0.9,
      carbs: 10,
      fat: 0.2,
      fiber: 2.8,
      sugar: 4.7,
      saturatedFat: 0,
      sodium: 69,
    };
    const tableOnly = [
      item({
        id: "food-matvaretabell-gulrot-norsk-ra",
        name: "Gulrot, norsk, rå",
        category: "gronnsaker",
        nutritionPer100g: n,
      }),
    ];
    const next = appendMissingSeedFoodItems(tableOnly);
    expect(next.map((row) => row.name)).not.toContain("Gulrot");
    expect(next.some((row) => row.name === "Gulrot, norsk, rå")).toBe(true);
  });
});
