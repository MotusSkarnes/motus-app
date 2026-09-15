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
import { computeRecipeMacros } from "../../app/recipeMacros";
import {
  buildRecipeBody,
  extractRecipeMethodSection,
  extractRecipeTipsSection,
  overridesFromIngredientDrafts,
  parseRecipeBaseServings,
  parseRecipeIngredientDrafts,
  type RecipeIngredientDraft,
} from "../../app/recipeBody";
import { RecipeAvoidanceWarning } from "../../components/RecipeAvoidanceWarning";
import { RecipeImageField } from "../../components/RecipeImageField";
import { RecipeIngredientEditor } from "../../components/RecipeIngredientEditor";
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
  method: string;
  tips: string;
  ingredients: RecipeIngredientDraft[];
  imageUrl: string;
};

function buildRecipeDraftFromSource(
  source: InspirationRecipeItem | null | undefined,
  duplicateFromItem: InspirationRecipeItem | null,
): RecipeDraftSnapshot {
  const duplicateTitle = duplicateFromItem?.title?.trim() ? `${duplicateFromItem.title.trim()} (kopi)` : "";
  const body = source?.body ?? "";
  const ingredients = parseRecipeIngredientDrafts(
    body,
    duplicateFromItem ? undefined : source?.ingredientFoodOverrides,
  );
  return {
    title: duplicateTitle || (source?.title ?? ""),
    description: source?.description ?? "",
    tag: source?.tag ?? "Oppskrift",
    proteinCategory: source?.proteinCategory ?? "",
    servings: String(source?.servings ?? (body ? parseRecipeBaseServings(body) : "2")),
    method: extractRecipeMethodSection(body),
    tips: extractRecipeTipsSection(body),
    ingredients,
    imageUrl: source?.imageUrl ?? "",
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
  const [servings, setServings] = useState(String(sourceItem?.servings ?? "2"));
  const [method, setMethod] = useState(extractRecipeMethodSection(sourceItem?.body ?? ""));
  const [tips, setTips] = useState(extractRecipeTipsSection(sourceItem?.body ?? ""));
  const [ingredients, setIngredients] = useState<RecipeIngredientDraft[]>(
    parseRecipeIngredientDrafts(sourceItem?.body ?? "", sourceItem?.ingredientFoodOverrides),
  );
  const [imageUrl, setImageUrl] = useState(sourceItem?.imageUrl ?? "");
  const [isImageProcessing, setIsImageProcessing] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [baselineSnapshot, setBaselineSnapshot] = useState<string | null>(null);
  const [confirmCloseOpen, setConfirmCloseOpen] = useState(false);

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
    setMethod(nextDraft.method);
    setTips(nextDraft.tips);
    setIngredients(nextDraft.ingredients);
    setImageUrl(nextDraft.imageUrl);
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
        method,
        tips,
        ingredients,
        imageUrl,
      }),
    [title, description, tag, proteinCategory, servings, method, tips, ingredients, imageUrl],
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
  const composedOverrides = useMemo(() => overridesFromIngredientDrafts(ingredients), [ingredients]);
  const draftBody = useMemo(
    () =>
      buildRecipeBody({
        servings: draftServings,
        ingredients,
        method,
        tips,
      }),
    [draftServings, ingredients, method, tips],
  );

  const recipeMacros = useMemo(
    () =>
      computeRecipeMacros(draftBody, foodItemsForMacros, {
        servings: draftServings,
        ingredientFoodOverrides: composedOverrides,
      }),
    [draftBody, foodItemsForMacros, draftServings, composedOverrides],
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
    const namedIngredients = ingredients.filter((row) => row.name.trim());
    if (!namedIngredients.length) {
      setStatus("Legg til minst én ingrediens.");
      return;
    }
    if (!method.trim()) {
      setStatus("Fyll inn «Slik gjør du».");
      return;
    }
    const servingsNumber = Math.max(1, Math.round(Number(servings) || 1));
    const saveOverrides = overridesFromIngredientDrafts(namedIngredients);
    const body = buildRecipeBody({
      servings: servingsNumber,
      ingredients: namedIngredients,
      method,
      tips,
    });

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
      body,
      tag: tag.trim() || "Oppskrift",
      author: authorName,
      ...(editItem?.createdAt && !duplicateFromItem
        ? { createdAt: editItem.createdAt }
        : { createdAt: new Date().toISOString().slice(0, 10) }),
      ...(storedImageUrl ? { imageUrl: storedImageUrl } : {}),
      ...(scalingMode ? { scalingMode } : {}),
      ...(proteinCategory ? { proteinCategory } : {}),
      servings: servingsNumber,
      ...(Object.keys(saveOverrides).length ? { ingredientFoodOverrides: saveOverrides } : {}),
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
            Oppskrifter vises kun under <strong>Ernæring</strong> for medlemmer og i matplan — ikke i Utforsk. Legg til
            ingredienser fra matvarebanken, og skriv fremgangsmåten under <strong>Slik gjør du</strong>.
          </p>
          <TextInput value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Tittel" />
          <TextInput value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Kort beskrivelse" />
          <TextInput value={tag} onChange={(e) => setTag(e.target.value)} placeholder="F.eks. 15 min · Middag" />
          <label className="block">
            <span className="motus-foodbank-field-label">Oppskriften er ment for (antall personer)</span>
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
          <RecipeIngredientEditor
            ingredients={ingredients}
            foodItems={foodItemsForMacros}
            disabled={saving}
            onChange={setIngredients}
          />
          <label className="block">
            <span className="motus-foodbank-field-label">Slik gjør du</span>
            <TextArea
              value={method}
              onChange={(event) => setMethod(event.target.value)}
              placeholder={"1. Stek kyllingen.\n2. Kok risen.\n3. Server med grønnsaker."}
              className="motus-recipe-composer-method"
              rows={8}
            />
          </label>
          <label className="block">
            <span className="motus-foodbank-field-label">Tips (valgfritt)</span>
            <TextArea
              value={tips}
              onChange={(event) => setTips(event.target.value)}
              placeholder="F.eks. Lag dobbel porsjon og frys ned."
              rows={3}
            />
          </label>
          {recipeMacros ? (
            <div className="rounded-xl border border-teal-100 bg-teal-50/40 p-3">
              <p className="text-[11px] font-semibold text-teal-900">
                Næringsinnhold per person
                {recipeMacros.matchedCount < recipeMacros.ingredientCount
                  ? ` (${recipeMacros.matchedCount} av ${recipeMacros.ingredientCount} ingredienser)`
                  : null}
              </p>
              <RecipeMacroBlocks result={recipeMacros} />
            </div>
          ) : ingredients.some((row) => row.name.trim()) ? (
            <p className="rounded-xl border border-amber-100 bg-amber-50/80 px-3 py-2 text-xs text-amber-900">
              Kunne ikke beregne makroer ennå. Velg matvarer fra banken og bruk mengder (g, dl, ss, stk).
            </p>
          ) : null}
          {ingredients.some((row) => row.name.trim() && !row.foodId) ? (
            <RecipeIngredientList
              body={draftBody}
              foodItems={foodItemsForMacros}
              recipeId={editItem?.id}
              servings={draftServings}
              editable
              foodOverrides={composedOverrides}
              onFoodOverrideChange={(ingredientKey, foodId) => {
                const index = Number(ingredientKey.replace(/^ing-/, ""));
                if (!Number.isFinite(index)) return;
                setIngredients((prev) =>
                  prev.map((row, rowIndex) =>
                    rowIndex === index ? { ...row, foodId: foodId ?? undefined } : row,
                  ),
                );
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
