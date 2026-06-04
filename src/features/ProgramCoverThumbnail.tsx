import { useId, useMemo } from "react";
import { resolveProgramCoverDisplayUrl } from "../app/programImage";
import {
  applyImageFocalPointToSrc,
  parseProgramCoverFrameFromSrc,
  programCustomCoverImageStyle,
  type ProgramCoverFrame,
} from "../app/imageFocalPoint";
import { PROGRAM_COVER_ZOOM_MAX, PROGRAM_COVER_ZOOM_MIN } from "../app/programImage";

type ProgramCoverThumbnailProps = {
  src: string;
  alt?: string;
  className?: string;
  onFocalPointChange?: (nextUrl: string) => void;
};

/** Samme bilderamme som kundens programkort på mobil (full bredde × 118px). */
export function ProgramCoverThumbnail({ src, alt = "", className = "", onFocalPointChange }: ProgramCoverThumbnailProps) {
  const controlId = useId();
  const displaySrc = resolveProgramCoverDisplayUrl(src.trim());
  const frame = useMemo(() => parseProgramCoverFrameFromSrc(src), [src]);
  if (!displaySrc) return null;

  const updateFrame = (patch: Partial<ProgramCoverFrame>) => {
    if (!onFocalPointChange) return;
    onFocalPointChange(
      applyImageFocalPointToSrc(src, {
        focalX: patch.focalX ?? frame.focalX,
        focalY: patch.focalY ?? frame.focalY,
        zoom: patch.zoom ?? frame.zoom,
      }),
    );
  };

  const zoomMinPct = Math.round(PROGRAM_COVER_ZOOM_MIN * 100);
  const zoomMaxPct = Math.round(PROGRAM_COVER_ZOOM_MAX * 100);

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
          <div className="text-[11px] font-semibold text-slate-700">Juster utsnitt</div>
          <label className="block space-y-1" htmlFor={`${controlId}-zoom`}>
            <span className="flex justify-between text-[10px] text-slate-500">
              <span>Zoom ut ← → inn</span>
              <span>{Math.round(frame.zoom * 100)} %</span>
            </span>
            <input
              id={`${controlId}-zoom`}
              type="range"
              min={zoomMinPct}
              max={zoomMaxPct}
              value={Math.round(frame.zoom * 100)}
              className="w-full accent-slate-800"
              onChange={(event) => updateFrame({ zoom: Number(event.target.value) / 100 })}
            />
          </label>
          <label className="block space-y-1" htmlFor={`${controlId}-fx`}>
            <span className="flex justify-between text-[10px] text-slate-500">
              <span>Venstre – høyre</span>
              <span>{Math.round(frame.focalX * 100)} %</span>
            </span>
            <input
              id={`${controlId}-fx`}
              type="range"
              min={0}
              max={100}
              value={Math.round(frame.focalX * 100)}
              className="w-full accent-slate-800"
              onChange={(event) => updateFrame({ focalX: Number(event.target.value) / 100 })}
            />
          </label>
          <label className="block space-y-1" htmlFor={`${controlId}-fy`}>
            <span className="flex justify-between text-[10px] text-slate-500">
              <span>Opp – ned</span>
              <span>{Math.round(frame.focalY * 100)} %</span>
            </span>
            <input
              id={`${controlId}-fy`}
              type="range"
              min={0}
              max={100}
              value={Math.round(frame.focalY * 100)}
              className="w-full accent-slate-800"
              onChange={(event) => updateFrame({ focalY: Number(event.target.value) / 100 })}
            />
          </label>
          <p className="text-[10px] leading-relaxed text-slate-500">
            100 % zoom viser hele opplastet bilde. Øk zoom for å beskjære, flytt med venstre/høyre og opp/ned. Lagre
            programmet etter justering. Last opp på nytt for bilder som ble kuttet for mye tidligere.
          </p>
        </div>
      ) : (
        <p className="mt-1.5 text-[10px] leading-relaxed text-slate-500">
          Forhåndsvisning som på kundens programkort (ca. 390 px bred mobil).
        </p>
      )}
    </div>
  );
}
