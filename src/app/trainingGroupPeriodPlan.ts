import { getCurrentWeekMondayISO, formatDateDdMmYyyy } from "./dateFormat";
import { RUNNING_INSPIRATION_ITEMS, type InspirationProgramTemplate } from "./inspirationRunningPlans";
import { collectActivePeriodPlanEntryLabels, findProgramForPeriodPlanEntry } from "./periodPlanEntryActions";
import { normalizePeriodSchedulePlan } from "./periodPlanMerge";
import { uid } from "./storage";
import {
  snapshotTrainingProgram,
  parseTrainingGroupTag,
} from "./trainingGroupProgram";
import type { TrainingGroup, TrainingGroupProgramSnapshot } from "./trainingGroups";
import type { Member, PeriodSchedulePlan, TrainingProgram } from "./types";

export type GroupPeriodPlanOption = {
  id: string;
  label: string;
  plan: PeriodSchedulePlan;
  programs: TrainingGroupProgramSnapshot[];
};

function countFilledDays(plan: PeriodSchedulePlan | undefined): number {
  if (!plan?.weeklyPlans?.length) return 0;
  let filled = 0;
  for (const week of plan.weeklyPlans) {
    for (const value of Object.values(week.days ?? {})) {
      if (String(value ?? "").trim()) filled += 1;
    }
  }
  return filled;
}

function snapshotFromInspirationProgram(
  template: InspirationProgramTemplate,
  sourceProgramId: string,
): TrainingGroupProgramSnapshot {
  return {
    title: template.title,
    goal: template.goal,
    notes: template.notes,
    exercises: template.exercises.map((exercise) => ({ ...exercise })),
    imageUrl: template.imageUrl,
    sourceProgramId,
  };
}

function resolveProgramsForPeriodPlan(
  plan: PeriodSchedulePlan,
  programs: TrainingProgram[],
): TrainingGroupProgramSnapshot[] {
  const sources = programs.filter((program) => !program.ephemeral && !parseTrainingGroupTag(program));
  const snapshots: TrainingGroupProgramSnapshot[] = [];
  const seen = new Set<string>();
  for (const label of collectActivePeriodPlanEntryLabels([plan])) {
    const match = findProgramForPeriodPlanEntry(label, sources);
    if (!match) continue;
    if (seen.has(match.id)) continue;
    seen.add(match.id);
    snapshots.push(snapshotTrainingProgram(match));
  }
  return snapshots;
}

export function snapshotPeriodPlanForGroup(
  plan: PeriodSchedulePlan,
  options?: { startThisWeek?: boolean },
): PeriodSchedulePlan {
  const normalized = normalizePeriodSchedulePlan(plan);
  return {
    ...normalized,
    startDate: options?.startThisWeek ? getCurrentWeekMondayISO() : normalized.startDate,
    memberPeriodPlanStatus: undefined,
    periodPlanAddedBy: "trainer",
    trainingGroupId: undefined,
    trainingGroupMasterPlanId: undefined,
  };
}

export function parseGroupMasterPeriodPlan(raw: unknown): {
  plan?: PeriodSchedulePlan;
  programs: TrainingGroupProgramSnapshot[];
} {
  if (!raw || typeof raw !== "object") return { programs: [] };
  const row = raw as Record<string, unknown>;
  const nested = row.plan && typeof row.plan === "object" ? row.plan : raw;
  const nestedId = String((nested as { id?: unknown }).id ?? "").trim();
  if (!nestedId) return { programs: [] };
  const plan = snapshotPeriodPlanForGroup(nested as PeriodSchedulePlan);
  const programsRaw = Array.isArray(row.programs) ? row.programs : [];
  const programs = programsRaw
    .map((item) => snapshotProgramFromUnknown(item))
    .filter((item): item is TrainingGroupProgramSnapshot => Boolean(item));
  return { plan, programs };
}

function snapshotProgramFromUnknown(raw: unknown): TrainingGroupProgramSnapshot | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const row = raw as Record<string, unknown>;
  const title = String(row.title ?? "").trim();
  if (!title) return undefined;
  return {
    title,
    goal: String(row.goal ?? ""),
    notes: String(row.notes ?? ""),
    exercises: Array.isArray(row.exercises) ? (row.exercises as TrainingGroupProgramSnapshot["exercises"]) : [],
    imageUrl: typeof row.imageUrl === "string" ? row.imageUrl : undefined,
    conditioningDeliveryMode:
      row.conditioningDeliveryMode === "interval" || row.conditioningDeliveryMode === "logAfter"
        ? row.conditioningDeliveryMode
        : undefined,
    activityTemplateKind:
      row.activityTemplateKind === "group" ||
      row.activityTemplateKind === "activity" ||
      row.activityTemplateKind === "no-plan"
        ? row.activityTemplateKind
        : undefined,
    sourceProgramId: String(row.sourceProgramId ?? "").trim() || undefined,
  };
}

export function serializeGroupMasterPeriodPlan(group: Pick<TrainingGroup, "masterPeriodPlan" | "masterPeriodPlanPrograms">) {
  if (!group.masterPeriodPlan) return null;
  return {
    plan: group.masterPeriodPlan,
    programs: group.masterPeriodPlanPrograms ?? [],
  };
}

export function findGroupPeriodPlanCopy(
  plans: PeriodSchedulePlan[],
  groupId: string,
): PeriodSchedulePlan | undefined {
  const wanted = groupId.trim();
  if (!wanted) return undefined;
  return plans.find((plan) => plan.trainingGroupId?.trim() === wanted);
}

export function buildGroupPeriodPlanCopy(
  snapshot: PeriodSchedulePlan,
  group: Pick<TrainingGroup, "id" | "sourcePeriodPlanId">,
  existing?: PeriodSchedulePlan,
): PeriodSchedulePlan {
  return normalizePeriodSchedulePlan({
    ...snapshot,
    id: existing?.id ?? uid("period-plan"),
    createdAt: existing?.createdAt ?? formatDateDdMmYyyy(new Date()),
    periodPlanAddedBy: "trainer",
    trainerSavedAtIso: new Date().toISOString(),
    memberPeriodPlanStatus: undefined,
    trainingGroupId: group.id,
    trainingGroupMasterPlanId: group.sourcePeriodPlanId ?? snapshot.id,
  });
}

export function collectGroupPeriodPlanOptions(input: {
  plansByMemberId: Record<string, PeriodSchedulePlan[]>;
  members: Array<Pick<Member, "id" | "name">>;
  programs: TrainingProgram[];
}): GroupPeriodPlanOption[] {
  const options: GroupPeriodPlanOption[] = [];
  const seen = new Set<string>();

  for (const item of RUNNING_INSPIRATION_ITEMS) {
    const plan = snapshotPeriodPlanForGroup(item.periodPlanTemplate, { startThisWeek: true });
    if (countFilledDays(plan) === 0) continue;
    const id = `inspo:${item.id}`;
    seen.add(id);
    options.push({
      id,
      label: `Utforsk: ${item.title}`,
      plan,
      programs: item.bundledProgramTemplates.map((template, index) =>
        snapshotFromInspirationProgram(template, `inspo:${item.id}:${template.title || index}`),
      ),
    });
  }

  const memberNameById = new Map(input.members.map((member) => [member.id, member.name.trim() || "Klient"]));
  const clientPlans: Array<{ plan: PeriodSchedulePlan; memberName: string }> = [];
  for (const [memberId, plans] of Object.entries(input.plansByMemberId)) {
    const memberName = memberNameById.get(memberId) ?? "Klient";
    for (const plan of plans) {
      if (plan.trainingGroupId) continue;
      if (countFilledDays(plan) === 0) continue;
      clientPlans.push({ plan, memberName });
    }
  }

  for (const row of clientPlans) {
    const id = `plan:${row.plan.id}`;
    if (seen.has(id)) continue;
    seen.add(id);
    options.push({
      id,
      label: `${row.plan.title} (fra ${row.memberName})`,
      plan: snapshotPeriodPlanForGroup(row.plan),
      programs: resolveProgramsForPeriodPlan(row.plan, input.programs),
    });
  }

  return options;
}

export type GroupPeriodPlanSyncResult = {
  copies: Array<{ memberId: string; plan: PeriodSchedulePlan }>;
  missingSnapshot: boolean;
};

export function planGroupPeriodPlanSync(input: {
  group: Pick<TrainingGroup, "id" | "memberIds" | "sourcePeriodPlanId" | "masterPeriodPlan">;
  plansByMemberId: Record<string, PeriodSchedulePlan[]>;
}): GroupPeriodPlanSyncResult {
  const snapshot = input.group.masterPeriodPlan;
  if (!snapshot) {
    return { copies: [], missingSnapshot: true };
  }
  const copies = input.group.memberIds.map((memberId) => {
    const existing = findGroupPeriodPlanCopy(input.plansByMemberId[memberId] ?? [], input.group.id);
    return {
      memberId,
      plan: buildGroupPeriodPlanCopy(snapshot, input.group, existing),
    };
  });
  return { copies, missingSnapshot: false };
}

export function upsertGroupPeriodPlanInLocalMap(
  byMember: Record<string, PeriodSchedulePlan[]>,
  memberIds: string[],
  plan: PeriodSchedulePlan,
): Record<string, PeriodSchedulePlan[]> {
  const next = { ...byMember };
  const groupId = plan.trainingGroupId?.trim() ?? "";
  for (const memberId of memberIds) {
    const trimmed = memberId.trim();
    if (!trimmed) continue;
    const previous = next[trimmed] ?? [];
    next[trimmed] = [
      plan,
      ...previous.filter((existing) => existing.id !== plan.id && (!groupId || existing.trainingGroupId !== groupId)),
    ];
  }
  return next;
}
