import { describe, expect, it, vi } from "vitest";
import { IdeaToProjectWorkflow } from "../../src/application/workflows/idea-to-project-workflow";
import { OpenAiArchitectClient } from "../../src/infrastructure/ai/openai-architect-client";
import { GitHubClient } from "../../src/infrastructure/github/github-client";
import { NotionClient } from "../../src/infrastructure/notion/notion-client";

describe("Workflow integration", () => {
  it("runs the full flow with infrastructure adapters", async () => {
    const notionQuery = vi.fn().mockResolvedValue({
      results: [
        {
          object: "page",
          id: "idea-1",
          created_time: "2026-03-16T14:00:00.000Z",
          properties: {
            Title: {
              type: "title",
              title: [{ plain_text: "Build AI invoicing assistant" }],
            },
            Status: {
              type: "select",
              select: { name: "new" },
            },
          },
        },
      ],
      has_more: false,
      next_cursor: null,
    });
    const notionCreatePage = vi
      .fn()
      .mockResolvedValueOnce({ object: "page", id: "project-1" })
      .mockResolvedValueOnce({ object: "page", id: "task-1" });
    const notionUpdatePage = vi.fn().mockResolvedValue({
      object: "page",
      id: "idea-1",
    });
    const notionRepository = new NotionClient(
      {
        authToken: "notion-token",
        ideasDatabaseId: "ideas-ds",
        projectsDatabaseId: "projects-ds",
        tasksDatabaseId: "tasks-ds",
      },
      {
        dataSources: { query: notionQuery },
        pages: { create: notionCreatePage, update: notionUpdatePage },
      } as never,
    );

    const aiCreateResponse = vi.fn().mockResolvedValue({
      output_text: JSON.stringify({
        product_overview: {
          name: "AI Invoicing Assistant",
          description: "Automates invoice generation and reminders.",
          target_users: ["freelancers"],
        },
        architecture: {
          frontend: "React",
          backend: "Fastify",
          database: "PostgreSQL",
          infrastructure: "Docker",
        },
        tasks: [
          {
            title: "Setup invoice domain",
            description: "Create invoice core entities.",
            priority: "high",
            type: "feature",
            labels: ["backend", "billing"],
            acceptance_criteria: [
              "Invoice entity supports totals and taxes",
              "Invoice repository has create/read operations",
            ],
          },
        ],
        roadmap: [{ sprint: "Sprint 1", tasks: ["Setup invoice domain"] }],
      }),
    });
    const aiService = new OpenAiArchitectClient(
      {
        apiKey: "openai-key",
        model: "gpt-5.2",
      },
      {
        responses: { create: aiCreateResponse },
      },
    );

    const githubCreateIssue = vi.fn().mockResolvedValue({
      data: { html_url: "https://github.com/acme/notion-ai-architect/issues/1" },
    });
    const githubRepository = new GitHubClient(
      {
        token: "github-token",
        owner: "acme",
        repo: "notion-ai-architect",
      },
      {
        issues: { create: githubCreateIssue },
      },
    );

    const workflow = new IdeaToProjectWorkflow(
      notionRepository,
      aiService,
      githubRepository,
    );

    await expect(workflow.runOnce()).resolves.toEqual({
      processedIdeas: 1,
      createdProjects: 1,
      createdTasks: 1,
      createdIssues: 1,
    });

    expect(aiCreateResponse).toHaveBeenCalledTimes(1);
    expect(githubCreateIssue).toHaveBeenCalledTimes(1);
    expect(notionUpdatePage).toHaveBeenNthCalledWith(1, {
      page_id: "idea-1",
      properties: {
        Status: {
          select: {
            name: "processing",
          },
        },
      },
    });
    expect(notionUpdatePage).toHaveBeenNthCalledWith(2, {
      page_id: "idea-1",
      properties: {
        Project: {
          relation: [{ id: "project-1" }],
        },
      },
    });
    expect(notionUpdatePage).toHaveBeenNthCalledWith(3, {
      page_id: "task-1",
      properties: {
        "GitHub Issue": {
          url: "https://github.com/acme/notion-ai-architect/issues/1",
        },
      },
    });
    expect(notionUpdatePage).toHaveBeenNthCalledWith(4, {
      page_id: "idea-1",
      properties: {
        Status: {
          select: {
            name: "done",
          },
        },
      },
    });
    expect(githubCreateIssue).toHaveBeenCalledWith({
      owner: "acme",
      repo: "notion-ai-architect",
      title: "[AI] Setup invoice domain",
      body: `## 🧩 Task Overview

Create invoice core entities.

---

## 🎯 Objective

Implement this feature to improve the product functionality.

---

## ✅ Acceptance Criteria

- [ ] Invoice entity supports totals and taxes
- [ ] Invoice repository has create/read operations

---

## 🏷 Metadata

- Priority: high
- Type: feature
- Source: AI-generated from Notion

---`,
      labels: ["AI", "high", "feature", "backend", "billing"],
    });
  });
});
