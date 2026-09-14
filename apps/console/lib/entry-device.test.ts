import { describe, expect, it } from "vitest";
import { shouldShowLaunchScreen } from "./entry-device";

describe("TableNow OS entry experience", () => {
  it.each([
    "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit Mobile",
    "Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit Mobile",
    "Mozilla/5.0 (iPad; CPU OS 18_0 like Mac OS X) AppleWebKit Mobile",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15) AppleWebKit Mobile/15E148",
  ])("shows the launch screen on phone and tablet: %s", (userAgent) => {
    expect(shouldShowLaunchScreen(userAgent)).toBe(true);
  });

  it.each([
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit Chrome Safari",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit Chrome Safari",
  ])("sends desktop browsers directly to login: %s", (userAgent) => {
    expect(shouldShowLaunchScreen(userAgent)).toBe(false);
  });
});
