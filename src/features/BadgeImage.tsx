import { badgeAssetUrl } from "../app/badgeAssets";

type BadgeImageSize = "card" | "catalog" | "hero" | "popup";

/** Stor visning — PNG har egen transparent kant etter normalisering. */
const SIZE_PX: Record<BadgeImageSize, number> = {
  card: 200,
  catalog: 176,
  hero: 240,
  popup: 280,
};

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
  const resolvedSrc = src.includes("?v=") ? src : badgeAssetUrl(src);

  return (
    <img
      src={resolvedSrc}
      alt={alt}
      width={px}
      height={px}
      loading={loading}
      decoding="async"
      className={`motus-badge-img shrink-0 object-contain ${dimmed ? "opacity-45 grayscale" : ""} ${className}`.trim()}
      style={{ width: px, height: px, maxWidth: px, maxHeight: px }}
    />
  );
}
