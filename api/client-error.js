export default function handler(request, response) {
  if (request.method !== "POST") {
    response.status(405).json({ ok: false });
    return;
  }

  const body = request.body && typeof request.body === "object" ? request.body : {};
  const record = {
    event: String(body.event ?? "unknown").slice(0, 120),
    level: body.level === "error" ? "error" : "info",
    context: body.context && typeof body.context === "object" ? body.context : {},
    path: String(body.path ?? "").slice(0, 300),
    userAgent: String(body.userAgent ?? "").slice(0, 500),
    occurredAt: String(body.occurredAt ?? ""),
  };

  if (record.level === "error") console.error("[client-diagnostic]", JSON.stringify(record));
  else console.log("[client-diagnostic]", JSON.stringify(record));
  response.status(202).json({ ok: true });
}
