import { FOOD_BANK_CATEGORIES, type FoodCategoryId } from "../app/foodBankTypes";
import type { FoodLabelScanResult, FoodSubmissionDraft } from "../app/foodLabelScanTypes";
import { FoodLabelScanButton } from "./FoodLabelScanButton";
import { GradientButton, OutlineButton, SelectBox, TextInput } from "../app/ui";

export type FoodSubmissionDraftFormProps = {
  draft: FoodSubmissionDraft;
  onDraftChange: (draft: FoodSubmissionDraft) => void;
  onScanned: (scan: FoodLabelScanResult, imageDataUrl: string) => void;
  onScanError: (message: string) => void;
  submitLabel: string;
  onSubmit: () => void;
  onCancel: () => void;
  submitting: boolean;
};

export function FoodSubmissionDraftForm({
  draft,
  onDraftChange,
  onScanned,
  onScanError,
  submitLabel,
  onSubmit,
  onCancel,
  submitting,
}: FoodSubmissionDraftFormProps) {
  return (
    <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
      {draft.imageUrl ? (
        <img src={draft.imageUrl} alt="" className="max-h-40 rounded-lg border border-slate-200 object-contain" />
      ) : null}
      <div className="flex flex-wrap gap-2">
        <FoodLabelScanButton onScanned={onScanned} onError={onScanError} label="Scan etikett på nytt" />
      </div>
      <label className="block space-y-1">
        <span className="text-xs font-semibold text-slate-700">Navn</span>
        <TextInput value={draft.name} onChange={(e) => onDraftChange({ ...draft, name: e.target.value })} />
      </label>
      <div className="grid gap-2 sm:grid-cols-2">
        <label className="block space-y-1">
          <span className="text-xs font-semibold text-slate-700">Porsjon</span>
          <TextInput
            value={draft.portionLabel}
            onChange={(e) => onDraftChange({ ...draft, portionLabel: e.target.value })}
          />
        </label>
        <label className="block space-y-1">
          <span className="text-xs font-semibold text-slate-700">Gram</span>
          <TextInput
            value={String(draft.portionGrams)}
            onChange={(e) =>
              onDraftChange({ ...draft, portionGrams: Number(e.target.value.replace(",", ".")) || 0 })
            }
          />
        </label>
      </div>
      <label className="block space-y-1">
        <span className="text-xs font-semibold text-slate-700">Kategori</span>
        <SelectBox
          value={draft.category}
          onChange={(value) => onDraftChange({ ...draft, category: value as FoodCategoryId })}
          options={FOOD_BANK_CATEGORIES.map((c) => ({ value: c.id, label: c.label }))}
        />
      </label>
      <div className="grid gap-2 sm:grid-cols-2">
        {(["kcal", "protein", "carbs", "fat"] as const).map((key) => (
          <label key={key} className="block space-y-1">
            <span className="text-xs font-semibold text-slate-700">{key} / 100g</span>
            <TextInput
              value={String(draft.nutritionPer100g[key])}
              onChange={(e) =>
                onDraftChange({
                  ...draft,
                  nutritionPer100g: {
                    ...draft.nutritionPer100g,
                    [key]: Number(e.target.value.replace(",", ".")) || 0,
                  },
                })
              }
            />
          </label>
        ))}
      </div>
      <div className="flex flex-wrap gap-2">
        <GradientButton type="button" onClick={onSubmit} disabled={submitting}>
          {submitLabel}
        </GradientButton>
        <OutlineButton type="button" onClick={onCancel} disabled={submitting}>
          Avbryt
        </OutlineButton>
      </div>
    </div>
  );
}
