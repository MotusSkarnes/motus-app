import { badgeAssetUrl, badgeUiScaleForSrc } from "../app/badgeAssets";

type BadgeImageSize = "card" | "catalog" | "hero" | "popup";

const SIZE_PX: Record<BadgeImageSize, number> = {
  card: 160,
  catalog: 140,
  hero: 208,
  popup: 248,
};

/** Luft rundt motivet i UI — smalere filer (f.eks. helgekriger) og brede får samme «pusterom». */
const FRAME_INSET_RATIO = 0.07;

type BadgeImageProps = {
  src: string;
  alt?: string;
  size?: BadgeImageSize;
  dimmed?: boolean;
  className?: string;
  loading?: "lazy" | "eager";
};

export function BadgeImage({ src, alt = "", size = "card", dimmed = false, className = "", loading = "lazy" }: BadgeImageProps) {
  const px = SIZE_PX[size];
  const pad = Math.max(4, Math.round(px * FRAME_INSET_RATIO));
  const resolvedSrc = src.includes("?v=") ? src : badgeAssetUrl(src);
  const uiScale = badgeUiScaleForSrc(resolvedSrc);
  const innerMax = px - pad * 2;
  const inner = Math.min(innerMax, Math.round(innerMax * uiScale));

  return (
    <span
      className={`relative inline-flex shrink-0 items-center justify-center ${className}`.trim()}
      style={{ width: px, height: px, boxSizing: "border-box", padding: pad }}
    >
      <img
        src={resolvedSrc}
        alt={alt}
        width={inner}
        height={inner}
        loading={loading}
        decoding="async"
        className={`motus-badge-img h-full w-full object-contain ${dimmed ? "opacity-45 grayscale" : ""}`}
      />
    </span>
  );
}
