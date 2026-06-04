import { PROGRAM_COVER_DISPLAY_ASPECT } from "../app/programImage";
import { imageObjectPositionFromSrc } from "../app/imageFocalPoint";

type ProgramCoverImageFieldProps = {
  imageUrl: string;
  onImageUrlChange: (url: string) => void;
  onUploadFile: (file: File) => void | Promise<void>;
  isUploading?: boolean;
  disabled?: boolean;
};

export function ProgramCoverImageField({
  imageUrl,
  onImageUrlChange,
  onUploadFile,
  isUploading = false,
  disabled = false,
}: ProgramCoverImageFieldProps) {
  return (
    <div className="space-y-2 rounded-xl border bg-slate-50/70 p-3" style={{ borderColor: "rgba(15,23,42,0.08)" }}>
      <div className="text-xs font-semibold text-slate-700">Programbilde (valgfritt)</div>
      <p className="text-[11px] leading-relaxed text-slate-500">
        Beskjæres til bredt banner (ca. 3:1) som på programkort. Plasser hovedmotivet midt i bildet. Uten bilde brukes første
        øvelse.
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <label className="inline-flex">
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            disabled={disabled || isUploading}
            onChange={(event) => {
              const selectedFile = event.currentTarget.files?.[0] ?? null;
              if (selectedFile) void onUploadFile(selectedFile);
              event.currentTarget.value = "";
            }}
          />
          <span
            className={`cursor-pointer rounded-xl px-3 py-2 text-xs font-medium ${
              disabled || isUploading ? "bg-slate-200 text-slate-500" : "bg-slate-900 text-white"
            }`}
          >
            {isUploading ? "Laster opp…" : "Last opp bilde"}
          </span>
        </label>
        {imageUrl.trim() ? (
          <button
            type="button"
            className="rounded-xl border px-3 py-2 text-xs font-medium text-slate-600 hover:bg-white"
            style={{ borderColor: "rgba(15,23,42,0.12)" }}
            disabled={disabled || isUploading}
            onClick={() => onImageUrlChange("")}
          >
            Fjern bilde
          </button>
        ) : null}
        <div className="text-xs text-slate-500">JPG/PNG/WEBP, maks 5 MB.</div>
      </div>
      {imageUrl.trim() ? (
        <div
          className="w-full max-w-md overflow-hidden rounded-xl border bg-slate-900"
          style={{ borderColor: "rgba(15,23,42,0.08)", aspectRatio: PROGRAM_COVER_DISPLAY_ASPECT }}
        >
          <img
            src={imageUrl}
            alt="Forhåndsvisning av programbilde"
            className="h-full w-full object-cover"
            style={{ objectPosition: imageObjectPositionFromSrc(imageUrl) }}
          />
        </div>
      ) : null}
    </div>
  );
}
