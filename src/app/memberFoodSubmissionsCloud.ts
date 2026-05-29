import type { FoodSubmissionDraft, MemberFoodSubmission, MemberFoodSubmissionStatus } from "./foodLabelScanTypes";
import {
  draftWithProposedFoodId,
  foodItemFromSubmission,
  foodItemFromSubmissionDraft,
} from "./foodLabelScanTypes";
import type { FoodItem } from "./foodBankTypes";
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
  const draftItem = draftWithProposedFoodId(input.draftItem);
  const { data, error } = await supabaseClient
    .from("member_food_submissions")
    .insert({
      member_id: input.memberId,
      member_name: input.memberName,
      owner_user_id: input.ownerUserId,
      status: "pending",
      draft_item: draftItem,
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

function approvedFoodItemFromRow(row: Record<string, unknown>): FoodItem | null {
  const submission = parseSubmission(row);
  if (submission.status !== "approved") return null;
  return foodItemFromSubmission(submission);
}

/** Medlemmets egne forslag (ventende + godkjente) — kan brukes i logging med en gang. */
export async function fetchMemberSubmissionFoodItemsForLogging(memberId: string): Promise<FoodItem[]> {
  if (!isSupabaseConfigured || !supabaseClient || !memberId.trim()) return [];
  const { data, error } = await supabaseClient
    .from("member_food_submissions")
    .select("*")
    .eq("member_id", memberId)
    .in("status", ["pending", "approved"])
    .order("created_at", { ascending: false });
  if (error || !data) return [];
  const items: FoodItem[] = [];
  const seen = new Set<string>();
  for (const row of data) {
    const item = foodItemFromSubmission(parseSubmission(row as Record<string, unknown>));
    if (!item || seen.has(item.id)) continue;
    seen.add(item.id);
    items.push(item);
  }
  return items;
}

export async function fetchApprovedFoodItemsForMember(memberId: string): Promise<FoodItem[]> {
  return fetchMemberSubmissionFoodItemsForLogging(memberId);
}

export async function updateFoodSubmissionByTrainer(input: {
  submissionId: string;
  ownerUserId: string;
  draftItem: FoodSubmissionDraft;
  labelImageUrl?: string;
}): Promise<{ ok: true; submission: MemberFoodSubmission } | { ok: false; error: string }> {
  if (!isSupabaseConfigured || !supabaseClient) {
    return { ok: false, error: "Sky-tjenesten er ikke tilgjengelig." };
  }
  const { data, error } = await supabaseClient
    .from("member_food_submissions")
    .update({
      draft_item: input.draftItem,
      label_image_url: input.labelImageUrl ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.submissionId)
    .eq("owner_user_id", input.ownerUserId)
    .eq("status", "pending")
    .select("*")
    .maybeSingle();
  if (error) return { ok: false, error: error.message };
  if (!data) return { ok: false, error: "Fant ikke forslaget, eller det er allerede behandlet." };
  return { ok: true, submission: parseSubmission(data as Record<string, unknown>) };
}

export async function fetchApprovedFoodItemsForTrainer(ownerUserId: string): Promise<FoodItem[]> {
  if (!isSupabaseConfigured || !supabaseClient || !ownerUserId.trim()) return [];
  const { data, error } = await supabaseClient
    .from("member_food_submissions")
    .select("approved_food_id, draft_item, reviewed_at")
    .eq("owner_user_id", ownerUserId)
    .eq("status", "approved");
  if (error || !data) return [];
  return data
    .map((row) => approvedFoodItemFromRow(row as Record<string, unknown>))
    .filter((item): item is FoodItem => item !== null);
}

export async function updateMemberFoodSubmission(input: {
  submissionId: string;
  memberId: string;
  draftItem: FoodSubmissionDraft;
  labelImageUrl?: string;
}): Promise<{ ok: true; submission: MemberFoodSubmission } | { ok: false; error: string }> {
  if (!isSupabaseConfigured || !supabaseClient) {
    return { ok: false, error: "Sky-tjenesten er ikke tilgjengelig." };
  }
  const { data, error } = await supabaseClient
    .from("member_food_submissions")
    .update({
      draft_item: input.draftItem,
      label_image_url: input.labelImageUrl ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.submissionId)
    .eq("member_id", input.memberId)
    .eq("status", "pending")
    .select("*")
    .maybeSingle();
  if (error) return { ok: false, error: error.message };
  if (!data) return { ok: false, error: "Fant ikke forslaget, eller det er allerede behandlet." };
  return { ok: true, submission: parseSubmission(data as Record<string, unknown>) };
}

export async function reviewFoodSubmission(input: {
  submissionId: string;
  action: "approve" | "reject";
  reviewNote?: string;
  draftItem?: FoodSubmissionDraft & { id?: string; createdAt?: string; createdBy?: string };
}): Promise<{ ok: true; foodId?: string; item?: FoodItem } | { ok: false; error: string }> {
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
  const payload = data as { ok?: boolean; error?: string; foodId?: string; item?: unknown };
  if (!payload?.ok) return { ok: false, error: String(payload?.error ?? "Kunne ikke behandle forslaget.") };
  const item = payload.item && typeof payload.item === "object"
    ? foodItemFromSubmissionDraft(
        payload.item as FoodSubmissionDraft,
        String(payload.foodId ?? (payload.item as { id?: string }).id ?? ""),
        { createdBy: String((payload.item as { createdBy?: string }).createdBy ?? "") },
      )
    : undefined;
  return { ok: true, foodId: payload.foodId, item };
}
