import { useCallback, useEffect, useMemo, useState } from "react";
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
import {
  computeRecipeMacros,
  normalizeRecipeIngredientFoodOverrides,
  parseRecipeServings,
  type RecipeIngredientFoodOverrides,
} from "../../app/recipeMacros";
import { RecipeAvoidanceWarning } from "../../components/RecipeAvoidanceWarning";
import { RecipeImageField } from "../../components/RecipeImageField";
import { RecipeIngredientList } from "../../components/RecipeIngredientList";
import { RecipeMacroBlocks } from "../../components/RecipeMacroBlocks";
import { ConfirmDialog, GradientButton, OutlineButton, StatusMessage, TextArea, TextInput } from "../../app/ui";
import { useFoodBankItems } from "../../app/useFoodBankItems";
import { uid } from "../../app/storage";

type RecipeDraftSnapshot = {
  title: string;
  description: string;
  tag: string;
  proteinCategory: string;
  servings: string;
  body: string;
  imageUrl: string;
  ingredientFoodOverrides: RecipeIngredientFoodOverrides;
};

function buildRecipeDraftFromSource(
  source: InspirationRecipeItem | null | undefined,
  duplicateFromItem: InspirationRecipeItem | null,
): RecipeDraftSnapshot {
  const duplicateTitle = duplicateFromItem?.title?.trim() ? `${duplicateFromItem.title.trim()} (kopi)` : "";
  return {
    title: duplicateTitle || (source?.title ?? ""),
    description: source?.description ?? "",
    tag: source?.tag ?? "Oppskrift",
    proteinCategory: source?.proteinCategory ?? "",
    servings: String(source?.servings ?? (source?.body ? parseRecipeServings(source.body) : "")),
    body: source?.body ?? "",
    imageUrl: source?.imageUrl ?? "",
    ingredientFoodOverrides: duplicateFromItem ? {} : { ...(source?.ingredientFoodOverrides ?? {}) },
  };
}

function snapshotRecipeDraft(input: RecipeDraftSnapshot): string {
  return JSON.stringify(input);
}

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
  const [servings, setServings] = useState(String(sourceItem?.servings ?? ""));
  const [body, setBody] = useState(sourceItem?.body ?? "");
  const [imageUrl, setImageUrl] = useState(sourceItem?.imageUrl ?? "");
  const [isImageProcessing, setIsImageProcessing] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [baselineSnapshot, setBaselineSnapshot] = useState<string | null>(null);
  const [confirmCloseOpen, setConfirmCloseOpen] = useState(false);
  const [ingredientFoodOverrides, setIngredientFoodOverrides] = useState<RecipeIngredientFoodOverrides>({});

  useEffect(() => {
    if (!open) {
      setBaselineSnapshot(null);
      setConfirmCloseOpen(false);
      return;
    }
    const source = duplicateFromItem ?? editItem;
    const nextDraft = buildRecipeDraftFromSource(source, duplicateFromItem);
    setTitle(nextDraft.title);
    setDescription(nextDraft.description);
    setTag(nextDraft.tag);
    setProteinCategory(nextDraft.proteinCategory);
    setServings(nextDraft.servings);
    setBody(nextDraft.body);
    setImageUrl(nextDraft.imageUrl);
    setIngredientFoodOverrides(nextDraft.ingredientFoodOverrides);
    setStatus(null);
    setBaselineSnapshot(snapshotRecipeDraft(nextDraft));
  }, [open, editItem, duplicateFromItem]);

  const currentSnapshot = useMemo(
    () =>
      snapshotRecipeDraft({
        title,
        description,
        tag,
        proteinCategory,
        servings,
        body,
        imageUrl,
        ingredientFoodOverrides,
      }),
    [title, description, tag, proteinCategory, servings, body, imageUrl, ingredientFoodOverrides],
  );
  const hasUnsavedChanges = baselineSnapshot !== null && currentSnapshot !== baselineSnapshot;

  const requestClose = useCallback(() => {
    if (hasUnsavedChanges) {
      setConfirmCloseOpen(true);
      return;
    }
    onClose();
  }, [hasUnsavedChanges, onClose]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || confirmCloseOpen || !hasUnsavedChanges) return;
      event.preventDefault();
      setConfirmCloseOpen(true);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [confirmCloseOpen, hasUnsavedChanges, open]);

  const draftServings = Math.max(1, Math.round(Number(servings) || 1));
  const draftBody = useMemo(
    () =>
      body.trim() ||
      `**Til ${draftServings} porsjon${draftServings === 1 ? "" : "er"}**

**Ingredienser**
- 

**Slik gjør du**
1. `,
    [body, draftServings],
  );

  const recipeMacros = useMemo(
    () =>
      computeRecipeMacros(draftBody, foodItemsForMacros, {
        servings: Number(servings),
        ingredientFoodOverrides,
      }),
    [draftBody, foodItemsForMacros, servings, ingredientFoodOverrides],
  );

  useEffect(() => {
    if (!open) return;
    setIngredientFoodOverrides((prev) => {
      const next = normalizeRecipeIngredientFoodOverrides(draftBody, foodItemsForMacros, prev);
      return JSON.stringify(next) === JSON.stringify(prev) ? prev : next;
    });
  }, [draftBody, foodItemsForMacros, open]);

  const avoidanceConflicts = useMemo(
    () => findRecipeFoodAvoidanceConflicts(draftBody, foodItemsForMacros, members, { ingredientFoodOverrides }),
    [draftBody, foodItemsForMacros, members, ingredientFoodOverrides],
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
    const servingsNumber = Math.max(1, Math.round(Number(servings) || parseRecipeServings(body)));

    setSaving(true);
    setStatus(null);

    const recipeId = editItem && !duplicateFromItem ? editItem.id : uid("recipe");
    const storedImageUrl = await resolveInspirationImageForStorage(imageUrl);
    const scalingMode =
      sourceItem?.scalingMode ?? DEFAULT_RECIPE_SCALING_BY_ID.get(recipeId);
    const normalizedIngredientFoodOverrides = normalizeRecipeIngredientFoodOverrides(
      body.trim(),
      foodItemsForMacros,
      ingredientFoodOverrides,
    );

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
      servings: servingsNumber,
      ...(Object.keys(normalizedIngredientFoodOverrides).length
        ? { ingredientFoodOverrides: normalizedIngredientFoodOverrides }
        : {}),
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
    <>
    <div className="motus-foodbank-modal-backdrop motus-recipe-composer-backdrop" role="presentation">
      <div
        className="motus-foodbank-modal motus-foodbank-modal--wide motus-recipe-composer-modal"
        role="dialog"
        aria-label={editItem && !duplicateFromItem ? "Rediger oppskrift" : "Ny oppskrift"}
        aria-modal="true"
      >
        <div className="motus-foodbank-modal-head">
          <h3>{editItem && !duplicateFromItem ? "Rediger oppskrift" : duplicateFromItem ? "Dupliser oppskrift" : "Ny oppskrift"}</h3>
          <button type="button" className="motus-foodbank-icon-btn" onClick={requestClose} aria-label="Lukk">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="motus-foodbank-modal-body motus-recipe-composer-body max-h-[min(80vh,40rem)] space-y-3 overflow-y-auto">
          {hasUnsavedChanges ? (
            <p className="rounded-xl border border-amber-100 bg-amber-50/80 px-3 py-2 text-xs text-amber-900">
              Du har ulagrede endringer. Lukk med <strong>Avbryt</strong> eller ✕ for å forkaste, eller publiser for å lagre.
            </p>
          ) : null}
          <p className="text-xs text-slate-600">
            Oppskrifter vises kun under <strong>Ernæring</strong> for medlemmer og i matplan — ikke i Utforsk. Næringsinnhold
            beregnes automatisk fra ingredienslisten når du skriver.
          </p>
          <TextInput value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Tittel" />
          <TextInput value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Kort beskrivelse" />
          <TextInput value={tag} onChange={(e) => setTag(e.target.value)} placeholder="F.eks. 15 min · Middag" />
          <label className="block">
            <span className="motus-foodbank-field-label">Antall porsjoner oppskriften gjelder for</span>
            <TextInput
              type="number"
              min={1}
              step={1}
              inputMode="numeric"
              value={servings}
              onChange={(event) => setServings(event.target.value)}
              placeholder="F.eks. 4"
            />
          </label>
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
            className="motus-recipe-composer-textarea"
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
            <RecipeIngredientList
              body={draftBody}
              foodItems={foodItemsForMacros}
              recipeId={editItem?.id}
              servings={Number(servings)}
              editable
              foodOverrides={ingredientFoodOverrides}
              onFoodOverrideChange={(ingredientKey, foodId) => {
                setIngredientFoodOverrides((prev) => {
                  if (!foodId) {
                    const next = { ...prev };
                    delete next[ingredientKey];
                    return next;
                  }
                  return { ...prev, [ingredientKey]: foodId };
                });
              }}
            />
          ) : null}
          {avoidanceConflicts.length > 0 ? <RecipeAvoidanceWarning conflicts={avoidanceConflicts} /> : null}
          {status ? <StatusMessage message={status} tone="error" /> : null}
          <div className="flex flex-wrap justify-end gap-2">
            <OutlineButton type="button" onClick={requestClose}>
              Avbryt
            </OutlineButton>
            <GradientButton type="button" onClick={() => void handleSave()} disabled={saving || isImageProcessing}>
              {saving ? "Lagrer…" : editItem && !duplicateFromItem ? "Lagre endringer" : duplicateFromItem ? "Opprett kopi" : "Publiser oppskrift"}
            </GradientButton>
          </div>
        </div>
      </div>
    </div>
    <ConfirmDialog
      open={confirmCloseOpen}
      title="Forkaste ulagret oppskrift?"
      message="Du har endringer som ikke er lagret. Vil du lukke uten å publisere?"
      confirmLabel="Forkast endringer"
      cancelLabel="Fortsett redigering"
      tone="danger"
      onCancel={() => setConfirmCloseOpen(false)}
      onConfirm={() => {
        setConfirmCloseOpen(false);
        onClose();
      }}
    />
    </>
  );
}
