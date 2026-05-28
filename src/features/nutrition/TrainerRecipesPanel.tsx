import { useState } from "react";
import { Plus } from "lucide-react";
import {
  loadInspirationItemsFromLocalStorage,
} from "../../app/inspirationStorage";
import type { InspirationRecipeItem } from "../../app/inspirationRecipeItems";
import type { Member } from "../../app/types";
import { GradientButton } from "../../app/ui";
import { NutritionRecipesPanel } from "./NutritionRecipesPanel";
import { TrainerRecipeComposer } from "./TrainerRecipeComposer";

type TrainerRecipesPanelProps = {
  members: Member[];
  authorName?: string;
};

export function TrainerRecipesPanel({ members, authorName = "Motus PT" }: TrainerRecipesPanelProps) {
  const [composerOpen, setComposerOpen] = useState(false);
  const [editItem, setEditItem] = useState<InspirationRecipeItem | null>(null);
  const [duplicateFromItem, setDuplicateFromItem] = useState<InspirationRecipeItem | null>(null);
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

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-slate-600">
          Oppskrifter for medlemmer og matplan. Klikk <strong>Rediger</strong> på en oppskrift for å endre tekst, bilde og
          ingredienser — næringsinnhold oppdateres automatisk.
        </p>
        <GradientButton type="button" className="text-sm" onClick={openCreate}>
          <Plus className="mr-1.5 h-4 w-4" aria-hidden />
          Ny oppskrift
        </GradientButton>
      </div>
      <NutritionRecipesPanel key={reloadKey} canManage onEdit={openEdit} onDuplicate={openDuplicate} />
      <TrainerRecipeComposer
        open={composerVisible}
        members={members}
        existingItems={loadInspirationItemsFromLocalStorage() ?? []}
        editItem={editItem}
        duplicateFromItem={duplicateFromItem}
        authorName={authorName}
        onClose={closeComposer}
        onSaved={() => setReloadKey((n) => n + 1)}
      />
    </div>
  );
}
