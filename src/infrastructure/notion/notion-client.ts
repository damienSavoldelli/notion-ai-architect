import { Client } from "@notionhq/client";
import type {
  CreateProjectInput,
  CreateTasksInput,
  NotionRepository,
} from "../../application/ports/notion-repository";
import type { Idea, IdeaStatus } from "../../domain/entities/idea";
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
    const ideas: Idea[] = [];
    let nextCursor: string | undefined;

    while (true) {
      const response = await this.notion.dataSources.query({
        data_source_id: this.config.ideasDatabaseId,
        start_cursor: nextCursor,
        filter: {
          property: "Status",
          select: { equals: "new" },
        },
      });

      for (const result of response.results) {
        const idea = this.mapIdea(result);
        if (idea) {
          ideas.push(idea);
        }
      }

      if (!response.has_more || !response.next_cursor) {
        break;
      }
      nextCursor = response.next_cursor;
    }

    return ideas;
  }

  async createProject(input: CreateProjectInput): Promise<Project> {
    const response = await this.notion.pages.create({
      parent: {
        data_source_id: this.config.projectsDatabaseId,
      },
      properties: {
        Name: {
          title: [
            {
              type: "text",
              text: {
                content: input.name,
              },
            },
          ],
        },
        Idea: {
          relation: [{ id: input.ideaId }],
        },
        "Product Plan": {
          rich_text: [
            {
              type: "text",
              text: {
                content: input.productPlan,
              },
            },
          ],
        },
        Architecture: {
          rich_text: [
            {
              type: "text",
              text: {
                content: input.architecture,
              },
            },
          ],
        },
        Status: {
          select: { name: "draft" },
        },
      },
    });

    const projectId = this.extractPageId(response);
    if (!projectId) {
      throw new Error("NotionClient.createProject returned an invalid page.");
    }

    return {
      id: projectId,
      ideaId: input.ideaId,
      name: input.name,
      productPlan: input.productPlan,
      architecture: input.architecture,
      status: "draft",
    };
  }

  async createTasks(_input: CreateTasksInput): Promise<ReadonlyArray<Task>> {
    throw new Error("NotionClient.createTasks is not implemented yet.");
  }

  private mapIdea(page: unknown): Idea | null {
    if (!isObject(page)) {
      return null;
    }

    if (page.object !== "page") {
      return null;
    }

    if (typeof page.id !== "string" || typeof page.created_time !== "string") {
      return null;
    }

    if (!isObject(page.properties)) {
      return null;
    }

    const titleProperty = page.properties.Title;
    const statusProperty = page.properties.Status;

    if (!isTitleProperty(titleProperty) || !isStatusProperty(statusProperty)) {
      return null;
    }

    const title = titleProperty.title
      .map((fragment) => fragment.plain_text ?? "")
      .join("")
      .trim();

    if (!title) {
      return null;
    }

    const status = statusProperty.select?.name;
    if (!isIdeaStatus(status)) {
      return null;
    }

    const createdAt = new Date(page.created_time);
    if (Number.isNaN(createdAt.getTime())) {
      return null;
    }

    return {
      id: page.id,
      title,
      status,
      createdAt,
    };
  }

  private extractPageId(page: unknown): string | null {
    if (!isObject(page) || page.object !== "page") {
      return null;
    }

    return typeof page.id === "string" ? page.id : null;
  }
}

interface NotionTitleProperty {
  type: "title";
  title: ReadonlyArray<{ plain_text?: string }>;
}

interface NotionStatusProperty {
  type: "select";
  select: { name?: string } | null;
}

const IDEA_STATUSES: ReadonlySet<IdeaStatus> = new Set([
  "new",
  "processing",
  "done",
]);

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const isTitleProperty = (value: unknown): value is NotionTitleProperty => {
  if (!isObject(value)) {
    return false;
  }

  if (value.type !== "title" || !Array.isArray(value.title)) {
    return false;
  }

  return value.title.every((item) => isObject(item));
};

const isStatusProperty = (value: unknown): value is NotionStatusProperty => {
  if (!isObject(value)) {
    return false;
  }

  if (value.type !== "select") {
    return false;
  }

  return value.select === null || isObject(value.select);
};

const isIdeaStatus = (value: unknown): value is IdeaStatus =>
  typeof value === "string" && IDEA_STATUSES.has(value as IdeaStatus);
