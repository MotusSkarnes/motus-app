import { compressImageDataUrl } from "./imageCompress";

/** Klargjør oppskrifts-/inspirasjonsbilde for lagring (komprimerer data-URL). */
export async function resolveInspirationImageForStorage(value: string): Promise<string | undefined> {
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  if (!trimmed.startsWith("data:image/")) return trimmed;
  return compressImageDataUrl(trimmed);
}
