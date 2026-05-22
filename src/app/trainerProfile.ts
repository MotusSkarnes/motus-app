export const TRAINER_PROFILE_METADATA_KEY = "motus_trainer_profile";

export type TrainerProfile = {
  phone: string;
  title: string;
  focus: string;
  bio: string;
};

export function emptyTrainerProfile(): TrainerProfile {
  return {
    phone: "",
    title: "",
    focus: "",
    bio: "",
  };
}

export function parseTrainerProfile(value: unknown): TrainerProfile {
  if (!value || typeof value !== "object") return emptyTrainerProfile();
  const row = value as Record<string, unknown>;
  return {
    phone: String(row.phone ?? "").trim(),
    title: String(row.title ?? "").trim(),
    focus: String(row.focus ?? "").trim(),
    bio: String(row.bio ?? "").trim(),
  };
}

export function trainerProfileFromUserMetadata(metadata: Record<string, unknown> | undefined | null): TrainerProfile {
  if (!metadata) return emptyTrainerProfile();
  return parseTrainerProfile(metadata[TRAINER_PROFILE_METADATA_KEY]);
}

export function serializeTrainerProfile(profile: TrainerProfile): TrainerProfile {
  return {
    phone: profile.phone.trim(),
    title: profile.title.trim(),
    focus: profile.focus.trim(),
    bio: profile.bio.trim(),
  };
}
