import type { AddressInfo } from "node:net";
import { afterEach, describe, expect, it } from "vitest";
import { createSimulatorServer } from "./index.js";

const servers: ReturnType<typeof createSimulatorServer>[] = [];

afterEach(async () => {
  await Promise.all(servers.splice(0).map((server) => new Promise<void>((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
  })));
});

async function startSimulator() {
  const server = createSimulatorServer();
  servers.push(server);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address() as AddressInfo;
  return `http://127.0.0.1:${address.port}`;
}

describe("integration simulator", () => {
  it("serves a non-cacheable health endpoint", async () => {
    const origin = await startSimulator();
    const response = await fetch(`${origin}/healthz`);
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    await expect(response.json()).resolves.toEqual({ status: "ok" });
  });

  it("serves the accessible reservation workflow with restrictive headers", async () => {
    const origin = await startSimulator();
    const response = await fetch(`${origin}/reservations`);
    const html = await response.text();
    expect(response.status).toBe(200);
    expect(response.headers.get("content-security-policy")).toContain("frame-ancestors 'none'");
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    expect(html).toContain('data-testid="reservation-list"');
    expect(html).toContain('id="reservation-form"');
    expect(html).toContain("Nouvelle réservation");
  });

  it("returns 404 for every unrecognised route", async () => {
    const origin = await startSimulator();
    const response = await fetch(`${origin}/not-a-workflow`);
    expect(response.status).toBe(404);
  });
});
