import { afterEach, describe, expect, it, vi } from "vitest";
import {
  configureWorkoutRestAudioSession,
  playWorkoutRestTone,
  primeWorkoutRestAudio,
  resetWorkoutRestAudioForTests,
} from "./workoutRestAudio";

describe("workoutRestAudio", () => {
  afterEach(() => {
    resetWorkoutRestAudioForTests();
  });

  it("sets transient audio session when supported", () => {
    const audioSession = { type: "auto" };
    Object.defineProperty(navigator, "audioSession", {
      configurable: true,
      value: audioSession,
    });

    configureWorkoutRestAudioSession();
    expect(audioSession.type).toBe("transient");
  });

  it("plays rest tones without throwing when AudioContext exists", async () => {
    class FakeAudioContext {
      state: AudioContextState = "running";
      currentTime = 0;
      destination = {};
      createGain() {
        return {
          gain: {
            setValueAtTime: vi.fn(),
            exponentialRampToValueAtTime: vi.fn(),
          },
          connect: vi.fn(),
        };
      }
      createOscillator() {
        return {
          type: "sine",
          frequency: { setValueAtTime: vi.fn() },
          connect: vi.fn(),
          start: vi.fn(),
          stop: vi.fn(),
        };
      }
      resume = vi.fn().mockResolvedValue(undefined);
      close = vi.fn().mockResolvedValue(undefined);
    }

    vi.stubGlobal(
      "AudioContext",
      FakeAudioContext as unknown as typeof AudioContext,
    );

    await expect(primeWorkoutRestAudio()).resolves.toBeUndefined();
    await expect(playWorkoutRestTone("tick")).resolves.toBeUndefined();
    await expect(playWorkoutRestTone("start")).resolves.toBeUndefined();
  });
});
