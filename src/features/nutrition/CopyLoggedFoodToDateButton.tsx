import { useState } from "react";
import { createPortal } from "react-dom";
import { Copy } from "lucide-react";

type Props = {
  label: string;
  sourceDateKey: string;
  onCopy: (targetDateKey: string) => void;
  onSaveMeal?: () => void;
};

export function CopyLoggedFoodToDateButton({ label, sourceDateKey, onCopy, onSaveMeal }: Props) {
  const [chooseOpen, setChooseOpen] = useState(false);
  const [open, setOpen] = useState(false);
  const [targetDateKey, setTargetDateKey] = useState("");
  return <>
    <button type="button" className={onSaveMeal ? "motus-save-logged-meal__copy motus-pressable" : "motus-pressable inline-flex items-center gap-1 rounded-full border border-teal-200 bg-teal-50 px-2 py-1 text-xs font-semibold text-teal-800"}
      onClick={(event) => { event.stopPropagation(); setTargetDateKey(""); if (onSaveMeal) setChooseOpen(true); else setOpen(true); }}
      aria-label={onSaveMeal ? `Kopier ${label}` : `Kopier ${label} til en annen dag`} title={`Kopier ${label}`}>
      <Copy className="h-3.5 w-3.5" aria-hidden /> {onSaveMeal ? null : "Kopier til dato"}
    </button>
    {chooseOpen && typeof document !== "undefined" ? createPortal(<div className="motus-foodbank-modal-backdrop !z-[10060]" role="presentation" onClick={() => setChooseOpen(false)}>
      <div className="motus-foodbank-modal max-w-sm" role="dialog" aria-modal="true" aria-label={`Kopier ${label}`}
        onClick={(event) => event.stopPropagation()}>
        <div className="motus-foodbank-modal-head"><h3>Kopier {label}</h3></div>
        <div className="motus-foodbank-modal-body space-y-3">
          <button type="button" className="block w-full rounded-lg border border-teal-200 p-3 text-left font-semibold text-teal-800"
            onClick={() => { setChooseOpen(false); setOpen(true); }}>Kopier til en annen dag</button>
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
              onClick={() => { onCopy(targetDateKey); setOpen(false); }}>Kopier</button>
          </div>
        </div>
      </div>
    </div>, document.body) : null}
  </>;
}
