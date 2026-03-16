import { describe, expect, it } from "vitest";
import { loadEnv } from "../../src/config/env";

describe("loadEnv", () => {
  it("loads a valid environment object", () => {
    const env = loadEnv({
      NOTION_API_TOKEN: "notion-token",
      NOTION_IDEAS_DATABASE_ID: "ideas-id",
      NOTION_PROJECTS_DATABASE_ID: "projects-id",
      NOTION_TASKS_DATABASE_ID: "tasks-id",
      OPENAI_API_KEY: "openai-key",
      OPENAI_MODEL: "gpt-5.2",
      GITHUB_TOKEN: "github-token",
      GITHUB_OWNER: "acme",
      GITHUB_REPO: "notion-ai-architect",
    });

    expect(env.OPENAI_MODEL).toBe("gpt-5.2");
    expect(env.GITHUB_REPO).toBe("notion-ai-architect");
  });

  it("throws when required values are missing", () => {
    expect(() =>
      loadEnv({
        NOTION_API_TOKEN: "",
      }),
    ).toThrow();
  });
});
