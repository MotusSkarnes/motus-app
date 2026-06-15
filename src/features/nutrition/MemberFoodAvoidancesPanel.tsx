import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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

const BROWSE_LIMIT = 14;

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
  const draftRef = useRef(draft);
  draftRef.current = draft;
  const personalGoalsRef = useRef(personalGoals);
  personalGoalsRef.current = personalGoals;

  useEffect(() => {
    const fromProps = readMemberFoodAvoidancesFromPersonalGoals(personalGoals);
    const local = draftRef.current;
    if (fromProps.updatedAt < local.updatedAt) return;
    if (JSON.stringify(fromProps) === JSON.stringify(local)) return;
    setDraft(fromProps);
  }, [personalGoals]);

  const [search, setSearch] = useState("");
  const [customLabel, setCustomLabel] = useState("");
  const [status, setStatus] = useState<string | null>(null);

  const dirty = JSON.stringify(draft) !== JSON.stringify(stored);

  const persistDraft = useCallback(
    (nextDraft: MemberFoodAvoidances, successMessage?: string) => {
      const nextGoals = patchMemberFoodAvoidancesInPersonalGoals(personalGoalsRef.current, nextDraft);
      personalGoalsRef.current = nextGoals;
      onSavePersonalGoals(nextGoals);
      if (successMessage) setStatus(successMessage);
    },
    [onSavePersonalGoals],
  );

  const pickBrowsableFoods = useCallback(
    (query: string, limit: number) => {
      const q = query.trim().toLowerCase();
      const existingIds = new Set(draft.items.map((row) => row.foodId).filter(Boolean));
      const existingKeys = new Set(draft.items.map((row) => row.key));
      let list = foodItems.filter((item) => !existingIds.has(item.id));
      if (q) {
        list = list.filter((item) => item.name.toLowerCase().includes(q));
      }
      return list
        .filter((item) => !existingKeys.has(foodAvoidanceFromFoodItem(item).key))
        .slice(0, limit);
    },
    [draft.items, foodItems],
  );

  const browseFoods = useMemo(
    () => pickBrowsableFoods(search, BROWSE_LIMIT),
    [pickBrowsableFoods, search],
  );

  const addFood = useCallback(
    (food: FoodItem) => {
      const next = foodAvoidanceFromFoodItem(food);
      if (draftRef.current.items.some((row) => row.key === next.key)) {
        setStatus(`${food.name} finnes allerede i listen.`);
        return;
      }
      const nextDraft: MemberFoodAvoidances = {
        ...draftRef.current,
        items: [...draftRef.current.items, next],
      };
      setDraft(nextDraft);
      setSearch("");
      if (readOnly) return;
      persistDraft(nextDraft, `${food.name} er lagt til.`);
    },
    [persistDraft, readOnly],
  );

  const addCustom = useCallback(() => {
    const next = foodAvoidanceFromLabel(customLabel);
    if (!next) return;
    if (draftRef.current.items.some((row) => row.key === next.key)) {
      setStatus(`${next.label} finnes allerede i listen.`);
      setCustomLabel("");
      return;
    }
    const nextDraft: MemberFoodAvoidances = {
      ...draftRef.current,
      items: [...draftRef.current.items, next],
    };
    setDraft(nextDraft);
    setCustomLabel("");
    if (readOnly) return;
    persistDraft(nextDraft, `${next.label} er lagt til.`);
  }, [customLabel, persistDraft, readOnly]);

  const removeItem = useCallback(
    (key: string) => {
      const nextDraft: MemberFoodAvoidances = {
        ...draftRef.current,
        items: draftRef.current.items.filter((row) => row.key !== key),
      };
      setDraft(nextDraft);
      if (readOnly) return;
      persistDraft(nextDraft, "Listen er oppdatert.");
    },
    [persistDraft, readOnly],
  );

  const handleSave = useCallback(() => {
    persistDraft(draftRef.current, "Lagret. Treneren får varsel hvis oppskrifter inneholder dette.");
  }, [persistDraft]);

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
            : "Trykk på matvarer under for å legge til. Treneren får varsel når oppskrifter inneholder dette."}
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
          Ingen registrert ennå — velg matvarer under eller skriv f.eks. gluten, laktose.
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

          {browseFoods.length > 0 ? (
            <div className="space-y-2">
              <p className="text-[11px] font-medium text-slate-600">
                {search.trim() ? "Treff i matvarebanken" : "Vanlige matvarer — trykk for å legge til"}
              </p>
              <ul className="motus-food-avoidances-search-list">
                {browseFoods.map((food) => (
                  <li key={food.id}>
                    <button type="button" className="motus-food-avoidances-search-item" onClick={() => addFood(food)}>
                      <span>{food.imageEmoji ?? "🍽️"}</span>
                      <span className="font-medium text-slate-800">{food.name}</span>
                      <Plus className="ml-auto h-4 w-4 text-teal-700" aria-hidden />
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ) : search.trim() ? (
            <p className="text-xs text-slate-500">Ingen nye treff — prøv et annet søkeord eller legg til som fritekst under.</p>
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
            onBlur={() => {
              if (!readOnly && draftRef.current.notes !== stored.notes) {
                persistDraft(draftRef.current);
              }
            }}
            placeholder="Valgfritt: allergier, reaksjoner, «liten mengde ok» osv."
            rows={3}
          />

          {dirty ? (
            <div className="flex flex-wrap gap-2">
              <GradientButton type="button" onClick={handleSave}>
                Lagre notat
              </GradientButton>
              <OutlineButton type="button" onClick={handleReset}>
                Avbryt endringer
              </OutlineButton>
            </div>
          ) : null}
        </>
      ) : stored.notes.trim() ? (
        <p className="rounded-xl bg-slate-50 px-3 py-2 text-sm text-slate-700">
          <span className="font-semibold text-slate-800">Notat: </span>
          {stored.notes}
        </p>
      ) : null}

      {status ? <StatusMessage message={status} tone="success" /> : null}
      <input type="hidden" value={memberId} readOnly aria-hidden />
    </Card>
  );
}
