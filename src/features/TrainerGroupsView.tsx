import { useEffect, useMemo, useState } from "react";
import { CalendarDays, Plus, RefreshCw, Trash2, UsersRound } from "lucide-react";
import { memberRecordIsActive } from "../services/memberAccessRules";
import type { SaveProgramInput } from "../services/appRepository";
import { findMembersByEmail } from "../app/memberOnboarding";
import {
  readPeriodPlansByMemberId,
  writeActivePeriodPlanIdForMembers,
  writePeriodPlansByMemberId,
} from "../app/periodPlanMerge";
import { parseTrainingGroupTag } from "../app/trainingGroupProgram";
import {
  buildGroupCopySaveNotes,
  cloneProgramExercisesForGroupCopy,
  findGroupProgramCopy,
  listGroupProgramCopies,
  planGroupProgramSync,
  serializeTrainingGroupProgramNotes,
  snapshotTrainingProgram,
} from "../app/trainingGroupProgram";
import {
  collectGroupPeriodPlanOptions,
  planGroupPeriodPlanSync,
  upsertGroupPeriodPlanInLocalMap,
} from "../app/trainingGroupPeriodPlan";
import {
  TRAINING_GROUP_LEVELS,
  countTrainingGroupMembersAtLevel,
  parseTrainingGroupLevel,
  trainingGroupLevelLabel,
  trainingGroupMemberLevel,
  type TrainingGroup,
  type TrainingGroupLevel,
  type TrainingGroupLevelPreferences,
} from "../app/trainingGroups";
import type { Member, PeriodSchedulePlan, TrainingProgram } from "../app/types";
import { Card, GradientButton, MotusSectionIcon, OutlineButton, TextArea } from "../app/ui";
import { GroupChatPanel } from "./GroupChatPanel";
import type { GroupChatMessage } from "../app/trainingGroups";
import { isSupabaseConfigured } from "../services/supabaseClient";
import { upsertMemberPeriodPlansForTrainer } from "../services/supabaseRepository";

type TrainerGroupsViewProps = {
  groups: TrainingGroup[];
  members: Member[];
  programs: TrainingProgram[];
  trainerName: string;
  inProgressProgramIds: string[];
  cloudAvailable: boolean;
  isLocalDemoSession?: boolean;
  status: string | null;
  messagesByGroupId: Map<string, GroupChatMessage[]>;
  remotePeriodPlansByMemberId?: Record<string, PeriodSchedulePlan[]>;
  onCreateGroup: (name: string) => Promise<TrainingGroup | null>;
  onUpdateMembers: (
    groupId: string,
    memberIds: string[],
    memberLevels?: Record<string, TrainingGroupLevel>,
  ) => Promise<unknown>;
  onUpdateLevelPreferences: (groupId: string, preferences: TrainingGroupLevelPreferences) => Promise<unknown>;
  onSetMaster: (
    groupId: string,
    sourceProgramId: string,
    snapshot: ReturnType<typeof snapshotTrainingProgram>,
  ) => Promise<unknown>;
  onSetPeriodPlan: (
    groupId: string,
    sourcePeriodPlanId: string,
    snapshot: PeriodSchedulePlan | null,
    programs: ReturnType<typeof snapshotTrainingProgram>[],
  ) => Promise<unknown>;
  onDeleteGroup: (groupId: string) => Promise<void>;
  onSaveProgram: (input: SaveProgramInput) => void;
  onSendGroupMessage: (groupId: string, text: string) => void;
};

export function TrainerGroupsView({
  groups,
  members,
  programs,
  trainerName,
  inProgressProgramIds,
  cloudAvailable,
  isLocalDemoSession = false,
  status,
  messagesByGroupId,
  remotePeriodPlansByMemberId = {},
  onCreateGroup,
  onUpdateMembers,
  onUpdateLevelPreferences,
  onSetMaster,
  onSetPeriodPlan,
  onDeleteGroup,
  onSaveProgram,
  onSendGroupMessage,
}: TrainerGroupsViewProps) {
  const [newName, setNewName] = useState("");
  const [selectedGroupId, setSelectedGroupId] = useState(groups[0]?.id ?? "");
  const [syncStatus, setSyncStatus] = useState<string | null>(null);
  const [showChat, setShowChat] = useState(false);
  const [preferenceDrafts, setPreferenceDrafts] = useState<TrainingGroupLevelPreferences>({});
  const [preferenceGroupId, setPreferenceGroupId] = useState("");

  const activeMembers = useMemo(
    () =>
      members
        .filter((member) => memberRecordIsActive(member) && member.id !== "__template__")
        .sort((a, b) => a.name.localeCompare(b.name, "nb")),
    [members],
  );

  const sourcePrograms = useMemo(
    () =>
      programs.filter((program) => !program.ephemeral && !parseTrainingGroupTag(program)).sort((a, b) => {
        const templateDelta = Number(b.memberId === "__template__") - Number(a.memberId === "__template__");
        if (templateDelta) return templateDelta;
        return a.title.localeCompare(b.title, "nb");
      }),
    [programs],
  );

  const selectedGroup = groups.find((group) => group.id === selectedGroupId) ?? groups[0] ?? null;
  const chatMessages = selectedGroup ? messagesByGroupId.get(selectedGroup.id) ?? [] : [];

  useEffect(() => {
    if (!selectedGroup) return;
    if (preferenceGroupId === selectedGroup.id) return;
    setPreferenceGroupId(selectedGroup.id);
    setPreferenceDrafts(selectedGroup.levelPreferences ?? {});
  }, [preferenceGroupId, selectedGroup]);

  const periodPlansByMemberId = useMemo(() => {
    const local = readPeriodPlansByMemberId();
    const remoteKeys = Object.keys(remotePeriodPlansByMemberId);
    if (!remoteKeys.length) return local;
    const merged = { ...local };
    for (const memberId of remoteKeys) {
      const combined = [...(local[memberId] ?? []), ...(remotePeriodPlansByMemberId[memberId] ?? [])];
      const byId = new Map(combined.map((plan) => [plan.id, plan]));
      merged[memberId] = Array.from(byId.values());
    }
    return merged;
  }, [remotePeriodPlansByMemberId]);

  const periodPlanOptions = useMemo(
    () =>
      collectGroupPeriodPlanOptions({
        plansByMemberId: periodPlansByMemberId,
        members: activeMembers,
        programs,
      }),
    [periodPlansByMemberId, activeMembers, programs],
  );

  async function handleCreate() {
    const created = await onCreateGroup(newName);
    if (created) {
      setNewName("");
      setSelectedGroupId(created.id);
    }
  }

  function toggleMember(memberId: string) {
    if (!selectedGroup) return;
    const removing = selectedGroup.memberIds.includes(memberId);
    const nextIds = removing
      ? selectedGroup.memberIds.filter((id) => id !== memberId)
      : [...selectedGroup.memberIds, memberId];
    const nextLevels = { ...(selectedGroup.memberLevels ?? {}) };
    if (removing) delete nextLevels[memberId];
    else nextLevels[memberId] = 1;
    void onUpdateMembers(selectedGroup.id, nextIds, nextLevels);
    if (!removing) return;
    for (const copy of listGroupProgramCopies(programs, selectedGroup.id, memberId)) {
      onSaveProgram({
        id: copy.id,
        memberId: copy.memberId,
        title: copy.title,
        goal: copy.goal,
        notes: serializeTrainingGroupProgramNotes({ ...copy, detachFromTrainingGroup: true }),
        exercises: copy.exercises,
        imageUrl: copy.imageUrl,
        programCreatedBy: copy.programCreatedBy,
        programCreatedByName: copy.programCreatedByName,
        detachFromTrainingGroup: true,
      });
    }
  }

  function setMemberLevel(memberId: string, level: TrainingGroupLevel) {
    if (!selectedGroup || !selectedGroup.memberIds.includes(memberId)) return;
    void onUpdateMembers(selectedGroup.id, selectedGroup.memberIds, {
      ...(selectedGroup.memberLevels ?? {}),
      [memberId]: level,
    });
  }

  function saveLevelPreferences(next: TrainingGroupLevelPreferences) {
    if (!selectedGroup) return;
    setPreferenceDrafts(next);
    void onUpdateLevelPreferences(selectedGroup.id, next);
  }

  function handleChooseProgram(programId: string) {
    if (!selectedGroup) return;
    const program = programs.find((row) => row.id === programId);
    if (!program) return;
    void onSetMaster(selectedGroup.id, program.id, snapshotTrainingProgram(program));
  }

  function handleChoosePeriodPlan(optionId: string) {
    if (!selectedGroup) return;
    if (!optionId) {
      void onSetPeriodPlan(selectedGroup.id, "", null, []);
      return;
    }
    const option = periodPlanOptions.find((row) => row.id === optionId);
    if (!option) return;
    void onSetPeriodPlan(selectedGroup.id, option.id, option.plan, option.programs);
  }

  async function handleUpdateGroup() {
    if (!selectedGroup) return;
    const snapshot = selectedGroup.masterSnapshot;
    const hasProgram = Boolean(snapshot);
    const hasPeriodPlan = Boolean(selectedGroup.masterPeriodPlan);
    if (!hasProgram && !hasPeriodPlan) {
      setSyncStatus("Velg et program eller en ukeplan først. Ingenting synkes før du trykker Oppdater gruppen.");
      return;
    }

    const parts: string[] = [];
    let skipped = 0;

    if (snapshot) {
      const plan = planGroupProgramSync({
        group: selectedGroup,
        programs,
        inProgressProgramIds,
      });
      const tag = {
        groupId: selectedGroup.id,
        masterProgramId: selectedGroup.sourceProgramId ?? snapshot.sourceProgramId ?? "",
      };
      for (const memberId of plan.toCreate) {
        onSaveProgram({
          memberId,
          title: snapshot.title,
          goal: snapshot.goal,
          notes: buildGroupCopySaveNotes(snapshot, tag),
          exercises: cloneProgramExercisesForGroupCopy(snapshot.exercises),
          imageUrl: snapshot.imageUrl,
          programCreatedBy: "trainer",
          programCreatedByName: trainerName,
          groupId: tag.groupId,
          groupMasterProgramId: tag.masterProgramId,
        });
      }
      for (const copy of plan.toUpdate) {
        onSaveProgram({
          id: copy.id,
          memberId: copy.memberId,
          title: snapshot.title,
          goal: snapshot.goal,
          notes: buildGroupCopySaveNotes(snapshot, tag),
          exercises: cloneProgramExercisesForGroupCopy(snapshot.exercises, copy.exercises),
          imageUrl: snapshot.imageUrl,
          programCreatedBy: "trainer",
          programCreatedByName: trainerName,
          groupId: tag.groupId,
          groupMasterProgramId: tag.masterProgramId,
        });
      }
      skipped += plan.skippedInProgress.length;
      if (plan.toCreate.length) parts.push(`${plan.toCreate.length} nye programkopier`);
      if (plan.toUpdate.length) parts.push(`${plan.toUpdate.length} program oppdatert`);
    }

    const periodProgramSnapshots = selectedGroup.masterPeriodPlanPrograms ?? [];
    let periodProgramsCreated = 0;
    let periodProgramsUpdated = 0;
    for (const programSnapshot of periodProgramSnapshots) {
      const masterProgramId = programSnapshot.sourceProgramId?.trim() || `period:${programSnapshot.title}`;
      if (snapshot && (selectedGroup.sourceProgramId === masterProgramId || snapshot.sourceProgramId === masterProgramId)) {
        continue;
      }
      const tag = { groupId: selectedGroup.id, masterProgramId };
      for (const memberId of selectedGroup.memberIds) {
        const copy = findGroupProgramCopy(programs, selectedGroup.id, memberId, masterProgramId);
        if (copy && inProgressProgramIds.includes(copy.id)) {
          skipped += 1;
          continue;
        }
        onSaveProgram({
          id: copy?.id,
          memberId,
          title: programSnapshot.title,
          goal: programSnapshot.goal,
          notes: buildGroupCopySaveNotes(programSnapshot, tag),
          exercises: cloneProgramExercisesForGroupCopy(programSnapshot.exercises, copy?.exercises),
          imageUrl: programSnapshot.imageUrl,
          programCreatedBy: "trainer",
          programCreatedByName: trainerName,
          groupId: tag.groupId,
          groupMasterProgramId: tag.masterProgramId,
        });
        if (copy) periodProgramsUpdated += 1;
        else periodProgramsCreated += 1;
      }
    }
    if (periodProgramsCreated) parts.push(`${periodProgramsCreated} ukeplan-programmer`);
    if (periodProgramsUpdated) parts.push(`${periodProgramsUpdated} ukeplan-programmer oppdatert`);

    if (selectedGroup.masterPeriodPlan) {
      const periodSync = planGroupPeriodPlanSync({
        group: selectedGroup,
        plansByMemberId: periodPlansByMemberId,
      });
      let localByMember = { ...periodPlansByMemberId };
      for (const row of periodSync.copies) {
        const member = members.find((item) => item.id === row.memberId);
        const relatedIds = member
          ? Array.from(new Set(findMembersByEmail(member, members).map((item) => item.id)))
          : [row.memberId];
        localByMember = upsertGroupPeriodPlanInLocalMap(localByMember, relatedIds, row.plan);
        writeActivePeriodPlanIdForMembers(relatedIds, row.plan.id);
        if (isSupabaseConfigured && !isLocalDemoSession) {
          const persist = await upsertMemberPeriodPlansForTrainer(relatedIds, row.plan, {
            targetEmail: member?.email,
          });
          if (!persist.ok) {
            setSyncStatus(persist.message || "Kunne ikke lagre ukeplanen til alle i gruppen.");
            writePeriodPlansByMemberId(localByMember);
            return;
          }
        }
      }
      writePeriodPlansByMemberId(localByMember);
      if (periodSync.copies.length) {
        parts.push(`ukeplan til ${periodSync.copies.length} medlemmer`);
      }
    }

    if (skipped) parts.push(`${skipped} hoppet over (pågående økt)`);
    setSyncStatus(parts.length ? `Gruppen er oppdatert: ${parts.join(", ")}.` : "Ingen endringer å synke.");
  }

  if (selectedGroup && showChat) {
    return (
      <GroupChatPanel
        group={selectedGroup}
        messages={chatMessages}
        viewerRole="trainer"
        trainerName={trainerName}
        members={activeMembers}
        onSend={(text) => onSendGroupMessage(selectedGroup.id, text)}
        onBack={() => setShowChat(false)}
      />
    );
  }

  return (
    <div className="space-y-4 sm:space-y-5">
      <Card className="p-4 sm:p-5" style={{ borderColor: "rgba(15,23,42,0.08)" }}>
        <div className="flex items-start gap-3">
          <MotusSectionIcon className="!p-2.5">
            <UsersRound className="h-5 w-5" />
          </MotusSectionIcon>
          <div className="min-w-0">
            <h1 className="text-lg font-semibold text-slate-900 sm:text-xl">Treningsgrupper</h1>
            <p className="mt-1 text-sm leading-relaxed text-slate-600">
              Alle i gruppen får hver sin kopi av samme program og ukeplan. Personlige kilo og logger blir ikke delt.
              Når du starter en gruppe, plasserer du folk på <span className="font-semibold">nivå 1–3</span> og skriver
              preferanser under hvert nivå. Endringer synkes bare når du trykker{" "}
              <span className="font-semibold">Oppdater gruppen</span>. Du er alltid med i gruppechatten.
            </p>
            {!cloudAvailable ? (
              <p className="mt-2 text-xs text-amber-800">
                Sky-tabeller for grupper er ikke tilgjengelige ennå. Gruppen lagres lokalt hos deg til SQL er kjørt i
                Supabase.
              </p>
            ) : null}
            {status ? <p className="mt-2 text-xs text-rose-700">{status}</p> : null}
          </div>
        </div>
      </Card>

      <Card className="space-y-3 p-4" style={{ borderColor: "rgba(15,23,42,0.08)" }}>
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            value={newName}
            onChange={(event) => setNewName(event.target.value)}
            placeholder="Navn på ny gruppe"
            className="min-h-10 flex-1 rounded-xl border border-slate-200 px-3 text-sm"
          />
          <GradientButton onClick={() => void handleCreate()} disabled={!newName.trim()}>
            <Plus className="mr-1 h-4 w-4" />
            Opprett gruppe
          </GradientButton>
        </div>
      </Card>

      {groups.length === 0 ? (
        <Card className="p-4 text-sm text-slate-600">Ingen grupper ennå. Opprett en gruppe og legg til klienter.</Card>
      ) : (
        <div className="grid gap-4 xl:grid-cols-[16rem_minmax(0,1fr)]">
          <Card className="p-2" style={{ borderColor: "rgba(15,23,42,0.08)" }}>
            {groups.map((group) => (
              <button
                key={group.id}
                type="button"
                onClick={() => {
                  if (selectedGroup) void onUpdateLevelPreferences(selectedGroup.id, preferenceDrafts);
                  setSelectedGroupId(group.id);
                  setPreferenceGroupId("");
                  setSyncStatus(null);
                  setShowChat(false);
                }}
                className={`motus-pressable mb-1 w-full rounded-xl px-3 py-2 text-left text-sm ${
                  group.id === selectedGroup?.id ? "bg-teal-50 font-semibold text-teal-900" : "text-slate-700"
                }`}
              >
                <div>{group.name}</div>
                <div className="text-[11px] font-normal text-slate-500">
                  {group.memberIds.length} medlemmer
                  {TRAINING_GROUP_LEVELS.map((level) => {
                    const count = countTrainingGroupMembersAtLevel(group, level);
                    return count ? ` · ${trainingGroupLevelLabel(level)} ${count}` : "";
                  }).join("")}
                </div>
              </button>
            ))}
          </Card>

          {selectedGroup ? (
            <div className="space-y-4">
              <Card className="space-y-4 p-4" style={{ borderColor: "rgba(15,23,42,0.08)" }}>
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <h2 className="text-base font-semibold text-slate-900">{selectedGroup.name}</h2>
                    <p className="text-xs text-slate-500">PT ({trainerName}) er alltid med i chatten.</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <OutlineButton onClick={() => setShowChat(true)}>Gruppechat</OutlineButton>
                    <button
                      type="button"
                      className="inline-flex items-center gap-1 rounded-xl px-3 py-2 text-xs font-semibold text-rose-700"
                      onClick={() => {
                        if (window.confirm(`Slette gruppen «${selectedGroup.name}»? Medlemmenes programkopier beholdes.`)) {
                          void onDeleteGroup(selectedGroup.id);
                        }
                      }}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Slett gruppe
                    </button>
                  </div>
                </div>

                <div>
                  <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Medlemmer og nivå</div>
                  <p className="mb-3 text-xs text-slate-500">
                    Huk av hvem som er med, og sett nivå 1, 2 eller 3 for hver person i denne gruppen.
                  </p>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {activeMembers.map((member) => {
                      const checked = selectedGroup.memberIds.includes(member.id);
                      const level = trainingGroupMemberLevel(selectedGroup, member.id) ?? 1;
                      return (
                        <label key={member.id} className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm">
                          <input type="checkbox" checked={checked} onChange={() => toggleMember(member.id)} />
                          <span className="min-w-0 flex-1 truncate">{member.name}</span>
                          <select
                            className="h-8 shrink-0 rounded-lg border border-slate-200 bg-white px-1.5 text-xs disabled:text-slate-400"
                            value={checked ? String(level) : ""}
                            disabled={!checked}
                            aria-label={`Nivå for ${member.name}`}
                            onChange={(event) => {
                              const nextLevel = parseTrainingGroupLevel(event.target.value);
                              if (nextLevel) setMemberLevel(member.id, nextLevel);
                            }}
                          >
                            {!checked ? <option value="">Nivå</option> : null}
                            {TRAINING_GROUP_LEVELS.map((option) => (
                              <option key={option} value={option}>
                                {trainingGroupLevelLabel(option)}
                              </option>
                            ))}
                          </select>
                        </label>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Preferanser per nivå
                  </div>
                  <p className="mb-3 text-xs text-slate-500">
                    Gjelder bare denne gruppen. Brukes f.eks. til fart, utstyr, skånsomme øvelser eller hva nivået skal
                    holde.
                  </p>
                  <div className="grid gap-3 lg:grid-cols-3">
                    {TRAINING_GROUP_LEVELS.map((level) => (
                      <div key={level} className="rounded-xl border border-slate-200 p-3">
                        <div className="flex items-center justify-between gap-2">
                          <div className="text-sm font-semibold text-slate-900">{trainingGroupLevelLabel(level)}</div>
                          <div className="text-[11px] text-slate-500">
                            {countTrainingGroupMembersAtLevel(selectedGroup, level)} pers.
                          </div>
                        </div>
                        <TextArea
                          rows={4}
                          value={preferenceDrafts[level] ?? ""}
                          onChange={(event) =>
                            setPreferenceDrafts((prev) => ({ ...prev, [level]: event.target.value }))
                          }
                          onBlur={(event) =>
                            saveLevelPreferences({ ...preferenceDrafts, [level]: event.target.value })
                          }
                          placeholder={`Preferanser for ${trainingGroupLevelLabel(level).toLowerCase()}…`}
                          className="mt-2 !min-h-[6rem]"
                        />
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Gruppeprogram</div>
                  <select
                    className="min-h-10 w-full rounded-xl border border-slate-200 px-3 text-sm"
                    value={selectedGroup.sourceProgramId ?? ""}
                    onChange={(event) => handleChooseProgram(event.target.value)}
                  >
                    <option value="">Velg program som skal kopieres…</option>
                    {sourcePrograms.map((program) => (
                      <option key={program.id} value={program.id}>
                        {program.memberId === "__template__" ? `Mal: ${program.title}` : program.title}
                      </option>
                    ))}
                  </select>
                  <p className="mt-2 text-xs text-slate-500">
                    {selectedGroup.masterSnapshot
                      ? `Valgt: ${selectedGroup.masterSnapshot.title}. Endringer synkes ikke automatisk.`
                      : "Valgfritt hvis gruppen bare skal ha ukeplan."}
                  </p>
                </div>

                <div>
                  <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
                    <CalendarDays className="h-3.5 w-3.5" />
                    Gruppeukeplan
                  </div>
                  <select
                    className="min-h-10 w-full rounded-xl border border-slate-200 px-3 text-sm"
                    value={selectedGroup.sourcePeriodPlanId ?? ""}
                    onChange={(event) => handleChoosePeriodPlan(event.target.value)}
                  >
                    <option value="">Velg ukeplan som skal deles med gruppen…</option>
                    {selectedGroup.sourcePeriodPlanId &&
                    !periodPlanOptions.some((option) => option.id === selectedGroup.sourcePeriodPlanId) ? (
                      <option value={selectedGroup.sourcePeriodPlanId}>
                        {selectedGroup.masterPeriodPlan?.title || "Valgt ukeplan"}
                      </option>
                    ) : null}
                    {periodPlanOptions.map((option) => (
                      <option key={option.id} value={option.id}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                  <p className="mt-2 text-xs text-slate-500">
                    {selectedGroup.masterPeriodPlan
                      ? `Valgt: ${selectedGroup.masterPeriodPlan.title}. Alle medlemmer får den i Trening → Plan når du oppdaterer gruppen.`
                      : "Utforsk-planer og ukeplaner du allerede har laget til en klient kan kobles til hele gruppen."}
                  </p>
                </div>

                <GradientButton onClick={() => void handleUpdateGroup()}>
                  <RefreshCw className="mr-1 h-4 w-4" />
                  Oppdater gruppen
                </GradientButton>
                {syncStatus ? <p className="text-xs text-teal-800">{syncStatus}</p> : null}
              </Card>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
