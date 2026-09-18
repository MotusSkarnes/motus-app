import { useCallback, useEffect, useState } from "react";
import { withoutCoveredSeedPlaceholders } from "./foodBankDedup";
import { FOOD_BANK_CHANGED_EVENT, loadFoodBankItems } from "./foodBankStorage";
import type { FoodItem } from "./foodBankTypes";

export function useFoodBankItems(): FoodItem[] {
  const [items, setItems] = useState<FoodItem[]>(() => withoutCoveredSeedPlaceholders(loadFoodBankItems()));

  const reload = useCallback(() => {
    setItems(withoutCoveredSeedPlaceholders(loadFoodBankItems()));
  }, []);

  useEffect(() => {
    reload();
    window.addEventListener(FOOD_BANK_CHANGED_EVENT, reload);
    return () => window.removeEventListener(FOOD_BANK_CHANGED_EVENT, reload);
  }, [reload]);

  return items;
}
