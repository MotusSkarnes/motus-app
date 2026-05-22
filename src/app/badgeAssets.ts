/** Felles badge-bilder (PNG 1024×1024, normalisert visuell størrelse). */
export const MEMBER_BADGE_IMAGE_BY_ID: Record<string, string> = {
  sessions: "/badges/02-oktjeger.png",
  "workout-club": "/badges/32-100-klubben.png",
  streak: "/badges/08-streak.png",
  "monday-hero": "/badges/30-mandagshelt.png",
  "weekend-warrior": "/badges/31-helgekriger.png",
  lift: "/badges/11-tungvekter.png",
  "month-sessions": "/badges/07-vanebygger.png",
  "training-days": "/badges/13-konsistent.png",
  "goal-percent": "/badges/01-forste-steg.png",
  pulsmaskin: "/badges/33-pulsmaskin.png",
  "may-17-workout": "/badges/21-17-mai.png",
  "never-two-weeks-without": "/badges/22-aldri-to-uker-uten.png",
  "back-again": "/badges/23-tilbake-igjen.png",
  "habit-sticks": "/badges/24-vanen-sitter.png",
  "before-sunrise": "/badges/25-for-sola.png",
  "evening-trainer": "/badges/04-kveldsskiftet.png",
  "summer-loyal": "/badges/26-sommertrofast.png",
  "new-start": "/badges/27-ny-start.png",
  "easter-pump": "/badges/28-paskepump.png",
  "christmas-pump": "/badges/29-julepump.png",
};

export const HIDDEN_MEMBER_BADGE_IMAGE_BY_ID: Record<string, string> = {
  "may-17-workout": MEMBER_BADGE_IMAGE_BY_ID["may-17-workout"],
  "never-two-weeks-without": MEMBER_BADGE_IMAGE_BY_ID["never-two-weeks-without"],
  "back-again": MEMBER_BADGE_IMAGE_BY_ID["back-again"],
  "habit-sticks": MEMBER_BADGE_IMAGE_BY_ID["habit-sticks"],
  "before-sunrise": MEMBER_BADGE_IMAGE_BY_ID["before-sunrise"],
  "evening-trainer": MEMBER_BADGE_IMAGE_BY_ID["evening-trainer"],
  "summer-loyal": MEMBER_BADGE_IMAGE_BY_ID["summer-loyal"],
  "new-start": MEMBER_BADGE_IMAGE_BY_ID["new-start"],
  "easter-pump": MEMBER_BADGE_IMAGE_BY_ID["easter-pump"],
  "christmas-pump": MEMBER_BADGE_IMAGE_BY_ID["christmas-pump"],
};

export function memberBadgeImageSrc(badgeId: string): string {
  return MEMBER_BADGE_IMAGE_BY_ID[badgeId] ?? "/badges/01-forste-steg.png";
}
