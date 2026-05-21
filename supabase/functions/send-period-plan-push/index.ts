import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import webpush from "https://esm.sh/web-push@3.6.7";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
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

async function memberOwnedByTrainer(
  admin: ReturnType<typeof createClient>,
  memberId: string,
  userId: string,
): Promise<boolean> {
  const { data: mem } = await admin.from("members").select("owner_user_id").eq("id", memberId).maybeSingle();
  return String((mem as { owner_user_id?: string } | null)?.owner_user_id ?? "").trim() === userId;
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

  let body: { memberId?: string; planTitle?: string };
  try {
    body = (await req.json()) as { memberId?: string; planTitle?: string };
  } catch {
    return jsonResponse(400, { error: "Invalid JSON body" });
  }

  const memberId = String(body.memberId ?? "").trim();
  const planTitle = String(body.planTitle ?? "").trim() || "Periodeplan";
  if (!memberId) {
    return jsonResponse(400, { error: "memberId required" });
  }

  const admin = createClient(supabaseUrl, serviceRoleKey);
  const {
    data: { user },
    error: userError,
  } = await admin.auth.getUser(token);
  if (userError || !user) {
    return jsonResponse(401, { error: "Invalid user session" });
  }

  const allowed = await memberOwnedByTrainer(admin, memberId, user.id);
  if (!allowed) {
    return jsonResponse(403, { error: "Not allowed to notify for this member" });
  }

  const { data: recipientId, error: rpcError } = await admin.rpc("resolve_member_form_push_recipient", {
    p_member_id: memberId,
  });
  if (rpcError) {
    return jsonResponse(500, { error: rpcError.message });
  }
  const recipient = typeof recipientId === "string" ? recipientId : null;
  if (!recipient) {
    return jsonResponse(200, { ok: true, sent: 0, skipped: "no_recipient_user" });
  }

  const { data: subs, error: subErr } = await admin
    .from("push_subscriptions")
    .select("endpoint, p256dh, auth_secret")
    .eq("user_id", recipient);
  if (subErr) {
    return jsonResponse(500, { error: subErr.message });
  }
  const list = (subs ?? []) as SubRow[];
  if (!list.length) {
    return jsonResponse(200, { ok: true, sent: 0, skipped: "no_subscriptions" });
  }

  const payload = JSON.stringify({
    title: "Ny periodeplan",
    body: `Treneren har lagt inn «${planTitle}».`,
    url: "/?memberTab=overview",
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
      console.warn("[send-period-plan-push] send failed", sub.endpoint, e);
    }
  }

  return jsonResponse(200, { ok: true, sent });
});
