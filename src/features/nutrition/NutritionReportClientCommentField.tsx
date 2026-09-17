import { TextArea } from "../../app/ui";

type NutritionReportClientCommentFieldProps = {
  value: string;
  onChange: (value: string) => void;
};

export function NutritionReportClientCommentField({ value, onChange }: NutritionReportClientCommentFieldProps) {
  return (
    <label className="motus-nutrition-report-modal__comment">
      <span>Kommentar til kunderapporten</span>
      <TextArea
        rows={3}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder="Vises nederst på utskriften til kunden. La feltet stå tomt for et tomt notatfelt på papiret."
      />
    </label>
  );
}
