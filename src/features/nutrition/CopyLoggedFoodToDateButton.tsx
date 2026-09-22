import { useState } from "react";
import { createPortal } from "react-dom";
import { Copy } from "lucide-react";
import type { MemberQuickFoodLogEntry } from "../../app/memberMealPlanState";
import { includedLoggedMealSaveRows, loggedMealSaveRowsFromEntries } from "../../app/memberSavedMeals";

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
  const [rows, setRows] = useState(() => loggedMealSaveRowsFromEntries(entries));
  function startCopy() {
    setTargetDateKey("");
    setRows(loggedMealSaveRowsFromEntries(entries));
    setOpen(true);
  }
  function confirmCopy() {
    const selected = includedLoggedMealSaveRows(rows).map((row) => {
      const entry = entries.find((item) => item.id === row.id)!;
      return { ...entry, grams: row.grams };
    });
    if (!selected.length) return;
    onCopy(targetDateKey, selected);
    setReviewOpen(false);
  }
  return <>
    <button type="button" className={onSaveMeal ? "motus-save-logged-meal__copy motus-pressable" : "motus-pressable inline-flex items-center gap-1 rounded-full border border-teal-200 bg-teal-50 px-2 py-1 text-xs font-semibold text-teal-800"}
      onClick={(event) => { event.stopPropagation(); if (onSaveMeal) setChooseOpen(true); else startCopy(); }}
      aria-label={onSaveMeal ? `Kopier ${label}` : `Kopier ${label} til en annen dag`} title={`Kopier ${label}`}>
      <Copy className="h-3.5 w-3.5" aria-hidden /> {onSaveMeal ? null : "Kopier til dato"}
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
            <ul className="motus-save-logged-meal-modal__list">{rows.map((row) => <li key={row.id}
              className={`motus-save-logged-meal-modal__row ${row.included ? "" : "motus-save-logged-meal-modal__row--excluded"}`}>
              <label className="motus-save-logged-meal-modal__check"><input type="checkbox" checked={row.included}
                onChange={(event) => setRows((previous) => previous.map((item) => item.id === row.id ? { ...item, included: event.target.checked } : item))}
                aria-label={`Ta med ${row.name}`} /><span className="motus-save-logged-meal-modal__name">{row.name}</span></label>
              <label className="motus-save-logged-meal-modal__grams"><input type="number" inputMode="decimal" min={1} max={5000} step="1"
                value={row.grams > 0 ? row.grams : ""} disabled={!row.included} aria-label={`Mengde i gram for ${row.name}`}
                onChange={(event) => { const grams = Number(event.target.value.replace(",", ".")); setRows((previous) => previous.map((item) => item.id === row.id ? { ...item, grams: Number.isFinite(grams) ? grams : 0 } : item)); }} />
                <span aria-hidden>g</span></label>
            </li>)}</ul>
            <div className="motus-save-logged-meal-modal__actions">
              <button type="button" className="rounded-lg border px-4 py-2" onClick={() => { setReviewOpen(false); setOpen(true); }}>Tilbake</button>
              <button type="button" className="rounded-lg bg-teal-700 px-4 py-2 font-semibold text-white"
                disabled={includedLoggedMealSaveRows(rows).length === 0} onClick={confirmCopy}>Kopier valgte</button>
            </div>
          </div>
        </div>
      </div>
    </div>, document.body) : null}
  </>;
}
