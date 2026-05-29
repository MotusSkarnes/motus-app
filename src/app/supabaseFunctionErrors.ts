import { FunctionsFetchError, FunctionsHttpError, FunctionsRelayError } from "@supabase/supabase-js";

type FunctionErrorPayload = {
  error?: string;
  detail?: string;
  message?: string;
  code?: string;
};

function messageFromPayload(payload: FunctionErrorPayload | null | undefined): string | null {
  if (!payload) return null;
  if (payload.error) {
    if (payload.detail) return `${payload.error}: ${String(payload.detail).slice(0, 240)}`;
    return String(payload.error);
  }
  if (payload.message) return String(payload.message);
  if (payload.code === "UNAUTHORIZED_INVALID_JWT_FORMAT") {
    return "Innloggingen er utløpt. Logg ut og inn igjen, og prøv på nytt.";
  }
  return null;
}

export async function readSupabaseFunctionInvokeError(
  error: unknown,
  data: unknown,
): Promise<string> {
  const fromData = messageFromPayload(data as FunctionErrorPayload);
  if (fromData) return fromData;

  if (error instanceof FunctionsHttpError) {
    try {
      const payload = (await error.context.json()) as FunctionErrorPayload;
      const fromContext = messageFromPayload(payload);
      if (fromContext) return fromContext;
    } catch {
      // ignore parse errors
    }
    return `Serverfeil (${error.context.status}). Prøv igjen om litt.`;
  }

  if (error instanceof FunctionsRelayError) {
    return "Kunne ikke nå serveren. Prøv igjen om litt.";
  }

  if (error instanceof FunctionsFetchError) {
    return "Nettverksfeil. Sjekk tilkoblingen og prøv igjen.";
  }

  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  return "Kunne ikke fullføre forespørselen.";
}
