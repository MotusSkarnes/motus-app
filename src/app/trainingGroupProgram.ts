import { serializeConditioningProgramNotes } from "./conditioningProgramMode";
import { uid } from "./storage";
import type { TrainingGroup, TrainingGroupProgramSnapshot } from "./trainingGroups";
import type { ProgramExercise, SaveProgramGroupFields, TrainingProgram } from "./types";

const GROUP_LINE = /^__motusTrainingGroup=([^\s:]+)(?::(\S+))?$/;

export type TrainingGroupTag = {
  groupId: string;
  masterProgramId: string;
};

type GroupTaggedProgram = Pick<TrainingProgram, "notes"> &
  SaveProgramGroupFields & {
    groupId?: string;
    groupMasterProgramId?: string;
    conditioningDeliveryMode?: TrainingProgram["conditioningDeliveryMode"];
    exercises?: ProgramExercise[];
  };

export function parseTrainingGroupTag(program: GroupTaggedProgram): TrainingGroupTag | null {
  if (program.detachFromTrainingGroup) return null;
  const storedId = program.groupId?.trim();
  if (storedId) {
    return {
      groupId: storedId,
      masterProgramId: program.groupMasterProgramId?.trim() ?? "",
    };
  }
  for (const line of String(program.notes ?? "").split(/\r?\n/)) {
    const match = line.trim().match(GROUP_LINE);
    if (!match) continue;
    return {
      groupId: match[1] ?? "",
      masterProgramId: match[2] ?? "",
    };
  }
  return null;
}

export function stripTrainingGroupMarker(notes: string): string {
  return String(notes ?? "")
    .split(/\r?\n/)
    .filter((line) => !GROUP_LINE.test(line.trim()))
    .join("\n")
    .trim();
}

export function serializeTrainingGroupProgramNotes(program: GroupTaggedProgram): string {
  const tag = parseTrainingGroupTag(program);
  const withoutGroup = stripTrainingGroupMarker(program.notes ?? "");
  const withConditioning = serializeConditioningProgramNotes({
    notes: withoutGroup,
    conditioningDeliveryMode: program.conditioningDeliveryMode,
    exercises: program.exercises ?? [],
  });
  if (!tag) return withConditioning;
  const line = tag.masterProgramId
    ? `__motusTrainingGroup=${tag.groupId}:${tag.masterProgramId}`
    : `__motusTrainingGroup=${tag.groupId}`;
  return withConditioning ? `${withConditioning}\n${line}` : line;
}

export function enrichProgramWithTrainingGroup(program: TrainingProgram): TrainingProgram {
  const tag = parseTrainingGroupTag(program);
  const notes = stripTrainingGroupMarker(program.notes);
  if (!tag) {
    if (!program.groupId && notes === program.notes) return program;
    return {
      ...program,
      notes,
      groupId: undefined,
      groupMasterProgramId: undefined,
    };
  }
  return {
    ...program,
    notes,
    groupId: tag.groupId,
    groupMasterProgramId: tag.masterProgramId || undefined,
  };
}

export function snapshotTrainingProgram(program: TrainingProgram): TrainingGroupProgramSnapshot {
  return {
    title: program.title,
    goal: program.goal,
    notes: stripTrainingGroupMarker(program.notes),
    exercises: program.exercises.map((exercise) => ({ ...exercise })),
    imageUrl: program.imageUrl,
    conditioningDeliveryMode: program.conditioningDeliveryMode,
    activityTemplateKind: program.activityTemplateKind,
  };
}

function remapBlockId(blockId: string | undefined, blockMap: Map<string, string>): string | undefined {
  const key = blockId?.trim();
  if (!key) return undefined;
  const existing = blockMap.get(key);
  if (existing) return existing;
  const next = uid("block");
  blockMap.set(key, next);
  return next;
}

export function cloneProgramExercisesForGroupCopy(
  exercises: ProgramExercise[],
  keepIdsFrom?: ProgramExercise[],
): ProgramExercise[] {
  const blockMap = new Map<string, string>();
  return exercises.map((exercise, index) => ({
    ...exercise,
    id: keepIdsFrom?.[index]?.id?.trim() || uid("prog-ex"),
    blockId: remapBlockId(exercise.blockId, blockMap),
  }));
}

export function findGroupProgramCopy(
  programs: TrainingProgram[],
  groupId: string,
  memberId: string,
): TrainingProgram | undefined {
  const wantedGroup = groupId.trim();
  const wantedMember = memberId.trim();
  if (!wantedGroup || !wantedMember) return undefined;
  return programs.find((program) => {
    if (program.memberId.trim() !== wantedMember) return false;
    return parseTrainingGroupTag(program)?.groupId === wantedGroup;
  });
}

export type GroupProgramSyncPlan = {
  toCreate: string[];
  toUpdate: TrainingProgram[];
  skippedInProgress: TrainingProgram[];
  missingSnapshot: boolean;
};

export function planGroupProgramSync(input: {
  group: Pick<TrainingGroup, "id" | "memberIds" | "masterSnapshot">;
  programs: TrainingProgram[];
  inProgressProgramIds?: Iterable<string>;
}): GroupProgramSyncPlan {
  const snapshot = input.group.masterSnapshot;
  if (!snapshot) {
    return { toCreate: [], toUpdate: [], skippedInProgress: [], missingSnapshot: true };
  }
  const busy = new Set(
    Array.from(input.inProgressProgramIds ?? [])
      .map((id) => id.trim())
      .filter(Boolean),
  );
  const toCreate: string[] = [];
  const toUpdate: TrainingProgram[] = [];
  const skippedInProgress: TrainingProgram[] = [];
  for (const memberId of input.group.memberIds) {
    const copy = findGroupProgramCopy(input.programs, input.group.id, memberId);
    if (!copy) {
      toCreate.push(memberId);
      continue;
    }
    if (busy.has(copy.id)) {
      skippedInProgress.push(copy);
      continue;
    }
    toUpdate.push(copy);
  }
  return { toCreate, toUpdate, skippedInProgress, missingSnapshot: false };
}

export function buildGroupCopySaveNotes(
  snapshot: TrainingGroupProgramSnapshot,
  tag: TrainingGroupTag,
): string {
  return serializeTrainingGroupProgramNotes({
    notes: snapshot.notes,
    exercises: snapshot.exercises,
    conditioningDeliveryMode: snapshot.conditioningDeliveryMode,
    groupId: tag.groupId,
    groupMasterProgramId: tag.masterProgramId,
  });
}
