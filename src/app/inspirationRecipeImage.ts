import { cropImageDataUrlToSquare } from "./imageCompress";

/** Klargjør oppskriftsbilde for lagring: 1:1-beskjæring + komprimering. */
export async function resolveInspirationImageForStorage(value: string): Promise<string | undefined> {
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  if (!trimmed.startsWith("data:image/")) return trimmed;
  return cropImageDataUrlToSquare(trimmed, 960, 0.82);
}
