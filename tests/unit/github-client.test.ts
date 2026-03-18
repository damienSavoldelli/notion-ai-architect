import { describe, expect, it, vi } from "vitest";
import { GitHubClient } from "../../src/infrastructure/github/github-client";

const baseConfig = {
  token: "test-github-token",
  owner: "acme",
  repo: "notion-ai-architect",
};

const createMockSdk = (params: {
  createImpl: () => Promise<unknown>;
  listForRepoImpl?: () => Promise<unknown>;
}) => ({
  issues: {
    create: vi.fn(params.createImpl),
    listForRepo: vi.fn(
      params.listForRepoImpl ??
        vi.fn().mockResolvedValue({
          data: [],
        }),
    ),
  },
});

describe("GitHubClient", () => {
  it("creates an issue and returns its URL", async () => {
    const createImpl = vi.fn().mockResolvedValue({
      data: {
        html_url: "https://github.com/acme/notion-ai-architect/issues/12",
      },
    });
    const client = new GitHubClient(baseConfig, createMockSdk({ createImpl }));

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
      createMockSdk({ createImpl: vi.fn().mockResolvedValue({ data: {} }) }),
    );

    await expect(
      client.createIssue({
        title: "Invalid issue",
        body: "No url returned.",
      }),
    ).rejects.toThrow("GitHub create issue response did not include html_url.");
  });

  it("finds an existing issue URL by title", async () => {
    const listForRepoImpl = vi.fn().mockResolvedValue({
      data: [
        {
          title: "[AI][Project] Existing task",
          html_url: "https://github.com/acme/notion-ai-architect/issues/42",
        },
      ],
    });
    const client = new GitHubClient(
      baseConfig,
      createMockSdk({
        createImpl: vi.fn().mockResolvedValue({
          data: {
            html_url: "https://github.com/acme/notion-ai-architect/issues/99",
          },
        }),
        listForRepoImpl,
      }),
    );

    await expect(
      client.findIssueUrlByTitle("[AI][Project] Existing task"),
    ).resolves.toBe("https://github.com/acme/notion-ai-architect/issues/42");
    expect(listForRepoImpl).toHaveBeenCalledWith({
      owner: "acme",
      repo: "notion-ai-architect",
      state: "all",
      per_page: 100,
      page: 1,
    });
  });

  it("ignores pull requests when searching issue title", async () => {
    const listForRepoImpl = vi.fn().mockResolvedValue({
      data: [
        {
          title: "[AI][Project] Existing task",
          html_url: "https://github.com/acme/notion-ai-architect/pull/42",
          pull_request: { url: "https://api.github.com/repos/acme/notion-ai-architect/pulls/42" },
        },
      ],
    });
    const client = new GitHubClient(
      baseConfig,
      createMockSdk({
        createImpl: vi.fn().mockResolvedValue({
          data: {
            html_url: "https://github.com/acme/notion-ai-architect/issues/99",
          },
        }),
        listForRepoImpl,
      }),
    );

    await expect(
      client.findIssueUrlByTitle("[AI][Project] Existing task"),
    ).resolves.toBeNull();
  });
});
