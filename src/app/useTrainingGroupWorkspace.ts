import { useCallback, useEffect, useMemo, useState } from "react";
import { uid } from "./storage";
import {
  deleteTrainingGroupRemote,
  fetchGroupChatMessages,
  fetchTrainingGroupsForMember,
  fetchTrainingGroupsForTrainer,
  persistGroupChatMessage,
  persistTrainingGroup,
} from "./trainingGroupCloud";
import {
  appendLocalGroupChatMessage,
  loadLocalGroupChatMessages,
  loadLocalTrainingGroups,
  removeLocalTrainingGroup,
  upsertLocalTrainingGroup,
} from "./trainingGroupStorage";
import type { GroupChatMessage, TrainingGroup, TrainingGroupProgramSnapshot } from "./trainingGroups";

type WorkspaceRole = "trainer" | "member";

type UseTrainingGroupWorkspaceInput = {
  role?: WorkspaceRole;
  ownerUserId?: string;
  memberId?: string;
  trainerDisplayName: string;
  memberDisplayName?: string;
};

export function useTrainingGroupWorkspace({
  role,
  ownerUserId,
  memberId,
  trainerDisplayName,
  memberDisplayName,
}: UseTrainingGroupWorkspaceInput) {
  const [groups, setGroups] = useState<TrainingGroup[]>([]);
  const [messages, setMessages] = useState<GroupChatMessage[]>([]);
  const [cloudAvailable, setCloudAvailable] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  const resolvedOwnerId = ownerUserId?.trim() ?? "";
  const resolvedMemberId = memberId?.trim() ?? "";

  const refresh = useCallback(async () => {
    if (role === "trainer" && resolvedOwnerId) {
      const remote = await fetchTrainingGroupsForTrainer(resolvedOwnerId);
      setCloudAvailable(remote.cloudAvailable);
      const nextGroups = remote.cloudAvailable ? remote.groups : loadLocalTrainingGroups(resolvedOwnerId);
      setGroups(nextGroups);
      const groupIds = nextGroups.map((group) => group.id);
      const remoteChat = await fetchGroupChatMessages(groupIds);
      setMessages(remoteChat.cloudAvailable ? remoteChat.messages : loadLocalGroupChatMessages(resolvedOwnerId));
      return;
    }
    if (role === "member" && resolvedMemberId) {
      const remote = await fetchTrainingGroupsForMember(resolvedMemberId);
      setCloudAvailable(remote.cloudAvailable);
      setGroups(remote.groups);
      const remoteChat = await fetchGroupChatMessages(remote.groups.map((group) => group.id));
      setMessages(remoteChat.messages);
    }
  }, [role, resolvedMemberId, resolvedOwnerId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const saveGroup = useCallback(
    async (group: TrainingGroup) => {
      const next = { ...group, updatedAt: new Date().toISOString() };
      setGroups((prev) => [next, ...prev.filter((row) => row.id !== next.id)]);
      if (resolvedOwnerId) upsertLocalTrainingGroup(resolvedOwnerId, next);
      const remote = await persistTrainingGroup(next);
      setCloudAvailable(remote.cloudAvailable);
      if (!remote.ok && remote.cloudAvailable) {
        setStatus(remote.error ?? "Kunne ikke lagre gruppen i skyen.");
      } else {
        setStatus(null);
      }
      return next;
    },
    [resolvedOwnerId],
  );

  const createGroup = useCallback(
    async (name: string) => {
      if (!resolvedOwnerId) return null;
      const now = new Date().toISOString();
      const group: TrainingGroup = {
        id: uid("tgroup"),
        ownerUserId: resolvedOwnerId,
        name: name.trim() || "Ny gruppe",
        memberIds: [],
        createdAt: now,
        updatedAt: now,
      };
      return saveGroup(group);
    },
    [resolvedOwnerId, saveGroup],
  );

  const updateGroupMembers = useCallback(
    async (groupId: string, memberIds: string[]) => {
      const group = groups.find((row) => row.id === groupId);
      if (!group) return null;
      return saveGroup({ ...group, memberIds: Array.from(new Set(memberIds.map((id) => id.trim()).filter(Boolean))) });
    },
    [groups, saveGroup],
  );

  const setGroupMaster = useCallback(
    async (groupId: string, sourceProgramId: string, snapshot: TrainingGroupProgramSnapshot) => {
      const group = groups.find((row) => row.id === groupId);
      if (!group) return null;
      return saveGroup({
        ...group,
        sourceProgramId,
        masterSnapshot: snapshot,
      });
    },
    [groups, saveGroup],
  );

  const deleteGroup = useCallback(
    async (groupId: string) => {
      setGroups((prev) => prev.filter((group) => group.id !== groupId));
      setMessages((prev) => prev.filter((message) => message.groupId !== groupId));
      if (resolvedOwnerId) removeLocalTrainingGroup(resolvedOwnerId, groupId);
      if (resolvedOwnerId) await deleteTrainingGroupRemote(groupId, resolvedOwnerId);
    },
    [resolvedOwnerId],
  );

  const sendGroupMessage = useCallback(
    async (groupId: string, text: string, as: "trainer" | "member") => {
      const trimmed = text.trim();
      const group = groups.find((row) => row.id === groupId);
      if (!trimmed || !group) return;
      const message: GroupChatMessage = {
        id: uid("gmsg"),
        groupId,
        senderRole: as,
        senderMemberId: as === "member" ? resolvedMemberId || undefined : undefined,
        senderName:
          as === "trainer"
            ? trainerDisplayName.trim() || "PT"
            : memberDisplayName?.trim() || "Medlem",
        text: trimmed,
        createdAt: new Date().toISOString(),
        ownerUserId: group.ownerUserId,
      };
      setMessages((prev) => [...prev, message]);
      appendLocalGroupChatMessage(message);
      const remote = await persistGroupChatMessage(message);
      if (!remote.ok && remote.cloudAvailable) {
        setStatus(remote.error ?? "Kunne ikke sende gruppemeldingen.");
      }
    },
    [groups, memberDisplayName, resolvedMemberId, trainerDisplayName],
  );

  const messagesByGroupId = useMemo(() => {
    const map = new Map<string, GroupChatMessage[]>();
    for (const message of messages) {
      const list = map.get(message.groupId) ?? [];
      list.push(message);
      map.set(message.groupId, list);
    }
    return map;
  }, [messages]);

  return {
    groups,
    messages,
    messagesByGroupId,
    cloudAvailable,
    status,
    setStatus,
    refresh,
    createGroup,
    saveGroup,
    updateGroupMembers,
    setGroupMaster,
    deleteGroup,
    sendGroupMessage,
  };
}
