type FoodImageFieldProps = {
  imageUrl: string;
  imageEmoji: string;
  onImageUrlChange: (url: string) => void;
  onImageEmojiChange: (emoji: string) => void;
  onUploadFile: (file: File) => void | Promise<void>;
  isUploading?: boolean;
  disabled?: boolean;
};

export function FoodImageField({
  imageUrl,
  imageEmoji,
  onImageUrlChange,
  onImageEmojiChange,
  onUploadFile,
  isUploading = false,
  disabled = false,
}: FoodImageFieldProps) {
  const hasPhoto = Boolean(imageUrl.trim());

  return (
    <div className="motus-foodbank-image-field">
      <span className="motus-foodbank-field-label">Bilde</span>
      <p className="motus-foodbank-image-field-hint">Last opp foto, eller bruk emoji hvis du ikke har bilde.</p>
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
            {isUploading ? "Behandler bilde…" : "Last opp bilde"}
          </span>
        </label>
        {hasPhoto ? (
          <button type="button" className="motus-foodbank-image-remove" disabled={disabled || isUploading} onClick={() => onImageUrlChange("")}>
            Fjern bilde
          </button>
        ) : null}
      </div>
      <div className="motus-foodbank-image-preview-row">
        {hasPhoto ? (
          <img src={imageUrl} alt="" className="motus-foodbank-image-preview" />
        ) : (
          <div className="motus-foodbank-image-preview motus-foodbank-image-preview--emoji" aria-hidden>
            {imageEmoji.trim() || "🍽️"}
          </div>
        )}
        <label className="motus-foodbank-field motus-foodbank-field--grow">
          <span className="motus-foodbank-field-label">Emoji (uten bilde)</span>
          <input
            className="motus-foodbank-emoji-input"
            value={imageEmoji}
            disabled={disabled || isUploading || hasPhoto}
            onChange={(event) => onImageEmojiChange(event.target.value)}
            placeholder="🍽️"
            maxLength={8}
          />
        </label>
      </div>
    </div>
  );
}
