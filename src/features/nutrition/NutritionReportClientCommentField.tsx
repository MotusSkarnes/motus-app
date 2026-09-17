import { useId, useRef } from "react";
import { clearPrintOverlayLocks } from "../../app/printHtmlDocument";

type NutritionReportClientCommentFieldProps = {
  value: string;
  onChange: (value: string) => void;
};

function unlockCommentField(el: HTMLTextAreaElement): void {
  clearPrintOverlayLocks();
  const start = el.selectionStart;
  const end = el.selectionEnd;
  el.readOnly = true;
  void el.offsetHeight;
  el.readOnly = false;
  if (typeof start === "number" && typeof end === "number") {
    try {
      el.setSelectionRange(start, end);
    } catch {
      // ignore
    }
  }
}

export function NutritionReportClientCommentField({ value, onChange }: NutritionReportClientCommentFieldProps) {
  const id = useId();
  const ref = useRef<HTMLTextAreaElement>(null);

  return (
    <div className="motus-nutrition-report-modal__comment">
      <label htmlFor={id}>Kommentar til kunderapporten</label>
      <textarea
        ref={ref}
        id={id}
        name="clientComment"
        rows={4}
        autoComplete="off"
        spellCheck
        data-motus-client-comment="true"
        value={value}
        onPointerDown={(event) => unlockCommentField(event.currentTarget)}
        onFocus={(event) => unlockCommentField(event.currentTarget)}
        onChange={(event) => onChange(event.target.value)}
        placeholder="Skriv her. Teksten vises nederst på utskriften til kunden."
      />
    </div>
  );
}
