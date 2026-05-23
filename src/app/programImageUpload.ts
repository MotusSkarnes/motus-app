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

  const extension = file.name.split(".").pop()?.toLowerCase() || "jpg";
  const imagePath = `${PROGRAM_IMAGE_PREFIX}/${uid("program-cover")}.${extension}`;
  const { error: uploadError } = await upload(imagePath, file, { cacheControl: "3600", upsert: false });
  if (uploadError) {
    return { ok: false, message: uploadError.message };
  }
  const publicUrl = getPublicUrl(imagePath);
  if (!publicUrl) {
    return { ok: false, message: "Mangler offentlig URL for opplastet bilde." };
  }
  return { ok: true, publicUrl };
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
