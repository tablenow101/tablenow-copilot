import { describe, expect, it } from "vitest";
import { legacyCopilotRedirect } from "./legacy-host-redirect";

describe("legacy Copilot hostname", () => {
  it("sends old Preview links to the canonical Preview origin without a permanent cache", () => {
    expect(legacyCopilotRedirect({ VERCEL_ENV: "preview" })).toEqual({
      source: "/:path*",
      has: [{ type: "host", value: "copilot\\.tablenow\\.io" }],
      destination: "https://preview.tablenow.io/:path*",
      permanent: false,
    });
  });

  it("sends old production links permanently to TableNow OS", () => {
    expect(legacyCopilotRedirect({ VERCEL_ENV: "production" })).toEqual({
      source: "/:path*",
      has: [{ type: "host", value: "copilot\\.tablenow\\.io" }],
      destination: "https://os.tablenow.io/:path*",
      permanent: true,
    });
  });
});
