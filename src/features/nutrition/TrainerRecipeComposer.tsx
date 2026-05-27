import { useEffect, useMemo, useState } from "react";
import { X } from "lucide-react";
import { buildDefaultFoodBankItems } from "../../app/foodBankSeed";
import { findRecipeFoodAvoidanceConflicts } from "../../app/memberFoodAvoidances";
import type { Member } from "../../app/types";
import {
  notifyInspirationItemsChanged,
  persistInspirationItems,
} from "../../app/inspirationStorage";
import { isInspirationRecipeItem } from "../../app/inspirationHubItems";
import type { InspirationRecipeItem } from "../../app/inspirationRecipeItems";
import { RecipeAvoidanceWarning } from "../../components/RecipeAvoidanceWarning";
import { RecipeIngredientList } from "../../components/RecipeIngredientList";
import { GradientButton, OutlineButton, StatusMessage, TextArea, TextInput } from "../../app/ui";
import { useFoodBankItems } from "../../app/useFoodBankItems";
import { uid } from "../../app/storage";

type TrainerRecipeComposerProps = {
  open: boolean;
  members: Member[];
  existingItems: unknown[];
  editItem?: InspirationRecipeItem | null;
  authorName?: string;
  onClose: () => void;
  onSaved: () => void;
};

export function TrainerRecipeComposer({
  open,
  members,
  existingItems,
  editItem = null,
  authorName = "Motus",
  onClose,
  onSaved,
}: TrainerRecipeComposerProps) {
  const foodBankItems = useFoodBankItems();
  const foodItemsForMacros = useMemo(
    () => (foodBankItems.length > 0 ? foodBankItems : buildDefaultFoodBankItems()),
    [foodBankItems],
  );

  const [title, setTitle] = useState(editItem?.title ?? "");
  const [description, setDescription] = useState(editItem?.description ?? "");
  const [tag, setTag] = useState(editItem?.tag ?? "Oppskrift");
  const [body, setBody] = useState(editItem?.body ?? "");
  const [status, setStatus] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setTitle(editItem?.title ?? "");
    setDescription(editItem?.description ?? "");
    setTag(editItem?.tag ?? "Oppskrift");
    setBody(editItem?.body ?? "");
    setStatus(null);
  }, [open, editItem]);

  const draftBody = useMemo(
    () =>
      body.trim() ||
      `**Til 1 porsjon**

**Ingredienser**
- 

**Slik gjør du**
1. `,
    [body],
  );

  const avoidanceConflicts = useMemo(
    () => findRecipeFoodAvoidanceConflicts(draftBody, foodItemsForMacros, members),
    [draftBody, foodItemsForMacros, members],
  );

  if (!open) return null;

  async function handleSave() {
    if (!title.trim()) {
      setStatus("Fyll inn tittel.");
      return;
    }
    if (!description.trim()) {
      setStatus("Fyll inn kort beskrivelse.");
      return;
    }
    if (!body.trim()) {
      setStatus("Fyll inn oppskriftstekst med **Ingredienser**-liste.");
      return;
    }

    setSaving(true);
    setStatus(null);

    const recipeRow = {
      id: editItem?.id ?? uid("recipe"),
      category: "recipes",
      kind: "article",
      title: title.trim(),
      description: description.trim(),
      body: body.trim(),
      tag: tag.trim() || "Oppskrift",
      author: authorName,
      createdAt: editItem?.id ? undefined : new Date().toISOString().slice(0, 10),
      ...(editItem?.imageUrl ? { imageUrl: editItem.imageUrl } : {}),
    };

    const nonRecipe = (existingItems as Array<{ id: string; category?: string }>).filter(
      (item) => !isInspirationRecipeItem(item),
    );
    const otherRecipes = (existingItems as Array<{ id: string; category?: string }>).filter(
      (item) => isInspirationRecipeItem(item) && item.id !== editItem?.id,
    );
    const nextFeed = [...nonRecipe, ...otherRecipes, recipeRow];

    const result = await persistInspirationItems(nextFeed);
    setSaving(false);

    if (!result.ok) {
      setStatus(result.error ?? "Kunne ikke lagre.");
      return;
    }

    notifyInspirationItemsChanged();
    onSaved();
    onClose();
  }

  return (
    <div className="motus-foodbank-modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className="motus-foodbank-modal motus-foodbank-modal--wide"
        role="dialog"
        aria-label={editItem ? "Rediger oppskrift" : "Ny oppskrift"}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="motus-foodbank-modal-head">
          <h3>{editItem ? "Rediger oppskrift" : "Ny oppskrift"}</h3>
          <button type="button" className="motus-foodbank-icon-btn" onClick={onClose} aria-label="Lukk">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="motus-foodbank-modal-body max-h-[min(80vh,40rem)] space-y-3 overflow-y-auto">
          <p className="text-xs text-slate-600">
            Oppskrifter vises kun under <strong>Ernæring</strong> for medlemmer og i matplan — ikke i Utforsk.
          </p>
          <TextInput value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Tittel" />
          <TextInput value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Kort beskrivelse" />
          <TextInput value={tag} onChange={(e) => setTag(e.target.value)} placeholder="F.eks. 15 min · Middag" />
          <TextArea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder={"**Til 2 porsjoner**\n\n**Ingredienser**\n- 200 g …\n\n**Slik gjør du**\n1. …"}
            rows={12}
          />
          {body.trim() ? <RecipeIngredientList body={body} foodItems={foodItemsForMacros} /> : null}
          {avoidanceConflicts.length > 0 ? <RecipeAvoidanceWarning conflicts={avoidanceConflicts} /> : null}
          {status ? <StatusMessage tone="error">{status}</StatusMessage> : null}
          <div className="flex flex-wrap justify-end gap-2">
            <OutlineButton type="button" onClick={onClose}>
              Avbryt
            </OutlineButton>
            <GradientButton type="button" onClick={() => void handleSave()} disabled={saving}>
              {saving ? "Lagrer…" : editItem ? "Lagre endringer" : "Publiser oppskrift"}
            </GradientButton>
          </div>
        </div>
      </div>
    </div>
  );
}
