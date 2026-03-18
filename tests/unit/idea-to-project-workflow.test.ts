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
  const createProject = vi.fn();
  const createTasks = vi.fn();
  const generateProjectFromIdea = vi.fn();
  const createIssue = vi.fn();

  const notionRepository: NotionRepository = {
    listNewIdeas,
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
    generateProjectFromIdea,
    createIssue,
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
    expect(githubRepository.createIssue).toHaveBeenCalledWith({
      title: "[AI][AI CRM Assistant] Setup backend",
      body: `## 📦 Project

AI CRM Assistant

---

## 🧩 Task Overview

Initialize API foundation.

---

## 🎯 Objective

Implement this feature to improve the product functionality.

---

## ✅ Acceptance Criteria

- [ ] API server starts successfully
- [ ] Health endpoint returns 200
- [ ] Core modules are wired

---

## 🏷 Metadata

- Priority: high
- Type: feature
- Source: AI-generated from Notion

---`,
      labels: [
        "AI",
        "high",
        "feature",
        "project:ai-crm-assistant",
        "backend",
        "auth",
      ],
    });
    expect(updateTaskGithubIssue).toHaveBeenCalledWith(
      "task-1",
      "https://github.com/acme/repo/issues/1",
    );
    expect(updateIdeaStatus).toHaveBeenNthCalledWith(1, "idea-1", "processing");
    expect(updateIdeaStatus).toHaveBeenNthCalledWith(2, "idea-1", "done");
  });

  it("sets idea status to error when processing fails", async () => {
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
    );

    await expect(workflow.runOnce()).rejects.toThrow("AI failed");

    expect(updateIdeaStatus).toHaveBeenNthCalledWith(1, "idea-1", "processing");
    expect(updateIdeaStatus).toHaveBeenNthCalledWith(2, "idea-1", "error");
    expect(linkIdeaToProject).not.toHaveBeenCalled();
    expect(updateTaskGithubIssue).not.toHaveBeenCalled();
  });
});
