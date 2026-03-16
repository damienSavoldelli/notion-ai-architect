import type { AiArchitectService } from "../ports/ai-architect-service";
import type { GitHubRepository } from "../ports/github-repository";
import type { NotionRepository } from "../ports/notion-repository";

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
    const summary: WorkflowRunSummary = {
      processedIdeas: 0,
      createdProjects: 0,
      createdTasks: 0,
      createdIssues: 0,
    };

    for (const idea of ideas) {
      const generatedProject =
        await this.aiArchitectService.generateProjectFromIdea(idea.title);

      const project = await this.notionRepository.createProject({
        ideaId: idea.id,
        name: generatedProject.product_overview.name,
        productPlan: generatedProject.product_overview.description,
        architecture: JSON.stringify(generatedProject.architecture, null, 2),
      });

      const createdTasks = await this.notionRepository.createTasks({
        projectId: project.id,
        tasks: generatedProject.tasks.map((task) => ({
          title: task.title,
          description: task.description,
          priority: task.priority,
        })),
      });

      for (const task of createdTasks) {
        await this.githubRepository.createIssue({
          title: `[${project.name}] ${task.title}`,
          body: buildIssueBody(project.name, task.description),
          labels: ["ai-generated"],
        });
        summary.createdIssues += 1;
      }

      summary.processedIdeas += 1;
      summary.createdProjects += 1;
      summary.createdTasks += createdTasks.length;
    }

    return summary;
  }
}

const buildIssueBody = (projectName: string, taskDescription: string): string =>
  `Project: ${projectName}

Task description:
${taskDescription}`;
