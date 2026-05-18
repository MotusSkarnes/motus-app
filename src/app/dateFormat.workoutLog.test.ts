import { describe, expect, it } from "vitest";
import { formatDateTimeDdMmYyyy, resolveWorkoutLogDateTime } from "./dateFormat";

describe("resolveWorkoutLogDateTime", () => {
  const reference = new Date(2026, 4, 15, 14, 35, 0);

  it("uses reference clock when input is ISO date only", () => {
    expect(resolveWorkoutLogDateTime("2026-05-15", reference)).toBe("15.05.2026 kl 14:35");
  });

  it("uses reference clock when input is dd.mm.yyyy without time", () => {
    expect(resolveWorkoutLogDateTime("15.05.2026", reference)).toBe("15.05.2026 kl 14:35");
  });

  it("preserves explicit time in input", () => {
    expect(resolveWorkoutLogDateTime("15.05.2026 kl 09:10", reference)).toBe("15.05.2026 kl 09:10");
  });

  it("defaults to reference now when input is empty", () => {
    expect(resolveWorkoutLogDateTime("", reference)).toBe(formatDateTimeDdMmYyyy(reference));
  });
});
