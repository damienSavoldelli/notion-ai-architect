import type { Client } from "@notionhq/client";
import { describe, expect, it, vi } from "vitest";
import { NotionClient } from "../../src/infrastructure/notion/notion-client";

const baseConfig = {
  authToken: "test-token",
  ideasDatabaseId: "ideas-db",
  projectsDatabaseId: "projects-db",
  tasksDatabaseId: "tasks-db",
};

const createMockSdk = (queryImpl: () => Promise<unknown>) =>
  ({
    dataSources: {
      query: vi.fn(queryImpl),
    },
  }) as unknown as Client;

describe("NotionClient", () => {
  it("maps Notion pages into Idea entities and paginates", async () => {
    const mockSdk = createMockSdk(
      vi
        .fn()
        .mockResolvedValueOnce({
          results: [
            {
              object: "page",
              id: "idea-1",
              created_time: "2026-03-16T10:00:00.000Z",
              properties: {
                Title: {
                  type: "title",
                  title: [{ plain_text: "Build SaaS invoicing tool" }],
                },
                Status: {
                  type: "select",
                  select: { name: "new" },
                },
              },
            },
          ],
          has_more: true,
          next_cursor: "cursor-1",
        })
        .mockResolvedValueOnce({
          results: [
            {
              object: "page",
              id: "idea-2",
              created_time: "2026-03-16T11:00:00.000Z",
              properties: {
                Title: {
                  type: "title",
                  title: [{ plain_text: "Build AI CRM assistant" }],
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
        }),
    );
    const notionClient = new NotionClient(baseConfig, mockSdk);

    await expect(notionClient.listNewIdeas()).resolves.toEqual([
      {
        id: "idea-1",
        title: "Build SaaS invoicing tool",
        status: "new",
        createdAt: new Date("2026-03-16T10:00:00.000Z"),
      },
      {
        id: "idea-2",
        title: "Build AI CRM assistant",
        status: "new",
        createdAt: new Date("2026-03-16T11:00:00.000Z"),
      },
    ]);
  });

  it("ignores invalid pages from Notion response", async () => {
    const mockSdk = createMockSdk(
      vi.fn().mockResolvedValue({
        results: [
          {
            object: "database",
            id: "not-a-page",
          },
          {
            object: "page",
            id: "idea-1",
            created_time: "not-a-date",
            properties: {
              Title: {
                type: "title",
                title: [{ plain_text: "Bad idea payload" }],
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
      }),
    );
    const notionClient = new NotionClient(baseConfig, mockSdk);

    await expect(notionClient.listNewIdeas()).resolves.toEqual([]);
  });

  it("throws for createProject until implementation", async () => {
    const notionClient = new NotionClient(baseConfig, createMockSdk(vi.fn()));

    await expect(
      notionClient.createProject({
        ideaId: "idea-1",
        name: "Demo project",
        productPlan: "Plan",
        architecture: "Architecture",
      }),
    ).rejects.toThrow("NotionClient.createProject is not implemented yet.");
  });

  it("throws for createTasks until implementation", async () => {
    const notionClient = new NotionClient(baseConfig, createMockSdk(vi.fn()));

    await expect(
      notionClient.createTasks({
        projectId: "project-1",
        tasks: [
          {
            title: "Task",
            description: "Task description",
            priority: "medium",
          },
        ],
      }),
    ).rejects.toThrow("NotionClient.createTasks is not implemented yet.");
  });
});
