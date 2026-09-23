import { describe, expect, it } from "vitest";
import { bodyForProxyResponse } from "./proxy-response";

describe("API proxy response bodies", () => {
  it.each([204, 205, 304])("returns no body for HTTP %s", status => {
    const body = bodyForProxyResponse("GET", status, new Uint8Array());
    expect(body).toBeNull();
    expect(() => new Response(body, { status })).not.toThrow();
  });

  it("returns no body for HEAD and preserves ordinary response bodies", async () => {
    const payload = new TextEncoder().encode("ok");
    expect(bodyForProxyResponse("HEAD", 200, payload)).toBeNull();
    const response = new Response(bodyForProxyResponse("GET", 200, payload), { status: 200 });
    expect(await response.text()).toBe("ok");
  });
});
