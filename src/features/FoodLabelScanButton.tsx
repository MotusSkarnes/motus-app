import { useRef, useState } from "react";
import { Camera } from "lucide-react";
import { scanNutritionLabelFromFile } from "../app/foodLabelScan";
import type { FoodLabelScanResult } from "../app/foodLabelScanTypes";
import { OutlineButton } from "../app/ui";

type FoodLabelScanButtonProps = {
  onScanned: (result: FoodLabelScanResult, imageDataUrl: string) => void;
  onError?: (message: string) => void;
  disabled?: boolean;
  label?: string;
};

export function FoodLabelScanButton({
  onScanned,
  onError,
  disabled = false,
  label = "Scan etikett",
}: FoodLabelScanButtonProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [loading, setLoading] = useState(false);

  const handleFile = async (file: File | null) => {
    if (!file || loading) return;
    setLoading(true);
    try {
      const reader = new FileReader();
      const imageDataUrl = await new Promise<string>((resolve, reject) => {
        reader.onload = () => resolve(String(reader.result ?? ""));
        reader.onerror = () => reject(new Error("Kunne ikke lese bildet."));
        reader.readAsDataURL(file);
      });
      const result = await scanNutritionLabelFromFile(file);
      if (!result.ok) {
        onError?.(result.error);
        return;
      }
      onScanned(result.scan, imageDataUrl);
    } catch (err) {
      onError?.(err instanceof Error ? err.message : "Kunne ikke lese etiketten.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        capture="environment"
        className="hidden"
        onChange={(event) => {
          const file = event.currentTarget.files?.[0] ?? null;
          void handleFile(file);
          event.currentTarget.value = "";
        }}
      />
      <OutlineButton
        type="button"
        disabled={disabled || loading}
        onClick={() => inputRef.current?.click()}
      >
        <Camera className="h-4 w-4" aria-hidden />
        {loading ? "Leser etikett…" : label}
      </OutlineButton>
    </>
  );
}
