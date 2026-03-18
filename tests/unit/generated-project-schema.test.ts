import { describe, expect, it } from "vitest";
import { parseGeneratedProject } from "../../src/infrastructure/ai/generated-project-schema";

describe("generatedProjectSchema", () => {
  it("parses a valid generated project payload", () => {
    const parsed = parseGeneratedProject({
      product_overview: {
        name: "Notion AI Architect",
        description: "Transforms ideas into executable projects.",
        target_users: "developers, product teams",
        core_features: ["Idea ingestion", "Task generation"],
      },
      architecture: {
        frontend: "Not required for MVP",
        backend: "Fastify + Effect",
        database: "Notion workspace databases",
        infrastructure: "Bun worker + GitHub API",
        external_services: ["OpenAI", "Notion", "GitHub"],
      },
      tasks: [
        {
          title: "Setup worker polling",
          description: "Read new ideas from Notion.",
          priority: "high",
          technical_notes: "Run every 30 seconds with idempotent status handling.",
        },
      ],
      roadmap: [
        {
          sprint: "Sprint 1",
          tasks: ["Setup repo", "Notion integration"],
        },
      ],
    });

    expect(parsed.product_overview.name).toBe("Notion AI Architect");
    expect(parsed.product_overview.target_users).toEqual([
      "developers",
      "product teams",
    ]);
    expect(parsed.tasks[0]?.priority).toBe("high");
  });

  it("rejects an invalid task priority", () => {
    expect(() =>
      parseGeneratedProject({
        product_overview: {
          name: "Test",
          description: "Test",
          target_users: ["devs"],
        },
        architecture: {
          frontend: "none",
          backend: "api",
          database: "db",
          infrastructure: "infra",
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
    ).toThrow();
  });
});
