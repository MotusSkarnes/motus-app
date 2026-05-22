/** Felles visning av badge-PNG (transparent bakgrunn etter normalisering). */
export const BADGE_IMAGE_BOX_CLASS = "h-[6.25rem] w-[6.25rem]";

export const BADGE_IMAGE_WRAPPER_CLASS =
  `${BADGE_IMAGE_BOX_CLASS} relative flex shrink-0 items-center justify-center overflow-visible rounded-xl bg-transparent`;

export const BADGE_IMAGE_CLASS = "h-full w-full object-contain object-center drop-shadow-sm";

export const BADGE_IMAGE_POPUP_WRAPPER_CLASS =
  "mx-auto mt-4 flex h-44 w-44 items-center justify-center overflow-visible rounded-xl bg-transparent p-2";

export const BADGE_IMAGE_POPUP_CLASS = "h-full w-full object-contain object-center drop-shadow-sm";

/** Horisontal scroll uten å klippe badge-høyde (overflow-x-auto setter ellers overflow-y til auto). */
export const BADGE_CAROUSEL_SCROLL_CLASS = "overflow-x-auto overflow-y-visible";
