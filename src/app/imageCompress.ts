export function readImageFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result === "string") {
        resolve(result);
        return;
      }
      reject(new Error("Kunne ikke lese bildefilen."));
    };
    reader.onerror = () => reject(new Error("Kunne ikke lese bildefilen."));
    reader.readAsDataURL(file);
  });
}

export function compressImageDataUrl(dataUrl: string, maxSide = 960, quality = 0.82): Promise<string> {
  if (!dataUrl.startsWith("data:image/")) return Promise.resolve(dataUrl);

  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
      const width = Math.max(1, Math.round(img.width * scale));
      const height = Math.max(1, Math.round(img.height * scale));
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext("2d");
      if (!context) {
        reject(new Error("Kunne ikke behandle bildefilen."));
        return;
      }
      context.drawImage(img, 0, 0, width, height);
      const compressed = canvas.toDataURL("image/jpeg", quality);
      resolve(compressed || dataUrl);
    };
    img.onerror = () => reject(new Error("Kunne ikke behandle bildefilen."));
    img.src = dataUrl;
  });
}

/** Beskjær til kvadrat (1:1) med hvit bakgrunn — brukes for øvelsesbilder. */
export function cropImageDataUrlToSquare(
  dataUrl: string,
  size = 512,
  quality = 0.88,
): Promise<string> {
  if (!dataUrl.startsWith("data:image/")) return Promise.resolve(dataUrl);

  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const cropSide = Math.min(img.width, img.height);
      const sx = Math.floor((img.width - cropSide) / 2);
      const sy = Math.floor((img.height - cropSide) / 2);
      const canvas = document.createElement("canvas");
      canvas.width = size;
      canvas.height = size;
      const context = canvas.getContext("2d");
      if (!context) {
        reject(new Error("Kunne ikke behandle bildefilen."));
        return;
      }
      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, size, size);
      context.drawImage(img, sx, sy, cropSide, cropSide, 0, 0, size, size);
      const mime = dataUrl.includes("image/png") ? "image/png" : "image/jpeg";
      const out =
        mime === "image/png"
          ? canvas.toDataURL("image/png")
          : canvas.toDataURL("image/jpeg", quality);
      resolve(out || dataUrl);
    };
    img.onerror = () => reject(new Error("Kunne ikke behandle bildefilen."));
    img.src = dataUrl;
  });
}

export async function compressImageFile(file: File, maxSide = 960, quality = 0.82): Promise<string> {
  const original = await readImageFileAsDataUrl(file);
  return compressImageDataUrl(original, maxSide, quality);
}

/** Kvadratisk 1:1 + komprimering — standard for øvelsesbank-bilder. */
export async function prepareExerciseIllustrationFile(
  file: File,
  size = 512,
  quality = 0.88,
): Promise<string> {
  const original = await readImageFileAsDataUrl(file);
  return cropImageDataUrlToSquare(original, size, quality);
}

export function dataUrlToBlob(dataUrl: string): Blob | null {
  const parts = dataUrl.split(",");
  if (parts.length < 2) return null;
  const mimeMatch = parts[0].match(/data:(.*?);base64/);
  const mime = mimeMatch?.[1] ?? "image/jpeg";
  try {
    const binary = atob(parts[1]);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) {
      bytes[i] = binary.charCodeAt(i);
    }
    return new Blob([bytes], { type: mime });
  } catch {
    return null;
  }
}
