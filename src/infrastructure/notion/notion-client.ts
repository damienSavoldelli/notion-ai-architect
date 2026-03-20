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

type NotionPageCreateProperties = Parameters<Client["pages"]["create"]>[0]["properties"];

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
        const ideaBase = this.mapIdea(result);
        if (ideaBase) {
          const content = await this.getIdeaPageContent(ideaBase.id);
          ideas.push(content ? { ...ideaBase, content } : ideaBase);
        }
      }

      if (!response.has_more || !response.next_cursor) {
        break;
      }
      nextCursor = response.next_cursor;
    }

    return ideas;
  }

  async resetStaleProcessingIdeas(maxAgeMinutes: number): Promise<number> {
    const staleIdeaIds: string[] = [];
    const cutoffIso = new Date(
      Date.now() - Math.max(1, maxAgeMinutes) * 60_000,
    ).toISOString();
    let nextCursor: string | undefined;

    while (true) {
      const response = await this.notion.dataSources.query({
        data_source_id: this.config.ideasDatabaseId,
        start_cursor: nextCursor,
        filter: {
          and: [
            {
              property: "Status",
              select: { equals: "processing" },
            },
            {
              timestamp: "last_edited_time",
              last_edited_time: { before: cutoffIso },
            },
          ],
        },
      });

      for (const result of response.results) {
        const pageId = this.extractPageId(result);
        if (pageId) {
          staleIdeaIds.push(pageId);
        }
      }

      if (!response.has_more || !response.next_cursor) {
        break;
      }
      nextCursor = response.next_cursor;
    }

    await Promise.all(
      staleIdeaIds.map((ideaId) => this.updateIdeaStatus(ideaId, "new")),
    );

    return staleIdeaIds.length;
  }

  async updateIdeaStatus(ideaId: string, status: Idea["status"]): Promise<void> {
    await this.notion.pages.update({
      page_id: ideaId,
      properties: {
        Status: {
          select: {
            name: status,
          },
        },
      },
    });
  }

  async linkIdeaToProject(ideaId: string, projectId: string): Promise<void> {
    await this.notion.pages.update({
      page_id: ideaId,
      properties: {
        Project: {
          relation: [{ id: projectId }],
        },
      },
    });
  }

  async updateTaskGithubIssue(taskId: string, issueUrl: string): Promise<void> {
    await this.notion.pages.update({
      page_id: taskId,
      properties: {
        "GitHub Issue": {
          url: issueUrl,
        },
      },
    });
  }

  async createProject(input: CreateProjectInput): Promise<Project> {
    const response = await this.createProjectPage(input);

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

  private async createProjectPage(input: CreateProjectInput) {
    const propertiesBase: NotionPageCreateProperties = {
      Name: {
        title: buildRichText(input.name),
      },
      Idea: {
        relation: [{ id: input.ideaId }],
      },
      "Product Plan": {
        rich_text: buildRichText(input.productPlan),
      },
      Architecture: {
        rich_text: buildRichText(input.architecture),
      },
      Status: {
        select: { name: "draft" },
      },
    };

    if (!input.architectureJson) {
      return this.notion.pages.create({
        parent: {
          data_source_id: this.config.projectsDatabaseId,
        },
        properties: propertiesBase,
      });
    }

    const architectureJsonPropertyCandidates = [
      "Architecture JSON",
      "Architecture Json",
      "ArchitectureJSON",
    ] as const;
    let lastError: unknown;

    for (const propertyKey of architectureJsonPropertyCandidates) {
      try {
        return await this.notion.pages.create({
          parent: {
            data_source_id: this.config.projectsDatabaseId,
          },
          properties: {
            ...propertiesBase,
            [propertyKey]: {
              rich_text: [
                {
                  type: "text",
                  text: {
                    content: input.architectureJson,
                  },
                },
              ],
            },
          },
        });
      } catch (error) {
        lastError = error;
        if (!isUnknownPropertyError(error)) {
          throw error;
        }
      }
    }

    return this.notion.pages.create({
      parent: {
        data_source_id: this.config.projectsDatabaseId,
      },
      properties: propertiesBase,
    });
  }

  async createTasks(input: CreateTasksInput): Promise<ReadonlyArray<Task>> {
    const createdTasks = await Promise.all(
      input.tasks.map(async (taskInput) => {
        const response = await this.createTaskPageWithTitleFallback(input.projectId, {
          title: taskInput.title,
          description: taskInput.description,
          priority: taskInput.priority,
        });

        const taskId = this.extractPageId(response);
        if (!taskId) {
          throw new Error("NotionClient.createTasks returned an invalid page.");
        }

        return {
          id: taskId,
          projectId: input.projectId,
          title: taskInput.title,
          description: taskInput.description,
          status: "todo",
          priority: taskInput.priority,
        } satisfies Task;
      }),
    );

    return createdTasks;
  }

  private async createTaskPageWithTitleFallback(
    projectId: string,
    taskInput: { title: string; description: string; priority: "low" | "medium" | "high" },
  ) {
    const titlePropertyCandidates = ["Task", "Tasks", "Name"] as const;
    let lastError: unknown;

    for (const titlePropertyKey of titlePropertyCandidates) {
      try {
        return await this.notion.pages.create({
          parent: {
            data_source_id: this.config.tasksDatabaseId,
          },
          properties: {
            [titlePropertyKey]: {
              title: buildRichText(taskInput.title),
            },
            Project: {
              relation: [{ id: projectId }],
            },
            Status: {
              select: { name: "todo" },
            },
            Priority: {
              select: { name: taskInput.priority },
            },
          },
        });
      } catch (error) {
        lastError = error;
        if (!isUnknownPropertyError(error)) {
          throw error;
        }
      }
    }

    throw lastError ?? new Error("Unable to create task page in Notion.");
  }

  private async getIdeaPageContent(pageId: string): Promise<string | null> {
    const textParts: string[] = [];
    let nextCursor: string | undefined;
    let skipExampleSection = false;
    let skipTemplateSection = false;

    while (true) {
      const response = await this.notion.blocks.children.list({
        block_id: pageId,
        start_cursor: nextCursor,
      });

      for (const block of response.results) {
        const blockType = getBlockType(block);
        if (isTemplateSectionBoundaryHeading(blockType)) {
          skipExampleSection = false;
          skipTemplateSection = false;
        }

        const extracted = extractTextFromBlock(block);
        if (extracted) {
          if (isTemplateSectionHeading(extracted)) {
            skipTemplateSection = true;
            continue;
          }

          if (isExampleMarkerLine(extracted)) {
            if (isStandaloneExampleMarker(extracted)) {
              skipExampleSection = true;
            }
            continue;
          }

          if (
            skipExampleSection ||
            skipTemplateSection ||
            isTemplateInstructionLine(extracted)
          ) {
            continue;
          }

          textParts.push(extracted);
        }
      }

      if (!response.has_more || !response.next_cursor) {
        break;
      }
      nextCursor = response.next_cursor;
    }

    const content = sanitizeIdeaContent(textParts.join("\n"));
    return content.length > 0 ? content : null;
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
  "error",
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

const sanitizeIdeaContent = (value: string): string => {
  const withoutControlChars = value.replace(
    /[\u0000-\u0008\u000B-\u001F\u007F-\u009F]/g,
    " ",
  );
  const normalized = withoutControlChars.replace(/\r\n/g, "\n");
  const lines = normalized
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  return lines.join("\n");
};

const extractTextFromBlock = (block: unknown): string | null => {
  if (!isObject(block) || typeof block.type !== "string") {
    return null;
  }

  switch (block.type) {
    case "paragraph":
    case "heading_1":
    case "heading_2":
    case "heading_3":
      return extractRichTextField(block, block.type);
    case "bulleted_list_item": {
      const text = extractRichTextField(block, "bulleted_list_item");
      return text ? `- ${text}` : null;
    }
    case "numbered_list_item": {
      const text = extractRichTextField(block, "numbered_list_item");
      return text ? `1. ${text}` : null;
    }
    default:
      return null;
  }
};

const getBlockType = (block: unknown): string | null => {
  if (!isObject(block) || typeof block.type !== "string") {
    return null;
  }
  return block.type;
};

const isTemplateSectionBoundaryHeading = (blockType: string | null): boolean =>
  blockType === "heading_1" || blockType === "heading_2";

const isExampleMarkerLine = (line: string): boolean =>
  normalizeLineForFiltering(line).startsWith("[example]");

const isStandaloneExampleMarker = (line: string): boolean =>
  normalizeLineForFiltering(line) === "[example]" ||
  normalizeLineForFiltering(line) === "[example]:";

const isTemplateSectionHeading = (line: string): boolean =>
  normalizeLineForFiltering(line) === "how to use";

const isTemplateInstructionLine = (line: string): boolean => {
  const normalized = normalizeLineForFiltering(line);

  if (normalized === "user input:" || normalized === "user input") {
    return true;
  }

  if (normalized === "->" || normalized === "→") {
    return true;
  }

  if (/^-{3,}$/.test(normalized)) {
    return true;
  }

  return (
    normalized.includes("for best ai results") ||
    normalized.includes("you can fill only the sections you need") ||
    normalized.includes("please remove or replace all lines starting with [example]") ||
    normalized.startsWith("tip: the more precise your idea")
  );
};

const normalizeLineForFiltering = (line: string): string =>
  line
    .replace(/^\s*(?:[-*]\s+|\d+\.\s+)?/, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();

const extractRichTextField = (
  block: Record<string, unknown>,
  key: string,
): string | null => {
  const typed = block[key];
  if (!isObject(typed) || !Array.isArray(typed.rich_text)) {
    return null;
  }

  const text = typed.rich_text
    .map((fragment) =>
      isObject(fragment) && typeof fragment.plain_text === "string"
        ? fragment.plain_text
        : "",
    )
    .join("")
    .trim();

  return text.length > 0 ? text : null;
};

const buildRichText = (content: string) => [
  {
    type: "text" as const,
    text: {
      content,
    },
  },
];

const isUnknownPropertyError = (error: unknown): boolean => {
  if (!(error instanceof Error)) {
    return false;
  }

  return (
    error.message.includes("is not a property that exists") ||
    error.message.includes("Could not find property")
  );
};
