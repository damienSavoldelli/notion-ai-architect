import { describe, expect, it, vi } from "vitest";
import { bootstrap, maybePrintBootstrap } from "../../src/index";

describe("bootstrap", () => {
  it("returns readiness message", () => {
    expect(bootstrap()).toBe("Notion AI Architect backend is ready.");
  });

  it("prints readiness message when running as main", () => {
    const log = vi.fn();

    maybePrintBootstrap(true, log);

    expect(log).toHaveBeenCalledWith("Notion AI Architect backend is ready.");
  });

  it("does not print when not running as main", () => {
    const log = vi.fn();

    maybePrintBootstrap(false, log);

    expect(log).not.toHaveBeenCalled();
  });
});
