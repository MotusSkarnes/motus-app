import { PROGRAM_COVER_DISPLAY_PAN_SCALE } from "./programImage";

export type ImageFocalPoint = {
  focalX: number;
  focalY: number;
};

export const DEFAULT_IMAGE_FOCAL_POINT: ImageFocalPoint = { focalX: 0.5, focalY: 0.5 };

function clampFocal01(value: number, fallback: number): number {
  if (!Number.isFinite(value)) return fallback;
  return Math.min(1, Math.max(0, value));
}

export function parseImageFocalPointFromSrc(src?: string | null): ImageFocalPoint {
  if (!src) return { ...DEFAULT_IMAGE_FOCAL_POINT };
  const queryStart = src.indexOf("?");
  if (queryStart < 0) return { ...DEFAULT_IMAGE_FOCAL_POINT };

  const params = new URLSearchParams(src.slice(queryStart + 1));
  return {
    focalX: clampFocal01(Number(params.get("fx")), DEFAULT_IMAGE_FOCAL_POINT.focalX),
    focalY: clampFocal01(Number(params.get("fy")), DEFAULT_IMAGE_FOCAL_POINT.focalY),
  };
}

export function applyImageFocalPointToSrc(src: string, focalPoint: ImageFocalPoint): string {
  const trimmed = src.trim();
  if (!trimmed) return trimmed;

  const queryStart = trimmed.indexOf("?");
  const base = queryStart >= 0 ? trimmed.slice(0, queryStart) : trimmed;
  const params = new URLSearchParams(queryStart >= 0 ? trimmed.slice(queryStart + 1) : "");
  params.set("fx", clampFocal01(focalPoint.focalX, DEFAULT_IMAGE_FOCAL_POINT.focalX).toFixed(3));
  params.set("fy", clampFocal01(focalPoint.focalY, DEFAULT_IMAGE_FOCAL_POINT.focalY).toFixed(3));
  const serialized = params.toString();
  return serialized ? `${base}?${serialized}` : base;
}

function srcHasFocalQuery(src?: string | null): boolean {
  if (!src) return false;
  const queryStart = src.indexOf("?");
  if (queryStart < 0) return false;
  const params = new URLSearchParams(src.slice(queryStart + 1));
  return params.has("fx") || params.has("fy");
}

export function imageObjectPositionFromSrc(src?: string | null): string {
  if (!srcHasFocalQuery(src)) return "center top";
  const { focalX, focalY } = parseImageFocalPointFromSrc(src);
  const x = focalX * 100;
  const y = focalY * 100;
  return `${x.toFixed(1)}% ${y.toFixed(1)}%`;
}

/** Prosent-translasjon ved glidebryter 0–100 % (fast zoom, begge akser). */
export function programCoverPanTranslatePercent(
  focalX: number,
  focalY: number,
  scale: number = PROGRAM_COVER_DISPLAY_PAN_SCALE,
): { x: number; y: number } {
  const panScale = Number.isFinite(scale) && scale > 1 ? scale : PROGRAM_COVER_DISPLAY_PAN_SCALE;
  const range = ((panScale - 1) / 2) * 100;
  return {
    x: Math.round(((0.5 - focalX) * 2 * range) * 100) / 100,
    y: Math.round(((focalY - 0.5) * 2 * range) * 100) / 100,
  };
}

export type ProgramCustomCoverImageStyle = {
  objectFit: "cover";
  transform: string;
  transformOrigin: string;
};

/**
 * Fast lett zoom + translate — pan både venstre/høyre og opp/ned uten at zoom endres under dragging.
 * (object-position alene gir bare vertikal pan på brede hero-bannere i forhåndsvisningen.)
 */
export function programCustomCoverImageStyle(src?: string | null): ProgramCustomCoverImageStyle {
  const { focalX, focalY } = parseImageFocalPointFromSrc(src);
  const scale = PROGRAM_COVER_DISPLAY_PAN_SCALE;
  const { x, y } = programCoverPanTranslatePercent(focalX, focalY, scale);
  return {
    objectFit: "cover",
    transform: `scale(${scale}) translate(${x.toFixed(2)}%, ${y.toFixed(2)}%)`,
    transformOrigin: "50% 50%",
  };
}
