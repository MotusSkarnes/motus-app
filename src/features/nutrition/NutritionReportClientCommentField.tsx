import { useId } from "react";

type NutritionReportClientCommentFieldProps = {
  value: string;
  onChange: (value: string) => void;
};

export function NutritionReportClientCommentField({ value, onChange }: NutritionReportClientCommentFieldProps) {
  const id = useId();
  return (
    <div className="motus-nutrition-report-modal__comment">
      <label htmlFor={id}>Kommentar til kunderapporten</label>
      <textarea
        id={id}
        name="clientComment"
        rows={4}
        autoComplete="off"
        spellCheck
        data-motus-client-comment="true"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder="Skriv her. Teksten vises nederst på utskriften til kunden."
      />
    </div>
  );
}
