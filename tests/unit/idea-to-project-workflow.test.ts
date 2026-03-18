import { describe, expect, it, vi } from "vitest";
import { IdeaToProjectWorkflow } from "../../src/application/workflows/idea-to-project-workflow";
import type { AiArchitectService } from "../../src/application/ports/ai-architect-service";
import type { GitHubRepository } from "../../src/application/ports/github-repository";
import type { NotionRepository } from "../../src/application/ports/notion-repository";

const createMocks = () => {
  const listNewIdeas = vi.fn();
  const updateIdeaStatus = vi.fn();
  const linkIdeaToProject = vi.fn();
  const updateTaskGithubIssue = vi.fn();
  const resetStaleProcessingIdeas = vi.fn().mockResolvedValue(0);
  const createProject = vi.fn();
  const createTasks = vi.fn();
  const generateProjectFromIdea = vi.fn();
  const createIssue = vi.fn();
  const findIssueUrlByTitle = vi.fn().mockResolvedValue(null);

  const notionRepository: NotionRepository = {
    listNewIdeas,
    resetStaleProcessingIdeas,
    updateIdeaStatus,
    linkIdeaToProject,
    updateTaskGithubIssue,
    createProject,
    createTasks,
  };

  const aiArchitectService: AiArchitectService = {
    generateProjectFromIdea,
  };

  const githubRepository: GitHubRepository = {
    findIssueUrlByTitle,
    createIssue,
  };

  return {
    notionRepository,
    aiArchitectService,
    githubRepository,
    listNewIdeas,
    createProject,
    createTasks,
    updateIdeaStatus,
    linkIdeaToProject,
    updateTaskGithubIssue,
    resetStaleProcessingIdeas,
    generateProjectFromIdea,
    createIssue,
    findIssueUrlByTitle,
  };
};

describe("IdeaToProjectWorkflow", () => {
  it("returns an empty summary when there are no new ideas", async () => {
    const {
      notionRepository,
      aiArchitectService,
      githubRepository,
      listNewIdeas,
      updateIdeaStatus,
      linkIdeaToProject,
      updateTaskGithubIssue,
      resetStaleProcessingIdeas,
    } = createMocks();
    listNewIdeas.mockResolvedValue([]);

    const workflow = new IdeaToProjectWorkflow(
      notionRepository,
      aiArchitectService,
      githubRepository,
    );

    await expect(workflow.runOnce()).resolves.toEqual({
      processedIdeas: 0,
      createdProjects: 0,
      createdTasks: 0,
      createdIssues: 0,
    });

    expect(aiArchitectService.generateProjectFromIdea).not.toHaveBeenCalled();
    expect(githubRepository.createIssue).not.toHaveBeenCalled();
    expect(updateIdeaStatus).not.toHaveBeenCalled();
    expect(linkIdeaToProject).not.toHaveBeenCalled();
    expect(updateTaskGithubIssue).not.toHaveBeenCalled();
    expect(resetStaleProcessingIdeas).toHaveBeenCalledWith(20);
  });

  it("orchestrates idea -> project -> tasks -> issues", async () => {
    const {
      notionRepository,
      aiArchitectService,
      githubRepository,
      listNewIdeas,
      generateProjectFromIdea,
      createProject,
      createTasks,
      updateIdeaStatus,
      linkIdeaToProject,
      updateTaskGithubIssue,
      createIssue,
      findIssueUrlByTitle,
    } = createMocks();
    listNewIdeas.mockResolvedValue([
      {
        id: "idea-1",
        title: "Build an AI CRM assistant",
        status: "new",
        createdAt: new Date("2026-03-16T12:00:00.000Z"),
      },
    ]);
    generateProjectFromIdea.mockResolvedValue({
      product_overview: {
        name: "AI CRM Assistant",
        description: "Automates CRM follow-up actions.",
        target_users: ["sales teams"],
      },
      architecture: {
        frontend: "React",
        backend: "Fastify",
        database: "PostgreSQL",
        infrastructure: "Docker",
      },
      tasks: [
        {
          title: "Setup backend",
          description: "Initialize API foundation.",
          priority: "high",
          type: "feature",
          labels: ["backend", "auth"],
          acceptance_criteria: [
            "API server starts successfully",
            "Health endpoint returns 200",
            "Core modules are wired",
          ],
        },
      ],
      roadmap: [{ sprint: "Sprint 1", tasks: ["Setup backend"] }],
    });
    createProject.mockResolvedValue({
      id: "project-1",
      ideaId: "idea-1",
      name: "AI CRM Assistant",
      productPlan: "Automates CRM follow-up actions.",
      architecture: "{}",
      status: "draft",
    });
    createTasks.mockResolvedValue([
      {
        id: "task-1",
        projectId: "project-1",
        title: "Setup backend",
        description: "Initialize API foundation.",
        status: "todo",
        priority: "high",
      },
    ]);
    createIssue.mockResolvedValue("https://github.com/acme/repo/issues/1");

    const workflow = new IdeaToProjectWorkflow(
      notionRepository,
      aiArchitectService,
      githubRepository,
    );

    await expect(workflow.runOnce()).resolves.toEqual({
      processedIdeas: 1,
      createdProjects: 1,
      createdTasks: 1,
      createdIssues: 1,
    });

    expect(aiArchitectService.generateProjectFromIdea).toHaveBeenCalledWith(
      "Build an AI CRM assistant",
    );
    expect(notionRepository.createProject).toHaveBeenCalledWith({
      ideaId: "idea-1",
      name: "AI CRM Assistant",
      productPlan: "Automates CRM follow-up actions.",
      architecture:
        "Frontend: React\nBackend: Fastify\nDatabase: PostgreSQL\nInfrastructure: Docker",
      architectureJson: `{
  "frontend": "React",
  "backend": "Fastify",
  "database": "PostgreSQL",
  "infrastructure": "Docker"
}`,
    });
    expect(notionRepository.createTasks).toHaveBeenCalledWith({
      projectId: "project-1",
      tasks: [
        {
          title: "Setup backend",
          description: "Initialize API foundation.",
          priority: "high",
        },
      ],
    });
    expect(linkIdeaToProject).toHaveBeenCalledWith("idea-1", "project-1");
    const issuePayload = createIssue.mock.calls[0]?.[0];
    expect(issuePayload).toMatchObject({
      title: "[AI][AI CRM Assistant] Setup backend",
      labels: [
        "AI",
        "high",
        "feature",
        "priority:high",
        "project:ai-crm-assistant",
        "domain:auth",
        "domain:api",
        "backend",
        "auth",
      ],
    });
    expect(issuePayload?.body).toContain("## 🧱 Implementation Scope");
    expect(issuePayload?.body).toContain("## 🛠 Technical Notes");
    expect(issuePayload?.body).toContain("token lifecycle");
    expect(updateTaskGithubIssue).toHaveBeenCalledWith(
      "task-1",
      "https://github.com/acme/repo/issues/1",
    );
    expect(findIssueUrlByTitle).toHaveBeenCalledWith(
      "[AI][AI CRM Assistant] Setup backend",
    );
    expect(updateIdeaStatus).toHaveBeenNthCalledWith(1, "idea-1", "processing");
    expect(updateIdeaStatus).toHaveBeenNthCalledWith(2, "idea-1", "done");
  });

  it("builds AI input from title + content when idea content exists", async () => {
    const {
      notionRepository,
      aiArchitectService,
      githubRepository,
      listNewIdeas,
      generateProjectFromIdea,
      createProject,
      createTasks,
      createIssue,
      findIssueUrlByTitle,
    } = createMocks();

    listNewIdeas.mockResolvedValue([
      {
        id: "idea-1",
        title: "Build a freelancer invoice app",
        content: "Core problem\n\nFreelancers lose track of payment reminders.",
        status: "new",
        createdAt: new Date("2026-03-16T12:00:00.000Z"),
      },
    ]);
    generateProjectFromIdea.mockResolvedValue({
      product_overview: {
        name: "Invoice app",
        description: "desc",
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
          title: "Task 1",
          description: "Task",
          priority: "medium",
        },
      ],
      roadmap: [{ sprint: "Sprint 1", tasks: ["Task 1"] }],
    });
    createProject.mockResolvedValue({
      id: "project-1",
      ideaId: "idea-1",
      name: "Invoice app",
      productPlan: "desc",
      architecture: "{}",
      status: "draft",
    });
    createTasks.mockResolvedValue([
      {
        id: "task-1",
        projectId: "project-1",
        title: "Task 1",
        description: "Task",
        status: "todo",
        priority: "medium",
      },
    ]);
    createIssue.mockResolvedValue("https://github.com/acme/repo/issues/1");

    const workflow = new IdeaToProjectWorkflow(
      notionRepository,
      aiArchitectService,
      githubRepository,
    );

    await workflow.runOnce();

    expect(generateProjectFromIdea).toHaveBeenCalledWith(
      "Build a freelancer invoice app\n\nCore problem\nFreelancers lose track of payment reminders.",
    );
    expect(findIssueUrlByTitle).toHaveBeenCalledWith(
      "[AI][Invoice app] Task 1",
    );
  });

  it("falls back to title-only AI input when content is empty", async () => {
    const {
      notionRepository,
      aiArchitectService,
      githubRepository,
      listNewIdeas,
      generateProjectFromIdea,
      createProject,
      createTasks,
      createIssue,
    } = createMocks();

    listNewIdeas.mockResolvedValue([
      {
        id: "idea-1",
        title: "Build a freelancer invoice app",
        content: " \n \n ",
        status: "new",
        createdAt: new Date("2026-03-16T12:00:00.000Z"),
      },
    ]);
    generateProjectFromIdea.mockResolvedValue({
      product_overview: {
        name: "Invoice app",
        description: "desc",
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
          title: "Task 1",
          description: "Task",
          priority: "medium",
        },
      ],
      roadmap: [{ sprint: "Sprint 1", tasks: ["Task 1"] }],
    });
    createProject.mockResolvedValue({
      id: "project-1",
      ideaId: "idea-1",
      name: "Invoice app",
      productPlan: "desc",
      architecture: "{}",
      status: "draft",
    });
    createTasks.mockResolvedValue([
      {
        id: "task-1",
        projectId: "project-1",
        title: "Task 1",
        description: "Task",
        status: "todo",
        priority: "medium",
      },
    ]);
    createIssue.mockResolvedValue("https://github.com/acme/repo/issues/1");

    const workflow = new IdeaToProjectWorkflow(
      notionRepository,
      aiArchitectService,
      githubRepository,
    );

    await workflow.runOnce();

    expect(generateProjectFromIdea).toHaveBeenCalledWith(
      "Build a freelancer invoice app",
    );
  });

  it("sets idea status to error when processing fails and continues without crashing", async () => {
    const {
      notionRepository,
      aiArchitectService,
      githubRepository,
      listNewIdeas,
      generateProjectFromIdea,
      updateIdeaStatus,
      linkIdeaToProject,
      updateTaskGithubIssue,
    } = createMocks();
    listNewIdeas.mockResolvedValue([
      {
        id: "idea-1",
        title: "Broken idea",
        status: "new",
        createdAt: new Date("2026-03-16T12:00:00.000Z"),
      },
    ]);
    generateProjectFromIdea.mockRejectedValue(new Error("AI failed"));

    const workflow = new IdeaToProjectWorkflow(
      notionRepository,
      aiArchitectService,
      githubRepository,
      { retryDelayMs: 0 },
    );

    await expect(workflow.runOnce()).resolves.toEqual({
      processedIdeas: 0,
      createdProjects: 0,
      createdTasks: 0,
      createdIssues: 0,
    });

    expect(updateIdeaStatus).toHaveBeenNthCalledWith(1, "idea-1", "processing");
    expect(updateIdeaStatus).toHaveBeenNthCalledWith(2, "idea-1", "error");
    expect(linkIdeaToProject).not.toHaveBeenCalled();
    expect(updateTaskGithubIssue).not.toHaveBeenCalled();
  });

  it("retries transient AI failure and succeeds", async () => {
    const {
      notionRepository,
      aiArchitectService,
      githubRepository,
      listNewIdeas,
      generateProjectFromIdea,
      createProject,
      createTasks,
      createIssue,
      updateIdeaStatus,
    } = createMocks();

    listNewIdeas.mockResolvedValue([
      {
        id: "idea-1",
        title: "Retry AI generation",
        status: "new",
        createdAt: new Date("2026-03-16T12:00:00.000Z"),
      },
    ]);
    generateProjectFromIdea
      .mockRejectedValueOnce(new Error("rate limited"))
      .mockResolvedValueOnce({
        product_overview: {
          name: "Retry project",
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
            title: "Task 1",
            description: "Task",
            priority: "medium",
          },
        ],
        roadmap: [{ sprint: "Sprint 1", tasks: ["Task 1"] }],
      });
    createProject.mockResolvedValue({
      id: "project-1",
      ideaId: "idea-1",
      name: "Retry project",
      productPlan: "desc",
      architecture: "{}",
      status: "draft",
    });
    createTasks.mockResolvedValue([
      {
        id: "task-1",
        projectId: "project-1",
        title: "Task 1",
        description: "Task",
        status: "todo",
        priority: "medium",
      },
    ]);
    createIssue.mockResolvedValue("https://github.com/acme/repo/issues/1");

    const workflow = new IdeaToProjectWorkflow(
      notionRepository,
      aiArchitectService,
      githubRepository,
      { retryDelayMs: 0 },
    );

    await expect(workflow.runOnce()).resolves.toEqual({
      processedIdeas: 1,
      createdProjects: 1,
      createdTasks: 1,
      createdIssues: 1,
    });

    expect(generateProjectFromIdea).toHaveBeenCalledTimes(2);
    expect(updateIdeaStatus).toHaveBeenNthCalledWith(1, "idea-1", "processing");
    expect(updateIdeaStatus).toHaveBeenNthCalledWith(2, "idea-1", "done");
  });

  it("reuses existing GitHub issue when title already exists", async () => {
    const {
      notionRepository,
      aiArchitectService,
      githubRepository,
      listNewIdeas,
      generateProjectFromIdea,
      createProject,
      createTasks,
      createIssue,
      findIssueUrlByTitle,
      updateTaskGithubIssue,
    } = createMocks();

    listNewIdeas.mockResolvedValue([
      {
        id: "idea-1",
        title: "Duplicate issue prevention",
        status: "new",
        createdAt: new Date("2026-03-16T12:00:00.000Z"),
      },
    ]);
    generateProjectFromIdea.mockResolvedValue({
      product_overview: {
        name: "Duplicate-safe project",
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
          title: "Task 1",
          description: "Task",
          priority: "medium",
        },
      ],
      roadmap: [{ sprint: "Sprint 1", tasks: ["Task 1"] }],
    });
    createProject.mockResolvedValue({
      id: "project-1",
      ideaId: "idea-1",
      name: "Duplicate-safe project",
      productPlan: "desc",
      architecture: "{}",
      status: "draft",
    });
    createTasks.mockResolvedValue([
      {
        id: "task-1",
        projectId: "project-1",
        title: "Task 1",
        description: "Task",
        status: "todo",
        priority: "medium",
      },
    ]);
    findIssueUrlByTitle.mockResolvedValue(
      "https://github.com/acme/repo/issues/42",
    );

    const workflow = new IdeaToProjectWorkflow(
      notionRepository,
      aiArchitectService,
      githubRepository,
    );

    await expect(workflow.runOnce()).resolves.toEqual({
      processedIdeas: 1,
      createdProjects: 1,
      createdTasks: 1,
      createdIssues: 0,
    });

    expect(createIssue).not.toHaveBeenCalled();
    expect(updateTaskGithubIssue).toHaveBeenCalledWith(
      "task-1",
      "https://github.com/acme/repo/issues/42",
    );
  });
});
