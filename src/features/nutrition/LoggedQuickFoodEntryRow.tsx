import { useEffect, useState } from "react";
import { Pencil, Trash2, X } from "lucide-react";
import { formatMacro } from "../../app/foodBankTypes";
import {
  MEMBER_MEAL_SLOTS,
  persistMemberMealSlotAfterEdit,
  resolveMemberMealSlotSelectValue,
} from "../../app/memberMealSlots";
import type { MemberQuickFoodLogEntry } from "../../app/memberMealPlanState";
import { sumQuickFoodLogMacros } from "../../app/quickFoodLogMacros";

type LoggedQuickFoodEntryRowProps = {
  entry: MemberQuickFoodLogEntry;
  onSave: (patch: { grams: number; mealId: string }) => void;
  onRemove: () => void;
  /** Compact actions for matplan meal cards. */
  compact?: boolean;
};

function entryMacroLine(entry: MemberQuickFoodLogEntry): string {
  const macros = sumQuickFoodLogMacros([entry]);
  return `${formatMacro(macros.kcal, 0)} kcal · P ${formatMacro(macros.protein, 1)} g`;
}

function resolveEditMealId(entry: MemberQuickFoodLogEntry): string {
  return resolveMemberMealSlotSelectValue(entry.mealId, entry.name);
}

export function LoggedQuickFoodEntryRow({ entry, onSave, onRemove, compact = false }: LoggedQuickFoodEntryRowProps) {
  const [editing, setEditing] = useState(false);
  const [gramsInput, setGramsInput] = useState(String(entry.grams));
  const [mealId, setMealId] = useState(() => resolveEditMealId(entry));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (editing) return;
    setGramsInput(String(entry.grams));
    setMealId(resolveEditMealId(entry));
    setError(null);
  }, [editing, entry]);

  function startEdit() {
    setGramsInput(String(entry.grams));
    setMealId(resolveEditMealId(entry));
    setError(null);
    setEditing(true);
  }

  function cancelEdit() {
    setEditing(false);
    setError(null);
  }

  function saveEdit() {
    const grams = Number(String(gramsInput).replace(",", "."));
    if (!Number.isFinite(grams) || grams <= 0) {
      setError("Oppgi en mengde større enn 0 g.");
      return;
    }
    if (grams > 5000) {
      setError("Mengde kan ikke være over 5000 g.");
      return;
    }
    onSave({ grams, mealId: persistMemberMealSlotAfterEdit(entry.mealId, mealId, entry.name) ?? "" });
    setEditing(false);
    setError(null);
  }

  if (editing) {
    return (
      <li className={`motus-log-meal-panel__item motus-log-meal-panel__item--editing ${compact ? "motus-log-meal-panel__item--compact" : ""}`}>
        <div className="motus-log-entry-edit">
          <p className="motus-log-entry-edit__name">{entry.name}</p>
          <div className="motus-log-entry-edit__fields">
            <label className="motus-log-entry-edit__field">
              <span>Mengde (g)</span>
              <input
                type="number"
                inputMode="decimal"
                min={1}
                max={5000}
                step={1}
                value={gramsInput}
                onChange={(e) => setGramsInput(e.target.value)}
                className="motus-log-entry-edit__input"
                aria-label={`Mengde for ${entry.name}`}
              />
            </label>
            <label className="motus-log-entry-edit__field">
              <span>Måltid</span>
              <select
                value={mealId}
                onChange={(e) => setMealId(e.target.value)}
                className="motus-log-entry-edit__select"
                aria-label={`Måltid for ${entry.name}`}
              >
                <option value="">Annet</option>
                {MEMBER_MEAL_SLOTS.map((slot) => (
                  <option key={slot.id} value={slot.id}>
                    {slot.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
          {error ? <p className="motus-log-entry-edit__error">{error}</p> : null}
          <div className="motus-log-entry-edit__actions">
            <button type="button" className="motus-log-entry-edit__save motus-pressable" onClick={saveEdit}>
              Lagre
            </button>
            <button type="button" className="motus-log-entry-edit__cancel motus-pressable" onClick={cancelEdit}>
              Avbryt
            </button>
          </div>
        </div>
      </li>
    );
  }

  return (
    <li className={`motus-log-meal-panel__item ${compact ? "motus-log-meal-panel__item--compact" : ""}`}>
      <div className="min-w-0">
        <p className="motus-log-meal-panel__item-name">
          {entry.name} · {formatMacro(entry.grams, 0)} g
        </p>
        <p className="motus-log-meal-panel__item-meta">{entryMacroLine(entry)}</p>
      </div>
      <div className="motus-log-meal-panel__item-actions">
        <button
          type="button"
          className="motus-log-meal-panel__edit"
          onClick={startEdit}
          aria-label={`Rediger ${entry.name}`}
        >
          <Pencil className="h-4 w-4" aria-hidden />
          {compact ? <span>Rediger</span> : null}
        </button>
        <button
          type="button"
          className="motus-log-meal-panel__remove"
          onClick={onRemove}
          aria-label={`Fjern ${entry.name}`}
        >
          {compact ? (
            <>
              <X className="h-3.5 w-3.5" aria-hidden />
              Fjern
            </>
          ) : (
            <Trash2 className="h-4 w-4" aria-hidden />
          )}
        </button>
      </div>
    </li>
  );
}
