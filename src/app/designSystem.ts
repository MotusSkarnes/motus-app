/** Motus global design tokens — single source of truth for brand colors. */
export const MOTUS_COLORS = {
  mint: "#30E3BE",
  pink: "#D91278",
  paleMint: "#D6FBF1",
  ink: "#0F172A",
} as const;

export const MOTUS_GRADIENT = `linear-gradient(90deg, ${MOTUS_COLORS.mint} 0%, ${MOTUS_COLORS.pink} 100%)`;

/** @deprecated Use MOTUS_GRADIENT — kept for imports that expect this name. */
export const MOTUS_GRADIENT_90 = MOTUS_GRADIENT;

/** Shared Motus UI tokens — spacing, surfaces, typography scale. */
export const DS = {
  color: {
    bg: "#FFFFFF",
    bgSecondary: "#F7F8FA",
    bgTertiary: "#F3F5F7",
    border: "rgba(15, 23, 42, 0.08)",
    borderStrong: "rgba(15, 23, 42, 0.12)",
    text: MOTUS_COLORS.ink,
    textSecondary: "#475569",
    textMuted: "#94A3B8",
    accent: MOTUS_COLORS.mint,
    accentPink: MOTUS_COLORS.pink,
    accentSoft: MOTUS_COLORS.paleMint,
    accentText: MOTUS_COLORS.ink,
    accentTextStrong: MOTUS_COLORS.ink,
    accentBorder: "rgba(48, 227, 190, 0.28)",
    accentPinkSoft: "rgba(217, 18, 120, 0.08)",
  },
  radius: {
    card: "16px",
    hero: "24px",
    button: "12px",
    pill: "9999px",
  },
  shadow: {
    card: "0 1px 2px rgba(15, 23, 42, 0.04), 0 4px 16px rgba(15, 23, 42, 0.04)",
    nav: "0 -1px 0 rgba(15, 23, 42, 0.06), 0 4px 20px rgba(15, 23, 42, 0.06)",
  },
  spacing: {
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 24,
    xxl: 32,
  },
} as const;
