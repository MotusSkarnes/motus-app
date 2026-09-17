import { useEffect, useId, useMemo, useState } from "react";
import { Copy, X } from "lucide-react";
import { formatMacro } from "../../app/foodBankTypes";
import type { MemberQuickFoodLogEntry } from "../../app/memberMealPlanState";
import {
  createSavedMealFromSaveRows,
  defaultSavedMealName,
  includedLoggedMealSaveRows,
  loggedMealSaveRowsFromEntries,
  type LoggedMealSaveRow,
  type MemberSavedMeal,
} from "../../app/memberSavedMeals";
import { sumQuickFoodLogMacros } from "../../app/quickFoodLogMacros";
import { Card, GradientButton, OutlineButton, TextInput } from "../../app/ui";
import "../../foodbank.css";

type SaveLoggedMealCopyButtonProps = {
  mealLabel: string;
  onClick: () => void;
  className?: string;
};

export function SaveLoggedMealCopyButton({ mealLabel, onClick, className = "" }: SaveLoggedMealCopyButtonProps) {
  return (
    <button
      type="button"
      className={`motus-save-logged-meal__copy motus-pressable ${className}`.trim()}
      onClick={(event) => {
        event.stopPropagation();
        onClick();
      }}
      aria-label={`Lagre ${mealLabel} som måltid`}
      title="Lagre som måltid"
    >
      <Copy className="h-3.5 w-3.5" aria-hidden />
    </button>
  );
}

type SaveLoggedMealModalProps = {
  open: boolean;
  mealLabel: string;
  mealSlotId?: string;
  entries: MemberQuickFoodLogEntry[];
  onClose: () => void;
  onSave: (meal: MemberSavedMeal) => void;
};

function rowPreviewMacros(row: LoggedMealSaveRow): string {
  const macros = sumQuickFoodLogMacros([
    {
      id: row.id,
      name: row.name,
      grams: row.grams,
      source: row.source,
      loggedAt: "",
      nutritionPer100g: row.nutritionPer100g,
    },
  ]);
  return `${formatMacro(macros.kcal, 0)} kcal`;
}

export function SaveLoggedMealModal({
  open,
  mealLabel,
  mealSlotId,
  entries,
  onClose,
  onSave,
}: SaveLoggedMealModalProps) {
  const titleId = useId();
  const nameId = useId();
  const [name, setName] = useState(() => defaultSavedMealName(entries, mealLabel));
  const [rows, setRows] = useState(() => loggedMealSaveRowsFromEntries(entries));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setName(defaultSavedMealName(entries, mealLabel));
    setRows(loggedMealSaveRowsFromEntries(entries));
    setError(null);
  }, [entries, mealLabel, open]);

  useEffect(() => {
    if (!open) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose, open]);

  const includedCount = useMemo(() => includedLoggedMealSaveRows(rows).length, [rows]);
  const canSave = name.trim().length > 0 && includedCount > 0;

  function setRowIncluded(rowId: string, included: boolean) {
    setRows((prev) => prev.map((row) => (row.id === rowId ? { ...row, included } : row)));
    setError(null);
  }

  function setRowGrams(rowId: string, raw: string) {
    const grams = Number(String(raw).replace(",", "."));
    setRows((prev) =>
      prev.map((row) => (row.id === rowId ? { ...row, grams: Number.isFinite(grams) ? grams : 0 } : row)),
    );
    setError(null);
  }

  function handleSave() {
    const meal = createSavedMealFromSaveRows(rows, name, mealSlotId);
    if (!meal) {
      setError("Velg minst én ingrediens med mengde over 0 g.");
      return;
    }
    onSave(meal);
    onClose();
  }

  if (!open) return null;

  return (
    <div
      className="motus-modal-insets motus-save-logged-meal-backdrop"
      role="presentation"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(event) => event.stopPropagation()}
      >
      <Card className="motus-save-logged-meal-modal overflow-hidden p-0 shadow-xl ring-1 ring-black/10">
        <header className="motus-save-logged-meal-modal__head">
          <div className="min-w-0">
            <h2 id={titleId} className="motus-save-logged-meal-modal__title">
              Lagre som måltid
            </h2>
            <p className="motus-save-logged-meal-modal__lead">
              Alle ingredienser fra {mealLabel.toLowerCase()} er med. Fjern haken på det du ikke vil lagre, og juster
              mengder om du vil.
            </p>
          </div>
          <button type="button" className="motus-save-logged-meal-modal__close motus-pressable" onClick={onClose} aria-label="Lukk">
            <X className="h-5 w-5" aria-hidden />
          </button>
        </header>

        <div className="motus-save-logged-meal-modal__body">
          <label className="motus-saved-meals__save-label" htmlFor={nameId}>
            Navn på måltidet
          </label>
          <TextInput
            id={nameId}
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder={`F.eks. Min ${mealLabel.toLowerCase()}`}
          />

          <ul className="motus-save-logged-meal-modal__list">
            {rows.map((row) => (
              <li
                key={row.id}
                className={`motus-save-logged-meal-modal__row ${row.included ? "" : "motus-save-logged-meal-modal__row--excluded"}`}
              >
                <label className="motus-save-logged-meal-modal__check">
                  <input
                    type="checkbox"
                    checked={row.included}
                    onChange={(event) => setRowIncluded(row.id, event.target.checked)}
                    aria-label={`Ta med ${row.name}`}
                  />
                  <span className="motus-save-logged-meal-modal__name">{row.name}</span>
                </label>
                <span className="motus-save-logged-meal-modal__kcal">{rowPreviewMacros(row)}</span>
                <label className="motus-save-logged-meal-modal__grams">
                  <input
                    type="number"
                    inputMode="decimal"
                    min={1}
                    max={5000}
                    step="1"
                    value={Number.isFinite(row.grams) && row.grams > 0 ? row.grams : ""}
                    disabled={!row.included}
                    aria-label={`Mengde i gram for ${row.name}`}
                    onChange={(event) => setRowGrams(row.id, event.target.value)}
                  />
                  <span aria-hidden>g</span>
                </label>
              </li>
            ))}
          </ul>

          {error ? <p className="motus-save-logged-meal-modal__error">{error}</p> : null}

          <div className="motus-save-logged-meal-modal__actions">
            <OutlineButton type="button" onClick={onClose}>
              Avbryt
            </OutlineButton>
            <GradientButton type="button" onClick={handleSave} disabled={!canSave}>
              Lagre måltid
            </GradientButton>
          </div>
        </div>
      </Card>
      </div>
    </div>
  );
}
