export const TRAINER_PROFILE_METADATA_KEY = "motus_trainer_profile";

export type TrainerProfile = {
  phone: string;
  title: string;
  focus: string;
  bio: string;
  vacation: TrainerVacation;
};

export type TrainerVacation = {
  enabled: boolean;
  startDate: string;
  endDate: string;
  message: string;
};

export type TrainerVacationNotice = {
  title: string;
  detail: string;
};

export function emptyTrainerProfile(): TrainerProfile {
  return {
    phone: "",
    title: "",
    focus: "",
    bio: "",
    vacation: emptyTrainerVacation(),
  };
}

export function emptyTrainerVacation(): TrainerVacation {
  return {
    enabled: false,
    startDate: "",
    endDate: "",
    message: "",
  };
}

function parseDateOnlyMs(value: string, endOfDay = false): number | null {
  const match = value.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]) - 1;
  const day = Number(match[3]);
  const date = endOfDay ? new Date(year, month, day, 23, 59, 59, 999) : new Date(year, month, day);
  const ms = date.getTime();
  return Number.isNaN(ms) ? null : ms;
}

export function parseTrainerVacation(value: unknown): TrainerVacation {
  if (!value || typeof value !== "object") return emptyTrainerVacation();
  const row = value as Record<string, unknown>;
  return {
    enabled: row.enabled === true,
    startDate: String(row.startDate ?? row.start_date ?? "").trim(),
    endDate: String(row.endDate ?? row.end_date ?? "").trim(),
    message: String(row.message ?? "").trim(),
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
    vacation: parseTrainerVacation(row.vacation ?? row.trainerVacation),
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
    vacation: {
      enabled: profile.vacation.enabled === true,
      startDate: profile.vacation.startDate.trim(),
      endDate: profile.vacation.endDate.trim(),
      message: profile.vacation.message.trim(),
    },
  };
}

export function buildTrainerVacationNotice(
  vacation: TrainerVacation | undefined,
  nowDate = new Date(),
): TrainerVacationNotice | null {
  if (!vacation?.enabled) return null;
  const startMs = parseDateOnlyMs(vacation.startDate);
  const endMs = parseDateOnlyMs(vacation.endDate, true);
  if (startMs === null || endMs === null || endMs < startMs) return null;

  const nowMs = nowDate.getTime();
  if (nowMs < startMs || nowMs > endMs) return null;

  const formatter = new Intl.DateTimeFormat("nb-NO", { day: "numeric", month: "long" });
  const startLabel = formatter.format(new Date(startMs));
  const endLabel = formatter.format(new Date(endMs));
  const range = startLabel === endLabel ? startLabel : `${startLabel} til ${endLabel}`;
  const message = vacation.message.trim();
  return {
    title: "Trener er ikke tilgjengelig.",
    detail: message
      ? `Treneren din er på ferie fra ${range}. ${message}`
      : `Treneren din er på ferie fra ${range}. Du kan fortsatt sende melding, men svar kan ta litt lenger tid.`,
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
