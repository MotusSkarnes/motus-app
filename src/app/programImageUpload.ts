import { uid } from "./storage";
import {
  ALLOWED_PROGRAM_IMAGE_TYPES,
  MAX_PROGRAM_IMAGE_BYTES,
  PROGRAM_IMAGE_BUCKET,
  PROGRAM_IMAGE_PREFIX,
} from "./programImage";

type UploadProgramImageResult =
  | { ok: true; publicUrl: string }
  | { ok: false; message: string };

type ProgramImageVariant = {
  key: "hero" | "portrait" | "square";
  width: number;
  height: number;
};

/** Format programkort bruker (bredt banner). */
export const PRIMARY_PROGRAM_COVER_VARIANT = "hero" as const;

const PROGRAM_IMAGE_VARIANTS: ProgramImageVariant[] = [
  { key: "hero", width: 1600, height: 550 },
  { key: "portrait", width: 900, height: 1200 },
  { key: "square", width: 1000, height: 1000 },
];

type FocalPoint = {
  focalX: number;
  focalY: number;
};

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0.5;
  return Math.min(1, Math.max(0, value));
}

async function loadImageBitmap(file: File): Promise<ImageBitmap | HTMLImageElement> {
  if ("createImageBitmap" in window) {
    return window.createImageBitmap(file);
  }

  return new Promise((resolve, reject) => {
    const image = new Image();
    const url = URL.createObjectURL(file);
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Kunne ikke lese bildet."));
    };
    image.src = url;
  });
}

async function detectFocalPoint(image: ImageBitmap | HTMLImageElement): Promise<FocalPoint> {
  const fallback = { focalX: 0.5, focalY: 0.32 };
  const maybeWindow = window as typeof window & {
    FaceDetector?: new (options?: { fastMode?: boolean; maxDetectedFaces?: number }) => {
      detect: (source: ImageBitmap | HTMLImageElement) => Promise<Array<{ boundingBox: DOMRectReadOnly }>>;
    };
  };

  if (!maybeWindow.FaceDetector) return fallback;

  try {
    const detector = new maybeWindow.FaceDetector({ fastMode: true, maxDetectedFaces: 1 });
    const faces = await detector.detect(image);
    const face = faces[0]?.boundingBox;
    if (!face) return fallback;
    const width = "width" in image ? image.width : fallback.focalX;
    const height = "height" in image ? image.height : fallback.focalY;
    return {
      focalX: clamp01((face.x + face.width / 2) / width),
      focalY: clamp01((face.y + face.height * 0.42) / height),
    };
  } catch {
    return fallback;
  }
}

async function createCroppedImageFile(
  source: ImageBitmap | HTMLImageElement,
  variant: ProgramImageVariant,
  focalPoint: FocalPoint,
): Promise<File> {
  const sourceWidth = source.width;
  const sourceHeight = source.height;
  const targetRatio = variant.width / variant.height;
  const sourceRatio = sourceWidth / sourceHeight;
  let cropWidth = sourceWidth;
  let cropHeight = sourceHeight;

  if (sourceRatio > targetRatio) {
    cropWidth = sourceHeight * targetRatio;
  } else {
    cropHeight = sourceWidth / targetRatio;
  }

  const focalX = sourceWidth * focalPoint.focalX;
  const focalY = sourceHeight * focalPoint.focalY;
  const cropX = Math.min(sourceWidth - cropWidth, Math.max(0, focalX - cropWidth / 2));
  const cropY = Math.min(sourceHeight - cropHeight, Math.max(0, focalY - cropHeight / 2));
  const canvas = document.createElement("canvas");
  canvas.width = variant.width;
  canvas.height = variant.height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Kunne ikke behandle bildet.");

  context.drawImage(source, cropX, cropY, cropWidth, cropHeight, 0, 0, variant.width, variant.height);

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.86));
  if (!blob) throw new Error("Kunne ikke lage bildevariant.");
  return new File([blob], `motus-${variant.key}.jpg`, { type: "image/jpeg" });
}

function appendFocalPointToUrl(url: string, focalPoint: FocalPoint): string {
  const separator = url.includes("?") ? "&" : "?";
  return `${url}${separator}fx=${focalPoint.focalX.toFixed(3)}&fy=${focalPoint.focalY.toFixed(3)}`;
}

export async function uploadProgramCoverImage(
  file: File,
  upload: (path: string, file: File, options: { cacheControl: string; upsert: boolean }) => Promise<{ error: { message: string } | null }>,
  getPublicUrl: (path: string) => string | null,
): Promise<UploadProgramImageResult> {
  if (!ALLOWED_PROGRAM_IMAGE_TYPES.has(file.type)) {
    return { ok: false, message: "Kun JPG, PNG eller WEBP er tillatt." };
  }
  if (file.size > MAX_PROGRAM_IMAGE_BYTES) {
    return { ok: false, message: "Bildet er for stort. Maks størrelse er 5 MB." };
  }

  const imageId = uid("program-cover");
  try {
    const source = await loadImageBitmap(file);
    const focalPoint = await detectFocalPoint(source);
    let primaryPublicUrl: string | null = null;

    for (const variant of PROGRAM_IMAGE_VARIANTS) {
      const variantFile = await createCroppedImageFile(source, variant, focalPoint);
      const variantPath = `${PROGRAM_IMAGE_PREFIX}/${imageId}-${variant.key}.jpg`;
      const { error: uploadError } = await upload(variantPath, variantFile, { cacheControl: "31536000", upsert: false });
      if (uploadError) return { ok: false, message: uploadError.message };
      if (variant.key === PRIMARY_PROGRAM_COVER_VARIANT) {
        primaryPublicUrl = getPublicUrl(variantPath);
      }
    }

    if (!primaryPublicUrl) {
      return { ok: false, message: "Mangler offentlig URL for opplastet bilde." };
    }
    return { ok: true, publicUrl: appendFocalPointToUrl(primaryPublicUrl, focalPoint) };
  } catch {
    const extension = file.name.split(".").pop()?.toLowerCase() || "jpg";
    const imagePath = `${PROGRAM_IMAGE_PREFIX}/${imageId}.${extension}`;
    const { error: uploadError } = await upload(imagePath, file, { cacheControl: "3600", upsert: false });
    if (uploadError) {
      return { ok: false, message: uploadError.message };
    }
    const publicUrl = getPublicUrl(imagePath);
    if (!publicUrl) {
      return { ok: false, message: "Mangler offentlig URL for opplastet bilde." };
    }
    return { ok: true, publicUrl: appendFocalPointToUrl(publicUrl, { focalX: 0.5, focalY: 0.32 }) };
  }
}

export async function uploadProgramCoverImageToSupabase(
  file: File,
  supabaseClient: {
    storage: {
      from: (bucket: string) => {
        upload: (
          path: string,
          body: File,
          options: { cacheControl: string; upsert: boolean },
        ) => Promise<{ error: { message: string } | null }>;
        getPublicUrl: (path: string) => { data: { publicUrl?: string } };
      };
    };
  },
): Promise<UploadProgramImageResult> {
  return uploadProgramCoverImage(
    file,
    (path, body, options) => supabaseClient.storage.from(PROGRAM_IMAGE_BUCKET).upload(path, body, options),
    (path) => supabaseClient.storage.from(PROGRAM_IMAGE_BUCKET).getPublicUrl(path).data.publicUrl ?? null,
  );
}
