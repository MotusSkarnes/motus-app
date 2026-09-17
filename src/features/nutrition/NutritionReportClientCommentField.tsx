const COMMENT_FIELD_ID = "motus-nutrition-report-client-comment";

type NutritionReportClientCommentFieldProps = {
  value: string;
  onChange: (value: string) => void;
};

export function NutritionReportClientCommentField({ value, onChange }: NutritionReportClientCommentFieldProps) {
  return (
    <div
      className="motus-nutrition-report-modal__comment"
      onMouseDown={(event) => event.stopPropagation()}
      onPointerDown={(event) => event.stopPropagation()}
    >
      <label htmlFor={COMMENT_FIELD_ID}>Kommentar til kunderapporten</label>
      <textarea
        id={COMMENT_FIELD_ID}
        rows={3}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onMouseDown={(event) => {
          event.stopPropagation();
          event.currentTarget.focus();
        }}
        onPointerDown={(event) => event.stopPropagation()}
        placeholder="Skriv her. Teksten vises nederst på utskriften til kunden."
      />
    </div>
  );
}
