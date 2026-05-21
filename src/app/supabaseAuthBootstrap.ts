/** Parsed invite/recovery params from URL (and optional sessionStorage backup). */
export type AuthBootstrapParams = {
  recoveryInviteFlow: boolean;
  tokenHash: string | null;
  accessToken: string | null;
  refreshToken: string | null;
  authCode: string | null;
};

const STORAGE_KEY = "motus.auth.bootstrap.v1";
const PENDING_INVITE_PASSWORD_KEY = "motus.auth.pendingInvitePassword.v1";

/** Kort, lesbar landing for medlemsinvitasjon (redirect_to i Supabase). */
export const MEMBER_INVITE_ACTIVATE_PATH = "/aktiver";

let earlyCaptureDone = false;

export function isMemberInviteActivatePath(pathname: string): boolean {
  const normalized = pathname.replace(/\/+$/, "") || "/";
  return normalized === MEMBER_INVITE_ACTIVATE_PATH || normalized.endsWith(MEMBER_INVITE_ACTIVATE_PATH);
}

export function buildMemberInviteRedirectUrl(origin: string): string {
  const base = origin.replace(/\/+$/, "").trim();
  if (!base) return MEMBER_INVITE_ACTIVATE_PATH;
  return `${base}${MEMBER_INVITE_ACTIVATE_PATH}`;
}

export function readAuthParamsFromLocation(href: string): AuthBootstrapParams | null {
  let url: URL;
  try {
    url = new URL(href);
  } catch {
    return null;
  }
  const hash = new URLSearchParams(url.hash.replace(/^#/, ""));
  const query = url.searchParams;
  const pathnameInvite = isMemberInviteActivatePath(url.pathname);
  const type = hash.get("type") ?? query.get("type");
  const recoveryFlag = hash.get("recovery") ?? query.get("recovery");
  const inviteFlag = hash.get("invite") ?? query.get("invite");
  const tokenHash = hash.get("token_hash") ?? query.get("token_hash");
  const accessToken = hash.get("access_token") ?? query.get("access_token");
  const refreshToken = hash.get("refresh_token") ?? query.get("refresh_token");
  const authCode = query.get("code") ?? hash.get("code");
  const isInviteType = type === "invite" || type === "signup" || inviteFlag === "1" || pathnameInvite;
  const isRecoveryType = type === "recovery" || recoveryFlag === "1";

  if (!isInviteType && !isRecoveryType && !authCode) return null;

  return {
    recoveryInviteFlow: isInviteType || (Boolean(authCode) && (inviteFlag === "1" || pathnameInvite)),
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

export function markPendingInvitePasswordRequired(): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(PENDING_INVITE_PASSWORD_KEY, "1");
  } catch {
    // ignore
  }
}

export function clearPendingInvitePasswordRequired(): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.removeItem(PENDING_INVITE_PASSWORD_KEY);
  } catch {
    // ignore
  }
}

export function isPendingInvitePasswordRequired(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.sessionStorage.getItem(PENDING_INVITE_PASSWORD_KEY) === "1";
  } catch {
    return false;
  }
}

/** Kjør synkront før Supabase-klient opprettes — unngår at detectSessionInUrl svelger hash før passordskjerm. */
export function captureAuthParamsBeforeSupabaseInit(): void {
  if (earlyCaptureDone || typeof window === "undefined") return;
  earlyCaptureDone = true;
  const params = readAuthParamsFromLocation(window.location.href);
  if (!params) return;
  persistAuthBootstrapParams(params);
  if (params.recoveryInviteFlow && hasAuthBootstrapSecrets(params)) {
    markPendingInvitePasswordRequired();
  }
}
