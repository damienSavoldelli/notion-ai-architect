import type { AiArchitectService } from "../ports/ai-architect-service";
import type { GitHubRepository } from "../ports/github-repository";
import type { NotionRepository } from "../ports/notion-repository";
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

      for (const [index, task] of createdTasks.entries()) {
        const sourceTask = generatedProject.tasks[index];

        const issueTaskInput: GithubIssueTaskInput = {
          title: sourceTask?.title ?? task.title,
          description: sourceTask?.description ?? task.description,
          priority: sourceTask?.priority ?? task.priority,
          type: sourceTask?.type,
          labels: sourceTask?.labels,
          acceptance_criteria: sourceTask?.acceptance_criteria,
        };

        await this.createGithubIssue(issueTaskInput);
        summary.createdIssues += 1;
      }

      summary.processedIdeas += 1;
      summary.createdProjects += 1;
      summary.createdTasks += createdTasks.length;
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
