import { useMemo, useState } from "react";
import { Plus, RefreshCw, Trash2, UsersRound } from "lucide-react";
import { memberRecordIsActive } from "../services/memberAccessRules";
import type { SaveProgramInput } from "../services/appRepository";
import { parseTrainingGroupTag } from "../app/trainingGroupProgram";
import {
  buildGroupCopySaveNotes,
  cloneProgramExercisesForGroupCopy,
  findGroupProgramCopy,
  planGroupProgramSync,
  serializeTrainingGroupProgramNotes,
  snapshotTrainingProgram,
} from "../app/trainingGroupProgram";
import type { TrainingGroup } from "../app/trainingGroups";
import type { Member, TrainingProgram } from "../app/types";
import { Card, GradientButton, MotusSectionIcon, OutlineButton } from "../app/ui";
import { GroupChatPanel } from "./GroupChatPanel";
import type { GroupChatMessage } from "../app/trainingGroups";

type TrainerGroupsViewProps = {
  groups: TrainingGroup[];
  members: Member[];
  programs: TrainingProgram[];
  trainerName: string;
  inProgressProgramIds: string[];
  cloudAvailable: boolean;
  status: string | null;
  messagesByGroupId: Map<string, GroupChatMessage[]>;
  onCreateGroup: (name: string) => Promise<TrainingGroup | null>;
  onUpdateMembers: (groupId: string, memberIds: string[]) => Promise<unknown>;
  onSetMaster: (
    groupId: string,
    sourceProgramId: string,
    snapshot: ReturnType<typeof snapshotTrainingProgram>,
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
  status,
  messagesByGroupId,
  onCreateGroup,
  onUpdateMembers,
  onSetMaster,
  onDeleteGroup,
  onSaveProgram,
  onSendGroupMessage,
}: TrainerGroupsViewProps) {
  const [newName, setNewName] = useState("");
  const [selectedGroupId, setSelectedGroupId] = useState(groups[0]?.id ?? "");
  const [syncStatus, setSyncStatus] = useState<string | null>(null);
  const [showChat, setShowChat] = useState(false);

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
    const next = removing
      ? selectedGroup.memberIds.filter((id) => id !== memberId)
      : [...selectedGroup.memberIds, memberId];
    void onUpdateMembers(selectedGroup.id, next);
    if (!removing) return;
    const copy = findGroupProgramCopy(programs, selectedGroup.id, memberId);
    if (!copy) return;
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

  function handleChooseProgram(programId: string) {
    if (!selectedGroup) return;
    const program = programs.find((row) => row.id === programId);
    if (!program) return;
    void onSetMaster(selectedGroup.id, program.id, snapshotTrainingProgram(program));
  }

  function handleUpdateGroup() {
    if (!selectedGroup) return;
    const snapshot = selectedGroup.masterSnapshot;
    if (!snapshot) {
      setSyncStatus("Velg et program først. Ingenting synkes før du trykker Oppdater gruppen.");
      return;
    }
    const plan = planGroupProgramSync({
      group: selectedGroup,
      programs,
      inProgressProgramIds,
    });
    const tag = {
      groupId: selectedGroup.id,
      masterProgramId: selectedGroup.sourceProgramId ?? "",
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
    const skipped = plan.skippedInProgress.length;
    const parts = [
      plan.toCreate.length ? `${plan.toCreate.length} nye kopier` : null,
      plan.toUpdate.length ? `${plan.toUpdate.length} oppdatert` : null,
      skipped ? `${skipped} hoppet over (pågående økt)` : null,
    ].filter(Boolean);
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
              Alle i gruppen får hver sin kopi av samme program. Personlige kilo og logger blir ikke delt. Programmet
              synkes bare når du trykker <span className="font-semibold">Oppdater gruppen</span>. Du er alltid med i
              gruppechatten.
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
                  setSelectedGroupId(group.id);
                  setSyncStatus(null);
                  setShowChat(false);
                }}
                className={`motus-pressable mb-1 w-full rounded-xl px-3 py-2 text-left text-sm ${
                  group.id === selectedGroup?.id ? "bg-teal-50 font-semibold text-teal-900" : "text-slate-700"
                }`}
              >
                <div>{group.name}</div>
                <div className="text-[11px] font-normal text-slate-500">{group.memberIds.length} medlemmer</div>
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
                  <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Medlemmer</div>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {activeMembers.map((member) => {
                      const checked = selectedGroup.memberIds.includes(member.id);
                      return (
                        <label key={member.id} className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm">
                          <input type="checkbox" checked={checked} onChange={() => toggleMember(member.id)} />
                          <span className="min-w-0 truncate">{member.name}</span>
                        </label>
                      );
                    })}
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
                      : "Ingen synk skjer før du trykker Oppdater gruppen."}
                  </p>
                </div>

                <GradientButton onClick={handleUpdateGroup}>
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
