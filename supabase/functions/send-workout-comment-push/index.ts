import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import webpush from "https://esm.sh/web-push@3.6.7";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type LogRow = {
  id: string;
  member_id: string;
  program_title: string;
  note: string;
  owner_user_id: string;
};

type SubRow = {
  endpoint: string;
  p256dh: string;
  auth_secret: string;
};

function jsonResponse(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function previewText(text: string, max = 140): string {
  const t = text.replace(/\s+/g, " ").trim();
  return t.length <= max ? t : `${t.slice(0, max - 1)}…`;
}

function parseTrainerComment(note: string): { comment: string; authorName: string } {
  const raw = String(note ?? "").trim();
  if (!raw) return { comment: "", authorName: "" };
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    if (parsed && typeof parsed === "object") {
      return {
        comment: String(parsed.trainerComment ?? "").trim(),
        authorName: String(parsed.trainerCommentAuthorName ?? "").trim(),
      };
    }
  } catch {
    /* plain text note */
  }
  return { comment: "", authorName: "" };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return jsonResponse(405, { error: "Method not allowed" });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || Deno.env.get("SERVICE_ROLE_KEY");
  const vapidPublic = Deno.env.get("VAPID_PUBLIC_KEY");
  const vapidPrivate = Deno.env.get("VAPID_PRIVATE_KEY");
  const vapidSubject = Deno.env.get("VAPID_CONTACT") || "mailto:hello@motus.no";

  if (!supabaseUrl || !serviceRoleKey) {
    return jsonResponse(500, { error: "Missing Supabase environment variables" });
  }
  if (!vapidPublic || !vapidPrivate) {
    return jsonResponse(200, { ok: true, sent: 0, skipped: "vapid_not_configured" });
  }

  webpush.setVapidDetails(vapidSubject, vapidPublic, vapidPrivate);

  const authHeader = req.headers.get("Authorization") || "";
  const token = authHeader.replace(/^Bearer\s+/i, "").trim();
  if (!token) {
    return jsonResponse(401, { error: "Missing bearer token" });
  }

  const admin = createClient(supabaseUrl, serviceRoleKey);
  const {
    data: { user },
    error: userError,
  } = await admin.auth.getUser(token);
  if (userError || !user) {
    return jsonResponse(401, { error: "Invalid user session" });
  }

  let body: { logId?: string };
  try {
    body = (await req.json()) as { logId?: string };
  } catch {
    return jsonResponse(400, { error: "Invalid JSON body" });
  }
  const logId = typeof body.logId === "string" ? body.logId.trim() : "";
  if (!logId) {
    return jsonResponse(400, { error: "logId required" });
  }

  const { data: row, error: rowError } = await admin
    .from("workout_logs")
    .select("id, member_id, program_title, note, owner_user_id")
    .eq("id", logId)
    .maybeSingle();

  if (rowError || !row) {
    return jsonResponse(404, { error: "Workout log not found" });
  }
  const log = row as LogRow;

  if (log.owner_user_id !== user.id) {
    return jsonResponse(403, { error: "Not allowed to notify for this workout log" });
  }

  const { comment, authorName } = parseTrainerComment(log.note);
  if (!comment) {
    return jsonResponse(200, { ok: true, sent: 0, skipped: "no_trainer_comment" });
  }

  const { data: recipientId, error: rpcError } = await admin.rpc("resolve_workout_comment_push_recipient", {
    p_log_id: logId,
  });
  if (rpcError) {
    return jsonResponse(500, { error: rpcError.message });
  }
  const recipient = typeof recipientId === "string" ? recipientId : null;
  if (!recipient) {
    return jsonResponse(200, { ok: true, sent: 0, skipped: "no_recipient_user" });
  }

  const { data: subs, error: subErr } = await admin.from("push_subscriptions").select("endpoint, p256dh, auth_secret").eq("user_id", recipient);
  if (subErr) {
    return jsonResponse(500, { error: subErr.message });
  }
  const list = (subs ?? []) as SubRow[];
  if (!list.length) {
    return jsonResponse(200, { ok: true, sent: 0, skipped: "no_subscriptions" });
  }

  const programTitle = String(log.program_title ?? "").trim() || "økten din";
  const bodyText = previewText(authorName ? `${authorName}: ${comment}` : comment);
  const payload = JSON.stringify({
    title: `Ny kommentar på ${programTitle}`,
    body: bodyText,
    url: `/?workoutLogId=${encodeURIComponent(logId)}`,
  });

  let sent = 0;
  for (const sub of list) {
    try {
      await webpush.sendNotification(
        {
          endpoint: sub.endpoint,
          keys: { p256dh: sub.p256dh, auth: sub.auth_secret },
        },
        payload,
        { TTL: 60 * 60 },
      );
      sent += 1;
    } catch (e) {
      const statusCode = (e as { statusCode?: number }).statusCode;
      if (statusCode === 404 || statusCode === 410) {
        await admin.from("push_subscriptions").delete().eq("endpoint", sub.endpoint);
      }
      console.warn("[send-workout-comment-push] send failed", sub.endpoint, e);
    }
  }

  return jsonResponse(200, { ok: true, sent });
});
