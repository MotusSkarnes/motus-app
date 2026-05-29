import type { FoodSubmissionDraft, MemberFoodSubmission, MemberFoodSubmissionStatus } from "./foodLabelScanTypes";
import { readSupabaseFunctionInvokeError } from "./supabaseFunctionErrors";
import { isSupabaseConfigured, supabaseClient } from "../services/supabaseClient";

function parseSubmission(row: Record<string, unknown>): MemberFoodSubmission {
  return {
    id: String(row.id ?? ""),
    memberId: String(row.member_id ?? row.memberId ?? ""),
    memberName: typeof row.member_name === "string" ? row.member_name : undefined,
    ownerUserId: String(row.owner_user_id ?? row.ownerUserId ?? ""),
    status: String(row.status ?? "pending") as MemberFoodSubmissionStatus,
    draftItem: (row.draft_item ?? row.draftItem) as FoodSubmissionDraft,
    labelImageUrl: typeof row.label_image_url === "string" ? row.label_image_url : undefined,
    reviewNote: typeof row.review_note === "string" ? row.review_note : undefined,
    approvedFoodId: typeof row.approved_food_id === "string" ? row.approved_food_id : undefined,
    reviewedAt: typeof row.reviewed_at === "string" ? row.reviewed_at : undefined,
    createdAt: String(row.created_at ?? row.createdAt ?? new Date().toISOString()),
    updatedAt: String(row.updated_at ?? row.updatedAt ?? new Date().toISOString()),
  };
}

export async function submitMemberFoodForApproval(input: {
  memberId: string;
  memberName: string;
  ownerUserId: string;
  draftItem: FoodSubmissionDraft;
  labelImageUrl?: string;
}): Promise<{ ok: true; submission: MemberFoodSubmission } | { ok: false; error: string }> {
  if (!isSupabaseConfigured || !supabaseClient) {
    return { ok: false, error: "Sky-tjenesten er ikke tilgjengelig." };
  }
  const { data, error } = await supabaseClient
    .from("member_food_submissions")
    .insert({
      member_id: input.memberId,
      member_name: input.memberName,
      owner_user_id: input.ownerUserId,
      status: "pending",
      draft_item: input.draftItem,
      label_image_url: input.labelImageUrl ?? null,
    })
    .select("*")
    .single();
  if (error) return { ok: false, error: error.message };
  return { ok: true, submission: parseSubmission(data as Record<string, unknown>) };
}

export async function fetchPendingFoodSubmissionsForTrainer(
  ownerUserId: string,
): Promise<MemberFoodSubmission[]> {
  if (!isSupabaseConfigured || !supabaseClient || !ownerUserId.trim()) return [];
  const { data, error } = await supabaseClient
    .from("member_food_submissions")
    .select("*")
    .eq("owner_user_id", ownerUserId)
    .eq("status", "pending")
    .order("created_at", { ascending: false });
  if (error || !data) return [];
  return data.map((row) => parseSubmission(row as Record<string, unknown>));
}

export async function fetchMemberFoodSubmissions(memberId: string): Promise<MemberFoodSubmission[]> {
  if (!isSupabaseConfigured || !supabaseClient || !memberId.trim()) return [];
  const { data, error } = await supabaseClient
    .from("member_food_submissions")
    .select("*")
    .eq("member_id", memberId)
    .order("created_at", { ascending: false })
    .limit(20);
  if (error || !data) return [];
  return data.map((row) => parseSubmission(row as Record<string, unknown>));
}

export async function reviewFoodSubmission(input: {
  submissionId: string;
  action: "approve" | "reject";
  reviewNote?: string;
  draftItem?: FoodSubmissionDraft & { id?: string; createdAt?: string; createdBy?: string };
}): Promise<{ ok: true; foodId?: string } | { ok: false; error: string }> {
  if (!isSupabaseConfigured || !supabaseClient) {
    return { ok: false, error: "Sky-tjenesten er ikke tilgjengelig." };
  }
  const { data: sessionData, error: sessionError } = await supabaseClient.auth.getSession();
  if (sessionError || !sessionData.session?.access_token) {
    return { ok: false, error: "Du må være innlogget for å godkjenne matvarer." };
  }
  await supabaseClient.auth.refreshSession();
  const { data, error } = await supabaseClient.functions.invoke("review-food-submission", {
    body: input,
  });
  if (error) return { ok: false, error: await readSupabaseFunctionInvokeError(error, data) };
  const payload = data as { ok?: boolean; error?: string; foodId?: string };
  if (!payload?.ok) return { ok: false, error: String(payload?.error ?? "Kunne ikke behandle forslaget.") };
  return { ok: true, foodId: payload.foodId };
}
