import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const LABEL_PROMPT = `Du er en assistent som leser næringsinnhold fra matvareetiketter (norsk/EU).
Returner KUN gyldig JSON med disse feltene per 100 g/ml:
{
  "name": "produktnavn",
  "portionLabel": "f.eks. 1 beger eller 130 g",
  "portionGrams": 130,
  "category": "proteinkilder|karbohydrater|fettkilder|gronnsaker|frukt-baer|meieriprodukter",
  "kcal": 0,
  "protein": 0,
  "carbs": 0,
  "fat": 0,
  "fiber": 0,
  "sugar": 0,
  "saturatedFat": 0,
  "sodium": 0,
  "confidence": 0.0
}
Bruk tall fra etiketten. Hvis verdi kun finnes per porsjon, regn om til per 100 g.
Hvis usikker, sett confidence lavt.`;

function jsonResponse(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function normalizeCategory(value: unknown): string {
  const raw = String(value ?? "").trim().toLowerCase();
  const allowed = ["proteinkilder", "karbohydrater", "fettkilder", "gronnsaker", "frukt-baer", "meieriprodukter"];
  if (allowed.includes(raw)) return raw;
  return "proteinkilder";
}

function num(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse(405, { error: "Method not allowed" });

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || Deno.env.get("SERVICE_ROLE_KEY");
  const openAiKey = Deno.env.get("OPENAI_API_KEY");
  if (!supabaseUrl || !serviceRoleKey) return jsonResponse(500, { error: "Missing Supabase environment variables" });
  if (!openAiKey) return jsonResponse(503, { error: "OPENAI_API_KEY is not configured on the server" });

  const authHeader = req.headers.get("Authorization") || "";
  const token = authHeader.replace(/^Bearer\s+/i, "").trim();
  if (!token) return jsonResponse(401, { error: "Missing bearer token" });

  const adminClient = createClient(supabaseUrl, serviceRoleKey);
  const { data: userData, error: userError } = await adminClient.auth.getUser(token);
  if (userError || !userData.user) {
    return jsonResponse(401, { error: "Invalid session", detail: userError?.message ?? "Kunne ikke verifisere innlogging." });
  }

  let body: { imageBase64?: string; mimeType?: string };
  try {
    body = (await req.json()) as { imageBase64?: string; mimeType?: string };
  } catch {
    return jsonResponse(400, { error: "Invalid JSON body" });
  }

  const imageBase64 = String(body.imageBase64 ?? "").trim();
  if (!imageBase64) return jsonResponse(400, { error: "imageBase64 is required" });
  const mimeType = String(body.mimeType ?? "image/jpeg").trim() || "image/jpeg";

  const openAiRes = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${openAiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      temperature: 0.1,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: LABEL_PROMPT },
            { type: "image_url", image_url: { url: `data:${mimeType};base64,${imageBase64}` } },
          ],
        },
      ],
    }),
  });

  if (!openAiRes.ok) {
    const errText = await openAiRes.text();
    let detail = errText.slice(0, 500);
    try {
      const parsed = JSON.parse(errText) as { error?: { message?: string } };
      detail = String(parsed?.error?.message ?? detail);
    } catch {
      // keep raw text
    }
    return jsonResponse(502, { error: "Vision API failed", detail });
  }

  const openAiJson = await openAiRes.json();
  const content = openAiJson?.choices?.[0]?.message?.content;
  if (!content || typeof content !== "string") {
    return jsonResponse(502, { error: "Empty vision response" });
  }

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(content) as Record<string, unknown>;
  } catch {
    return jsonResponse(502, { error: "Could not parse vision JSON" });
  }

  const name = String(parsed.name ?? "").trim();
  if (!name) return jsonResponse(422, { error: "Fant ikke produktnavn på etiketten" });

  const portionGrams = Math.max(1, Math.round(num(parsed.portionGrams) || 100));
  const result = {
    name,
    portionLabel: String(parsed.portionLabel ?? `${portionGrams} g`).trim() || `${portionGrams} g`,
    portionGrams,
    category: normalizeCategory(parsed.category),
    kcal: num(parsed.kcal),
    protein: num(parsed.protein),
    carbs: num(parsed.carbs),
    fat: num(parsed.fat),
    fiber: num(parsed.fiber),
    sugar: num(parsed.sugar),
    saturatedFat: num(parsed.saturatedFat),
    sodium: num(parsed.sodium),
    confidence: num(parsed.confidence),
  };

  return jsonResponse(200, { ok: true, result });
});
