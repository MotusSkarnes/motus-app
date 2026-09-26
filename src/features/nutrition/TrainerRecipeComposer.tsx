import { useCallback, useEffect, useMemo, useState } from "react";
import { Trash2, X } from "lucide-react";
import { buildDefaultFoodBankItems } from "../../app/foodBankSeed";
import type { FoodItem } from "../../app/foodBankTypes";
import { findRecipeFoodAvoidanceConflicts } from "../../app/memberFoodAvoidances";
import type { Member } from "../../app/types";
import {
  fetchInspirationItemsForHub,
  loadInspirationItemsFromLocalStorage,
  notifyInspirationItemsChanged,
  persistInspirationItems,
} from "../../app/inspirationStorage";
import { isInspirationRecipeItem } from "../../app/inspirationHubItems";
import {
  persistedRecipeAvailability,
  resolveInspirationFeedForWrite,
  type InspirationRecipeItem,
} from "../../app/inspirationRecipeItems";
import { prepareRecipePhotoDataUrl, resolveInspirationImageForStorage } from "../../app/inspirationRecipeImage";
import { readImageFileAsDataUrl } from "../../app/imageCompress";
import {
  RECIPE_MEAL_SLOTS,
  mealSlotsLabel,
  recipeMealSlotsFor,
  uniqueRecipeMealSlots,
  type RecipeMealSlot,
} from "../../app/recipeMealCategory";
import {
  RECIPE_PROTEIN_CATEGORIES,
  isRecipeProteinCategory,
  type RecipeProteinCategory,
} from "../../app/recipeProteinCategory";
import { computeRecipeIngredients, computeRecipeMacros } from "../../app/recipeMacros";
import { findFoodItemById } from "../../app/foodBankDedup";
import { persistFoodUnitGrams } from "../../app/foodBankCloud";
import {
  buildRecipeBody,
  extractRecipeMethodSection,
  extractRecipeTipsSection,
  overridesFromIngredientDrafts,
  parseRecipeBaseServings,
  parseRecipeIngredientDrafts,
  resolvedRecipeIngredientName,
  type RecipeIngredientDraft,
} from "../../app/recipeBody";
import { RecipeAvoidanceWarning } from "../../components/RecipeAvoidanceWarning";
import { RecipeImageField } from "../../components/RecipeImageField";
import { RecipeIngredientEditor } from "../../components/RecipeIngredientEditor";
import { RecipeIngredientList } from "../../components/RecipeIngredientList";
import { RecipeMacroBlocks } from "../../components/RecipeMacroBlocks";
import { RecipeCustomerPreview } from "../../components/RecipeCustomerPreview";
import { ConfirmDialog, DangerButton, GradientButton, OutlineButton, StatusMessage, TextArea, TextInput } from "../../app/ui";
import { useFoodBankItems } from "../../app/useFoodBankItems";
import { uid } from "../../app/storage";

type RecipeDraftSnapshot = {
  title: string;
  description: string;
  tag: string;
  mealSlots: RecipeMealSlot[];
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
    tag: source?.tag && source.tag.trim() !== "Oppskrift" ? source.tag : "Måltid",
    mealSlots: source ? recipeMealSlotsFor(source) : [],
    proteinCategory: source?.proteinCategory ?? "",
    servings: String(source?.servings ?? (body ? parseRecipeBaseServings(body) : "1")),
    method: extractRecipeMethodSection(body),
    tips: extractRecipeTipsSection(body),
    ingredients,
    imageUrl: source?.imageUrl ?? "",
  };
}

function withMatchedFoodIds(
  drafts: RecipeIngredientDraft[],
  foodItems: FoodItem[],
  servings: number,
  method: string,
  tips: string,
): RecipeIngredientDraft[] {
  const body = buildRecipeBody({ servings, ingredients: drafts, method, tips });
  const matched = computeRecipeIngredients(body, foodItems);
  let changed = false;
  const next = drafts.map((row, index) => {
    if (row.foodId?.trim()) return row;
    const foodId = matched.find((item) => item.key === `ing-${index}`)?.foodId;
    if (!foodId) return row;
    changed = true;
    return { ...row, foodId };
  });
  return changed ? next : drafts;
}

function withResolvedIngredientNames(
  rows: RecipeIngredientDraft[],
  foodItems: FoodItem[],
): RecipeIngredientDraft[] {
  return rows.map((row) => {
    const bankName = findFoodItemById(foodItems, row.foodId)?.name;
    const name = resolvedRecipeIngredientName(row, bankName);
    return name === row.name ? row : { ...row, name };
  });
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
  trainerOwnerUserId?: string;
  onClose: () => void;
  onSaved: () => void;
  onDelete?: (item: InspirationRecipeItem) => void;
};

export function TrainerRecipeComposer({
  open,
  members,
  existingItems,
  editItem = null,
  duplicateFromItem = null,
  authorName = "Motus",
  trainerOwnerUserId,
  onClose,
  onSaved,
  onDelete,
}: TrainerRecipeComposerProps) {
  const sourceItem = duplicateFromItem ?? editItem;
  const foodBankItems = useFoodBankItems();
  const foodItemsForMacros = useMemo(
    () => (foodBankItems.length > 0 ? foodBankItems : buildDefaultFoodBankItems()),
    [foodBankItems],
  );

  const [title, setTitle] = useState(sourceItem?.title ?? "");
  const [description, setDescription] = useState(sourceItem?.description ?? "");
  const [tag, setTag] = useState(sourceItem?.tag && sourceItem.tag.trim() !== "Oppskrift" ? sourceItem.tag : "Måltid");
  const [mealSlots, setMealSlots] = useState<RecipeMealSlot[]>(
    sourceItem ? recipeMealSlotsFor(sourceItem) : [],
  );
  const [proteinCategory, setProteinCategory] = useState<RecipeProteinCategory | "">(
    sourceItem?.proteinCategory ?? "",
  );
  const [servings, setServings] = useState(String(sourceItem?.servings ?? "1"));
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
    nextDraft.ingredients = withMatchedFoodIds(
      nextDraft.ingredients,
      foodItemsForMacros,
      Math.max(1, Math.round(Number(nextDraft.servings) || 1)),
      nextDraft.method,
      nextDraft.tips,
    );
    setTitle(nextDraft.title);
    setDescription(nextDraft.description);
    setTag(nextDraft.tag);
    setMealSlots(nextDraft.mealSlots);
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
        mealSlots,
        proteinCategory,
        servings,
        method,
        tips,
        ingredients,
        imageUrl,
      }),
    [title, description, tag, mealSlots, proteinCategory, servings, method, tips, ingredients, imageUrl],
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
        ingredients: withResolvedIngredientNames(ingredients, foodItemsForMacros),
        method,
        tips,
      }),
    [draftServings, foodItemsForMacros, ingredients, method, tips],
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
      const original = await readImageFileAsDataUrl(file);
      setImageUrl(await prepareRecipePhotoDataUrl(original));
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
    if (!mealSlots.length) {
      setStatus("Velg minst én kategori (frokost, lunsj, middag eller mellommåltid).");
      return;
    }
    const ingredientsToSave = withResolvedIngredientNames(ingredients, foodItemsForMacros).filter((row) =>
      row.name.trim(),
    );
    if (!ingredientsToSave.length) {
      setStatus("Legg til minst én ingrediens.");
      return;
    }
    if (!method.trim()) {
      setStatus("Fyll inn «Slik gjør du».");
      return;
    }
    const servingsNumber = Math.max(1, Math.round(Number(servings) || 1));
    const saveOverrides = overridesFromIngredientDrafts(ingredientsToSave);
    const body = buildRecipeBody({
      servings: servingsNumber,
      ingredients: ingredientsToSave,
      method,
      tips,
    });

    setSaving(true);
    setStatus(null);

    const recipeId = editItem && !duplicateFromItem ? editItem.id : uid("recipe");
    const storedImageUrl = await resolveInspirationImageForStorage(imageUrl);
    const scalingMode = "fixed";

    const tagValue = tag.trim() && tag.trim() !== "Oppskrift" && tag.trim() !== "Måltid" ? tag.trim() : mealSlotsLabel(mealSlots);
    const recipeRow: Record<string, unknown> = {
      id: recipeId,
      category: "recipes",
      kind: "article",
      title: title.trim(),
      description: description.trim(),
      body,
      tag: tagValue,
      mealSlots,
      mealSlot: mealSlots[0],
      author: authorName,
      ...(editItem?.createdAt && !duplicateFromItem
        ? { createdAt: editItem.createdAt }
        : { createdAt: new Date().toISOString().slice(0, 10) }),
      ...(storedImageUrl ? { imageUrl: storedImageUrl } : {}),
      ...(scalingMode ? { scalingMode } : {}),
      ...(proteinCategory ? { proteinCategory } : {}),
      servings: servingsNumber,
      ...(Object.keys(saveOverrides).length ? { ingredientFoodOverrides: saveOverrides } : {}),
      ...persistedRecipeAvailability(editItem, duplicateFromItem != null),
    };

    const storedLocal = loadInspirationItemsFromLocalStorage<unknown>();
    const latestItems = resolveInspirationFeedForWrite(
      await fetchInspirationItemsForHub<unknown>(),
      storedLocal ?? (existingItems.length > 0 ? existingItems : null),
    );
    if (!latestItems) {
      setSaving(false);
      setStatus("Kunne ikke laste måltidene. Prøv igjen.");
      return;
    }

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
        aria-label={editItem && !duplicateFromItem ? "Rediger måltid" : "Nytt måltid"}
        aria-modal="true"
      >
        <div className="motus-foodbank-modal-head">
          <h3>{editItem && !duplicateFromItem ? "Rediger måltid" : duplicateFromItem ? "Dupliser måltid" : "Nytt måltid"}</h3>
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
            Måltider vises kun under <strong>Ernæring</strong> for medlemmer og i matplan — ikke i Utforsk. Legg til
            ingredienser fra matvarebanken, og skriv fremgangsmåten (oppskriften) under <strong>Slik gjør du</strong>.
          </p>
          <TextInput value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Tittel" />
          <TextInput value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Kort beskrivelse" />
          <TextInput value={tag} onChange={(e) => setTag(e.target.value)} placeholder="F.eks. 15 min" />
          <fieldset className="block">
            <legend className="motus-foodbank-field-label">Vis under måltid</legend>
            <div className="motus-recipe-meal-slots">
              {RECIPE_MEAL_SLOTS.map((slot) => {
                const active = mealSlots.includes(slot.id);
                return (
                  <button
                    key={slot.id}
                    type="button"
                    className={`motus-recipe-meal-slot${active ? " motus-recipe-meal-slot--active" : ""}`}
                    aria-pressed={active}
                    disabled={saving}
                    onClick={() => {
                      setMealSlots((current) =>
                        uniqueRecipeMealSlots(
                          current.includes(slot.id)
                            ? current.filter((id) => id !== slot.id)
                            : [...current, slot.id],
                        ),
                      );
                    }}
                  >
                    {slot.label}
                  </button>
                );
              })}
            </div>
            <p className="mt-1 text-xs text-slate-500">
              Velg én eller flere faner. Samme måltid kan ligge både under frokost og lunsj.
            </p>
          </fieldset>
          <label className="block">
            <span className="motus-foodbank-field-label">Måltidet er ment for (antall porsjoner)</span>
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
            onRegisterUnitGrams={(foodId, unit, gramsPerUnit) => {
              persistFoodUnitGrams(foodId, unit, gramsPerUnit, trainerOwnerUserId);
            }}
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
            <p className="mt-1 text-xs text-slate-500">
              Ett steg per linje — eller skriv 1. 2. 3. på samme linje. Kunden ser hvert punkt nummerert.
            </p>
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
                Næringsinnhold per porsjon
                {recipeMacros.matchedCount < recipeMacros.ingredientCount
                  ? ` (${recipeMacros.matchedCount} av ${recipeMacros.ingredientCount} ingredienser)`
                  : null}
              </p>
              <RecipeMacroBlocks result={recipeMacros} />
            </div>
          ) : ingredients.some((row) => row.name.trim()) ? (
            <p className="rounded-xl border border-amber-100 bg-amber-50/80 px-3 py-2 text-xs text-amber-900">
              Kunne ikke beregne makroer ennå. Velg matvarer fra banken, og bruk enheter som har registrert vekt.
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
          {ingredients.length > 0 ? (
            <RecipeCustomerPreview
              ingredients={ingredients}
              servings={draftServings}
              body={draftBody}
              foodItems={foodItemsForMacros}
              onNameChange={(id, name) => {
                setIngredients((prev) => prev.map((row) => (row.id === id ? { ...row, name } : row)));
              }}
            />
          ) : null}
          {avoidanceConflicts.length > 0 ? <RecipeAvoidanceWarning conflicts={avoidanceConflicts} /> : null}
          {status ? <StatusMessage message={status} tone="error" /> : null}
          <div className="flex flex-wrap items-center justify-between gap-2">
            {editItem && !duplicateFromItem && onDelete ? (
              <DangerButton
                type="button"
                className="text-sm"
                disabled={saving}
                onClick={() => onDelete(editItem)}
              >
                <Trash2 className="mr-1.5 inline h-4 w-4" aria-hidden />
                Slett måltid
              </DangerButton>
            ) : (
              <span />
            )}
            <div className="flex flex-wrap justify-end gap-2">
              <OutlineButton type="button" onClick={requestClose}>
                Avbryt
              </OutlineButton>
              <GradientButton type="button" onClick={() => void handleSave()} disabled={saving || isImageProcessing}>
                {saving ? "Lagrer…" : editItem && !duplicateFromItem ? "Lagre endringer" : duplicateFromItem ? "Opprett kopi" : "Publiser måltid"}
              </GradientButton>
            </div>
          </div>
        </div>
      </div>
    </div>
    <ConfirmDialog
      open={confirmCloseOpen}
      title="Forkaste ulagret måltid?"
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
