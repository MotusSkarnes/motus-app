export const MEMBER_GOAL_OPTIONS = [
  "Bli sterkere",
  "Bygge muskler",
  "Øke i vekt",
  "Gå ned i vekt",
  "Generelt bedre helse",
] as const;

export type MemberGoalOption = (typeof MEMBER_GOAL_OPTIONS)[number];
