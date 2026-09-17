import { RecipePhoto } from "./RecipePhoto";

type RecipeImageFieldProps = {
  imageUrl: string;
  onImageUrlChange: (url: string) => void;
  onUploadFile: (file: File) => void | Promise<void>;
  isUploading?: boolean;
  disabled?: boolean;
};

export function RecipeImageField({
  imageUrl,
  onImageUrlChange,
  onUploadFile,
  isUploading = false,
  disabled = false,
}: RecipeImageFieldProps) {
  const hasPhoto = Boolean(imageUrl.trim());

  return (
    <div className="motus-foodbank-image-field">
      <span className="motus-foodbank-field-label">Bilde på måltid</span>
      <p className="motus-foodbank-image-field-hint">
        Valgfritt. Vises i 5:4 (litt bredere enn høyt) i måltidslisten, på detaljsiden og i matplanen — samme beskjæring overalt.
      </p>
      <div className="motus-foodbank-image-field-row">
        <label className="motus-foodbank-image-upload">
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            disabled={disabled || isUploading}
            onChange={(event) => {
              const file = event.currentTarget.files?.[0] ?? null;
              if (file) void onUploadFile(file);
              event.currentTarget.value = "";
            }}
          />
          <span className={disabled || isUploading ? "is-disabled" : ""}>
            {isUploading ? "Behandler bilde…" : hasPhoto ? "Bytt bilde" : "Last opp bilde"}
          </span>
        </label>
        {hasPhoto ? (
          <button
            type="button"
            className="motus-foodbank-image-remove"
            disabled={disabled || isUploading}
            onClick={() => onImageUrlChange("")}
          >
            Fjern bilde
          </button>
        ) : null}
      </div>
      {hasPhoto ? <RecipePhoto src={imageUrl} size="preview" alt="" /> : null}
    </div>
  );
}
