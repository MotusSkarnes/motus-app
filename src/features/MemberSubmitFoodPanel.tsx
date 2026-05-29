import { useCallback, useEffect, useState } from "react";
import { Check, X } from "lucide-react";
import { FOOD_BANK_CATEGORIES, type FoodCategoryId } from "../app/foodBankTypes";
import {
  foodSubmissionDraftFromScan,
  type FoodLabelScanResult,
  type FoodSubmissionDraft,
} from "../app/foodLabelScanTypes";
import {
  fetchMemberFoodSubmissions,
  submitMemberFoodForApproval,
} from "../app/memberFoodSubmissionsCloud";
import type { Member } from "../app/types";
import { FoodLabelScanButton } from "./FoodLabelScanButton";
import { Card, GradientButton, OutlineButton, SelectBox, TextInput } from "../app/ui";

type MemberSubmitFoodPanelProps = {
  member: Member;
};

function emptyDraft(): FoodSubmissionDraft {
  return {
    name: "",
    portionLabel: "100 g",
    portionGrams: 100,
    category: "proteinkilder",
    origin: "Etikett",
    source: "egen",
    imageEmoji: "🏷️",
    nutritionPer100g: {
      kcal: 0,
      protein: 0,
      carbs: 0,
      fat: 0,
      fiber: 0,
      sugar: 0,
      saturatedFat: 0,
      sodium: 0,
    },
  };
}

function draftFromScan(scan: FoodLabelScanResult, imageDataUrl: string): FoodSubmissionDraft {
  return foodSubmissionDraftFromScan(scan, imageDataUrl);
}

export function MemberSubmitFoodPanel({ member }: MemberSubmitFoodPanelProps) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<FoodSubmissionDraft>(() => emptyDraft());
  const [status, setStatus] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [history, setHistory] = useState<Awaited<ReturnType<typeof fetchMemberFoodSubmissions>>>([]);

  const reloadHistory = useCallback(async () => {
    const rows = await fetchMemberFoodSubmissions(member.id);
    setHistory(rows);
  }, [member.id]);

  useEffect(() => {
    void reloadHistory();
  }, [reloadHistory]);

  const ownerUserId = member.ownerUserId?.trim() ?? "";
  if (!ownerUserId) return null;

  const handleScanned = (scan: FoodLabelScanResult, imageDataUrl: string) => {
    setDraft(draftFromScan(scan, imageDataUrl));
    setOpen(true);
    setStatus("Sjekk at tallene stemmer før du sender til PT.");
  };

  const handleSubmit = async () => {
    if (!draft.name.trim()) {
      setStatus("Navn må fylles ut.");
      return;
    }
    setSubmitting(true);
    setStatus(null);
    const result = await submitMemberFoodForApproval({
      memberId: member.id,
      memberName: member.name,
      ownerUserId,
      draftItem: draft,
      labelImageUrl: draft.imageUrl,
    });
    setSubmitting(false);
    if (!result.ok) {
      setStatus(result.error);
      return;
    }
    setStatus("Sendt til PT for godkjenning.");
    setOpen(false);
    setDraft(emptyDraft());
    void reloadHistory();
  };

  const pendingCount = history.filter((row) => row.status === "pending").length;

  return (
    <Card className="p-4 space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">Foreslå ny matvare</h3>
          <p className="text-xs text-slate-600">
            Ta bilde av næringsinnholdet — PT godkjenner før det legges i matbanken.
          </p>
        </div>
        <FoodLabelScanButton onScanned={handleScanned} onError={setStatus} label="Scan etikett" />
      </div>
      {pendingCount > 0 ? (
        <p className="text-xs font-medium text-amber-800">{pendingCount} forslag venter på PT.</p>
      ) : null}
      {status ? <p className="text-xs text-teal-800">{status}</p> : null}

      {open ? (
        <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
          {draft.imageUrl ? (
            <img src={draft.imageUrl} alt="" className="max-h-40 rounded-lg border border-slate-200 object-contain" />
          ) : null}
          <label className="block space-y-1">
            <span className="text-xs font-semibold text-slate-700">Navn</span>
            <TextInput value={draft.name} onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))} />
          </label>
          <div className="grid gap-2 sm:grid-cols-2">
            <label className="block space-y-1">
              <span className="text-xs font-semibold text-slate-700">Porsjon</span>
              <TextInput
                value={draft.portionLabel}
                onChange={(e) => setDraft((d) => ({ ...d, portionLabel: e.target.value }))}
              />
            </label>
            <label className="block space-y-1">
              <span className="text-xs font-semibold text-slate-700">Gram</span>
              <TextInput
                value={String(draft.portionGrams)}
                onChange={(e) => setDraft((d) => ({ ...d, portionGrams: Number(e.target.value.replace(",", ".")) || 0 }))}
              />
            </label>
          </div>
          <label className="block space-y-1">
            <span className="text-xs font-semibold text-slate-700">Kategori</span>
            <SelectBox
              value={draft.category}
              onChange={(value) => setDraft((d) => ({ ...d, category: value as FoodCategoryId }))}
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
                    setDraft((d) => ({
                      ...d,
                      nutritionPer100g: {
                        ...d.nutritionPer100g,
                        [key]: Number(e.target.value.replace(",", ".")) || 0,
                      },
                    }))
                  }
                />
              </label>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            <GradientButton type="button" onClick={() => void handleSubmit()} disabled={submitting}>
              Send til PT
            </GradientButton>
            <OutlineButton type="button" onClick={() => setOpen(false)}>
              Avbryt
            </OutlineButton>
          </div>
        </div>
      ) : null}

      {history.length > 0 ? (
        <ul className="space-y-1 text-xs text-slate-600">
          {history.slice(0, 5).map((row) => (
            <li key={row.id} className="flex items-center gap-2">
              {row.status === "approved" ? (
                <Check className="h-3.5 w-3.5 text-teal-600" aria-hidden />
              ) : row.status === "rejected" ? (
                <X className="h-3.5 w-3.5 text-rose-600" aria-hidden />
              ) : (
                <span className="h-2 w-2 rounded-full bg-amber-400" aria-hidden />
              )}
              <span>
                {row.draftItem.name} ·{" "}
                {row.status === "pending"
                  ? "Venter"
                  : row.status === "approved"
                    ? "Godkjent"
                    : "Avslått"}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
    </Card>
  );
}
