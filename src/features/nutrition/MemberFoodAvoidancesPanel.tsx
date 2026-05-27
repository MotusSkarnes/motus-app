import { useCallback, useEffect, useMemo, useState } from "react";
import { Plus, Search, X } from "lucide-react";
import { buildDefaultFoodBankItems } from "../../app/foodBankSeed";
import type { FoodItem } from "../../app/foodBankTypes";
import {
  foodAvoidanceFromFoodItem,
  foodAvoidanceFromLabel,
  patchMemberFoodAvoidancesInPersonalGoals,
  readMemberFoodAvoidancesFromPersonalGoals,
  type MemberFoodAvoidances,
} from "../../app/memberFoodAvoidances";
import { useFoodBankItems } from "../../app/useFoodBankItems";
import { Card, GradientButton, OutlineButton, StatusMessage, TextArea, TextInput } from "../../app/ui";

type MemberFoodAvoidancesPanelProps = {
  memberId: string;
  personalGoals: string;
  onSavePersonalGoals: (personalGoals: string) => void;
  readOnly?: boolean;
};

export function MemberFoodAvoidancesPanel({
  memberId,
  personalGoals,
  onSavePersonalGoals,
  readOnly = false,
}: MemberFoodAvoidancesPanelProps) {
  const bankItems = useFoodBankItems();
  const foodItems = useMemo(
    () => (bankItems.length > 0 ? bankItems : buildDefaultFoodBankItems()),
    [bankItems],
  );

  const stored = useMemo(
    () => readMemberFoodAvoidancesFromPersonalGoals(personalGoals),
    [personalGoals],
  );

  const [draft, setDraft] = useState<MemberFoodAvoidances>(stored);

  useEffect(() => {
    setDraft(readMemberFoodAvoidancesFromPersonalGoals(personalGoals));
  }, [personalGoals]);
  const [search, setSearch] = useState("");
  const [customLabel, setCustomLabel] = useState("");
  const [status, setStatus] = useState<string | null>(null);

  const dirty =
    JSON.stringify(draft) !== JSON.stringify(stored);

  const filteredFoods = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = foodItems;
    if (q) list = list.filter((item) => item.name.toLowerCase().includes(q));
    const existingIds = new Set(draft.items.map((row) => row.foodId).filter(Boolean));
    return list.filter((item) => !existingIds.has(item.id)).slice(0, 12);
  }, [draft.items, foodItems, search]);

  const addFood = useCallback(
    (food: FoodItem) => {
      const next = foodAvoidanceFromFoodItem(food);
      if (draft.items.some((row) => row.key === next.key)) return;
      setDraft((prev) => ({ ...prev, items: [...prev.items, next] }));
      setSearch("");
    },
    [draft.items],
  );

  const addCustom = useCallback(() => {
    const next = foodAvoidanceFromLabel(customLabel);
    if (!next) return;
    if (draft.items.some((row) => row.key === next.key)) {
      setCustomLabel("");
      return;
    }
    setDraft((prev) => ({ ...prev, items: [...prev.items, next] }));
    setCustomLabel("");
  }, [customLabel, draft.items]);

  const removeItem = useCallback((key: string) => {
    setDraft((prev) => ({ ...prev, items: prev.items.filter((row) => row.key !== key) }));
  }, []);

  const handleSave = useCallback(() => {
    const nextGoals = patchMemberFoodAvoidancesInPersonalGoals(personalGoals, draft);
    onSavePersonalGoals(nextGoals);
    setStatus("Lagret. Treneren får varsel hvis oppskrifter inneholder dette.");
  }, [draft, onSavePersonalGoals, personalGoals]);

  const handleReset = useCallback(() => {
    setDraft(stored);
    setStatus(null);
  }, [stored]);

  if (readOnly && !stored.items.length && !stored.notes.trim()) {
    return (
      <Card className="p-4 text-sm text-slate-600">
        Medlemmet har ikke registrert mat de unngår eller ikke tåler.
      </Card>
    );
  }

  return (
    <Card className="motus-food-avoidances-panel space-y-4 p-4 sm:p-5">
      <div>
        <h2 className="text-base font-bold text-slate-900">Mat jeg unngår / ikke tåler</h2>
        <p className="mt-1 text-sm text-slate-600">
          {readOnly
            ? "Medlemmets registrerte matvarer og intoleranser. Du får varsel i oppskrifter og matplan som inneholder dette."
            : "Legg inn matvarer, allergener eller ingredienser du vil unngå. Treneren får varsel når oppskrifter inneholder dette."}
        </p>
      </div>

      {draft.items.length > 0 ? (
        <ul className="motus-food-avoidances-chips">
          {draft.items.map((item) => (
            <li key={item.key} className="motus-food-avoidances-chip">
              <span>{item.label}</span>
              {!readOnly ? (
                <button
                  type="button"
                  className="motus-food-avoidances-chip-remove"
                  onClick={() => removeItem(item.key)}
                  aria-label={`Fjern ${item.label}`}
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      ) : (
        <p className="rounded-xl border border-dashed border-slate-200 bg-slate-50/80 px-3 py-4 text-center text-xs text-slate-500">
          Ingen registrert ennå.
        </p>
      )}

      {!readOnly ? (
        <>
          <label className="motus-foodbank-search">
            <Search className="h-4 w-4 shrink-0 text-slate-400" aria-hidden />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Søk i matvarebanken …"
              aria-label="Søk matvare"
            />
          </label>
          {search.trim() && filteredFoods.length > 0 ? (
            <ul className="motus-food-avoidances-search-list">
              {filteredFoods.map((food) => (
                <li key={food.id}>
                  <button type="button" className="motus-food-avoidances-search-item" onClick={() => addFood(food)}>
                    <span>{food.imageEmoji ?? "🍽️"}</span>
                    <span className="font-medium text-slate-800">{food.name}</span>
                    <Plus className="ml-auto h-4 w-4 text-teal-700" aria-hidden />
                  </button>
                </li>
              ))}
            </ul>
          ) : null}

          <div className="flex flex-wrap gap-2">
            <TextInput
              value={customLabel}
              onChange={(e) => setCustomLabel(e.target.value)}
              placeholder="F.eks. gluten, laktose, nøtter …"
              className="min-w-[12rem] flex-1"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addCustom();
                }
              }}
            />
            <OutlineButton type="button" onClick={addCustom} disabled={!customLabel.trim()}>
              Legg til
            </OutlineButton>
          </div>

          <TextArea
            value={draft.notes}
            onChange={(e) => setDraft((prev) => ({ ...prev, notes: e.target.value }))}
            placeholder="Valgfritt: allergier, reaksjoner, «liten mengde ok» osv."
            rows={3}
          />

          <div className="flex flex-wrap gap-2">
            <GradientButton type="button" onClick={handleSave} disabled={!dirty}>
              Lagre
            </GradientButton>
            {dirty ? (
              <OutlineButton type="button" onClick={handleReset}>
                Avbryt
              </OutlineButton>
            ) : null}
          </div>
        </>
      ) : stored.notes.trim() ? (
        <p className="rounded-xl bg-slate-50 px-3 py-2 text-sm text-slate-700">
          <span className="font-semibold text-slate-800">Notat: </span>
          {stored.notes}
        </p>
      ) : null}

      {status ? <StatusMessage tone="success">{status}</StatusMessage> : null}
      <input type="hidden" value={memberId} readOnly aria-hidden />
    </Card>
  );
}
