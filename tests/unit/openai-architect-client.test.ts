import { describe, expect, it, vi } from "vitest";
import { OpenAiArchitectClient } from "../../src/infrastructure/ai/openai-architect-client";

const baseConfig = {
  apiKey: "test-openai-key",
  model: "gpt-5.2",
};

const createMockSdk = (createImpl: () => Promise<unknown>) => ({
  responses: {
    create: vi.fn(createImpl),
  },
});

describe("OpenAiArchitectClient", () => {
  it("generates and validates a structured project payload", async () => {
    const createImpl = vi.fn().mockResolvedValue({
      output_text: JSON.stringify({
        product_overview: {
          name: "AI CRM Assistant",
          description: "Assistant that automates CRM follow-up actions.",
          target_users: ["sales teams", "startup founders"],
        },
        architecture: {
          frontend: "React",
          backend: "Fastify",
          database: "PostgreSQL",
          infrastructure: "Docker + GitHub Actions",
        },
        tasks: [
          {
            title: "Initialize backend architecture",
            description: "Setup clean architecture and base modules.",
            priority: "high",
          },
        ],
        roadmap: [
          {
            sprint: "Sprint 1",
            tasks: ["Project setup", "Notion integration"],
          },
        ],
      }),
    });

    const client = new OpenAiArchitectClient(baseConfig, createMockSdk(createImpl));

    await expect(
      client.generateProjectFromIdea("Build an AI CRM assistant"),
    ).resolves.toEqual(
      expect.objectContaining({
        product_overview: expect.objectContaining({ name: "AI CRM Assistant" }),
        tasks: expect.arrayContaining([
          expect.objectContaining({ priority: "high" }),
        ]),
      }),
    );

    expect(createImpl).toHaveBeenCalledTimes(1);
    expect(createImpl).toHaveBeenCalledWith(
      expect.objectContaining({
        model: "gpt-5.2",
        input: expect.stringContaining("Build an AI CRM assistant"),
        temperature: 0.2,
      }),
    );
  });

  it("retries when first response is invalid JSON and succeeds on second", async () => {
    const createImpl = vi
      .fn()
      .mockResolvedValueOnce({ output_text: "not-json" })
      .mockResolvedValueOnce({
        output_text: JSON.stringify({
          product_overview: {
            name: "Recovered project",
            description: "Recovered on retry.",
            target_users: ["devs"],
          },
          architecture: {
            frontend: "React",
            backend: "Fastify",
            database: "PostgreSQL",
            infrastructure: "Docker",
          },
          tasks: [
            {
              title: "Task",
              description: "Task",
              priority: "medium",
            },
          ],
          roadmap: [],
        }),
      });
    const client = new OpenAiArchitectClient(baseConfig, createMockSdk(createImpl));

    await expect(client.generateProjectFromIdea("Build something")).resolves.toEqual(
      expect.objectContaining({
        product_overview: expect.objectContaining({ name: "Recovered project" }),
      }),
    );
    expect(createImpl).toHaveBeenCalledTimes(2);
  });

  it("returns fallback project after retries when OpenAI does not return valid JSON", async () => {
    const client = new OpenAiArchitectClient(
      baseConfig,
      createMockSdk(vi.fn().mockResolvedValue({ output_text: "not-json" })),
    );

    await expect(client.generateProjectFromIdea("Build something")).resolves.toEqual(
      expect.objectContaining({
        product_overview: expect.objectContaining({
          name: "Build something",
        }),
      }),
    );
  });

  it("normalizes OpenAI text when schema is close but not strictly valid", async () => {
    const client = new OpenAiArchitectClient(
      baseConfig,
      createMockSdk(
        vi.fn().mockResolvedValue({
          output_text: JSON.stringify({
            product_overview: {
              name: "Invalid",
              description: "Invalid",
              target_users: ["devs"],
            },
            architecture: {
              frontend: "React",
              backend: "Fastify",
              database: "PostgreSQL",
              infrastructure: "Docker",
            },
            tasks: [
              {
                title: "Task",
                description: "Task",
                priority: "urgent",
              },
            ],
            roadmap: [],
          }),
        }),
      ),
    );

    await expect(client.generateProjectFromIdea("Build something")).resolves.toEqual(
      expect.objectContaining({
        product_overview: expect.objectContaining({
          name: "Invalid",
        }),
        tasks: expect.arrayContaining([
          expect.objectContaining({
            title: "Task",
            priority: "high",
            type: "feature",
          }),
        ]),
      }),
    );
  });

  it("throws when OpenAI API request fails", async () => {
    const createImpl = vi.fn().mockRejectedValue(new Error("openai unavailable"));
    const client = new OpenAiArchitectClient(
      baseConfig,
      createMockSdk(createImpl),
    );

    await expect(client.generateProjectFromIdea("Build something")).rejects.toThrow(
      "openai unavailable",
    );
    expect(createImpl).toHaveBeenCalledTimes(3);
  });

  it("times out OpenAI calls when request exceeds timeout", async () => {
    const createImpl = vi.fn().mockImplementation(
      () => new Promise(() => undefined),
    );
    const client = new OpenAiArchitectClient(
      {
        ...baseConfig,
        timeoutMs: 5,
      },
      createMockSdk(createImpl),
    );

    await expect(client.generateProjectFromIdea("Build something")).rejects.toThrow(
      "OpenAI request timed out after 5ms.",
    );
    expect(createImpl).toHaveBeenCalledTimes(3);
  });

  it("sanitizes input before sending prompt", async () => {
    const createImpl = vi.fn().mockResolvedValue({
      output_text: JSON.stringify({
        product_overview: {
          name: "Sanitized project",
          description: "desc",
          target_users: ["devs"],
        },
        architecture: {
          frontend: "React",
          backend: "Fastify",
          database: "PostgreSQL",
          infrastructure: "Docker",
        },
        tasks: [
          {
            title: "Task",
            description: "Task",
            priority: "low",
          },
        ],
        roadmap: [],
      }),
    });
    const client = new OpenAiArchitectClient(baseConfig, createMockSdk(createImpl));

    const noisyIdea = `  Build\u0007   AI   app   ${"x".repeat(1300)}  `;
    await client.generateProjectFromIdea(noisyIdea);

    const calledInput = createImpl.mock.calls[0]?.[0]?.input as string;
    expect(calledInput).toContain("Build AI app");
    expect(calledInput).not.toContain("\u0007");
    const ideaSection = calledInput.split("Project idea:\n\n")[1] ?? "";
    expect(ideaSection.length).toBeLessThanOrEqual(4000);
  });
});
