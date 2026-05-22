/** Felles visning av badge-PNG (transparent bakgrunn etter normalisering). */
export const BADGE_IMAGE_BOX_CLASS = "h-[5.4rem] w-[5.4rem]";

export const BADGE_IMAGE_WRAPPER_CLASS =
  `${BADGE_IMAGE_BOX_CLASS} flex items-center justify-center overflow-visible rounded-xl bg-transparent`;

/** Litt innvendig luft så hele motivet (inkl. hjørner/sparkles) er synlig i boksen. */
export const BADGE_IMAGE_CLASS =
  "h-full w-full max-h-full max-w-full object-contain p-2 drop-shadow-sm";

export const BADGE_IMAGE_POPUP_WRAPPER_CLASS =
  "mx-auto mt-4 flex h-36 w-36 items-center justify-center overflow-hidden rounded-xl bg-transparent";

export const BADGE_IMAGE_POPUP_CLASS =
  "h-full w-full object-contain p-0 drop-shadow-sm";
