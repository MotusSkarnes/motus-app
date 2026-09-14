import { isSupabaseConfigured, supabaseClient } from "../services/supabaseClient";
import type { GroupChatMessage, TrainingGroup } from "./trainingGroups";
import { snapshotFromUnknown } from "./trainingGroupStorage";
import { parseGroupMasterPeriodPlan, serializeGroupMasterPeriodPlan } from "./trainingGroupPeriodPlan";

function isMissingTableError(message: string): boolean {
  const normalized = message.toLowerCase();
  return (
    normalized.includes("does not exist") ||
    normalized.includes("schema cache") ||
    normalized.includes("could not find the table")
  );
}

function isMissingPeriodPlanColumnError(message: string): boolean {
  const normalized = message.toLowerCase();
  return (
    normalized.includes("source_period_plan_id") ||
    normalized.includes("master_period_plan") ||
    (normalized.includes("schema cache") && normalized.includes("period_plan"))
  );
}

function parseGroupRow(row: Record<string, unknown>, memberIds: string[]): TrainingGroup {
  const periodPlan = parseGroupMasterPeriodPlan(row.master_period_plan);
  return {
    id: String(row.id ?? "").trim(),
    ownerUserId: String(row.owner_user_id ?? "").trim(),
    name: String(row.name ?? "").trim() || "Gruppe",
    memberIds,
    sourceProgramId: String(row.source_program_id ?? "").trim() || undefined,
    masterSnapshot: snapshotFromUnknown(row.master_snapshot),
    sourcePeriodPlanId: String(row.source_period_plan_id ?? "").trim() || undefined,
    masterPeriodPlan: periodPlan.plan,
    masterPeriodPlanPrograms: periodPlan.programs.length ? periodPlan.programs : undefined,
    createdAt: String(row.created_at ?? new Date().toISOString()),
    updatedAt: String(row.updated_at ?? new Date().toISOString()),
  };
}

function parseChatRow(row: Record<string, unknown>): GroupChatMessage {
  const senderRole = String(row.sender_role ?? "") === "member" ? "member" : "trainer";
  const senderMemberId = String(row.sender_member_id ?? "").trim();
  return {
    id: String(row.id ?? "").trim(),
    groupId: String(row.group_id ?? "").trim(),
    senderRole,
    senderMemberId: senderMemberId || undefined,
    senderName: String(row.sender_name ?? "").trim() || (senderRole === "trainer" ? "PT" : "Medlem"),
    text: String(row.text ?? ""),
    createdAt: String(row.created_at ?? new Date().toISOString()),
    ownerUserId: String(row.owner_user_id ?? "").trim(),
  };
}

export async function fetchTrainingGroupsForTrainer(ownerUserId: string): Promise<{
  groups: TrainingGroup[];
  cloudAvailable: boolean;
}> {
  if (!isSupabaseConfigured || !supabaseClient || !ownerUserId.trim()) {
    return { groups: [], cloudAvailable: false };
  }
  const { data, error } = await supabaseClient
    .from("training_groups")
    .select("*")
    .eq("owner_user_id", ownerUserId)
    .order("updated_at", { ascending: false });
  if (error) {
    return { groups: [], cloudAvailable: !isMissingTableError(error.message) };
  }
  const groupIds = (data ?? []).map((row) => String((row as { id?: string }).id ?? "")).filter(Boolean);
  const memberIdsByGroup = new Map<string, string[]>();
  if (groupIds.length) {
    const { data: memberRows, error: memberError } = await supabaseClient
      .from("training_group_members")
      .select("group_id, member_id")
      .in("group_id", groupIds);
    if (!memberError && memberRows) {
      for (const row of memberRows) {
        const groupId = String((row as { group_id?: string }).group_id ?? "");
        const memberId = String((row as { member_id?: string }).member_id ?? "");
        if (!groupId || !memberId) continue;
        const list = memberIdsByGroup.get(groupId) ?? [];
        list.push(memberId);
        memberIdsByGroup.set(groupId, list);
      }
    }
  }
  return {
    cloudAvailable: true,
    groups: (data ?? []).map((row) =>
      parseGroupRow(row as Record<string, unknown>, memberIdsByGroup.get(String((row as { id?: string }).id ?? "")) ?? []),
    ),
  };
}

export async function fetchTrainingGroupsForMember(memberId: string): Promise<{
  groups: TrainingGroup[];
  cloudAvailable: boolean;
}> {
  if (!isSupabaseConfigured || !supabaseClient || !memberId.trim()) {
    return { groups: [], cloudAvailable: false };
  }
  const { data: memberships, error: membershipError } = await supabaseClient
    .from("training_group_members")
    .select("group_id")
    .eq("member_id", memberId);
  if (membershipError) {
    return { groups: [], cloudAvailable: !isMissingTableError(membershipError.message) };
  }
  const groupIds = Array.from(
    new Set((memberships ?? []).map((row) => String((row as { group_id?: string }).group_id ?? "")).filter(Boolean)),
  );
  if (!groupIds.length) return { groups: [], cloudAvailable: true };
  const { data, error } = await supabaseClient.from("training_groups").select("*").in("id", groupIds);
  if (error) {
    return { groups: [], cloudAvailable: !isMissingTableError(error.message) };
  }
  const { data: memberRows } = await supabaseClient
    .from("training_group_members")
    .select("group_id, member_id")
    .in("group_id", groupIds);
  const memberIdsByGroup = new Map<string, string[]>();
  for (const row of memberRows ?? []) {
    const groupId = String((row as { group_id?: string }).group_id ?? "");
    const rowMemberId = String((row as { member_id?: string }).member_id ?? "");
    if (!groupId || !rowMemberId) continue;
    const list = memberIdsByGroup.get(groupId) ?? [];
    list.push(rowMemberId);
    memberIdsByGroup.set(groupId, list);
  }
  return {
    cloudAvailable: true,
    groups: (data ?? []).map((row) =>
      parseGroupRow(row as Record<string, unknown>, memberIdsByGroup.get(String((row as { id?: string }).id ?? "")) ?? []),
    ),
  };
}

export async function persistTrainingGroup(group: TrainingGroup): Promise<{ ok: boolean; error?: string; cloudAvailable: boolean }> {
  if (!isSupabaseConfigured || !supabaseClient) {
    return { ok: false, error: "Sky er ikke konfigurert.", cloudAvailable: false };
  }
  const baseRow = {
    id: group.id,
    owner_user_id: group.ownerUserId,
    name: group.name,
    source_program_id: group.sourceProgramId ?? null,
    master_snapshot: group.masterSnapshot ?? null,
    created_at: group.createdAt,
    updated_at: group.updatedAt,
  };
  const withPeriodPlan = {
    ...baseRow,
    source_period_plan_id: group.sourcePeriodPlanId ?? null,
    master_period_plan: serializeGroupMasterPeriodPlan(group),
  };
  let periodPlanSqlNeeded = false;
  let { error } = await supabaseClient.from("training_groups").upsert(withPeriodPlan, { onConflict: "id" });
  if (error && isMissingPeriodPlanColumnError(error.message)) {
    const retry = await supabaseClient.from("training_groups").upsert(baseRow, { onConflict: "id" });
    error = retry.error;
    periodPlanSqlNeeded = !error;
  }
  if (error) {
    return { ok: false, error: error.message, cloudAvailable: !isMissingTableError(error.message) };
  }
  await supabaseClient.from("training_group_members").delete().eq("group_id", group.id);
  if (group.memberIds.length) {
    const { error: memberError } = await supabaseClient.from("training_group_members").insert(
      group.memberIds.map((memberId) => ({
        group_id: group.id,
        member_id: memberId,
        owner_user_id: group.ownerUserId,
      })),
    );
    if (memberError) {
      return { ok: false, error: memberError.message, cloudAvailable: true };
    }
  }
  if (periodPlanSqlNeeded) {
    return {
      ok: false,
      error: "Kjør nyeste training_groups_schema.sql i Supabase for å lagre gruppeukeplan i skyen.",
      cloudAvailable: true,
    };
  }
  return { ok: true, cloudAvailable: true };
}

export async function deleteTrainingGroupRemote(groupId: string, ownerUserId: string): Promise<{ ok: boolean }> {
  if (!isSupabaseConfigured || !supabaseClient) return { ok: false };
  const { error } = await supabaseClient
    .from("training_groups")
    .delete()
    .eq("id", groupId)
    .eq("owner_user_id", ownerUserId);
  return { ok: !error };
}

export async function fetchGroupChatMessages(groupIds: string[]): Promise<{
  messages: GroupChatMessage[];
  cloudAvailable: boolean;
}> {
  if (!isSupabaseConfigured || !supabaseClient || !groupIds.length) {
    return { messages: [], cloudAvailable: Boolean(isSupabaseConfigured) };
  }
  const { data, error } = await supabaseClient
    .from("group_chat_messages")
    .select("*")
    .in("group_id", groupIds)
    .order("created_at", { ascending: true });
  if (error) {
    return { messages: [], cloudAvailable: !isMissingTableError(error.message) };
  }
  return {
    cloudAvailable: true,
    messages: (data ?? []).map((row) => parseChatRow(row as Record<string, unknown>)),
  };
}

export async function persistGroupChatMessage(
  message: GroupChatMessage,
): Promise<{ ok: boolean; error?: string; cloudAvailable: boolean }> {
  if (!isSupabaseConfigured || !supabaseClient) {
    return { ok: false, error: "Sky er ikke konfigurert.", cloudAvailable: false };
  }
  const { error } = await supabaseClient.from("group_chat_messages").insert({
    id: message.id,
    group_id: message.groupId,
    sender_role: message.senderRole,
    sender_member_id: message.senderMemberId ?? null,
    sender_name: message.senderName,
    text: message.text,
    created_at: message.createdAt,
    owner_user_id: message.ownerUserId,
  });
  if (error) {
    return { ok: false, error: error.message, cloudAvailable: !isMissingTableError(error.message) };
  }
  return { ok: true, cloudAvailable: true };
}
