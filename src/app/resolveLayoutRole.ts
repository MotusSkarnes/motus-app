import type { AppState, Member } from "./types";
import { memberRecordIsActive } from "../services/memberAccessRules";

/** UI layout role. Trainers may preview the member app via `appState.role`. */
export function resolveLayoutRole(state: Pick<AppState, "role" | "currentUser">): AppState["role"] {
  if (state.currentUser?.role === "trainer") return state.role;
  return state.currentUser?.role ?? state.role;
}

export function isTrainerMemberPreview(state: Pick<AppState, "role" | "currentUser">): boolean {
  return state.currentUser?.role === "trainer" && resolveLayoutRole(state) === "member";
}

/** Pick which client profile a trainer should open in member preview. */
export function resolveTrainerMemberPreviewId(input: {
  selectedMemberId?: string | null;
  memberViewId?: string | null;
  members: Array<Pick<Member, "id" | "customerType" | "isActive">>;
}): string {
  const selected = String(input.selectedMemberId ?? "").trim();
  if (selected && input.members.some((member) => member.id === selected && memberRecordIsActive(member))) {
    return selected;
  }
  const viewed = String(input.memberViewId ?? "").trim();
  if (viewed && input.members.some((member) => member.id === viewed && memberRecordIsActive(member))) {
    return viewed;
  }
  const active = input.members.filter((member) => memberRecordIsActive(member));
  const preferred =
    active.find((member) => member.customerType === "PT-kunde") ??
    active.find((member) => member.customerType !== "Medlem") ??
    active[0];
  return preferred?.id?.trim() ?? "";
}

/**
 * Keep trainer "Til klientvisning" open across auth token refreshes.
 * Auth events must update currentUser, but must not force role back to trainer mid-preview.
 */
export function resolveRoleAfterAuthSync(input: {
  authUserRole: AppState["role"];
  previousRole: AppState["role"];
}): AppState["role"] {
  if (input.authUserRole === "trainer" && input.previousRole === "member") {
    return "member";
  }
  return input.authUserRole;
}
