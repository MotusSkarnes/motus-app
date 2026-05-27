import type { Member } from "./types";

export function memberHasNutritionAccess(member: Pick<Member, "nutritionAccess"> | null | undefined): boolean {
  return member?.nutritionAccess === true;
}
