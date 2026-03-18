import type { AiArchitectService } from "../ports/ai-architect-service";
import type { GitHubRepository } from "../ports/github-repository";
import type { NotionRepository } from "../ports/notion-repository";
import type { TechnicalArchitecture } from "../../domain/entities/generated-project";
import {
  mapTaskToGithubIssue,
  type GithubIssueTaskInput,
} from "./github-issue-mapper";

export interface WorkflowRunSummary {
  processedIdeas: number;
  createdProjects: number;
  createdTasks: number;
  createdIssues: number;
}

interface WorkflowOptions {
  retryAttempts?: number;
  retryDelayMs?: number;
  processingRecoveryTimeoutMinutes?: number;
}

interface ResolvedWorkflowOptions {
  retryAttempts: number;
  retryDelayMs: number;
  processingRecoveryTimeoutMinutes: number;
}

interface GithubIssueResult {
  issueUrl: string;
  created: boolean;
}

const DEFAULT_WORKFLOW_OPTIONS: ResolvedWorkflowOptions = {
  retryAttempts: 3,
  retryDelayMs: 250,
  processingRecoveryTimeoutMinutes: 20,
};

export class IdeaToProjectWorkflow {
  private readonly options: ResolvedWorkflowOptions;

  constructor(
    private readonly notionRepository: NotionRepository,
    private readonly aiArchitectService: AiArchitectService,
    private readonly githubRepository: GitHubRepository,
    options: WorkflowOptions = {},
  ) {
    this.options = {
      ...DEFAULT_WORKFLOW_OPTIONS,
      ...options,
    };
  }

  async runOnce(): Promise<WorkflowRunSummary> {
    const summary: WorkflowRunSummary = {
      processedIdeas: 0,
      createdProjects: 0,
      createdTasks: 0,
      createdIssues: 0,
    };

    console.log("[Worker] Starting workflow cycle.");
    let ideas: ReadonlyArray<{ id: string; title: string; content?: string }> = [];

    try {
      await this.recoverStaleProcessingIdeas();
      ideas = await this.executeWithRetry(
        () => this.notionRepository.listNewIdeas(),
        "listNewIdeas",
      );
    } catch (error) {
      console.error("[Worker] Failed before idea processing started.", error);
      return summary;
    }

    console.log(`[Worker] Found ${ideas.length} new idea(s) to process.`);

    for (const idea of ideas) {
      const logPrefix = `[Worker][Idea ${idea.id}]`;
      console.log(`${logPrefix} Processing "${idea.title}".`);
      await this.executeWithRetry(
        () => this.notionRepository.updateIdeaStatus(idea.id, "processing"),
        `${idea.id}:status-processing`,
      );

      try {
        const aiStart = Date.now();
        const ideaInput = buildIdeaAiInput(idea.title, idea.content);
        console.log(`${logPrefix} Calling OpenAI architect.`);
        const generatedProject =
          await this.executeWithRetry(
            () => this.aiArchitectService.generateProjectFromIdea(ideaInput),
            `${idea.id}:generate-project`,
          );
        console.log(
          `${logPrefix} OpenAI completed in ${Date.now() - aiStart}ms.`,
        );

        const architectureJson = JSON.stringify(
          generatedProject.architecture,
          null,
          2,
        );

        console.log(`${logPrefix} Creating Notion project.`);
        const project = await this.notionRepository.createProject({
          ideaId: idea.id,
          name: generatedProject.product_overview.name,
          productPlan: generatedProject.product_overview.description,
          architecture: formatArchitectureText(generatedProject.architecture),
          architectureJson,
        });
        await this.executeWithRetry(
          () => this.notionRepository.linkIdeaToProject(idea.id, project.id),
          `${idea.id}:link-project`,
        );

        console.log(
          `${logPrefix} Creating ${generatedProject.tasks.length} task(s) in Notion.`,
        );
        const createdTasks = await this.notionRepository.createTasks({
          projectId: project.id,
          tasks: generatedProject.tasks.map((task) => ({
            title: task.title,
            description: task.description,
            priority: task.priority,
          })),
        });

        for (const [index, task] of createdTasks.entries()) {
          const sourceTask = generatedProject.tasks[index];

          const issueTaskInput: GithubIssueTaskInput = {
            projectName: project.name,
            title: sourceTask?.title ?? task.title,
            description: sourceTask?.description ?? task.description,
            priority: sourceTask?.priority ?? task.priority,
            type: sourceTask?.type,
            labels: sourceTask?.labels,
            acceptance_criteria: sourceTask?.acceptance_criteria,
            technical_notes: sourceTask?.technical_notes,
          };

          const issue = await this.createGithubIssue(issueTaskInput);
          await this.executeWithRetry(
            () => this.notionRepository.updateTaskGithubIssue(task.id, issue.issueUrl),
            `${idea.id}:link-task-issue:${task.id}`,
          );

          if (issue.created) {
            summary.createdIssues += 1;
            console.log(`${logPrefix} Created GitHub issue for task "${task.title}".`);
          } else {
            console.log(
              `${logPrefix} Reused existing GitHub issue for task "${task.title}".`,
            );
          }
        }

        await this.executeWithRetry(
          () => this.notionRepository.updateIdeaStatus(idea.id, "done"),
          `${idea.id}:status-done`,
        );

        summary.processedIdeas += 1;
        summary.createdProjects += 1;
        summary.createdTasks += createdTasks.length;
        console.log(`${logPrefix} Completed successfully.`);
      } catch (error) {
        console.error(`${logPrefix} Failed to process idea.`, error);
        await this.safeUpdateIdeaStatus(idea.id, "error", `${idea.id}:status-error`);
      }
    }

    console.log(
      `[Worker] Workflow summary: ideas=${summary.processedIdeas}, projects=${summary.createdProjects}, tasks=${summary.createdTasks}, issues=${summary.createdIssues}`,
    );

    return summary;
  }

  private async createGithubIssue(
    task: GithubIssueTaskInput,
  ): Promise<GithubIssueResult> {
    const mappedIssue = mapTaskToGithubIssue(task);

    const existingIssueUrl = await this.findExistingIssueByTitle(mappedIssue.title);
    if (existingIssueUrl) {
      return {
        issueUrl: existingIssueUrl,
        created: false,
      };
    }

    return this.executeWithRetry(async () => {
      const duplicate = await this.findExistingIssueByTitle(mappedIssue.title);
      if (duplicate) {
        return {
          issueUrl: duplicate,
          created: false,
        };
      }

      const createdUrl = await this.githubRepository.createIssue(mappedIssue);
      return {
        issueUrl: createdUrl,
        created: true,
      };
    }, `createIssue:${mappedIssue.title}`);
  }

  private async recoverStaleProcessingIdeas(): Promise<void> {
    if (typeof this.notionRepository.resetStaleProcessingIdeas !== "function") {
      return;
    }

    try {
      const recoveredCount = await this.executeWithRetry(
        () =>
          this.notionRepository.resetStaleProcessingIdeas!(
            this.options.processingRecoveryTimeoutMinutes,
          ),
        "resetStaleProcessingIdeas",
      );
      if (recoveredCount > 0) {
        console.log(
          `[Worker] Recovered ${recoveredCount} stale processing idea(s) back to "new".`,
        );
      }
    } catch (error) {
      console.warn("[Worker] Unable to recover stale processing ideas.", error);
    }
  }

  private async safeUpdateIdeaStatus(
    ideaId: string,
    status: "new" | "processing" | "done" | "error",
    context: string,
  ): Promise<void> {
    try {
      await this.executeWithRetry(
        () => this.notionRepository.updateIdeaStatus(ideaId, status),
        context,
      );
    } catch (statusError) {
      console.error(
        `[Worker][Idea ${ideaId}] Failed to update status to "${status}".`,
        statusError,
      );
    }
  }

  private async findExistingIssueByTitle(title: string): Promise<string | null> {
    if (typeof this.githubRepository.findIssueUrlByTitle !== "function") {
      return null;
    }

    return this.executeWithRetry(
      () => this.githubRepository.findIssueUrlByTitle!(title),
      `findIssueByTitle:${title}`,
    );
  }

  private async executeWithRetry<T>(
    operation: () => Promise<T>,
    context: string,
  ): Promise<T> {
    let lastError: unknown;

    for (let attempt = 1; attempt <= this.options.retryAttempts; attempt += 1) {
      try {
        return await operation();
      } catch (error) {
        lastError = error;

        if (attempt >= this.options.retryAttempts) {
          break;
        }

        console.warn(
          `[Worker][Retry] ${context} failed on attempt ${attempt}/${this.options.retryAttempts}. Retrying...`,
          error,
        );
        await sleep(this.options.retryDelayMs * attempt);
      }
    }

    throw lastError instanceof Error
      ? lastError
      : new Error(`Operation "${context}" failed after retries.`);
  }
}

const formatArchitectureText = (architecture: TechnicalArchitecture): string =>
  `Frontend: ${architecture.frontend}
Backend: ${architecture.backend}
Database: ${architecture.database}
Infrastructure: ${architecture.infrastructure}`;

const buildIdeaAiInput = (title: string, content?: string): string => {
  const cleanTitle = sanitizeIdeaInputSegment(title);
  const cleanContent = sanitizeIdeaInputSegment(content ?? "");

  const composed = cleanContent
    ? `${cleanTitle || "Untitled idea"}\n\n${cleanContent}`
    : cleanTitle || "Untitled idea";

  const maxLength = 4000;
  return composed.slice(0, maxLength).trim();
};

const sanitizeIdeaInputSegment = (value: string): string => {
  const withoutControlChars = value.replace(
    /[\u0000-\u0008\u000B-\u001F\u007F-\u009F]/g,
    " ",
  );
  const normalized = withoutControlChars.replace(/\r\n/g, "\n");
  const lines = normalized
    .split("\n")
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter((line) => line.length > 0);

  return lines.join("\n");
};

const sleep = async (ms: number): Promise<void> => {
  await new Promise((resolve) => setTimeout(resolve, ms));
};
