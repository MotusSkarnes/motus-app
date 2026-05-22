/** Felles visning av badge-PNG (transparent bakgrunn etter normalisering). */
export const BADGE_IMAGE_BOX_CLASS = "h-28 w-28 sm:h-[7.25rem] sm:w-[7.25rem]";

export const BADGE_IMAGE_WRAPPER_CLASS =
  `${BADGE_IMAGE_BOX_CLASS} flex shrink-0 items-center justify-center overflow-visible rounded-xl bg-transparent`;

/** Skaler ned i boksen så hjørner/sparkles ikke klippes av foreldre med overflow-hidden. */
export const BADGE_IMAGE_CLASS = "max-h-[88%] max-w-[88%] object-contain drop-shadow-sm";

export const BADGE_IMAGE_POPUP_WRAPPER_CLASS =
  "mx-auto mt-4 flex h-40 w-40 items-center justify-center overflow-visible rounded-xl bg-transparent p-2";

export const BADGE_IMAGE_POPUP_CLASS = "max-h-full max-w-full object-contain drop-shadow-sm";
