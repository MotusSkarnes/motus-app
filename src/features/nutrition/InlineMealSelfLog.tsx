import { useState } from "react";
import { Plus } from "lucide-react";
import type { MemberQuickFoodLogEntry } from "../../app/memberMealPlanState";
import { createSelfLogEntry } from "./foodLogEntry";
import { FoodLogFormFields, type FoodLogDraft } from "./FoodLogFormFields";

export type SelfLogDraft = Omit<MemberQuickFoodLogEntry, "id" | "loggedAt">;

export { createSelfLogEntry } from "./foodLogEntry";

type InlineMealSelfLogProps = {
  mealId: string;
  onAdd: (entry: SelfLogDraft) => void;
  compact?: boolean;
  autoOpen?: boolean;
  onPanelOpen?: () => void;
};

export function InlineMealSelfLog({ mealId, onAdd, compact = false, autoOpen = false, onPanelOpen }: InlineMealSelfLogProps) {
  const [open, setOpen] = useState(autoOpen);

  if (!open) {
    return (
      <button
        type="button"
        className="motus-matplan-self-log-trigger motus-pressable"
        onClick={() => {
          onPanelOpen?.();
          setOpen(true);
        }}
      >
        <Plus className="h-3.5 w-3.5" aria-hidden />
        Logg noe annet
      </button>
    );
  }

  return (
    <div className={`motus-matplan-self-log ${compact ? "motus-matplan-self-log--compact" : ""}`}>
      <p className="motus-matplan-self-log__label">Logg det du spiste</p>
      <FoodLogFormFields
        compact
        submitLabel="Logg"
        onSubmit={(draft: FoodLogDraft) => {
          onAdd(createSelfLogEntry(draft.food, draft.grams, mealId));
          if (!autoOpen) setOpen(false);
        }}
      />
      <button type="button" className="motus-matplan-self-log__cancel motus-pressable" onClick={() => setOpen(false)}>
        Avbryt
      </button>
    </div>
  );
}
