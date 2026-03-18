import type { Idea } from "../../domain/entities/idea";
import type { Project } from "../../domain/entities/project";
import type { Task, TaskPriority } from "../../domain/entities/task";

export interface CreateProjectInput {
  ideaId: string;
  name: string;
  productPlan: string;
  architecture: string;
  architectureJson?: string;
}

export interface CreateTaskInput {
  title: string;
  description: string;
  priority: TaskPriority;
}

export interface CreateTasksInput {
  projectId: string;
  tasks: ReadonlyArray<CreateTaskInput>;
}

export interface NotionRepository {
  listNewIdeas(): Promise<ReadonlyArray<Idea>>;
  resetStaleProcessingIdeas?(maxAgeMinutes: number): Promise<number>;
  updateIdeaStatus(ideaId: string, status: Idea["status"]): Promise<void>;
  linkIdeaToProject(ideaId: string, projectId: string): Promise<void>;
  updateTaskGithubIssue(taskId: string, issueUrl: string): Promise<void>;
  createProject(input: CreateProjectInput): Promise<Project>;
  createTasks(input: CreateTasksInput): Promise<ReadonlyArray<Task>>;
}
