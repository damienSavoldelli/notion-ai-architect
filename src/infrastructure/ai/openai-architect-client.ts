import OpenAI from "openai";
import type { AiArchitectService } from "../../application/ports/ai-architect-service";
import type { GeneratedProject } from "../../domain/entities/generated-project";
import { safeParseGeneratedProject } from "./generated-project-schema";

const SYSTEM_PROMPT = `You are a senior software architect and product engineer.

Your goal is to transform a product idea into a production-ready technical plan.

You must think like a startup team preparing to build and ship this product.

Return ONLY valid JSON.

The output must be precise, actionable, and realistic.
Avoid vague or generic statements.

SCHEMA:

{
  "product_overview": {
    "name": "",
    "description": "",
    "target_users": [],
    "core_features": []
  },
  "architecture": {
    "frontend": "",
    "backend": "",
    "database": "",
    "infrastructure": "",
    "external_services": []
  },
  "tasks": [
    {
      "title": "",
      "description": "",
      "type": "feature | chore | bug",
      "priority": "low | medium | high",
      "labels": [],
      "acceptance_criteria": [],
      "technical_notes": ""
    }
  ],
  "roadmap": []
}

RULES:
- Tasks must be specific and domain-aware
- Each task must represent one realistic engineering unit of work
- Avoid generic statements like "improve system"
- Acceptance criteria must be testable
- Include relevant technical implementation details
- Include backend and frontend tasks when relevant
- Return 6 to 10 tasks`;

interface OpenAiResponsesApi {
  create(params: {
    model: string;
    input: string;
    temperature?: number;
    text?: {
      format: {
        type: "json_schema";
        name: string;
        strict: boolean;
        schema: Record<string, unknown>;
      };
    };
  }): Promise<unknown>;
}

interface OpenAiSdk {
  responses: OpenAiResponsesApi;
}

export interface OpenAiArchitectClientConfig {
  apiKey: string;
  model: string;
  temperature?: number;
}

export class OpenAiArchitectClient implements AiArchitectService {
  private readonly openai: OpenAiSdk;
  private static readonly MAX_ATTEMPTS = 3;

  constructor(
    private readonly config: OpenAiArchitectClientConfig,
    openaiSdk?: OpenAiSdk,
  ) {
    this.openai = openaiSdk ?? new OpenAI({ apiKey: config.apiKey });
  }

  async generateProjectFromIdea(idea: string): Promise<GeneratedProject> {
    const sanitizedIdea = sanitizeIdeaInput(idea);
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= OpenAiArchitectClient.MAX_ATTEMPTS; attempt += 1) {
      const response = await this.openai.responses.create({
        model: this.config.model,
        input: buildPrompt(sanitizedIdea, attempt),
        temperature: this.config.temperature ?? 0.2,
        text: {
          format: {
            type: "json_schema",
            name: "generated_project",
            strict: true,
            schema: GENERATED_PROJECT_RESPONSE_SCHEMA,
          },
        },
      });

      const outputText = extractOutputText(response);
      if (!outputText) {
        lastError = new Error(
          "OpenAI response did not include any text output after retries.",
        );
        continue;
      }

      const parsedJson = safeJsonParse(outputText);
      if (!parsedJson.ok) {
        lastError = new Error("OpenAI response is not valid JSON after retries.");
        continue;
      }

      const normalized = normalizeGeneratedProjectCandidate(
        parsedJson.value,
        sanitizedIdea,
      );
      const validated = safeParseGeneratedProject(normalized);
      if (!validated.success) {
        lastError = new Error(
          "OpenAI response JSON does not match expected schema after retries.",
        );
        continue;
      }

      return validated.data;
    }

    console.warn(
      `OpenAI output remained invalid after retries. Using deterministic fallback. reason=${lastError?.message ?? "unknown"}`,
    );
    return buildFallbackGeneratedProject(sanitizedIdea);
  }
}

const buildPrompt = (idea: string, attempt: number): string =>
  `${SYSTEM_PROMPT}

${attempt > 1 ? "Previous response was invalid. Return valid JSON only and strictly match the schema.\n" : ""}

Project idea:

${idea}`;

const extractOutputText = (response: unknown): string | null => {
  if (!isObject(response)) {
    return null;
  }

  const directText = response.output_text;
  if (typeof directText === "string" && directText.trim()) {
    return directText.trim();
  }

  const output = response.output;
  if (!Array.isArray(output)) {
    return null;
  }

  const textParts: string[] = [];
  for (const item of output) {
    if (!isObject(item) || !Array.isArray(item.content)) {
      continue;
    }

    for (const content of item.content) {
      if (!isObject(content)) {
        continue;
      }

      if (content.type === "output_text" && typeof content.text === "string") {
        textParts.push(content.text);
      }
    }
  }

  const merged = textParts.join("").trim();
  return merged || null;
};

const safeJsonParse = (
  value: string,
): { ok: true; value: unknown } | { ok: false } => {
  const candidates = [
    value.trim(),
    unwrapJsonCodeFence(value),
    extractFirstJsonObject(value),
  ].filter((candidate): candidate is string => typeof candidate === "string");

  for (const candidate of candidates) {
    try {
      return { ok: true, value: JSON.parse(candidate) };
    } catch {
      continue;
    }
  }

  return { ok: false };
};

const unwrapJsonCodeFence = (value: string): string | null => {
  const match = value.trim().match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return match?.[1]?.trim() || null;
};

const extractFirstJsonObject = (value: string): string | null => {
  const start = value.indexOf("{");
  if (start === -1) {
    return null;
  }

  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let index = start; index < value.length; index += 1) {
    const char = value[index];

    if (escaped) {
      escaped = false;
      continue;
    }

    if (char === "\\") {
      escaped = true;
      continue;
    }

    if (char === "\"") {
      inString = !inString;
      continue;
    }

    if (inString) {
      continue;
    }

    if (char === "{") {
      depth += 1;
    } else if (char === "}") {
      depth -= 1;
      if (depth === 0) {
        return value.slice(start, index + 1);
      }
    }
  }

  return null;
};

const normalizeGeneratedProjectCandidate = (
  value: unknown,
  idea: string,
): GeneratedProject => {
  const root = isObject(value) ? value : {};
  const productOverviewRoot = pickObject(root, [
    "product_overview",
    "productOverview",
    "overview",
  ]);
  const architectureRoot = pickObject(root, ["architecture", "tech_stack", "techStack"]);
  const tasksRoot = pickArray(root, ["tasks", "todo", "items"]);
  const roadmapRoot = pickArray(root, ["roadmap", "sprints", "phases"]);

  const tasks = ensureMinimumTasks(normalizeTasks(tasksRoot, idea), idea);
  const roadmap = normalizeRoadmap(roadmapRoot, tasks);

  return {
    product_overview: {
      name:
        pickString(productOverviewRoot, ["name", "project_name", "title"]) ??
        deriveProjectNameFromIdea(idea),
      description:
        pickString(productOverviewRoot, ["description", "summary", "overview"]) ??
        `Project generated from idea: ${idea}`,
      target_users:
        pickStringArray(productOverviewRoot, [
          "target_users",
          "targetUsers",
          "users",
        ]) ?? ["builders"],
      core_features:
        pickStringArray(productOverviewRoot, [
          "core_features",
          "coreFeatures",
          "features",
        ]) ?? tasks.slice(0, 4).map((task) => task.title),
    },
    architecture: {
      frontend:
        pickString(architectureRoot, ["frontend", "front", "ui"]) ??
        "Web dashboard (optional for MVP)",
      backend:
        pickString(architectureRoot, ["backend", "api", "server"]) ??
        "Fastify API with clean architecture",
      database:
        pickString(architectureRoot, ["database", "db", "storage"]) ??
        "Notion databases as workflow source of truth",
      infrastructure:
        pickString(architectureRoot, ["infrastructure", "infra", "deployment"]) ??
        "Bun worker + OpenAI API + GitHub API",
      external_services:
        pickStringArray(architectureRoot, [
          "external_services",
          "externalServices",
          "services",
          "integrations",
        ]) ?? ["OpenAI API", "Notion API", "GitHub API"],
    },
    tasks,
    roadmap,
  };
};

const normalizeTasks = (tasksValue: unknown[], idea: string): GeneratedProject["tasks"] => {
  const normalized = tasksValue
    .filter(isObject)
    .map((task, index) => normalizeTask(task, index, idea));

  if (normalized.length > 0) {
    return normalized;
  }

  return buildFallbackGeneratedProject(idea).tasks;
};

const ensureMinimumTasks = (
  tasks: GeneratedProject["tasks"],
  idea: string,
): GeneratedProject["tasks"] => {
  const minimumTasks = 6;
  if (tasks.length >= minimumTasks) {
    return tasks;
  }

  const fallbackTasks = buildFallbackGeneratedProject(idea).tasks;
  const merged: GeneratedProject["tasks"][number][] = [...tasks];

  for (const task of fallbackTasks) {
    if (merged.length >= minimumTasks) {
      break;
    }

    const alreadyPresent = merged.some(
      (existingTask) =>
        existingTask.title.toLowerCase() === task.title.toLowerCase(),
    );
    if (!alreadyPresent) {
      merged.push(task);
    }
  }

  return merged;
};

const normalizeTask = (
  task: Record<string, unknown>,
  index: number,
  idea: string,
): GeneratedProject["tasks"][number] => {
  const title =
    pickString(task, ["title", "name", "task"]) ?? `Task ${index + 1}`;
  const description =
    pickString(task, ["description", "details", "summary"]) ??
    `Implement: ${title} for project idea "${idea}".`;

  const type = normalizeTaskType(
    pickString(task, ["type", "category", "kind"]),
  );

  return {
    title,
    description,
    priority: normalizePriority(pickString(task, ["priority", "importance"])),
    type,
    labels: pickStringArray(task, ["labels", "tags"]),
    acceptance_criteria: pickStringArray(task, [
      "acceptance_criteria",
      "acceptanceCriteria",
      "criteria",
    ]),
    technical_notes:
      pickString(task, [
        "technical_notes",
        "technicalNotes",
        "implementation_notes",
        "notes",
      ]) ??
      `Implement ${title} with validation, error handling, and integration tests.`,
  };
};

const normalizeRoadmap = (
  roadmapValue: unknown[],
  tasks: ReadonlyArray<GeneratedProject["tasks"][number]>,
): GeneratedProject["roadmap"] => {
  const normalized = roadmapValue
    .filter(isObject)
    .map((item, index) => {
      const sprint =
        pickString(item, ["sprint", "name", "phase"]) ??
        `Sprint ${index + 1}`;
      const sprintTasks = pickStringArray(item, ["tasks", "items"]);
      return {
        sprint,
        tasks: sprintTasks && sprintTasks.length > 0 ? sprintTasks : tasks.map((task) => task.title),
      };
    });

  if (normalized.length > 0) {
    return normalized;
  }

  return [
    {
      sprint: "Sprint 1",
      tasks: tasks.map((task) => task.title),
    },
  ];
};

const normalizePriority = (
  rawPriority: string | null,
): "low" | "medium" | "high" => {
  const value = (rawPriority ?? "").toLowerCase().trim();
  if (value.includes("high") || value.includes("urgent") || value.includes("critical")) {
    return "high";
  }
  if (value.includes("low") || value.includes("minor")) {
    return "low";
  }
  return "medium";
};

const normalizeTaskType = (
  rawType: string | null,
): "feature" | "bug" | "chore" => {
  const value = (rawType ?? "").toLowerCase().trim();
  if (value.includes("bug") || value.includes("fix") || value.includes("defect")) {
    return "bug";
  }
  if (
    value.includes("chore") ||
    value.includes("task") ||
    value.includes("refactor") ||
    value.includes("doc")
  ) {
    return "chore";
  }
  return "feature";
};

const pickObject = (
  root: Record<string, unknown>,
  keys: ReadonlyArray<string>,
): Record<string, unknown> => {
  for (const key of keys) {
    const value = root[key];
    if (isObject(value)) {
      return value;
    }
  }
  return {};
};

const pickArray = (
  root: Record<string, unknown>,
  keys: ReadonlyArray<string>,
): unknown[] => {
  for (const key of keys) {
    const value = root[key];
    if (Array.isArray(value)) {
      return value;
    }
  }
  return [];
};

const pickString = (
  root: Record<string, unknown>,
  keys: ReadonlyArray<string>,
): string | null => {
  for (const key of keys) {
    const value = toCleanString(root[key]);
    if (value) {
      return value;
    }
  }
  return null;
};

const pickStringArray = (
  root: Record<string, unknown>,
  keys: ReadonlyArray<string>,
): string[] | undefined => {
  for (const key of keys) {
    const value = root[key];

    if (Array.isArray(value)) {
      const cleaned = value
        .map((item) => toCleanString(item))
        .filter((item): item is string => typeof item === "string");
      if (cleaned.length > 0) {
        return cleaned;
      }
    }

    if (typeof value === "string") {
      const cleaned = value
        .split(",")
        .map((item) => item.trim())
        .filter((item) => item.length > 0);
      if (cleaned.length > 0) {
        return cleaned;
      }
    }
  }

  return undefined;
};

const toCleanString = (value: unknown): string | null => {
  if (typeof value !== "string") {
    return null;
  }

  const cleaned = value.replace(/\s+/g, " ").trim();
  return cleaned.length > 0 ? cleaned : null;
};

const deriveProjectNameFromIdea = (idea: string): string => {
  const compact = idea.replace(/\s+/g, " ").trim();
  if (compact.length <= 80) {
    return compact;
  }
  return `${compact.slice(0, 77)}...`;
};

const buildFallbackGeneratedProject = (idea: string): GeneratedProject => {
  const projectName = deriveProjectNameFromIdea(idea);
  const tasks: GeneratedProject["tasks"] = [
    {
      title: "Define MVP scope and requirements",
      description: `Clarify MVP scope, constraints, and user goals for: ${projectName}.`,
      priority: "high",
      type: "feature",
      labels: ["planning"],
      acceptance_criteria: [
        "MVP scope is clearly documented.",
        "User goals and success criteria are defined.",
      ],
      technical_notes:
        "Capture requirements as user stories and non-functional constraints.",
    },
    {
      title: "Implement core backend workflow",
      description:
        "Build the backend workflow that transforms idea input into project and task outputs.",
      priority: "high",
      type: "feature",
      labels: ["backend", "workflow"],
      acceptance_criteria: [
        "Workflow runs end-to-end without manual intervention.",
        "Generated outputs are stored correctly in Notion and GitHub.",
      ],
      technical_notes:
        "Use a deterministic orchestration flow with explicit state transitions.",
    },
    {
      title: "Build API endpoints for workflow control",
      description:
        "Expose health and trigger endpoints to run worker cycles and validate runtime readiness.",
      priority: "medium",
      type: "feature",
      labels: ["api", "backend"],
      acceptance_criteria: [
        "Health endpoint returns readiness status.",
        "Manual run endpoint triggers one complete workflow cycle.",
      ],
      technical_notes:
        "Add request validation and structured logs for each endpoint.",
    },
    {
      title: "Implement Notion data mapping safeguards",
      description:
        "Ensure Notion page/property mapping remains robust against schema drifts.",
      priority: "medium",
      type: "chore",
      labels: ["notion", "integration"],
      acceptance_criteria: [
        "Unknown optional properties do not break project/task creation.",
        "Mandatory fields are validated before write operations.",
      ],
      technical_notes:
        "Introduce property fallback resolution and consistent error messages.",
    },
    {
      title: "Harden GitHub issue generation quality",
      description:
        "Generate project-aware, structured issues with labels and acceptance criteria.",
      priority: "medium",
      type: "feature",
      labels: ["github", "automation"],
      acceptance_criteria: [
        "Issue titles include AI and project prefixes.",
        "Labels include type, priority, project, and inferred domain tags.",
      ],
      technical_notes:
        "Use a pure mapper to keep formatting deterministic and testable.",
    },
    {
      title: "Validate end-to-end execution",
      description:
        "Add integration and e2e checks to ensure deterministic execution and idempotency.",
      priority: "medium",
      type: "chore",
      labels: ["testing"],
      acceptance_criteria: [
        "Integration tests pass against mocked providers.",
        "One full e2e run succeeds with real configuration.",
      ],
      technical_notes:
        "Cover success, retry, and failure transitions across Notion/OpenAI/GitHub.",
    },
  ];

  return {
    product_overview: {
      name: projectName,
      description: `Automatically generated fallback project structure for idea: ${idea}.`,
      target_users: ["developers", "product teams"],
      core_features: [
        "Idea ingestion from Notion",
        "AI project plan generation",
        "Task decomposition",
        "GitHub issue automation",
      ],
    },
    architecture: {
      frontend: "Optional web dashboard for project tracking",
      backend: "Fastify API and worker orchestration",
      database: "Notion databases for ideas/projects/tasks",
      infrastructure: "Bun runtime with OpenAI and GitHub API integrations",
      external_services: ["OpenAI API", "Notion API", "GitHub API"],
    },
    tasks,
    roadmap: [
      {
        sprint: "Sprint 1",
        tasks: tasks.map((task) => task.title),
      },
    ],
  };
};

const GENERATED_PROJECT_RESPONSE_SCHEMA: Record<string, unknown> = {
  type: "object",
  additionalProperties: false,
  required: ["product_overview", "architecture", "tasks", "roadmap"],
  properties: {
    product_overview: {
      type: "object",
      additionalProperties: false,
      required: ["name", "description", "target_users", "core_features"],
      properties: {
        name: { type: "string", minLength: 1 },
        description: { type: "string", minLength: 1 },
        target_users: {
          type: "array",
          minItems: 1,
          items: { type: "string", minLength: 1 },
        },
        core_features: {
          type: "array",
          minItems: 1,
          items: { type: "string", minLength: 1 },
        },
      },
    },
    architecture: {
      type: "object",
      additionalProperties: false,
      required: [
        "frontend",
        "backend",
        "database",
        "infrastructure",
        "external_services",
      ],
      properties: {
        frontend: { type: "string", minLength: 1 },
        backend: { type: "string", minLength: 1 },
        database: { type: "string", minLength: 1 },
        infrastructure: { type: "string", minLength: 1 },
        external_services: {
          type: "array",
          minItems: 1,
          items: { type: "string", minLength: 1 },
        },
      },
    },
    tasks: {
      type: "array",
      minItems: 1,
      items: {
        type: "object",
        additionalProperties: false,
        required: [
          "title",
          "description",
          "priority",
          "type",
          "labels",
          "acceptance_criteria",
          "technical_notes",
        ],
        properties: {
          title: { type: "string", minLength: 1 },
          description: { type: "string", minLength: 1 },
          priority: { type: "string", enum: ["low", "medium", "high"] },
          type: { type: "string", enum: ["feature", "bug", "chore"] },
          labels: {
            type: "array",
            items: { type: "string", minLength: 1 },
          },
          acceptance_criteria: {
            type: "array",
            items: { type: "string", minLength: 1 },
          },
          technical_notes: { type: "string", minLength: 1 },
        },
      },
    },
    roadmap: {
      type: "array",
      minItems: 1,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["sprint", "tasks"],
        properties: {
          sprint: { type: "string", minLength: 1 },
          tasks: {
            type: "array",
            minItems: 1,
            items: { type: "string", minLength: 1 },
          },
        },
      },
    },
  },
};

const sanitizeIdeaInput = (idea: string): string => {
  const withoutControlChars = idea.replace(
    /[\u0000-\u0008\u000B-\u001F\u007F-\u009F]/g,
    " ",
  );
  const trimmed = withoutControlChars.replace(/\s+/g, " ").trim();
  const maxLength = 1200;
  const limited = trimmed.slice(0, maxLength);

  return limited.length > 0 ? limited : "Untitled project idea";
};

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;
