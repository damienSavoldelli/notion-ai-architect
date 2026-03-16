import { describe, expect, it } from "vitest";
import { NotionClient } from "../../src/infrastructure/notion/notion-client";

describe("NotionClient stub", () => {
  const notionClient = new NotionClient({
    authToken: "test-token",
    ideasDatabaseId: "ideas-db",
    projectsDatabaseId: "projects-db",
    tasksDatabaseId: "tasks-db",
  });

  it("returns an empty ideas list for now", async () => {
    await expect(notionClient.listNewIdeas()).resolves.toEqual([]);
  });

  it("throws for createProject until implementation", async () => {
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
