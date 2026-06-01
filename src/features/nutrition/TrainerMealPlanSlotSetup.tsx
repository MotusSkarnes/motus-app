import { MEAL_PLAN_SLOT_DEFINITIONS, type MealPlanSlotId } from "../../app/mealPlanMealSlots";
import { GradientButton, PillButton } from "../../app/ui";

type TrainerMealPlanSlotSetupProps = {
  memberName: string;
  selectedSlotIds: MealPlanSlotId[];
  onToggleSlot: (slotId: MealPlanSlotId) => void;
  onCreate: () => void;
  creating?: boolean;
  error?: string | null;
};

export function TrainerMealPlanSlotSetup({
  memberName,
  selectedSlotIds,
  onToggleSlot,
  onCreate,
  creating = false,
  error = null,
}: TrainerMealPlanSlotSetupProps) {
  const canCreate = selectedSlotIds.length > 0 && !creating;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white px-5 py-8 shadow-sm">
      <h3 className="text-lg font-semibold text-slate-950">Velg måltider for dagene</h3>
      <p className="mt-2 max-w-lg text-sm text-slate-600">
        Før du fyller uken for <span className="font-medium text-slate-800">{memberName}</span>, velg hvilke måltider som
        skal inngå hver dag. Du kan endre innholdet i rutenettet etterpå.
      </p>
      <div className="mt-5">
        <div className="text-[11px] font-medium text-slate-500">Måltider per dag</div>
        <div className="mt-2 flex flex-wrap gap-2">
          {MEAL_PLAN_SLOT_DEFINITIONS.map((slot) => (
            <PillButton key={slot.id} active={selectedSlotIds.includes(slot.id)} onClick={() => onToggleSlot(slot.id)}>
              {slot.label}
            </PillButton>
          ))}
        </div>
        <p className="mt-2 text-xs text-slate-500">
          Valgt: {selectedSlotIds.length ? selectedSlotIds.map((id) => MEAL_PLAN_SLOT_DEFINITIONS.find((s) => s.id === id)?.label).join(", ") : "ingen"}
          . Minst ett måltid må være med.
        </p>
      </div>
      <GradientButton type="button" className="mt-6" disabled={!canCreate} onClick={onCreate}>
        {creating ? "Oppretter ukeplan …" : "Opprett ukeplan"}
      </GradientButton>
      {error ? <p className="mt-3 text-sm font-medium text-rose-700">{error}</p> : null}
    </div>
  );
}
