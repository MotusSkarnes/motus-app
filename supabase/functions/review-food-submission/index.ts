import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type FoodItemRow = {
  id: string;
  name: string;
  portionLabel: string;
  portionGrams: number;
  category: string;
  origin: string;
  source: string;
  createdBy: string;
  createdAt: string;
  imageUrl?: string;
  imageEmoji?: string;
  isCustom?: boolean;
  isEdited?: boolean;
  nutritionPer100g: Record<string, unknown>;
};

function jsonResponse(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function parseFoodItems(value: unknown): FoodItemRow[] {
  if (!Array.isArray(value)) return [];
  return value.filter((row) => row && typeof row === "object") as FoodItemRow[];
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse(405, { error: "Method not allowed" });

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || Deno.env.get("SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) {
    return jsonResponse(500, { error: "Missing Supabase environment variables" });
  }

  const authHeader = req.headers.get("Authorization") || "";
  const token = authHeader.replace(/^Bearer\s+/i, "").trim();
  if (!token) return jsonResponse(401, { error: "Missing bearer token" });

  const adminClient = createClient(supabaseUrl, serviceRoleKey);
  const { data: userData, error: userError } = await adminClient.auth.getUser(token);
  if (userError || !userData.user) return jsonResponse(401, { error: "Invalid session" });
  const trainerId = userData.user.id;

  let body: {
    submissionId?: string;
    action?: "approve" | "reject";
    reviewNote?: string;
    draftItem?: FoodItemRow;
  };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return jsonResponse(400, { error: "Invalid JSON body" });
  }

  const submissionId = String(body.submissionId ?? "").trim();
  const action = body.action;
  if (!submissionId || (action !== "approve" && action !== "reject")) {
    return jsonResponse(400, { error: "submissionId and action (approve|reject) are required" });
  }

  const admin = adminClient;
  const { data: submission, error: fetchError } = await admin
    .from("member_food_submissions")
    .select("*")
    .eq("id", submissionId)
    .maybeSingle();

  if (fetchError) return jsonResponse(500, { error: fetchError.message });
  if (!submission) return jsonResponse(404, { error: "Submission not found" });

  const ownerUserId = String((submission as { owner_user_id?: string }).owner_user_id ?? "");
  if (ownerUserId !== trainerId) return jsonResponse(403, { error: "Not allowed" });
  if (String((submission as { status?: string }).status ?? "") !== "pending") {
    return jsonResponse(409, { error: "Submission already reviewed" });
  }

  const reviewNote = String(body.reviewNote ?? "").trim() || null;
  const now = new Date().toISOString();

  if (action === "reject") {
    const { error } = await admin
      .from("member_food_submissions")
      .update({
        status: "rejected",
        review_note: reviewNote,
        reviewed_at: now,
        updated_at: now,
      })
      .eq("id", submissionId);
    if (error) return jsonResponse(500, { error: error.message });
    return jsonResponse(200, { ok: true, status: "rejected" });
  }

  const draft = (body.draftItem ?? (submission as { draft_item?: FoodItemRow }).draft_item) as FoodItemRow | undefined;
  if (!draft?.name?.trim()) return jsonResponse(400, { error: "draftItem.name is required for approval" });

  const foodId = String(draft.id ?? "").trim() || `food-${crypto.randomUUID()}`;
  const approvedItem: FoodItemRow = {
    ...draft,
    id: foodId,
    name: draft.name.trim(),
    portionLabel: String(draft.portionLabel ?? "100 g").trim() || "100 g",
    portionGrams: Number(draft.portionGrams) > 0 ? Math.round(Number(draft.portionGrams)) : 100,
    category: String(draft.category ?? "proteinkilder"),
    origin: String(draft.origin ?? "Medlem").trim() || "Medlem",
    source: "egen",
    createdBy: String(draft.createdBy ?? "Medlem").trim() || "Medlem",
    isCustom: true,
    isEdited: false,
    createdAt: draft.createdAt || now,
    nutritionPer100g: draft.nutritionPer100g ?? {},
  };

  const { data: bankRow, error: bankFetchError } = await admin
    .from("trainer_food_bank")
    .select("items, favorite_ids, recent_ids")
    .eq("owner_user_id", ownerUserId)
    .maybeSingle();

  if (bankFetchError) return jsonResponse(500, { error: bankFetchError.message });

  const existingItems = parseFoodItems(bankRow?.items);
  const nextItems = [approvedItem, ...existingItems.filter((item) => item.id !== foodId)];

  const { error: bankSaveError } = await admin.from("trainer_food_bank").upsert({
    owner_user_id: ownerUserId,
    items: nextItems,
    favorite_ids: bankRow?.favorite_ids ?? [],
    recent_ids: bankRow?.recent_ids ?? [],
    updated_at: now,
  });
  if (bankSaveError) return jsonResponse(500, { error: bankSaveError.message });

  const { error: submissionUpdateError } = await admin
    .from("member_food_submissions")
    .update({
      status: "approved",
      draft_item: approvedItem,
      approved_food_id: foodId,
      review_note: reviewNote,
      reviewed_at: now,
      updated_at: now,
    })
    .eq("id", submissionId);
  if (submissionUpdateError) return jsonResponse(500, { error: submissionUpdateError.message });

  return jsonResponse(200, { ok: true, status: "approved", foodId, item: approvedItem });
});
