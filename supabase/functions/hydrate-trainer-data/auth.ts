type AuthUser = {
  id?: string | null;
};

type GetUserResult = {
  data?: { user?: AuthUser | null } | null;
  error?: { message?: string } | null;
};

type AuthClient = {
  auth: {
    getUser(token: string): Promise<GetUserResult>;
  };
};

export type TrainerHydrateAuthResult =
  | { ok: true; requesterUserId: string }
  | { ok: false; status: 401 | 403; error: string };

export function extractBearerToken(authHeader: string | null): string {
  const header = String(authHeader ?? "").trim();
  if (!header.toLowerCase().startsWith("bearer ")) return "";
  return header.slice("Bearer ".length).trim();
}

export async function assertTrainerHydrateAuth(
  authClient: AuthClient,
  authHeader: string | null,
  ownerUserId: string,
): Promise<TrainerHydrateAuthResult> {
  const token = extractBearerToken(authHeader);
  if (!token) {
    return { ok: false, status: 401, error: "Missing bearer token" };
  }

  const { data, error } = await authClient.auth.getUser(token);
  const requesterUserId = String(data?.user?.id ?? "").trim();
  if (error || !requesterUserId) {
    return { ok: false, status: 401, error: "Invalid session token" };
  }

  if (requesterUserId !== ownerUserId) {
    return { ok: false, status: 403, error: "Authenticated user cannot hydrate another trainer" };
  }

  return { ok: true, requesterUserId };
}
