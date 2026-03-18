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

export class IdeaToProjectWorkflow {
  constructor(
    private readonly notionRepository: NotionRepository,
    private readonly aiArchitectService: AiArchitectService,
    private readonly githubRepository: GitHubRepository,
  ) {}

  async runOnce(): Promise<WorkflowRunSummary> {
    const ideas = await this.notionRepository.listNewIdeas();
    console.log(`Found ${ideas.length} new idea(s) to process.`);

    const summary: WorkflowRunSummary = {
      processedIdeas: 0,
      createdProjects: 0,
      createdTasks: 0,
      createdIssues: 0,
    };

    for (const idea of ideas) {
      console.log(`Processing idea ${idea.id}: ${idea.title}`);
      await this.notionRepository.updateIdeaStatus(idea.id, "processing");

      try {
        const ideaInput = buildIdeaAiInput(idea.title, idea.content);
        const generatedProject =
          await this.aiArchitectService.generateProjectFromIdea(ideaInput);
        const architectureJson = JSON.stringify(
          generatedProject.architecture,
          null,
          2,
        );

        const project = await this.notionRepository.createProject({
          ideaId: idea.id,
          name: generatedProject.product_overview.name,
          productPlan: generatedProject.product_overview.description,
          architecture: formatArchitectureText(generatedProject.architecture),
          architectureJson,
        });
        await this.notionRepository.linkIdeaToProject(idea.id, project.id);

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

          const issueUrl = await this.createGithubIssue(issueTaskInput);
          await this.notionRepository.updateTaskGithubIssue(task.id, issueUrl);
          summary.createdIssues += 1;
        }

        await this.notionRepository.updateIdeaStatus(idea.id, "done");

        summary.processedIdeas += 1;
        summary.createdProjects += 1;
        summary.createdTasks += createdTasks.length;
      } catch (error) {
        await this.notionRepository.updateIdeaStatus(idea.id, "error");
        throw error;
      }
    }

    console.log(
      `Workflow summary: ideas=${summary.processedIdeas}, projects=${summary.createdProjects}, tasks=${summary.createdTasks}, issues=${summary.createdIssues}`,
    );

    return summary;
  }

  private async createGithubIssue(task: GithubIssueTaskInput): Promise<string> {
    const mappedIssue = mapTaskToGithubIssue(task);
    return this.githubRepository.createIssue(mappedIssue);
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
