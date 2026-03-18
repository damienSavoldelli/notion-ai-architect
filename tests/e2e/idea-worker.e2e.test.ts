import { describe, expect, it, vi } from "vitest";
import type { AiArchitectService } from "../../src/application/ports/ai-architect-service";
import type { GitHubRepository } from "../../src/application/ports/github-repository";
import type { NotionRepository } from "../../src/application/ports/notion-repository";
import { IdeaToProjectWorkflow } from "../../src/application/workflows/idea-to-project-workflow";
import { IdeaWorker } from "../../src/worker/idea-worker";

class InMemoryNotionRepository implements NotionRepository {
  public statusTransitions: Array<{ ideaId: string; status: "new" | "processing" | "done" | "error" }> = [];
  public ideaProjectLinks: Array<{ ideaId: string; projectId: string }> = [];
  public taskIssueLinks: Array<{ taskId: string; issueUrl: string }> = [];

  async listNewIdeas() {
    return [
      {
        id: "idea-1",
        title: "Build SaaS invoicing platform",
        status: "new" as const,
        createdAt: new Date("2026-03-16T15:00:00.000Z"),
      },
    ];
  }

  async updateIdeaStatus(
    ideaId: string,
    status: "new" | "processing" | "done" | "error",
  ) {
    this.statusTransitions.push({ ideaId, status });
  }

  async linkIdeaToProject(ideaId: string, projectId: string) {
    this.ideaProjectLinks.push({ ideaId, projectId });
  }

  async updateTaskGithubIssue(taskId: string, issueUrl: string) {
    this.taskIssueLinks.push({ taskId, issueUrl });
  }

  async createProject(input: {
    ideaId: string;
    name: string;
    productPlan: string;
    architecture: string;
  }) {
    return {
      id: "project-1",
      ideaId: input.ideaId,
      name: input.name,
      productPlan: input.productPlan,
      architecture: input.architecture,
      status: "draft" as const,
    };
  }

  async createTasks(input: {
    projectId: string;
    tasks: ReadonlyArray<{ title: string; description: string; priority: "low" | "medium" | "high" }>;
  }) {
    return input.tasks.map((task, index) => ({
      id: `task-${index + 1}`,
      projectId: input.projectId,
      title: task.title,
      description: task.description,
      status: "todo" as const,
      priority: task.priority,
    }));
  }
}

class InMemoryAiArchitectService implements AiArchitectService {
  async generateProjectFromIdea() {
    return {
      product_overview: {
        name: "SaaS Invoicing Platform",
        description: "Platform to manage invoices and reminders.",
        target_users: ["freelancers", "small teams"],
      },
      architecture: {
        frontend: "React",
        backend: "Fastify",
        database: "PostgreSQL",
        infrastructure: "Docker",
      },
      tasks: [
        {
          title: "Create invoice module",
          description: "Implement invoice entities and service.",
          priority: "high" as const,
        },
      ],
      roadmap: [
        {
          sprint: "Sprint 1",
          tasks: ["Create invoice module"],
        },
      ],
    };
  }
}

class InMemoryGitHubRepository implements GitHubRepository {
  public createdIssues: string[] = [];

  async createIssue() {
    const issueUrl = `https://github.com/acme/notion-ai-architect/issues/${this.createdIssues.length + 1}`;
    this.createdIssues.push(issueUrl);
    return issueUrl;
  }
}

describe("Idea worker e2e", () => {
  it("runs one cycle from idea to created GitHub issue", async () => {
    const notionRepository = new InMemoryNotionRepository();
    const aiService = new InMemoryAiArchitectService();
    const githubRepository = new InMemoryGitHubRepository();

    const workflow = new IdeaToProjectWorkflow(
      notionRepository,
      aiService,
      githubRepository,
    );
    const worker = new IdeaWorker(workflow);

    const logSpy = vi.spyOn(console, "log").mockImplementation(() => undefined);

    await worker.runOnce();

    expect(githubRepository.createdIssues).toEqual([
      "https://github.com/acme/notion-ai-architect/issues/1",
    ]);
    expect(notionRepository.statusTransitions).toEqual([
      { ideaId: "idea-1", status: "processing" },
      { ideaId: "idea-1", status: "done" },
    ]);
    expect(notionRepository.ideaProjectLinks).toEqual([
      { ideaId: "idea-1", projectId: "project-1" },
    ]);
    expect(notionRepository.taskIssueLinks).toEqual([
      {
        taskId: "task-1",
        issueUrl: "https://github.com/acme/notion-ai-architect/issues/1",
      },
    ]);
    expect(logSpy).toHaveBeenCalledWith(
      "Ideas processed=1, projects=1, tasks=1, issues=1",
    );

    logSpy.mockRestore();
  });
});
