import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import webpush from "https://esm.sh/web-push@3.6.7";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type ChatRow = {
  id: string;
  member_id: string;
  sender: "trainer" | "member";
  text: string;
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

async function verifyIsSender(
  admin: ReturnType<typeof createClient>,
  userId: string,
  userEmail: string,
  appMeta: Record<string, unknown>,
  userMeta: Record<string, unknown>,
  row: ChatRow,
): Promise<boolean> {
  if (row.sender === "trainer") {
    return row.owner_user_id === userId;
  }
  const memberIdApp = typeof appMeta.member_id === "string" ? appMeta.member_id.trim() : "";
  const memberIdUser = typeof userMeta.member_id === "string" ? userMeta.member_id.trim() : "";
  if ((memberIdApp && memberIdApp === row.member_id) || (memberIdUser && memberIdUser === row.member_id)) return true;
  const { data: mem } = await admin.from("members").select("email").eq("id", row.member_id).maybeSingle();
  const em = String((mem as { email?: string } | null)?.email ?? "")
    .trim()
    .toLowerCase();
  return Boolean(em && em === userEmail.trim().toLowerCase());
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

  let body: { messageId?: string };
  try {
    body = (await req.json()) as { messageId?: string };
  } catch {
    return jsonResponse(400, { error: "Invalid JSON body" });
  }
  const messageId = typeof body.messageId === "string" ? body.messageId.trim() : "";
  if (!messageId) {
    return jsonResponse(400, { error: "messageId required" });
  }

  const { data: row, error: rowError } = await admin.from("chat_messages").select("id, member_id, sender, text, owner_user_id").eq("id", messageId).maybeSingle();

  if (rowError || !row) {
    return jsonResponse(404, { error: "Message not found" });
  }
  const chat = row as ChatRow;

  const appMeta = (user.app_metadata ?? {}) as Record<string, unknown>;
  const userMeta = (user.user_metadata ?? {}) as Record<string, unknown>;
  const okSender = await verifyIsSender(admin, user.id, user.email ?? "", appMeta, userMeta, chat);
  if (!okSender) {
    return jsonResponse(403, { error: "Not allowed to notify for this message" });
  }

  const { data: recipientId, error: rpcError } = await admin.rpc("resolve_message_push_recipient", {
    p_message_id: messageId,
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

  const title = chat.sender === "trainer" ? "Ny melding fra treneren" : "Ny melding fra medlem";
  const bodyText = previewText(chat.text);
  const payload = JSON.stringify({
    title,
    body: bodyText,
    url: "/",
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
      console.warn("[send-message-push] send failed", sub.endpoint, e);
    }
  }

  return jsonResponse(200, { ok: true, sent });
});
