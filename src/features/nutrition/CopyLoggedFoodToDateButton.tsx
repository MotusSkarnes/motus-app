import { useState } from "react";
import { createPortal } from "react-dom";
import { Copy } from "lucide-react";
import type { MemberQuickFoodLogEntry } from "../../app/memberMealPlanState";
import { includedLoggedMealSaveRows, loggedMealSaveRowsFromEntries } from "../../app/memberSavedMeals";
import { MEMBER_MEAL_SLOTS, canonicalMemberMealSlotId } from "../../app/memberMealSlots";

type Props = {
  label: string;
  sourceDateKey: string;
  entries: MemberQuickFoodLogEntry[];
  onCopy: (targetDateKey: string, selectedEntries: MemberQuickFoodLogEntry[]) => void;
  onSaveMeal?: () => void;
};

export function CopyLoggedFoodToDateButton({ label, sourceDateKey, entries, onCopy, onSaveMeal }: Props) {
  const [chooseOpen, setChooseOpen] = useState(false);
  const [open, setOpen] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [targetDateKey, setTargetDateKey] = useState("");
  const [targetMealSlotId, setTargetMealSlotId] = useState("");
  const [slotByEntryId, setSlotByEntryId] = useState<Record<string, string>>({});
  const [rows, setRows] = useState(() => loggedMealSaveRowsFromEntries(entries));
  function startCopy() {
    setTargetDateKey("");
    setRows(loggedMealSaveRowsFromEntries(entries));
    const nextSlots = Object.fromEntries(entries.map((entry) => {
      const slot = canonicalMemberMealSlotId(entry.mealId, label);
      return [entry.id, MEMBER_MEAL_SLOTS.some((item) => item.id === slot) ? slot! : ""];
    }));
    setSlotByEntryId(nextSlots);
    setTargetMealSlotId("");
    setOpen(true);
  }
  function confirmCopy() {
    const selected = includedLoggedMealSaveRows(rows).map((row) => {
      const entry = entries.find((item) => item.id === row.id)!;
      return { ...entry, grams: row.grams, mealId: slotByEntryId[row.id] };
    });
    if (!selected.length || selected.some((entry) => !entry.mealId)) return;
    onCopy(targetDateKey, selected);
    setReviewOpen(false);
  }
  return <>
    <button type="button" className="motus-save-logged-meal__copy motus-pressable"
      onClick={(event) => { event.stopPropagation(); if (onSaveMeal) setChooseOpen(true); else startCopy(); }}
      aria-label={onSaveMeal ? `Kopier ${label}` : `Kopier ${label} til en annen dag`}
      title={onSaveMeal ? `Kopier ${label}` : `Kopier ${label} til en annen dag`}>
      <Copy className="h-3.5 w-3.5" aria-hidden />
    </button>
    {chooseOpen && typeof document !== "undefined" ? createPortal(<div className="motus-foodbank-modal-backdrop !z-[10060]" role="presentation" onClick={() => setChooseOpen(false)}>
      <div className="motus-foodbank-modal max-w-sm" role="dialog" aria-modal="true" aria-label={`Kopier ${label}`}
        onClick={(event) => event.stopPropagation()}>
        <div className="motus-foodbank-modal-head"><h3>Kopier {label}</h3></div>
        <div className="motus-foodbank-modal-body space-y-3">
          <button type="button" className="block w-full rounded-lg border border-teal-200 p-3 text-left font-semibold text-teal-800"
            onClick={() => { setChooseOpen(false); startCopy(); }}>Kopier til en annen dag</button>
          <button type="button" className="block w-full rounded-lg border border-slate-200 p-3 text-left font-semibold text-slate-800"
            onClick={() => { setChooseOpen(false); onSaveMeal?.(); }}>Lagre i lagrede måltider</button>
          <button type="button" className="text-sm text-slate-600" onClick={() => setChooseOpen(false)}>Avbryt</button>
        </div>
      </div>
    </div>, document.body) : null}
    {open && typeof document !== "undefined" ? createPortal(<div className="motus-foodbank-modal-backdrop !z-[10060]" role="presentation" onClick={(event) => { event.stopPropagation(); setOpen(false); }}>
      <div className="motus-foodbank-modal max-w-sm" role="dialog" aria-modal="true" aria-label={`Kopier ${label} til en annen dag`}
        onClick={(event) => event.stopPropagation()}>
        <div className="motus-foodbank-modal-head"><h3>Kopier {label}</h3></div>
        <div className="motus-foodbank-modal-body space-y-4">
          <p className="text-sm text-slate-600">Fra {sourceDateKey}. Velg dagen kopien skal legges til.</p>
          <label className="block text-sm font-semibold">Til dato
            <input type="date" className="mt-1 block w-full rounded-lg border border-slate-300 p-2" value={targetDateKey}
              onChange={(event) => setTargetDateKey(event.target.value)} />
          </label>
          <div className="flex gap-2">
            <button type="button" className="rounded-lg border px-4 py-2" onClick={() => setOpen(false)}>Avbryt</button>
            <button type="button" className="rounded-lg bg-teal-700 px-4 py-2 font-semibold text-white"
              disabled={!targetDateKey || targetDateKey === sourceDateKey}
              onClick={() => { setOpen(false); setReviewOpen(true); }}>Velg matvarer</button>
          </div>
        </div>
      </div>
    </div>, document.body) : null}
    {reviewOpen && typeof document !== "undefined" ? createPortal(<div className="motus-save-logged-meal-backdrop !z-[10060]" role="presentation" onClick={() => setReviewOpen(false)}>
      <div className="w-full max-w-lg" role="dialog" aria-modal="true" aria-label={`Velg matvarer fra ${label}`}
        onClick={(event) => event.stopPropagation()}>
        <div className="motus-save-logged-meal-modal overflow-hidden rounded-2xl bg-white shadow-xl">
          <header className="motus-save-logged-meal-modal__head"><div>
            <h2 className="motus-save-logged-meal-modal__title">Kopier til {targetDateKey}</h2>
            <p className="motus-save-logged-meal-modal__lead">Fjern haken på det du ikke vil kopiere, og juster mengder om du vil.</p>
          </div></header>
          <div className="motus-save-logged-meal-modal__body">
            <label className="motus-saved-meals__save-label" htmlFor="copy-target-meal-slot">Legg alle til som</label>
            <select id="copy-target-meal-slot" className="mb-3 w-full rounded-lg border border-slate-300 bg-white p-2"
              value={targetMealSlotId} onChange={(event) => {
                const slot = event.target.value;
                setTargetMealSlotId(slot);
                if (slot) setSlotByEntryId(Object.fromEntries(entries.map((entry) => [entry.id, slot])));
              }}>
              <option value="">Velg for alle</option>
              {MEMBER_MEAL_SLOTS.map((slot) => <option key={slot.id} value={slot.id}>{slot.label}</option>)}
            </select>
            <ul className="motus-save-logged-meal-modal__list">{rows.map((row) => <li key={row.id}
              className={`motus-save-logged-meal-modal__row motus-copy-food-row ${row.included ? "" : "motus-save-logged-meal-modal__row--excluded"}`}>
              <label className="motus-save-logged-meal-modal__check"><input type="checkbox" checked={row.included}
                onChange={(event) => setRows((previous) => previous.map((item) => item.id === row.id ? { ...item, included: event.target.checked } : item))}
                aria-label={`Ta med ${row.name}`} /><span className="motus-save-logged-meal-modal__name">{row.name}</span></label>
              <label className="motus-save-logged-meal-modal__grams"><input type="number" inputMode="decimal" min={1} max={5000} step="1"
                value={row.grams > 0 ? row.grams : ""} disabled={!row.included} aria-label={`Mengde i gram for ${row.name}`}
                onChange={(event) => { const grams = Number(event.target.value.replace(",", ".")); setRows((previous) => previous.map((item) => item.id === row.id ? { ...item, grams: Number.isFinite(grams) ? grams : 0 } : item)); }} />
                <span aria-hidden>g</span></label>
              <select className="motus-copy-food-row__slot rounded-lg border border-slate-300 bg-white p-1 text-sm" value={slotByEntryId[row.id] ?? ""}
                aria-label={`Måltid for ${row.name}`} disabled={!row.included}
                onChange={(event) => setSlotByEntryId((previous) => ({ ...previous, [row.id]: event.target.value }))}>
                <option value="">Velg måltid</option>
                {MEMBER_MEAL_SLOTS.map((slot) => <option key={slot.id} value={slot.id}>{slot.label}</option>)}
              </select>
            </li>)}</ul>
            <div className="motus-save-logged-meal-modal__actions">
              <button type="button" className="rounded-lg border px-4 py-2" onClick={() => { setReviewOpen(false); setOpen(true); }}>Tilbake</button>
              <button type="button" className="rounded-lg bg-teal-700 px-4 py-2 font-semibold text-white"
                disabled={includedLoggedMealSaveRows(rows).length === 0 || includedLoggedMealSaveRows(rows).some((row) => !slotByEntryId[row.id])}
                onClick={confirmCopy}>Kopier valgte</button>
            </div>
          </div>
        </div>
      </div>
    </div>, document.body) : null}
  </>;
}
