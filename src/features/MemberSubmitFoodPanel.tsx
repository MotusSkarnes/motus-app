import { useCallback, useEffect, useRef, useState } from "react";
import { Check, Pencil, X } from "lucide-react";
import { mergeFoodItemsIntoLocalCache } from "../app/foodBankCloud";
import {
  foodItemFromSubmission,
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
import { FoodSubmissionDraftForm } from "./FoodSubmissionDraftForm";
import { Card, OutlineButton } from "../app/ui";

type MemberSubmitFoodPanelProps = {
  member: Member;
  onRefreshFoodBank?: () => void;
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

export function MemberSubmitFoodPanel({ member, onRefreshFoodBank }: MemberSubmitFoodPanelProps) {
  const [createOpen, setCreateOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<FoodSubmissionDraft>(() => emptyDraft());
  const [status, setStatus] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [history, setHistory] = useState<MemberFoodSubmission[]>([]);

  const ownerUserId = member.ownerUserId?.trim() ?? "";
  const panelRef = useRef<HTMLDivElement | null>(null);

  const reloadHistory = useCallback(async () => {
    const rows = await fetchMemberFoodSubmissions(member.id);
    setHistory(rows);
    onRefreshFoodBank?.();
  }, [member.id, onRefreshFoodBank]);

  useEffect(() => {
    void reloadHistory();
  }, [reloadHistory]);

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
    requestAnimationFrame(() => {
      panelRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    });
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
    const item = foodItemFromSubmission(result.submission);
    if (item) mergeFoodItemsIntoLocalCache([item]);
    setStatus("Sendt til PT. Du kan søke etter matvaren med en gang når du logger mat.");
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
    const item = foodItemFromSubmission(result.submission);
    if (item) mergeFoodItemsIntoLocalCache([item]);
    setStatus("Forslaget er oppdatert — fortsatt tilgjengelig i logging.");
    closeForms();
    void reloadHistory();
  };

  const pendingCount = history.filter((row) => row.status === "pending").length;
  const formOpen = createOpen || editingId !== null;

  return (
    <div ref={panelRef}>
      <Card className="p-4 space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">Foreslå ny matvare</h3>
          <p className="text-xs text-slate-600">
            Ta bilde av næringsinnholdet. Du kan bruke matvaren med en gang; PT godkjenner før den legges i felles
            matbank.
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
            status.includes("Sendt") || status.includes("oppdatert") || status.includes("tilgjengelig")
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
        <FoodSubmissionDraftForm
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
        <FoodSubmissionDraftForm
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
                    ? "Tilgjengelig for deg · venter på PT"
                    : row.status === "approved"
                      ? "Godkjent — i felles matbank"
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
    </div>
  );
}
