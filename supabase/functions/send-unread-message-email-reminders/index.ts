import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-reminder-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type ReminderCandidate = {
  message_id: string;
  member_id: string;
  member_name: string;
  member_email: string;
  message_text: string;
  message_created_at: string;
};

function jsonResponse(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function normalizeEmail(value: unknown): string {
  return String(value ?? "").trim().toLowerCase();
}

function previewText(text: string, max = 160): string {
  const trimmed = String(text ?? "").replace(/\s+/g, " ").trim();
  if (!trimmed) return "Du har mottatt en ny melding.";
  return trimmed.length <= max ? trimmed : `${trimmed.slice(0, max - 1)}…`;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function buildAppUrl(baseUrl: string): string {
  return baseUrl.replace(/\/+$/, "") || "https://motus-pt-app.vercel.app";
}

async function sendEmailViaResend(
  apiKey: string,
  from: string,
  to: string,
  subject: string,
  html: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [to],
        subject,
        html,
      }),
    });
    if (!response.ok) {
      const bodyText = await response.text();
      return { ok: false, message: `Resend HTTP ${response.status}: ${bodyText}` };
    }
    return { ok: true };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : String(error) };
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse(405, { error: "Method not allowed" });

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || Deno.env.get("SERVICE_ROLE_KEY");
  const reminderSecret = String(Deno.env.get("CHAT_REMINDER_SECRET") ?? "").trim();
  const requestSecret = String(req.headers.get("x-reminder-secret") ?? "").trim();

  if (!supabaseUrl || !serviceRoleKey) {
    return jsonResponse(500, { error: "Missing Supabase environment variables" });
  }
  // Fail closed: cron is documented without a JWT, so the shared secret is the only gate.
  if (!reminderSecret || requestSecret !== reminderSecret) {
    return jsonResponse(401, { error: "Unauthorized reminder request" });
  }

  const resendApiKey = String(Deno.env.get("RESEND_API_KEY") ?? "").trim();
  const mailFrom = String(Deno.env.get("REMINDER_EMAIL_FROM") ?? "").trim();
  const appBaseUrl = buildAppUrl(String(Deno.env.get("PUBLIC_APP_URL") ?? Deno.env.get("VITE_SITE_URL") ?? ""));

  if (!resendApiKey || !mailFrom) {
    return jsonResponse(200, {
      ok: true,
      scanned: 0,
      sent: 0,
      skipped: "missing_mail_config",
      message: "Set RESEND_API_KEY and REMINDER_EMAIL_FROM to enable reminders.",
    });
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // One reminder max per member per 24h; only unread trainer messages older than 24h.
  const { data, error } = await admin.rpc("select_unread_message_email_reminder_candidates", {});
  if (error) {
    return jsonResponse(500, { error: error.message });
  }

  const candidates = ((data ?? []) as ReminderCandidate[]).filter(
    (row) => row.message_id && normalizeEmail(row.member_email),
  );

  let sent = 0;
  const failures: Array<{ memberId: string; email: string; error: string }> = [];

  for (const row of candidates) {
    const email = normalizeEmail(row.member_email);
    const safeName = escapeHtml(String(row.member_name ?? "").trim() || "der");
    const messagePreview = escapeHtml(previewText(row.message_text));
    const subject = "Du har en ulest melding i Motus";
    const appUrl = escapeHtml(buildAppUrl(appBaseUrl));
    const html = `
      <div style="font-family: Arial, sans-serif; line-height:1.5; color:#111827; max-width:560px;">
        <h2 style="margin:0 0 12px;">Hei ${safeName}</h2>
        <p style="margin:0 0 12px;">
          Du har mottatt en melding i Motus-appen som ikke er lest ennå.
        </p>
        <blockquote style="margin:0 0 16px; padding:10px 12px; border-left:4px solid #14b8a6; background:#f8fafc;">
          ${messagePreview}
        </blockquote>
        <p style="margin:0 0 16px;">
          Åpne appen for å lese og svare:
        </p>
        <p style="margin:0 0 18px;">
          <a href="${appUrl}" style="display:inline-block; background:#0f766e; color:white; text-decoration:none; padding:10px 14px; border-radius:8px;">
            Åpne Motus
          </a>
        </p>
        <p style="margin:0; font-size:12px; color:#6b7280;">
          Denne påminnelsen sendes kun når meldinger har vært ulest i minst 24 timer.
        </p>
      </div>
    `;

    const mailResult = await sendEmailViaResend(resendApiKey, mailFrom, email, subject, html);
    if (!mailResult.ok) {
      failures.push({ memberId: row.member_id, email, error: mailResult.message });
      continue;
    }

    const { error: insertError } = await admin.from("chat_message_email_reminders").insert({
      message_id: row.message_id,
      member_id: row.member_id,
      recipient_email: email,
      sent_at: new Date().toISOString(),
    });

    if (insertError) {
      failures.push({ memberId: row.member_id, email, error: insertError.message });
      continue;
    }
    sent += 1;
  }

  return jsonResponse(200, {
    ok: true,
    scanned: candidates.length,
    sent,
    failed: failures.length,
    failures,
  });
});

