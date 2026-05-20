export type WorkoutRestToneKind = "tick" | "start";

type NavigatorWithAudioSession = Navigator & {
  audioSession?: { type: string };
};

let sharedContext: AudioContext | null = null;

function getBrowserAudioContextConstructor():
  | (new (options?: AudioContextOptions) => AudioContext)
  | null {
  if (typeof window === "undefined") return null;
  return (
    window.AudioContext ||
    (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext ||
    null
  );
}

function getSharedAudioContext(): AudioContext | null {
  const AudioCtx = getBrowserAudioContextConstructor();
  if (!AudioCtx) return null;
  if (!sharedContext || sharedContext.state === "closed") {
    sharedContext = new AudioCtx();
  }
  return sharedContext;
}

/** Prefer short alert session so other apps (e.g. Spotify) duck on supporting platforms. */
export function configureWorkoutRestAudioSession(): void {
  const audioSession = (navigator as NavigatorWithAudioSession).audioSession;
  if (!audioSession) return;
  try {
    audioSession.type = "transient";
  } catch {
    // Experimental API — ignore unsupported assignments.
  }
}

export async function primeWorkoutRestAudio(): Promise<void> {
  const context = getSharedAudioContext();
  if (!context) return;
  configureWorkoutRestAudioSession();
  if (context.state === "suspended") {
    try {
      await context.resume();
    } catch {
      // Autoplay policies may block until a user gesture; playWorkoutRestTone retries.
    }
  }
}

export async function playWorkoutRestTone(kind: WorkoutRestToneKind): Promise<void> {
  const context = getSharedAudioContext();
  if (!context) return;

  configureWorkoutRestAudioSession();
  if (context.state === "suspended") {
    try {
      await context.resume();
    } catch {
      return;
    }
  }

  const master = context.createGain();
  master.gain.setValueAtTime(kind === "start" ? 1 : 0.85, context.currentTime);
  master.connect(context.destination);

  const nowTime = context.currentTime;
  const toneSpecs =
    kind === "start"
      ? [
          { frequency: 587.33, duration: 0.22, delay: 0, peak: 0.7 },
          { frequency: 739.99, duration: 0.24, delay: 0.14, peak: 0.75 },
          { frequency: 880, duration: 0.3, delay: 0.3, peak: 0.8 },
        ]
      : [{ frequency: 880, duration: 0.16, delay: 0, peak: 0.65 }];

  toneSpecs.forEach(({ frequency, duration, delay, peak }) => {
    const start = nowTime + delay;
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = kind === "start" ? "square" : "sine";
    oscillator.frequency.setValueAtTime(frequency, start);
    gain.gain.setValueAtTime(0.0001, start);
    oscillator.connect(gain);
    gain.connect(master);
    gain.gain.exponentialRampToValueAtTime(Math.max(peak, 0.0002), start + 0.006);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    oscillator.start(start);
    oscillator.stop(start + duration + 0.03);
  });
}

/** @internal Test helper */
export function resetWorkoutRestAudioForTests(): void {
  void sharedContext?.close();
  sharedContext = null;
}
