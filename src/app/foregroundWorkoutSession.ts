let activeSessions = 0;
const idleListeners = new Set<() => void>();

/** Pause background hydrate/polling while a member interval timer is on screen. */
export function beginForegroundWorkoutSession(): () => void {
  activeSessions += 1;
  return () => {
    activeSessions = Math.max(0, activeSessions - 1);
    if (activeSessions === 0) {
      idleListeners.forEach((listener) => listener());
    }
  };
}

export function isForegroundWorkoutSessionActive(): boolean {
  return activeSessions > 0;
}

export function onForegroundWorkoutSessionIdle(listener: () => void): () => void {
  idleListeners.add(listener);
  return () => {
    idleListeners.delete(listener);
  };
}

export function resetForegroundWorkoutSessionForTests(): void {
  activeSessions = 0;
  idleListeners.clear();
}
