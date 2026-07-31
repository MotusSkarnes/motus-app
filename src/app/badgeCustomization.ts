import type React from "react";
import { DEFAULT_PROGRAM_COVER_FRAME, programCoverPanTranslatePercent, type ProgramCoverFrame } from "./imageFocalPoint";

export type BadgeCustomization = {
  title?: string;
  description?: string;
  imageUrl?: string;
  frame?: ProgramCoverFrame;
};

export type BadgeCustomizations = Record<string, BadgeCustomization>;

export const BADGE_CUSTOMIZATIONS_STORAGE_KEY = "MOTUS_BADGE_CUSTOMIZATIONS_V1";
export const BADGE_CUSTOMIZATIONS_CHANGED_EVENT = "motus:badge-customizations-changed";

function normalizeFrame(frame?: Partial<ProgramCoverFrame>): ProgramCoverFrame {
  return {
    focalX: Math.min(1, Math.max(0, Number(frame?.focalX) || DEFAULT_PROGRAM_COVER_FRAME.focalX)),
    focalY: Math.min(1, Math.max(0, Number(frame?.focalY) || DEFAULT_PROGRAM_COVER_FRAME.focalY)),
    zoom: Math.min(2.25, Math.max(1, Number(frame?.zoom) || DEFAULT_PROGRAM_COVER_FRAME.zoom)),
  };
}

function normalizeCustomization(input: unknown): BadgeCustomization | null {
  if (!input || typeof input !== "object") return null;
  const record = input as Record<string, unknown>;
  const next: BadgeCustomization = {};
  const title = String(record.title ?? "").trim();
  const description = String(record.description ?? "").trim();
  const imageUrl = String(record.imageUrl ?? "").trim();
  if (title) next.title = title;
  if (description) next.description = description;
  if (imageUrl) next.imageUrl = imageUrl;
  if (record.frame && typeof record.frame === "object") next.frame = normalizeFrame(record.frame as Partial<ProgramCoverFrame>);
  return Object.keys(next).length ? next : null;
}

export function readBadgeCustomizations(): BadgeCustomizations {
  if (typeof window === "undefined") return {};
  try {
    const parsed = JSON.parse(window.localStorage.getItem(BADGE_CUSTOMIZATIONS_STORAGE_KEY) ?? "{}") as Record<string, unknown>;
    const entries = Object.entries(parsed)
      .map(([id, value]) => [id, normalizeCustomization(value)] as const)
      .filter((entry): entry is readonly [string, BadgeCustomization] => Boolean(entry[1]));
    return Object.fromEntries(entries);
  } catch {
    return {};
  }
}

export function writeBadgeCustomizations(customizations: BadgeCustomizations): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(BADGE_CUSTOMIZATIONS_STORAGE_KEY, JSON.stringify(customizations));
  window.dispatchEvent(new CustomEvent(BADGE_CUSTOMIZATIONS_CHANGED_EVENT));
}

export function updateBadgeCustomization(
  badgeId: string,
  patch: BadgeCustomization | ((current: BadgeCustomization) => BadgeCustomization),
): BadgeCustomizations {
  const id = badgeId.trim();
  if (!id) return readBadgeCustomizations();
  const current = readBadgeCustomizations();
  const previous = current[id] ?? {};
  const nextValue = typeof patch === "function" ? patch(previous) : { ...previous, ...patch };
  const normalized = normalizeCustomization(nextValue);
  const next = { ...current };
  if (normalized) next[id] = normalized;
  else delete next[id];
  writeBadgeCustomizations(next);
  return next;
}

export function clearBadgeCustomization(badgeId: string): BadgeCustomizations {
  const next = { ...readBadgeCustomizations() };
  delete next[badgeId];
  writeBadgeCustomizations(next);
  return next;
}

export function customizeBadgeText<T extends { id: string; title: string; description: string }>(
  badge: T,
  customizations: BadgeCustomizations,
): T {
  const custom = customizations[badge.id];
  if (!custom?.title && !custom?.description) return badge;
  return {
    ...badge,
    title: custom.title?.trim() || badge.title,
    description: custom.description?.trim() || badge.description,
  };
}

export function resolveCustomBadgeImage(badgeId: string, fallbackSrc: string, customizations: BadgeCustomizations): string {
  return customizations[badgeId]?.imageUrl?.trim() || fallbackSrc;
}

export function badgeCustomImageStyle(frame?: ProgramCoverFrame): React.CSSProperties {
  const normalized = normalizeFrame(frame);
  if (normalized.zoom <= 1.01) {
    return {
      objectFit: "cover",
      objectPosition: `${(normalized.focalX * 100).toFixed(1)}% ${(normalized.focalY * 100).toFixed(1)}%`,
      transform: "none",
      transformOrigin: "50% 50%",
    };
  }
  const { x, y } = programCoverPanTranslatePercent(normalized.focalX, normalized.focalY, normalized.zoom);
  return {
    objectFit: "cover",
    transform: `scale(${normalized.zoom.toFixed(3)}) translate(${x.toFixed(2)}%, ${y.toFixed(2)}%)`,
    transformOrigin: "50% 50%",
  };
}

export function badgeCustomizationFrame(custom?: BadgeCustomization): ProgramCoverFrame {
  return normalizeFrame(custom?.frame);
}
