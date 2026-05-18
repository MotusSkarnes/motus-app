/** Parsed invite/recovery params from URL (and optional sessionStorage backup). */
export type AuthBootstrapParams = {
  recoveryInviteFlow: boolean;
  tokenHash: string | null;
  accessToken: string | null;
  refreshToken: string | null;
  authCode: string | null;
};

const STORAGE_KEY = "motus.auth.bootstrap.v1";

export function readAuthParamsFromLocation(href: string): AuthBootstrapParams | null {
  let url: URL;
  try {
    url = new URL(href);
  } catch {
    return null;
  }
  const hash = new URLSearchParams(url.hash.replace(/^#/, ""));
  const query = url.searchParams;
  const type = hash.get("type") ?? query.get("type");
  const recoveryFlag = hash.get("recovery") ?? query.get("recovery");
  const inviteFlag = hash.get("invite") ?? query.get("invite");
  const tokenHash = hash.get("token_hash") ?? query.get("token_hash");
  const accessToken = hash.get("access_token") ?? query.get("access_token");
  const refreshToken = hash.get("refresh_token") ?? query.get("refresh_token");
  const authCode = query.get("code");
  const isInviteType = type === "invite" || type === "signup" || inviteFlag === "1";
  const isRecoveryType = type === "recovery" || recoveryFlag === "1";

  if (!isInviteType && !isRecoveryType && !authCode) return null;

  return {
    recoveryInviteFlow: isInviteType || (Boolean(authCode) && inviteFlag === "1"),
    tokenHash,
    accessToken,
    refreshToken,
    authCode,
  };
}

export function persistAuthBootstrapParams(params: AuthBootstrapParams): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(params));
  } catch {
    // ignore quota / private mode
  }
}

export function readPersistedAuthBootstrapParams(): AuthBootstrapParams | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<AuthBootstrapParams>;
    if (typeof parsed !== "object" || parsed === null) return null;
    return {
      recoveryInviteFlow: parsed.recoveryInviteFlow === true,
      tokenHash: typeof parsed.tokenHash === "string" ? parsed.tokenHash : null,
      accessToken: typeof parsed.accessToken === "string" ? parsed.accessToken : null,
      refreshToken: typeof parsed.refreshToken === "string" ? parsed.refreshToken : null,
      authCode: typeof parsed.authCode === "string" ? parsed.authCode : null,
    };
  } catch {
    return null;
  }
}

export function clearPersistedAuthBootstrapParams(): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}

export function hasAuthBootstrapSecrets(params: AuthBootstrapParams): boolean {
  return Boolean(
    params.tokenHash?.trim() ||
      (params.accessToken?.trim() && params.refreshToken?.trim()) ||
      params.authCode?.trim(),
  );
}
