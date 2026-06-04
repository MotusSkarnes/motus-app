import { resolveProgramCoverDisplayUrl } from "../app/programImage";
import { imageObjectPositionFromSrc } from "../app/imageFocalPoint";

type ProgramCoverThumbnailProps = {
  src: string;
  alt?: string;
  className?: string;
};

/** Samme bilderamme som kundens programkort på mobil (full bredde × 118px). */
export function ProgramCoverThumbnail({ src, alt = "", className = "" }: ProgramCoverThumbnailProps) {
  const displaySrc = resolveProgramCoverDisplayUrl(src.trim());
  if (!displaySrc) return null;

  return (
    <div className={`motus-program-cover-trainer-preview ${className}`.trim()}>
      <div className="motus-member-program-thumb motus-image-frame">
        <img
          src={displaySrc}
          alt={alt}
          className="motus-member-program-cover motus-image-media"
          style={{ objectPosition: imageObjectPositionFromSrc(displaySrc) }}
        />
      </div>
      <p className="mt-1.5 text-[10px] leading-relaxed text-slate-500">
        Forhåndsvisning som på kundens programkort (ca. 390 px bred mobil). Smalere eller bredere telefoner kan beskjære
        litt annerledes i kantene.
      </p>
    </div>
  );
}
