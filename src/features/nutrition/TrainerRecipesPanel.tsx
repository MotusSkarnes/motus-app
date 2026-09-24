import { useState } from "react";
import { Plus } from "lucide-react";
import {
  loadInspirationItemsFromLocalStorage,
} from "../../app/inspirationStorage";
import {
  deleteInspirationRecipe,
  setInspirationRecipeAvailability,
  type InspirationRecipeItem,
} from "../../app/inspirationRecipeItems";
import type { Member } from "../../app/types";
import { ConfirmDialog, GradientButton, StatusMessage } from "../../app/ui";
import { NutritionRecipesPanel } from "./NutritionRecipesPanel";
import { TrainerRecipeComposer } from "./TrainerRecipeComposer";

type TrainerRecipesPanelProps = {
  members: Member[];
  authorName?: string;
  trainerOwnerUserId?: string;
};

export function TrainerRecipesPanel({
  members,
  authorName = "Motus PT",
  trainerOwnerUserId,
}: TrainerRecipesPanelProps) {
  const [composerOpen, setComposerOpen] = useState(false);
  const [editItem, setEditItem] = useState<InspirationRecipeItem | null>(null);
  const [duplicateFromItem, setDuplicateFromItem] = useState<InspirationRecipeItem | null>(null);
  const [pendingDelete, setPendingDelete] = useState<InspirationRecipeItem | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const composerVisible = composerOpen || editItem !== null;

  function openCreate() {
    setEditItem(null);
    setDuplicateFromItem(null);
    setComposerOpen(true);
  }

  function openEdit(item: InspirationRecipeItem) {
    setEditItem(item);
    setDuplicateFromItem(null);
    setComposerOpen(true);
  }

  function openDuplicate(item: InspirationRecipeItem) {
    setEditItem(null);
    setDuplicateFromItem(item);
    setComposerOpen(true);
  }

  function closeComposer() {
    setComposerOpen(false);
    setEditItem(null);
    setDuplicateFromItem(null);
  }

  function requestDelete(item: InspirationRecipeItem) {
    setStatus(null);
    setPendingDelete(item);
  }

  async function confirmDelete() {
    if (!pendingDelete || deleting) return;
    setDeleting(true);
    const result = await deleteInspirationRecipe(
      pendingDelete.id,
      loadInspirationItemsFromLocalStorage() ?? [],
    );
    setDeleting(false);
    if (!result.ok) {
      setStatus(result.error ?? "Kunne ikke slette måltidet.");
      return;
    }
    if (editItem?.id === pendingDelete.id || duplicateFromItem?.id === pendingDelete.id) {
      closeComposer();
    }
    setPendingDelete(null);
    setStatus(`«${pendingDelete.title}» er slettet.`);
    setReloadKey((n) => n + 1);
  }

  async function changeAvailability(item: InspirationRecipeItem, available: boolean) {
    setStatus(null);
    const result = await setInspirationRecipeAvailability(item, available);
    if (!result.ok) {
      setStatus(result.error ?? "Kunne ikke oppdatere tilgjengeligheten.");
      return;
    }
    setStatus(
      available
        ? `«${item.title}» er tilgjengelig for kunder uten matplan.`
        : `«${item.title}» er skjult for kunder uten matplan.`,
    );
    setReloadKey((n) => n + 1);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-slate-600">
          Måltider for medlemmer og matplan. Klikk <strong>Nytt måltid</strong> for å legge til ingredienser, antall
          porsjoner og fremgangsmåte — næringsinnhold per porsjon oppdateres automatisk.
        </p>
        <GradientButton type="button" className="text-sm" onClick={openCreate}>
          <Plus className="mr-1.5 h-4 w-4" aria-hidden />
          Nytt måltid
        </GradientButton>
      </div>
      {status ? <StatusMessage message={status} tone={status.includes("slettet") ? "success" : "error"} /> : null}
      <NutritionRecipesPanel
        key={reloadKey}
        canManage
        onEdit={openEdit}
        onDuplicate={openDuplicate}
        onDelete={requestDelete}
        onAvailabilityChange={(item, available) => void changeAvailability(item, available)}
      />
      <TrainerRecipeComposer
        open={composerVisible}
        members={members}
        existingItems={loadInspirationItemsFromLocalStorage() ?? []}
        editItem={editItem}
        duplicateFromItem={duplicateFromItem}
        authorName={authorName}
        trainerOwnerUserId={trainerOwnerUserId}
        onClose={closeComposer}
        onSaved={() => setReloadKey((n) => n + 1)}
        onDelete={editItem && !duplicateFromItem ? requestDelete : undefined}
      />
      <ConfirmDialog
        open={pendingDelete !== null}
        title="Slette måltid?"
        message={
          pendingDelete
            ? `«${pendingDelete.title}» fjernes fra listen for alle medlemmer. Dette kan ikke angres.`
            : ""
        }
        confirmLabel={deleting ? "Sletter…" : "Slett måltid"}
        cancelLabel="Avbryt"
        tone="danger"
        onCancel={() => {
          if (deleting) return;
          setPendingDelete(null);
        }}
        onConfirm={() => {
          void confirmDelete();
        }}
      />
    </div>
  );
}
