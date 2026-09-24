export function isStorageQuotaError(error: unknown): boolean {
  return (
    (error instanceof DOMException &&
      (error.name === "QuotaExceededError" || error.name === "NS_ERROR_DOM_QUOTA_REACHED" || error.code === 22)) ||
    (error instanceof Error && /quota|storage.*full/i.test(error.message))
  );
}

/**
 * Browser storage is only a local cache. A full or blocked iOS/PWA store must
 * never be allowed to take down the application shell.
 */
export function runStorageWriteSafely(
  write: () => void,
  options?: { evictOnQuota?: string[] },
): boolean {
  try {
    write();
    return true;
  } catch (error) {
    if (!isStorageQuotaError(error) || typeof window === "undefined") return false;

    for (const key of options?.evictOnQuota ?? []) {
      try {
        window.localStorage.removeItem(key);
      } catch {
        return false;
      }
    }

    if (!options?.evictOnQuota?.length) return false;
    try {
      write();
      return true;
    } catch {
      return false;
    }
  }
}
