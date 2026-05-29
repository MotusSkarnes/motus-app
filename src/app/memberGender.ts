export type MemberGender = "" | "female" | "male";

export function normalizeMemberGender(value: unknown): MemberGender {
  const raw = String(value ?? "").trim().toLowerCase();
  if (raw === "female" || raw === "kvinne" || raw === "f") return "female";
  if (raw === "male" || raw === "mann" || raw === "m") return "male";
  return "";
}

export function memberGenderLabel(gender: MemberGender): string {
  if (gender === "female") return "Kvinne";
  if (gender === "male") return "Mann";
  return "Ikke satt";
}
