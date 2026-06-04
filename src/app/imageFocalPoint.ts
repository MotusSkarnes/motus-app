import {
  PROGRAM_COVER_ZOOM_DEFAULT,
  PROGRAM_COVER_ZOOM_MAX,
  PROGRAM_COVER_ZOOM_MIN,
} from "./programImage";

export type ProgramCoverFrame = {
  focalX: number;
  focalY: number;
  zoom: number;
};

/** @deprecated Bruk ProgramCoverFrame */
export type ImageFocalPoint = ProgramCoverFrame;

export const DEFAULT_PROGRAM_COVER_FRAME: ProgramCoverFrame = {
  focalX: 0.5,
  focalY: 0.5,
  zoom: PROGRAM_COVER_ZOOM_DEFAULT,
};

export const DEFAULT_IMAGE_FOCAL_POINT = DEFAULT_PROGRAM_COVER_FRAME;

function clampFocal01(value: number, fallback: number): number {
  if (!Number.isFinite(value)) return fallback;
  return Math.min(1, Math.max(0, value));
}

function clampZoom(value: number, fallback: number = PROGRAM_COVER_ZOOM_DEFAULT): number {
  if (!Number.isFinite(value)) return fallback;
  return Math.min(PROGRAM_COVER_ZOOM_MAX, Math.max(PROGRAM_COVER_ZOOM_MIN, value));
}

export function parseProgramCoverFrameFromSrc(src?: string | null): ProgramCoverFrame {
  if (!src) return { ...DEFAULT_PROGRAM_COVER_FRAME };
  const queryStart = src.indexOf("?");
  if (queryStart < 0) return { ...DEFAULT_PROGRAM_COVER_FRAME };

  const params = new URLSearchParams(src.slice(queryStart + 1));
  return {
    focalX: clampFocal01(Number(params.get("fx")), DEFAULT_PROGRAM_COVER_FRAME.focalX),
    focalY: clampFocal01(Number(params.get("fy")), DEFAULT_PROGRAM_COVER_FRAME.focalY),
    zoom: clampZoom(Number(params.get("fz"))),
  };
}

export function parseImageFocalPointFromSrc(src?: string | null): ProgramCoverFrame {
  return parseProgramCoverFrameFromSrc(src);
}

export function applyProgramCoverFrameToSrc(src: string, frame: ProgramCoverFrame): string {
  const trimmed = src.trim();
  if (!trimmed) return trimmed;

  const queryStart = trimmed.indexOf("?");
  const base = queryStart >= 0 ? trimmed.slice(0, queryStart) : trimmed;
  const params = new URLSearchParams(queryStart >= 0 ? trimmed.slice(queryStart + 1) : "");
  params.set("fx", clampFocal01(frame.focalX, DEFAULT_PROGRAM_COVER_FRAME.focalX).toFixed(3));
  params.set("fy", clampFocal01(frame.focalY, DEFAULT_PROGRAM_COVER_FRAME.focalY).toFixed(3));
  params.set("fz", clampZoom(frame.zoom).toFixed(3));
  const serialized = params.toString();
  return serialized ? `${base}?${serialized}` : base;
}

export function applyImageFocalPointToSrc(src: string, frame: Partial<ProgramCoverFrame>): string {
  const current = parseProgramCoverFrameFromSrc(src);
  return applyProgramCoverFrameToSrc(src, {
    focalX: frame.focalX ?? current.focalX,
    focalY: frame.focalY ?? current.focalY,
    zoom: frame.zoom ?? current.zoom,
  });
}

function srcHasFocalQuery(src?: string | null): boolean {
  if (!src) return false;
  const queryStart = src.indexOf("?");
  if (queryStart < 0) return false;
  const params = new URLSearchParams(src.slice(queryStart + 1));
  return params.has("fx") || params.has("fy") || params.has("fz");
}

export function imageObjectPositionFromSrc(src?: string | null): string {
  if (!srcHasFocalQuery(src)) return "center top";
  const { focalX, focalY } = parseProgramCoverFrameFromSrc(src);
  return `${(focalX * 100).toFixed(1)}% ${(focalY * 100).toFixed(1)}%`;
}

/** Prosent-translasjon ved pan (brukes når zoom > 1). */
export function programCoverPanTranslatePercent(
  focalX: number,
  focalY: number,
  zoom: number,
): { x: number; y: number } {
  const panZoom = clampZoom(zoom);
  const range = ((panZoom - 1) / 2) * 100;
  return {
    x: Math.round(((0.5 - focalX) * 2 * range) * 100) / 100,
    y: Math.round(((focalY - 0.5) * 2 * range) * 100) / 100,
  };
}

export type ProgramCustomCoverImageStyle = {
  objectFit: "cover";
  objectPosition?: string;
  transform: string;
  transformOrigin: string;
};

/** Trener styrer zoom (fz) + pan (fx/fy). Ved zoom 1: object-position; ved innzoom: scale + translate. */
export function programCustomCoverImageStyle(src?: string | null): ProgramCustomCoverImageStyle {
  const { focalX, focalY, zoom } = parseProgramCoverFrameFromSrc(src);

  if (zoom <= 1.01) {
    return {
      objectFit: "cover",
      objectPosition: `${(focalX * 100).toFixed(1)}% ${(focalY * 100).toFixed(1)}%`,
      transform: "none",
      transformOrigin: "50% 50%",
    };
  }

  const { x, y } = programCoverPanTranslatePercent(focalX, focalY, zoom);
  return {
    objectFit: "cover",
    transform: `scale(${zoom.toFixed(3)}) translate(${x.toFixed(2)}%, ${y.toFixed(2)}%)`,
    transformOrigin: "50% 50%",
  };
}
