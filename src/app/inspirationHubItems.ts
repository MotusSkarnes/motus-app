/** Oppskrifter lagres i samme feed som Utforsk, men vises kun under Ernæring. */

export function isInspirationRecipeItem(item: { category?: string }): boolean {
  const category = String(item.category ?? "")
    .trim()
    .toLowerCase();
  return category === "recipes" || category === "oppskrift";
}

export function filterRecipesFromInspirationHub<T extends { category?: string }>(items: T[]): T[] {
  return items.filter((item) => !isInspirationRecipeItem(item));
}

export function partitionInspirationFeedItems<T extends { category?: string }>(
  items: T[],
): { hub: T[]; recipes: T[] } {
  const hub: T[] = [];
  const recipes: T[] = [];
  for (const item of items) {
    if (isInspirationRecipeItem(item)) recipes.push(item);
    else hub.push(item);
  }
  return { hub, recipes };
}

export function mergeHubItemsPreservingRecipes<T extends { category?: string }>(
  hubItems: T[],
  existingFeed: T[],
): T[] {
  const recipes = existingFeed.filter(isInspirationRecipeItem);
  return [...hubItems, ...recipes];
}
