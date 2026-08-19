/**
 * Recover from stale PWA / Vite chunk shells that cause a white screen.
 *
 * Safety rules:
 * - Never touches localStorage / IndexedDB (member app data stays intact).
 * - Only clears Cache API entries used by our service worker precache.
 * - Reloads at most once per tab session for the same deploy id.
 */

const RECOVERY_FLAG_PREFIX = "motus.shell.recovered.";

function deployId(): string {
  return typeof __MOTUS_DEPLOY_ID__ !== "undefined"
    ? String(__MOTUS_DEPLOY_ID__ || "").trim() || "local"
    : "local";
}

function recoveryFlagKey(): string {
  return `${RECOVERY_FLAG_PREFIX}${deployId()}`;
}

export function isStaleAppShellError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error ?? "");
  const name = error instanceof Error ? error.name : "";
  const lower = `${name} ${message}`.toLowerCase();
  return (
    name === "ChunkLoadError" ||
    lower.includes("loading chunk") ||
    lower.includes("failed to fetch dynamically imported module") ||
    lower.includes("importing a module script failed") ||
    lower.includes("error loading dynamically imported module") ||
    lower.includes("css chunk load error") ||
    lower.includes("failed to load module script") ||
    lower.includes("sw stale shell signal")
  );
}

function alreadyRecoveredThisSession(): boolean {
  try {
    return window.sessionStorage.getItem(recoveryFlagKey()) === "1";
  } catch {
    return false;
  }
}

function markRecoveredThisSession(): void {
  try {
    window.sessionStorage.setItem(recoveryFlagKey(), "1");
  } catch {
    // ignore storage errors
  }
}

async function clearServiceWorkerPrecacheOnly(): Promise<void> {
  if (!("caches" in window)) return;
  try {
    const keys = await caches.keys();
    await Promise.all(keys.filter((key) => key.startsWith("motus-precache-")).map((key) => caches.delete(key)));
  } catch {
    // ignore cache API failures
  }
}

async function unregisterServiceWorkers(): Promise<void> {
  if (!("serviceWorker" in navigator)) return;
  try {
    const registrations = await navigator.serviceWorker.getRegistrations();
    await Promise.all(registrations.map((registration) => registration.unregister()));
  } catch {
    // ignore SW unregister failures
  }
}

/**
 * Returns true if a recovery reload was triggered.
 * Returns false if recovery was already attempted this session (caller should show UI).
 */
export async function recoverStaleAppShellOnce(reason: unknown): Promise<boolean> {
  if (typeof window === "undefined") return false;
  if (!isStaleAppShellError(reason)) return false;
  if (alreadyRecoveredThisSession()) return false;

  markRecoveredThisSession();
  console.warn("Stale app shell detected — refreshing once without clearing member data.", reason);

  await clearServiceWorkerPrecacheOnly();
  await unregisterServiceWorkers();
  window.location.reload();
  return true;
}

export function installStaleAppShellRecoveryListeners(): void {
  if (typeof window === "undefined") return;

  window.addEventListener("unhandledrejection", (event) => {
    const reason = event.reason;
    if (!isStaleAppShellError(reason)) return;
    event.preventDefault();
    void recoverStaleAppShellOnce(reason);
  });

  window.addEventListener("error", (event) => {
    const error = event.error ?? event.message;
    if (!isStaleAppShellError(error)) return;
    event.preventDefault();
    void recoverStaleAppShellOnce(error);
  });
}
