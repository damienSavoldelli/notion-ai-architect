import type { Client } from "@notionhq/client";
import { describe, expect, it, vi } from "vitest";
import { NotionClient } from "../../src/infrastructure/notion/notion-client";

const baseConfig = {
  authToken: "test-token",
  ideasDatabaseId: "ideas-db",
  projectsDatabaseId: "projects-db",
  tasksDatabaseId: "tasks-db",
};

const createMockSdk = (params?: {
  queryImpl?: () => Promise<unknown>;
  createPageImpl?: () => Promise<unknown>;
}) =>
  ({
    dataSources: {
      query: vi.fn(
        params?.queryImpl ??
          vi.fn().mockResolvedValue({
            results: [],
            has_more: false,
            next_cursor: null,
          }),
      ),
    },
    pages: {
      create: vi.fn(
        params?.createPageImpl ?? vi.fn().mockResolvedValue({ object: "page", id: "p-1" }),
      ),
    },
  }) as unknown as Client;

describe("NotionClient", () => {
  it("maps Notion pages into Idea entities and paginates", async () => {
    const mockSdk = createMockSdk({
      queryImpl: vi
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
    });
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
    const mockSdk = createMockSdk({
      queryImpl: vi.fn().mockResolvedValue({
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
    });
    const notionClient = new NotionClient(baseConfig, mockSdk);

    await expect(notionClient.listNewIdeas()).resolves.toEqual([]);
  });

  it("creates a project page and returns the mapped Project entity", async () => {
    const createPageImpl = vi.fn().mockResolvedValue({
      object: "page",
      id: "project-1",
    });
    const mockSdk = createMockSdk({ createPageImpl });
    const notionClient = new NotionClient(baseConfig, mockSdk);

    await expect(
      notionClient.createProject({
        ideaId: "idea-1",
        name: "Billing SaaS",
        productPlan: "MVP with auth, billing and invoices",
        architecture: "Fastify + Postgres + Redis",
      }),
    ).resolves.toEqual({
      id: "project-1",
      ideaId: "idea-1",
      name: "Billing SaaS",
      productPlan: "MVP with auth, billing and invoices",
      architecture: "Fastify + Postgres + Redis",
      status: "draft",
    });

    expect(createPageImpl).toHaveBeenCalledWith({
      parent: {
        data_source_id: "projects-db",
      },
      properties: {
        Name: {
          title: [
            {
              type: "text",
              text: {
                content: "Billing SaaS",
              },
            },
          ],
        },
        Idea: {
          relation: [{ id: "idea-1" }],
        },
        "Product Plan": {
          rich_text: [
            {
              type: "text",
              text: {
                content: "MVP with auth, billing and invoices",
              },
            },
          ],
        },
        Architecture: {
          rich_text: [
            {
              type: "text",
              text: {
                content: "Fastify + Postgres + Redis",
              },
            },
          ],
        },
        Status: {
          select: { name: "draft" },
        },
      },
    });
  });

  it("throws when Notion create page response is invalid", async () => {
    const mockSdk = createMockSdk({
      createPageImpl: vi.fn().mockResolvedValue({ object: "list" }),
    });
    const notionClient = new NotionClient(baseConfig, mockSdk);

    await expect(
      notionClient.createProject({
        ideaId: "idea-1",
        name: "Demo project",
        productPlan: "Plan",
        architecture: "Architecture",
      }),
    ).rejects.toThrow("NotionClient.createProject returned an invalid page.");
  });

  it("creates tasks pages and returns mapped Task entities", async () => {
    const createPageImpl = vi
      .fn()
      .mockResolvedValueOnce({ object: "page", id: "task-1" })
      .mockResolvedValueOnce({ object: "page", id: "task-2" });
    const notionClient = new NotionClient(
      baseConfig,
      createMockSdk({ createPageImpl }),
    );

    await expect(
      notionClient.createTasks({
        projectId: "project-1",
        tasks: [
          {
            title: "Setup auth",
            description: "Add auth endpoints",
            priority: "high",
          },
          {
            title: "Setup billing",
            description: "Integrate Stripe",
            priority: "medium",
          },
        ],
      }),
    ).resolves.toEqual([
      {
        id: "task-1",
        projectId: "project-1",
        title: "Setup auth",
        description: "Add auth endpoints",
        status: "todo",
        priority: "high",
      },
      {
        id: "task-2",
        projectId: "project-1",
        title: "Setup billing",
        description: "Integrate Stripe",
        status: "todo",
        priority: "medium",
      },
    ]);

    expect(createPageImpl).toHaveBeenCalledTimes(2);
    expect(createPageImpl).toHaveBeenNthCalledWith(1, {
      parent: {
        data_source_id: "tasks-db",
      },
      properties: {
        Task: {
          title: [
            {
              type: "text",
              text: {
                content: "Setup auth",
              },
            },
          ],
        },
        Project: {
          relation: [{ id: "project-1" }],
        },
        Status: {
          select: { name: "todo" },
        },
        Priority: {
          select: { name: "high" },
        },
      },
    });
  });

  it("throws when a created task page response is invalid", async () => {
    const notionClient = new NotionClient(
      baseConfig,
      createMockSdk({
        createPageImpl: vi.fn().mockResolvedValue({ object: "list" }),
      }),
    );

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
    ).rejects.toThrow("NotionClient.createTasks returned an invalid page.");
  });
});
