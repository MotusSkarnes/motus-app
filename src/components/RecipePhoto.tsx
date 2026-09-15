import { Soup } from "lucide-react";
import "../foodbank.css";

export type RecipePhotoSize = "hero" | "card" | "preview" | "tile" | "thumb" | "swap";

type RecipePhotoProps = {
  src?: string | null;
  alt?: string;
  size?: RecipePhotoSize;
  className?: string;
};

/** Felles 5:4-ramme for oppskriftsbilder i liste, detalj, matplan og komponist. */
export function RecipePhoto({ src, alt = "", size = "card", className = "" }: RecipePhotoProps) {
  const url = src?.trim() ?? "";
  const iconSize = size === "hero" || size === "card" ? 56 : size === "preview" || size === "tile" ? 28 : 20;

  return (
    <div className={`motus-recipe-photo motus-recipe-photo--${size} ${className}`.trim()}>
      {url ? (
        <img src={url} alt={alt} className="motus-recipe-photo__img" loading="lazy" decoding="async" />
      ) : (
        <div className="motus-recipe-photo__placeholder" aria-hidden>
          <Soup className="text-teal-600/55" style={{ width: iconSize, height: iconSize }} strokeWidth={1.5} />
        </div>
      )}
    </div>
  );
}
