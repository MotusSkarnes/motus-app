import {
  PROGRAM_COVER_DISPLAY_ZOOM_MAX,
  PROGRAM_COVER_DISPLAY_ZOOM_MIN,
  PROGRAM_COVER_DISPLAY_ZOOM_SOFT,
} from "./programImage";

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

export type ProgramCustomCoverImageStyle = {
  objectFit: "cover";
  objectPosition?: string;
  transform: string;
  transformOrigin: string;
};

/** 0 i midten, 1 ved fx/fy 0 eller 1 — styrer hvor mye zoom som trengs for kant-pan. */
export function programCoverPanEdgeFactor(focalX: number, focalY: number): number {
  return Math.min(1, Math.max(0, Math.max(Math.abs(focalX - 0.5), Math.abs(focalY - 0.5)) * 2));
}

export function programCoverPanScale(focalX: number, focalY: number): number {
  const edge = programCoverPanEdgeFactor(focalX, focalY);
  return PROGRAM_COVER_DISPLAY_ZOOM_MIN + edge * (PROGRAM_COVER_DISPLAY_ZOOM_MAX - PROGRAM_COVER_DISPLAY_ZOOM_MIN);
}

/** Prosent-translasjon ved fx/fy=0 eller 1 (ytterkant). */
export function programCoverPanTranslatePercent(
  focalX: number,
  focalY: number,
  zoom?: number,
): { x: number; y: number } {
  const scale = Number.isFinite(zoom) && zoom && zoom > 1 ? zoom : programCoverPanScale(focalX, focalY);
  const range = ((scale - 1) / 2) * 100;
  return {
    x: (0.5 - focalX) * 2 * range,
    y: (focalY - 0.5) * 2 * range,
  };
}

function programCustomCoverObjectPosition(focalX: number, focalY: number): string {
  return `${(focalX * 100).toFixed(1)}% ${(focalY * 100).toFixed(1)}%`;
}

/**
 * Midtstilt: hele motivet (ingen zoom). Mot kant: gradvis zoom + pan for å nå ytterkant.
 */
export function programCustomCoverImageStyle(src?: string | null): ProgramCustomCoverImageStyle {
  const { focalX, focalY } = parseImageFocalPointFromSrc(src);
  const scale = programCoverPanScale(focalX, focalY);

  if (scale < PROGRAM_COVER_DISPLAY_ZOOM_SOFT) {
    return {
      objectFit: "cover",
      objectPosition: programCustomCoverObjectPosition(focalX, focalY),
      transform: "none",
      transformOrigin: "50% 50%",
    };
  }

  const { x, y } = programCoverPanTranslatePercent(focalX, focalY, scale);
  return {
    objectFit: "cover",
    transform: `scale(${scale.toFixed(3)}) translate(${x.toFixed(2)}%, ${y.toFixed(2)}%)`,
    transformOrigin: "50% 50%",
  };
}
