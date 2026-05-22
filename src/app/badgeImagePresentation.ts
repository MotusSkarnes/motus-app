/** Felles visning av badge-PNG med «falsk» svart bakgrunn fra eksport. */
export const BADGE_IMAGE_BOX_CLASS = "h-[5.4rem] w-[5.4rem]";

export const BADGE_IMAGE_WRAPPER_CLASS =
  `${BADGE_IMAGE_BOX_CLASS} overflow-hidden rounded-xl bg-white`;

/** lighten på hvit flate gjør nesten-svarte piksler gjennomsiktige visuelt. */
export const BADGE_IMAGE_CLASS =
  "h-full w-full object-contain p-1.5 drop-shadow-sm mix-blend-lighten";

export const BADGE_IMAGE_POPUP_WRAPPER_CLASS =
  "mx-auto mt-4 flex h-36 w-36 items-center justify-center overflow-hidden rounded-xl bg-white";

export const BADGE_IMAGE_POPUP_CLASS =
  "h-full w-full object-contain p-1.5 drop-shadow-sm mix-blend-lighten";
