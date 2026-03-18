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
    ).resolves.toMatchObject({
      product_overview: { name: "AI CRM Assistant" },
      tasks: [{ priority: "high" }],
    });

    expect(createImpl).toHaveBeenCalledTimes(1);
    expect(createImpl).toHaveBeenCalledWith({
      model: "gpt-5.2",
      input: expect.stringContaining("Build an AI CRM assistant"),
      temperature: 0.2,
    });
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

    await expect(client.generateProjectFromIdea("Build something")).resolves.toMatchObject({
      product_overview: { name: "Recovered project" },
    });
    expect(createImpl).toHaveBeenCalledTimes(2);
  });

  it("throws after retries when OpenAI does not return valid JSON", async () => {
    const client = new OpenAiArchitectClient(
      baseConfig,
      createMockSdk(vi.fn().mockResolvedValue({ output_text: "not-json" })),
    );

    await expect(
      client.generateProjectFromIdea("Build something"),
    ).rejects.toThrow("OpenAI response is not valid JSON after retries.");
  });

  it("throws after retries when OpenAI text does not match expected schema", async () => {
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

    await expect(client.generateProjectFromIdea("Build something")).rejects.toThrow(
      "OpenAI response JSON does not match expected schema after retries.",
    );
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
    expect(calledInput.length).toBeLessThan(4000);
  });
});
