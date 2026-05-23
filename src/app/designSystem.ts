import { MOTUS } from "./data";

/** Shared Motus UI tokens — spacing, surfaces, typography scale. */
export const DS = {
  color: {
    bg: "#FFFFFF",
    bgSecondary: "#F7F8FA",
    bgTertiary: "#F3F5F7",
    border: "rgba(15, 23, 42, 0.08)",
    borderStrong: "rgba(15, 23, 42, 0.12)",
    text: MOTUS.ink,
    textSecondary: "#475569",
    textMuted: "#94a3b8",
    accent: MOTUS.turquoise,
    accentPink: MOTUS.pink,
    accentSoft: MOTUS.paleMint,
  accentText: "#0e8068",
  accentTextStrong: "#0a5f4f",
  accentBorder: "rgba(48, 227, 190, 0.28)",
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

export const MOTUS_GRADIENT = `linear-gradient(135deg, ${MOTUS.turquoise} 0%, ${MOTUS.pink} 100%)`;
export const MOTUS_GRADIENT_90 = `linear-gradient(90deg, ${MOTUS.turquoise} 0%, ${MOTUS.pink} 100%)`;
