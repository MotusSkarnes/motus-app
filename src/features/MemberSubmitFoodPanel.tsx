import { useCallback, useEffect, useState } from "react";
import { Check, Pencil, X } from "lucide-react";
import { FOOD_BANK_CATEGORIES, type FoodCategoryId } from "../app/foodBankTypes";
import {
  foodSubmissionDraftFromScan,
  type FoodLabelScanResult,
  type FoodSubmissionDraft,
  type MemberFoodSubmission,
} from "../app/foodLabelScanTypes";
import {
  fetchMemberFoodSubmissions,
  submitMemberFoodForApproval,
  updateMemberFoodSubmission,
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

function cloneDraft(draft: FoodSubmissionDraft): FoodSubmissionDraft {
  return {
    ...draft,
    nutritionPer100g: { ...draft.nutritionPer100g },
  };
}

type MemberFoodDraftFormProps = {
  draft: FoodSubmissionDraft;
  onDraftChange: (draft: FoodSubmissionDraft) => void;
  onScanned: (scan: FoodLabelScanResult, imageDataUrl: string) => void;
  onScanError: (message: string) => void;
  submitLabel: string;
  onSubmit: () => void;
  onCancel: () => void;
  submitting: boolean;
};

function MemberFoodDraftForm({
  draft,
  onDraftChange,
  onScanned,
  onScanError,
  submitLabel,
  onSubmit,
  onCancel,
  submitting,
}: MemberFoodDraftFormProps) {
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
        <TextInput
          value={draft.name}
          onChange={(e) => onDraftChange({ ...draft, name: e.target.value })}
        />
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

export function MemberSubmitFoodPanel({ member }: MemberSubmitFoodPanelProps) {
  const [createOpen, setCreateOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<FoodSubmissionDraft>(() => emptyDraft());
  const [status, setStatus] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [history, setHistory] = useState<MemberFoodSubmission[]>([]);

  const reloadHistory = useCallback(async () => {
    const rows = await fetchMemberFoodSubmissions(member.id);
    setHistory(rows);
  }, [member.id]);

  useEffect(() => {
    void reloadHistory();
  }, [reloadHistory]);

  const ownerUserId = member.ownerUserId?.trim() ?? "";
  if (!ownerUserId) return null;

  const closeForms = () => {
    setCreateOpen(false);
    setEditingId(null);
    setDraft(emptyDraft());
  };

  const handleScanned = (scan: FoodLabelScanResult, imageDataUrl: string) => {
    setDraft(draftFromScan(scan, imageDataUrl));
    setCreateOpen(true);
    setEditingId(null);
    setStatus("Sjekk at tallene stemmer før du sender til PT.");
  };

  const handleRescanInForm = (scan: FoodLabelScanResult, imageDataUrl: string) => {
    setDraft(draftFromScan(scan, imageDataUrl));
    setStatus("Etikett oppdatert — sjekk tallene.");
  };

  const openCreateManual = () => {
    setDraft(emptyDraft());
    setCreateOpen(true);
    setEditingId(null);
    setStatus(null);
  };

  const openEdit = (row: MemberFoodSubmission) => {
    setDraft(cloneDraft(row.draftItem));
    setEditingId(row.id);
    setCreateOpen(false);
    setStatus(null);
  };

  const handleSubmitNew = async () => {
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
    closeForms();
    void reloadHistory();
  };

  const handleSaveEdit = async () => {
    if (!editingId) return;
    if (!draft.name.trim()) {
      setStatus("Navn må fylles ut.");
      return;
    }
    setSubmitting(true);
    setStatus(null);
    const result = await updateMemberFoodSubmission({
      submissionId: editingId,
      memberId: member.id,
      draftItem: draft,
      labelImageUrl: draft.imageUrl,
    });
    setSubmitting(false);
    if (!result.ok) {
      setStatus(result.error);
      return;
    }
    setStatus("Forslaget er oppdatert.");
    closeForms();
    void reloadHistory();
  };

  const pendingCount = history.filter((row) => row.status === "pending").length;
  const formOpen = createOpen || editingId !== null;

  return (
    <Card className="p-4 space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">Foreslå ny matvare</h3>
          <p className="text-xs text-slate-600">
            Ta bilde av næringsinnholdet — PT godkjenner før det legges i matbanken.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <FoodLabelScanButton onScanned={handleScanned} onError={setStatus} label="Scan etikett" />
          {!formOpen ? (
            <OutlineButton type="button" onClick={openCreateManual}>
              Legg inn manuelt
            </OutlineButton>
          ) : null}
        </div>
      </div>
      {pendingCount > 0 ? (
        <p className="text-xs font-medium text-amber-800">{pendingCount} forslag venter på PT.</p>
      ) : null}
      {status ? (
        <p
          className={`text-xs ${
            status.includes("Sendt") || status.includes("oppdatert")
              ? "text-teal-800"
              : status.includes("Sjekk") || status.includes("Etikett")
                ? "text-slate-700"
                : "text-rose-700"
          }`}
        >
          {status}
        </p>
      ) : null}

      {createOpen ? (
        <MemberFoodDraftForm
          draft={draft}
          onDraftChange={setDraft}
          onScanned={handleRescanInForm}
          onScanError={setStatus}
          submitLabel={submitting ? "Sender…" : "Send til PT"}
          onSubmit={() => void handleSubmitNew()}
          onCancel={closeForms}
          submitting={submitting}
        />
      ) : null}

      {editingId ? (
        <MemberFoodDraftForm
          draft={draft}
          onDraftChange={setDraft}
          onScanned={handleRescanInForm}
          onScanError={setStatus}
          submitLabel={submitting ? "Lagrer…" : "Lagre endringer"}
          onSubmit={() => void handleSaveEdit()}
          onCancel={closeForms}
          submitting={submitting}
        />
      ) : null}

      {history.length > 0 ? (
        <ul className="space-y-2 text-xs text-slate-600">
          {history.slice(0, 8).map((row) => (
            <li key={row.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-100 bg-white px-2 py-1.5">
              <div className="flex min-w-0 items-center gap-2">
                {row.status === "approved" ? (
                  <Check className="h-3.5 w-3.5 shrink-0 text-teal-600" aria-hidden />
                ) : row.status === "rejected" ? (
                  <X className="h-3.5 w-3.5 shrink-0 text-rose-600" aria-hidden />
                ) : (
                  <span className="h-2 w-2 shrink-0 rounded-full bg-amber-400" aria-hidden />
                )}
                <span className="truncate">
                  {row.draftItem.name} ·{" "}
                  {row.status === "pending"
                    ? "Venter"
                    : row.status === "approved"
                      ? "Godkjent"
                      : "Avslått"}
                </span>
              </div>
              {row.status === "pending" && editingId !== row.id ? (
                <OutlineButton type="button" className="h-7 px-2 text-xs" onClick={() => openEdit(row)}>
                  <Pencil className="h-3 w-3" aria-hidden />
                  Rediger
                </OutlineButton>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
    </Card>
  );
}
