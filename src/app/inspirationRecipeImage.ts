import { cropImageDataUrlToAspect } from "./imageCompress";

/** Litt bredere enn høyt — samme ramme i oppskrift, detalj og matplan. */
export const RECIPE_PHOTO_ASPECT = { width: 5, height: 4 } as const;

export async function prepareRecipePhotoDataUrl(value: string): Promise<string> {
  const trimmed = value.trim();
  if (!trimmed.startsWith("data:image/")) return trimmed;
  return cropImageDataUrlToAspect(
    trimmed,
    RECIPE_PHOTO_ASPECT.width,
    RECIPE_PHOTO_ASPECT.height,
    960,
    0.82,
  );
}

/** Klargjør oppskriftsbilde for lagring: 5:4-beskjæring + komprimering. */
export async function resolveInspirationImageForStorage(value: string): Promise<string | undefined> {
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  if (!trimmed.startsWith("data:image/")) return trimmed;
  return prepareRecipePhotoDataUrl(trimmed);
}
