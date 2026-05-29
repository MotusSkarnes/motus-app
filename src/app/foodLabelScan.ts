import { compressImageFile } from "./imageCompress";
import { parseFoodLabelScanResult, type FoodLabelScanResult } from "./foodLabelScanTypes";
import { readSupabaseFunctionInvokeError } from "./supabaseFunctionErrors";
import { isSupabaseConfigured, supabaseClient } from "../services/supabaseClient";

export type ExtractNutritionLabelResult =
  | { ok: true; scan: FoodLabelScanResult }
  | { ok: false; error: string };

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const raw = String(reader.result ?? "");
      const comma = raw.indexOf(",");
      resolve(comma >= 0 ? raw.slice(comma + 1) : raw);
    };
    reader.onerror = () => reject(new Error("Kunne ikke lese bildefilen."));
    reader.readAsDataURL(file);
  });
}

export async function scanNutritionLabelFromFile(file: File): Promise<ExtractNutritionLabelResult> {
  if (!isSupabaseConfigured || !supabaseClient) {
    return { ok: false, error: "Sky-tjenesten er ikke tilgjengelig akkurat nå." };
  }
  try {
    const { data: sessionData, error: sessionError } = await supabaseClient.auth.getSession();
    if (sessionError || !sessionData.session?.access_token) {
      return { ok: false, error: "Du må være innlogget for å scanne etikett." };
    }
    await supabaseClient.auth.refreshSession();

    const compressed = await compressImageFile(file, 960, 0.75);
    const blob = await fetch(compressed).then((res) => res.blob());
    const base64 = await fileToBase64(new File([blob], file.name, { type: blob.type || file.type || "image/jpeg" }));
    const { data, error } = await supabaseClient.functions.invoke("extract-nutrition-label", {
      body: {
        imageBase64: base64,
        mimeType: blob.type || file.type || "image/jpeg",
      },
    });
    if (error) {
      return { ok: false, error: await readSupabaseFunctionInvokeError(error, data) };
    }
    const payload = data as { ok?: boolean; result?: unknown; error?: string };
    if (!payload?.ok) {
      return { ok: false, error: String(payload?.error ?? "Kunne ikke lese etiketten.") };
    }
    const scan = parseFoodLabelScanResult(payload.result);
    if (!scan) return { ok: false, error: "Ugyldig svar fra etikettleser." };
    return { ok: true, scan };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Kunne ikke lese etiketten.";
    return { ok: false, error: message };
  }
}

export async function scanNutritionLabelFromDataUrl(dataUrl: string): Promise<ExtractNutritionLabelResult> {
  const response = await fetch(dataUrl);
  const blob = await response.blob();
  const file = new File([blob], "label.jpg", { type: blob.type || "image/jpeg" });
  return scanNutritionLabelFromFile(file);
}
