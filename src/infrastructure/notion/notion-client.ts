import { Client } from "@notionhq/client";
import type {
  CreateProjectInput,
  CreateTasksInput,
  NotionRepository,
} from "../../application/ports/notion-repository";
import type { Idea } from "../../domain/entities/idea";
import type { Project } from "../../domain/entities/project";
import type { Task } from "../../domain/entities/task";

export interface NotionClientConfig {
  authToken: string;
  ideasDatabaseId: string;
  projectsDatabaseId: string;
  tasksDatabaseId: string;
}

export class NotionClient implements NotionRepository {
  private readonly notion: Client;

  constructor(
    private readonly config: NotionClientConfig,
    notionClient?: Client,
  ) {
    this.notion = notionClient ?? new Client({ auth: config.authToken });
  }

  async listNewIdeas(): Promise<ReadonlyArray<Idea>> {
    void this.notion;
    void this.config;
    return [];
  }

  async createProject(_input: CreateProjectInput): Promise<Project> {
    throw new Error("NotionClient.createProject is not implemented yet.");
  }

  async createTasks(_input: CreateTasksInput): Promise<ReadonlyArray<Task>> {
    throw new Error("NotionClient.createTasks is not implemented yet.");
  }
}
