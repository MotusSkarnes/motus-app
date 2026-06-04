import { useId, useMemo } from "react";
import { resolveProgramCoverDisplayUrl } from "../app/programImage";
import {
  applyImageFocalPointToSrc,
  parseImageFocalPointFromSrc,
  programCustomCoverImageStyle,
  type ImageFocalPoint,
} from "../app/imageFocalPoint";

type ProgramCoverThumbnailProps = {
  src: string;
  alt?: string;
  className?: string;
  /** Når satt: vis glidebrytere som oppdaterer fx/fy i URL (lagres med programmet). */
  onFocalPointChange?: (nextUrl: string) => void;
};

/** Samme bilderamme som kundens programkort på mobil (full bredde × 118px). */
export function ProgramCoverThumbnail({ src, alt = "", className = "", onFocalPointChange }: ProgramCoverThumbnailProps) {
  const controlId = useId();
  const displaySrc = resolveProgramCoverDisplayUrl(src.trim());
  const focal = useMemo(() => parseImageFocalPointFromSrc(src), [src]);
  if (!displaySrc) return null;

  const updateFocal = (patch: Partial<ImageFocalPoint>) => {
    if (!onFocalPointChange) return;
    onFocalPointChange(
      applyImageFocalPointToSrc(src, {
        focalX: patch.focalX ?? focal.focalX,
        focalY: patch.focalY ?? focal.focalY,
      }),
    );
  };

  return (
    <div className={`motus-program-cover-trainer-preview ${className}`.trim()}>
      <div className="motus-member-program-thumb motus-image-frame">
        <img
          src={displaySrc}
          alt={alt}
          className="motus-member-program-cover motus-member-program-cover--custom motus-image-media"
          style={programCustomCoverImageStyle(src)}
        />
      </div>
      {onFocalPointChange ? (
        <div className="mt-2 space-y-2 rounded-lg border bg-white/80 p-2.5" style={{ borderColor: "rgba(15,23,42,0.08)" }}>
          <div className="text-[11px] font-semibold text-slate-700">Juster utsnitt i forhåndsvisning</div>
          <label className="block space-y-1" htmlFor={`${controlId}-fx`}>
            <span className="flex justify-between text-[10px] text-slate-500">
              <span>Venstre – høyre</span>
              <span>{Math.round(focal.focalX * 100)}%</span>
            </span>
            <input
              id={`${controlId}-fx`}
              type="range"
              min={0}
              max={100}
              value={Math.round(focal.focalX * 100)}
              className="w-full accent-slate-800"
              onChange={(event) => updateFocal({ focalX: Number(event.target.value) / 100 })}
            />
          </label>
          <label className="block space-y-1" htmlFor={`${controlId}-fy`}>
            <span className="flex justify-between text-[10px] text-slate-500">
              <span>Opp – ned</span>
              <span>{Math.round(focal.focalY * 100)}%</span>
            </span>
            <input
              id={`${controlId}-fy`}
              type="range"
              min={0}
              max={100}
              value={Math.round(focal.focalY * 100)}
              className="w-full accent-slate-800"
              onChange={(event) => updateFocal({ focalY: Number(event.target.value) / 100 })}
            />
          </label>
          <p className="text-[10px] leading-relaxed text-slate-500">
            Midtstilt visning uten innzoom. Mot kant zoomes det litt for å nå ytterkant. Lagre programmet etter justering.
            Last opp på nytt for mest panerom.
          </p>
        </div>
      ) : (
        <p className="mt-1.5 text-[10px] leading-relaxed text-slate-500">
          Forhåndsvisning som på kundens programkort (ca. 390 px bred mobil). Smalere eller bredere telefoner kan beskjære
          litt annerledes i kantene.
        </p>
      )}
    </div>
  );
}
