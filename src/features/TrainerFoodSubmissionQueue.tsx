import { useCallback, useEffect, useState } from "react";
import { Check, Pencil, X } from "lucide-react";
import { formatMacro } from "../app/foodBankTypes";
import {
  foodSubmissionDraftFromScan,
  type FoodLabelScanResult,
  type FoodSubmissionDraft,
  type MemberFoodSubmission,
} from "../app/foodLabelScanTypes";
import {
  fetchPendingFoodSubmissionsForTrainer,
  reviewFoodSubmission,
  updateFoodSubmissionByTrainer,
} from "../app/memberFoodSubmissionsCloud";
import { mergeFoodItemsIntoLocalCache, refreshTrainerFoodBankAfterApproval } from "../app/foodBankCloud";
import { Card, GradientButton, OutlineButton } from "../app/ui";
import { FoodSubmissionDraftForm } from "./FoodSubmissionDraftForm";

type TrainerFoodSubmissionQueueProps = {
  ownerUserId: string;
  trainerName: string;
  onChanged?: () => void;
};

function cloneDraft(draft: FoodSubmissionDraft): FoodSubmissionDraft {
  return {
    ...draft,
    nutritionPer100g: { ...draft.nutritionPer100g },
  };
}

export function TrainerFoodSubmissionQueue({
  ownerUserId,
  trainerName,
  onChanged,
}: TrainerFoodSubmissionQueueProps) {
  const [rows, setRows] = useState<MemberFoodSubmission[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<FoodSubmissionDraft | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);

  const reload = useCallback(async () => {
    setLoading(true);
    const pending = await fetchPendingFoodSubmissionsForTrainer(ownerUserId);
    setRows(pending);
    setLoading(false);
  }, [ownerUserId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const closeEdit = () => {
    setEditingId(null);
    setEditDraft(null);
  };

  const openEdit = (row: MemberFoodSubmission) => {
    setEditingId(row.id);
    setEditDraft(cloneDraft(row.draftItem));
    setStatus(null);
  };

  const handleSaveEdit = async (row: MemberFoodSubmission) => {
    if (!editDraft?.name.trim()) {
      setStatus("Navn må fylles ut.");
      return;
    }
    setSavingEdit(true);
    setStatus(null);
    const result = await updateFoodSubmissionByTrainer({
      submissionId: row.id,
      ownerUserId,
      draftItem: editDraft,
      labelImageUrl: editDraft.imageUrl ?? row.labelImageUrl,
    });
    setSavingEdit(false);
    if (!result.ok) {
      setStatus(result.error);
      return;
    }
    setStatus(`${editDraft.name} er oppdatert.`);
    closeEdit();
    await reload();
    onChanged?.();
  };

  const handleRescanInForm = (scan: FoodLabelScanResult, imageDataUrl: string) => {
    setEditDraft(foodSubmissionDraftFromScan(scan, imageDataUrl));
    setStatus("Etikett oppdatert — sjekk tallene.");
  };

  const handleReview = async (row: MemberFoodSubmission, action: "approve" | "reject", reviewNote?: string) => {
    setBusyId(row.id);
    setStatus(null);
    const draftForReview = editingId === row.id && editDraft ? editDraft : row.draftItem;
    try {
      const draftItem: FoodSubmissionDraft & { id?: string; createdAt?: string; createdBy?: string } = {
        ...draftForReview,
        createdBy: trainerName,
      };
      const result = await reviewFoodSubmission({
        submissionId: row.id,
        action,
        reviewNote,
        draftItem: action === "approve" ? draftItem : undefined,
      });
      if (!result.ok) {
        setStatus(result.error);
        return;
      }
      if (action === "approve") {
        if (result.item) mergeFoodItemsIntoLocalCache([result.item]);
        await refreshTrainerFoodBankAfterApproval(ownerUserId);
      }
      setStatus(action === "approve" ? `${draftForReview.name} er lagt i matbanken.` : "Forslag avslått.");
      if (editingId === row.id) closeEdit();
      onChanged?.();
      await reload();
    } finally {
      setBusyId(null);
    }
  };

  if (loading) return null;
  if (rows.length === 0) return null;

  return (
    <Card className="mb-4 border-amber-200 bg-amber-50/80 p-4 space-y-3">
      <div>
        <h2 className="text-sm font-bold text-amber-950">Innkommende matvarer fra medlemmer</h2>
        <p className="text-xs text-amber-900">{rows.length} venter på godkjenning</p>
      </div>
      {status ? (
        <p
          className={`text-xs ${
            status.includes("er lagt") ||
            status.includes("avslått") ||
            status.includes("oppdatert")
              ? "text-teal-800"
              : "text-rose-700"
          }`}
        >
          {status}
        </p>
      ) : null}
      <ul className="space-y-3">
        {rows.map((row) => (
          <li key={row.id} className="rounded-xl border border-amber-200 bg-white p-3 space-y-2">
            {editingId === row.id && editDraft ? (
              <FoodSubmissionDraftForm
                draft={editDraft}
                onDraftChange={setEditDraft}
                onScanned={handleRescanInForm}
                onScanError={setStatus}
                submitLabel={savingEdit ? "Lagrer…" : "Lagre endringer"}
                onSubmit={() => void handleSaveEdit(row)}
                onCancel={closeEdit}
                submitting={savingEdit}
              />
            ) : (
              <>
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold text-slate-900">{row.draftItem.name}</p>
                    <p className="text-xs text-slate-600">
                      {row.memberName ?? "Medlem"} · {row.draftItem.portionLabel} ({row.draftItem.portionGrams} g)
                    </p>
                    <p className="text-xs text-slate-500">
                      {formatMacro(row.draftItem.nutritionPer100g.kcal, 0)} kcal · P{" "}
                      {formatMacro(row.draftItem.nutritionPer100g.protein, 1)} · K{" "}
                      {formatMacro(row.draftItem.nutritionPer100g.carbs, 1)} · F{" "}
                      {formatMacro(row.draftItem.nutritionPer100g.fat, 1)} / 100g
                    </p>
                  </div>
                  {row.labelImageUrl || row.draftItem.imageUrl ? (
                    <img
                      src={row.labelImageUrl ?? row.draftItem.imageUrl}
                      alt=""
                      className="h-16 w-16 rounded-lg border border-slate-200 object-cover"
                    />
                  ) : null}
                </div>
                <div className="flex flex-wrap gap-2">
                  <OutlineButton type="button" disabled={busyId === row.id} onClick={() => openEdit(row)}>
                    <Pencil className="h-4 w-4" aria-hidden />
                    Rediger
                  </OutlineButton>
                  <GradientButton
                    type="button"
                    disabled={busyId === row.id}
                    onClick={() => void handleReview(row, "approve")}
                  >
                    <Check className="h-4 w-4" aria-hidden />
                    Godkjenn
                  </GradientButton>
                  <OutlineButton
                    type="button"
                    disabled={busyId === row.id}
                    onClick={() => {
                      const note = window.prompt("Valgfri begrunnelse til medlem:");
                      if (note === null) return;
                      void handleReview(row, "reject", note.trim() || undefined);
                    }}
                  >
                    <X className="h-4 w-4" aria-hidden />
                    Avslå
                  </OutlineButton>
                </div>
              </>
            )}
          </li>
        ))}
      </ul>
    </Card>
  );
}
