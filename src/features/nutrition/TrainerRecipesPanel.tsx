import { useState } from "react";
import { Plus } from "lucide-react";
import {
  loadInspirationItemsFromLocalStorage,
} from "../../app/inspirationStorage";
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
  const [reloadKey, setReloadKey] = useState(0);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-slate-600">
          Oppskrifter for medlemmer og matplan. De vises <strong>ikke</strong> i Utforsk.
        </p>
        <GradientButton type="button" className="text-sm" onClick={() => setComposerOpen(true)}>
          <Plus className="mr-1.5 h-4 w-4" aria-hidden />
          Ny oppskrift
        </GradientButton>
      </div>
      <NutritionRecipesPanel key={reloadKey} />
      <TrainerRecipeComposer
        open={composerOpen}
        members={members}
        existingItems={loadInspirationItemsFromLocalStorage() ?? []}
        authorName={authorName}
        onClose={() => setComposerOpen(false)}
        onSaved={() => setReloadKey((n) => n + 1)}
      />
    </div>
  );
}
