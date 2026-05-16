import { describe, expect, it } from "vitest";
import {
  WORKOUT_LOG_URL_PARAM,
  buildWorkoutLogDeepLinkUrl,
  readWorkoutLogIdFromLocation,
  stripWorkoutLogIdFromLocation,
  workoutLogIdFromMemberAlertId,
} from "./workoutLogDeepLink";

describe("workoutLogDeepLink", () => {
  it("builds and reads workout log id from query string", () => {
    const url = buildWorkoutLogDeepLinkUrl("log-abc");
    expect(url).toBe(`/?${WORKOUT_LOG_URL_PARAM}=log-abc`);

    window.history.replaceState({}, "", url);
    expect(readWorkoutLogIdFromLocation()).toBe("log-abc");

    stripWorkoutLogIdFromLocation();
    expect(readWorkoutLogIdFromLocation()).toBeNull();
    expect(window.location.search).toBe("");
  });

  it("parses log id from member workout comment alert id", () => {
    expect(workoutLogIdFromMemberAlertId("member-workout-comment-log-99")).toBe("log-99");
    expect(workoutLogIdFromMemberAlertId("member-msg-1")).toBeNull();
  });
});
