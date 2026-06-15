import { useEffect, useMemo, useState } from "react";
import { X } from "lucide-react";
import { DEFAULT_RECIPE_SCALING_BY_ID } from "../../app/defaultInspirationRecipes";
import { buildDefaultFoodBankItems } from "../../app/foodBankSeed";
import { findRecipeFoodAvoidanceConflicts } from "../../app/memberFoodAvoidances";
import type { Member } from "../../app/types";
import {
  fetchInspirationItemsForHub,
  loadInspirationItemsFromLocalStorage,
  notifyInspirationItemsChanged,
  persistInspirationItems,
} from "../../app/inspirationStorage";
import { isInspirationRecipeItem } from "../../app/inspirationHubItems";
import type { InspirationRecipeItem } from "../../app/inspirationRecipeItems";
import { resolveInspirationImageForStorage } from "../../app/inspirationRecipeImage";
import { compressImageFile } from "../../app/imageCompress";
import {
  RECIPE_PROTEIN_CATEGORIES,
  isRecipeProteinCategory,
  type RecipeProteinCategory,
} from "../../app/recipeProteinCategory";
import { computeRecipeMacros } from "../../app/recipeMacros";
import { RecipeAvoidanceWarning } from "../../components/RecipeAvoidanceWarning";
import { RecipeImageField } from "../../components/RecipeImageField";
import { RecipeIngredientList } from "../../components/RecipeIngredientList";
import { RecipeMacroBlocks } from "../../components/RecipeMacroBlocks";
import { GradientButton, OutlineButton, StatusMessage, TextArea, TextInput } from "../../app/ui";
import { useFoodBankItems } from "../../app/useFoodBankItems";
import { uid } from "../../app/storage";

type TrainerRecipeComposerProps = {
  open: boolean;
  members: Member[];
  existingItems: unknown[];
  editItem?: InspirationRecipeItem | null;
  duplicateFromItem?: InspirationRecipeItem | null;
  authorName?: string;
  onClose: () => void;
  onSaved: () => void;
};

export function TrainerRecipeComposer({
  open,
  members,
  existingItems,
  editItem = null,
  duplicateFromItem = null,
  authorName = "Motus",
  onClose,
  onSaved,
}: TrainerRecipeComposerProps) {
  const sourceItem = duplicateFromItem ?? editItem;
  const foodBankItems = useFoodBankItems();
  const foodItemsForMacros = useMemo(
    () => (foodBankItems.length > 0 ? foodBankItems : buildDefaultFoodBankItems()),
    [foodBankItems],
  );

  const [title, setTitle] = useState(sourceItem?.title ?? "");
  const [description, setDescription] = useState(sourceItem?.description ?? "");
  const [tag, setTag] = useState(sourceItem?.tag ?? "Oppskrift");
  const [proteinCategory, setProteinCategory] = useState<RecipeProteinCategory | "">(
    sourceItem?.proteinCategory ?? "",
  );
  const [body, setBody] = useState(sourceItem?.body ?? "");
  const [imageUrl, setImageUrl] = useState(sourceItem?.imageUrl ?? "");
  const [isImageProcessing, setIsImageProcessing] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    const source = duplicateFromItem ?? editItem;
    const duplicateTitle = duplicateFromItem?.title?.trim() ? `${duplicateFromItem.title.trim()} (kopi)` : "";
    setTitle(duplicateTitle || (source?.title ?? ""));
    setDescription(source?.description ?? "");
    setTag(source?.tag ?? "Oppskrift");
    setProteinCategory(source?.proteinCategory ?? "");
    setBody(source?.body ?? "");
    setImageUrl(source?.imageUrl ?? "");
    setStatus(null);
  }, [open, editItem, duplicateFromItem]);

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

  const recipeMacros = useMemo(
    () => computeRecipeMacros(draftBody, foodItemsForMacros),
    [draftBody, foodItemsForMacros],
  );

  const avoidanceConflicts = useMemo(
    () => findRecipeFoodAvoidanceConflicts(draftBody, foodItemsForMacros, members),
    [draftBody, foodItemsForMacros, members],
  );

  async function handleImageFile(file: File | null) {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setStatus("Velg en bildefil (JPG, PNG eller WebP).");
      return;
    }
    setIsImageProcessing(true);
    setStatus(null);
    try {
      const compressed = await compressImageFile(file);
      setImageUrl(compressed);
    } catch {
      setStatus("Kunne ikke lese bildefilen. Prøv et mindre bilde.");
    } finally {
      setIsImageProcessing(false);
    }
  }

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

    const recipeId = editItem && !duplicateFromItem ? editItem.id : uid("recipe");
    const storedImageUrl = await resolveInspirationImageForStorage(imageUrl);
    const scalingMode =
      sourceItem?.scalingMode ?? DEFAULT_RECIPE_SCALING_BY_ID.get(recipeId);

    const recipeRow: Record<string, unknown> = {
      id: recipeId,
      category: "recipes",
      kind: "article",
      title: title.trim(),
      description: description.trim(),
      body: body.trim(),
      tag: tag.trim() || "Oppskrift",
      author: authorName,
      ...(editItem?.createdAt && !duplicateFromItem
        ? { createdAt: editItem.createdAt }
        : { createdAt: new Date().toISOString().slice(0, 10) }),
      ...(storedImageUrl ? { imageUrl: storedImageUrl } : {}),
      ...(scalingMode ? { scalingMode } : {}),
      ...(proteinCategory ? { proteinCategory } : {}),
    };

    const latestItems =
      (await fetchInspirationItemsForHub<unknown>()) ??
      loadInspirationItemsFromLocalStorage<unknown>() ??
      existingItems;

    const nonRecipe = (latestItems as Array<{ id: string; category?: string }>).filter(
      (item) => !isInspirationRecipeItem(item),
    );
    const otherRecipes = (latestItems as Array<{ id: string; category?: string }>).filter(
      (item) => isInspirationRecipeItem(item) && item.id !== recipeId,
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
        aria-label={editItem && !duplicateFromItem ? "Rediger oppskrift" : "Ny oppskrift"}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="motus-foodbank-modal-head">
          <h3>{editItem && !duplicateFromItem ? "Rediger oppskrift" : duplicateFromItem ? "Dupliser oppskrift" : "Ny oppskrift"}</h3>
          <button type="button" className="motus-foodbank-icon-btn" onClick={onClose} aria-label="Lukk">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="motus-foodbank-modal-body max-h-[min(80vh,40rem)] space-y-3 overflow-y-auto">
          <p className="text-xs text-slate-600">
            Oppskrifter vises kun under <strong>Ernæring</strong> for medlemmer og i matplan — ikke i Utforsk. Næringsinnhold
            beregnes automatisk fra ingredienslisten når du skriver.
          </p>
          <TextInput value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Tittel" />
          <TextInput value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Kort beskrivelse" />
          <TextInput value={tag} onChange={(e) => setTag(e.target.value)} placeholder="F.eks. 15 min · Middag" />
          <label className="block">
            <span className="motus-foodbank-field-label">Råvaretype for lunsj/middag</span>
            <select
              className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none transition focus:border-teal-400 focus:ring-2 focus:ring-teal-100"
              value={proteinCategory}
              onChange={(event) => {
                const value = event.target.value;
                setProteinCategory(isRecipeProteinCategory(value) ? value : "");
              }}
              disabled={saving}
            >
              <option value="">Automatisk</option>
              {RECIPE_PROTEIN_CATEGORIES.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.label}
                </option>
              ))}
            </select>
          </label>
          <RecipeImageField
            imageUrl={imageUrl}
            onImageUrlChange={setImageUrl}
            onUploadFile={handleImageFile}
            isUploading={isImageProcessing}
            disabled={saving}
          />
          <TextArea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder={"**Til 2 porsjoner**\n\n**Ingredienser**\n- 200 g …\n\n**Slik gjør du**\n1. …"}
            rows={12}
          />
          {recipeMacros ? (
            <div className="rounded-xl border border-teal-100 bg-teal-50/40 p-3">
              <p className="text-[11px] font-semibold text-teal-900">
                Næringsinnhold per porsjon
                {recipeMacros.matchedCount < recipeMacros.ingredientCount
                  ? ` (${recipeMacros.matchedCount} av ${recipeMacros.ingredientCount} ingredienser)`
                  : null}
              </p>
              <RecipeMacroBlocks result={recipeMacros} />
            </div>
          ) : body.trim() ? (
            <p className="rounded-xl border border-amber-100 bg-amber-50/80 px-3 py-2 text-xs text-amber-900">
              Kunne ikke beregne makroer ennå. Bruk en <strong>Ingredienser</strong>-liste med mengder (g, dl, ss, stk) og
              navn som finnes i matvarebanken.
            </p>
          ) : null}
          {body.trim() ? (
            <RecipeIngredientList body={draftBody} foodItems={foodItemsForMacros} recipeId={editItem?.id} />
          ) : null}
          {avoidanceConflicts.length > 0 ? <RecipeAvoidanceWarning conflicts={avoidanceConflicts} /> : null}
          {status ? <StatusMessage tone="error">{status}</StatusMessage> : null}
          <div className="flex flex-wrap justify-end gap-2">
            <OutlineButton type="button" onClick={onClose}>
              Avbryt
            </OutlineButton>
            <GradientButton type="button" onClick={() => void handleSave()} disabled={saving || isImageProcessing}>
              {saving ? "Lagrer…" : editItem && !duplicateFromItem ? "Lagre endringer" : duplicateFromItem ? "Opprett kopi" : "Publiser oppskrift"}
            </GradientButton>
          </div>
        </div>
      </div>
    </div>
  );
}
