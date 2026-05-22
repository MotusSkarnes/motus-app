/** Felles visning av badge-PNG (transparent bakgrunn etter normalisering). */

/** Stor badge øverst i medlemsoversikten — full størrelse uten scale-nedskalering. */
export const BADGE_IMAGE_HERO_WRAPPER_CLASS =
  "relative mx-auto flex h-[min(72vw,15rem)] w-[min(72vw,15rem)] max-h-60 max-w-60 items-center justify-center overflow-visible";

export const BADGE_IMAGE_HERO_CLASS = "h-full w-full object-contain object-center drop-shadow-md";

/** Liten miniatyr i karusellkort (valgfritt). */
export const BADGE_IMAGE_THUMB_WRAPPER_CLASS =
  "flex h-14 w-14 shrink-0 items-center justify-center overflow-visible rounded-lg bg-transparent p-1";

export const BADGE_IMAGE_THUMB_CLASS = "h-full w-full object-contain object-center drop-shadow-sm";

/** PT-katalog og eldre steder — medium størrelse. */
export const BADGE_IMAGE_BOX_CLASS = "h-24 w-24";

export const BADGE_IMAGE_WRAPPER_CLASS =
  `${BADGE_IMAGE_BOX_CLASS} relative flex shrink-0 items-center justify-center overflow-visible rounded-xl bg-transparent p-2`;

export const BADGE_IMAGE_CLASS = "h-full w-full object-contain object-center drop-shadow-sm";

export const BADGE_IMAGE_POPUP_WRAPPER_CLASS =
  "mx-auto mt-4 flex h-48 w-48 items-center justify-center overflow-visible rounded-xl bg-transparent p-3";

export const BADGE_IMAGE_POPUP_CLASS = "h-full w-full object-contain object-center drop-shadow-md";

/** Horisontal scroll uten å klippe badge-høyde (overflow-x-auto setter ellers overflow-y til auto). */
export const BADGE_CAROUSEL_SCROLL_CLASS = "overflow-x-auto overflow-y-visible";
