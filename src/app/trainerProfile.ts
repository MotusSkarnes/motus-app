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

/** Samme navn som vises i PT-kort under Innstillinger (fullt navn fra auth metadata). */
export function trainerDisplayNameFromAuthMetadata(
  metadata: Record<string, unknown> | null | undefined,
  email?: string | null,
): string {
  const fullName = String(metadata?.full_name ?? metadata?.name ?? "").trim();
  if (fullName && fullName !== "Bruker" && !fullName.includes("@")) return fullName;

  const normalizedEmail = String(email ?? "").trim().toLowerCase();
  const localPart = (normalizedEmail.split("@")[0] ?? "").replace(/[._-]+/g, " ").trim();
  if (!localPart) return "";
  return localPart
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function resolveMemberTrainerDisplayName(
  member: { id: string; ownerUserId?: string; assignedTrainerName?: string },
  programs: Array<{ memberId: string; ownerUserId?: string; assignedTrainerName?: string }>,
): string | undefined {
  const fromMember = member.assignedTrainerName?.trim();
  if (fromMember) return fromMember;

  const ownerUserId = member.ownerUserId?.trim();
  const fromProgram = programs
    .filter((program) => program.memberId === member.id)
    .map((program) => program.assignedTrainerName?.trim() ?? "")
    .find(Boolean);
  if (fromProgram) return fromProgram;

  if (!ownerUserId) return undefined;
  const fromOwnerProgram = programs
    .filter((program) => program.ownerUserId === ownerUserId)
    .map((program) => program.assignedTrainerName?.trim() ?? "")
    .find(Boolean);
  return fromOwnerProgram || undefined;
}
