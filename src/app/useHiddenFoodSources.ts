import { useCallback, useEffect, useState } from "react";
import {
  FOOD_SOURCE_HIDDEN_CHANGED_EVENT,
  loadHiddenFoodSources,
  type HiddenFoodSource,
} from "./foodSourceHiddenStorage";

export function useHiddenFoodSources(): HiddenFoodSource[] {
  const [entries, setEntries] = useState<HiddenFoodSource[]>(() => loadHiddenFoodSources());

  const reload = useCallback(() => {
    setEntries(loadHiddenFoodSources());
  }, []);

  useEffect(() => {
    reload();
    window.addEventListener(FOOD_SOURCE_HIDDEN_CHANGED_EVENT, reload);
    return () => window.removeEventListener(FOOD_SOURCE_HIDDEN_CHANGED_EVENT, reload);
  }, [reload]);

  return entries;
}
