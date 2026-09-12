import { describe, expect, it } from "vitest";
import { assertPreviewDatabaseIsolation } from "./preview-isolation.js";

describe("delivery preview migration boundary", () => {
  it("refuses production, pooling aliases and preserved preview endpoints", () => {
    for (const endpoint of ["ep-crimson-sound-za2s6xo0", "ep-crimson-sound-za2s6xo0-pooler", "ep-crimson-sound-za2s6xo0-jp7-pooler", "ep-crimson-dust-za2sb4ht"]) {
      expect(() => assertPreviewDatabaseIsolation(`postgres://test:test@${endpoint}.c-2.eu-west-2.aws.neon.tech/test`)).toThrow("separate Copilot Neon branch");
    }
  });
  it("rejects unrelated database services", () => {
    expect(() => assertPreviewDatabaseIsolation("postgres://test:test@unapproved.example/test")).toThrow();
  });
  it("allows a distinct Neon endpoint supplied by the existing project integration", () => {
    expect(() => assertPreviewDatabaseIsolation("postgres://test:test@ep-new-isolated.c-2.eu-west-2.aws.neon.tech/test")).not.toThrow();
  });
});
