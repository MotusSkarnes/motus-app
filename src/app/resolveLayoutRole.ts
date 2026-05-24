import type { AppState } from "./types";

/** UI layout role. Trainers may preview the member app via `appState.role`. */
export function resolveLayoutRole(state: Pick<AppState, "role" | "currentUser">): AppState["role"] {
  if (state.currentUser?.role === "trainer") return state.role;
  return state.currentUser?.role ?? state.role;
}

export function isTrainerMemberPreview(state: Pick<AppState, "role" | "currentUser">): boolean {
  return state.currentUser?.role === "trainer" && resolveLayoutRole(state) === "member";
}
