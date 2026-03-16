import { describe, expect, it, vi } from "vitest";
import { GitHubClient } from "../../src/infrastructure/github/github-client";

const baseConfig = {
  token: "test-github-token",
  owner: "acme",
  repo: "notion-ai-architect",
};

const createMockSdk = (createImpl: () => Promise<unknown>) => ({
  issues: {
    create: vi.fn(createImpl),
  },
});

describe("GitHubClient", () => {
  it("creates an issue and returns its URL", async () => {
    const createImpl = vi.fn().mockResolvedValue({
      data: {
        html_url: "https://github.com/acme/notion-ai-architect/issues/12",
      },
    });
    const client = new GitHubClient(baseConfig, createMockSdk(createImpl));

    await expect(
      client.createIssue({
        title: "Setup worker orchestration",
        body: "Implement idea -> project workflow.",
        labels: ["enhancement", "phase-5"],
      }),
    ).resolves.toBe("https://github.com/acme/notion-ai-architect/issues/12");

    expect(createImpl).toHaveBeenCalledTimes(1);
    expect(createImpl).toHaveBeenCalledWith({
      owner: "acme",
      repo: "notion-ai-architect",
      title: "Setup worker orchestration",
      body: "Implement idea -> project workflow.",
      labels: ["enhancement", "phase-5"],
    });
  });

  it("throws when GitHub response does not contain html_url", async () => {
    const client = new GitHubClient(
      baseConfig,
      createMockSdk(vi.fn().mockResolvedValue({ data: {} })),
    );

    await expect(
      client.createIssue({
        title: "Invalid issue",
        body: "No url returned.",
      }),
    ).rejects.toThrow("GitHub create issue response did not include html_url.");
  });
});
