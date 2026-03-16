import { describe, expect, it } from "vitest";
import { bootstrap } from "../../src/index";

describe("bootstrap", () => {
  it("returns readiness message", () => {
    expect(bootstrap()).toBe("Notion AI Architect backend is ready.");
  });
});
