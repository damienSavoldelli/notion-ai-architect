export type GithubIssuePriority = "low" | "medium" | "high";
export type GithubIssueType = "feature" | "bug" | "chore";

export interface GithubIssueTaskInput {
  projectName?: string;
  title: string;
  description: string;
  priority: GithubIssuePriority;
  type?: GithubIssueType;
  labels?: ReadonlyArray<string>;
  acceptance_criteria?: ReadonlyArray<string>;
  technical_notes?: string;
}

export interface GithubIssuePayload {
  title: string;
  body: string;
  labels: ReadonlyArray<string>;
}

export const mapTaskToGithubIssue = (
  task: GithubIssueTaskInput,
): GithubIssuePayload => {
  const projectName = normalizeProjectName(task.projectName);
  const taskTitle = normalizeTitle(task.title, task.description);
  const title = `[AI][${projectName}] ${taskTitle}`;
  const description = normalizeBodyText(task.description);
  const priority = normalizePriority(task.priority);
  const type = normalizeType(task.type);
  const projectLabel = `project:${slugifyProjectName(projectName)}`;
  const priorityLabel = `priority:${priority}`;
  const domainLabels = inferDomainLabels(task);
  const technicalNotes = normalizeTechnicalNotes(
    task.technical_notes,
    taskTitle,
    description,
    domainLabels,
  );
  const acceptanceCriteria = normalizeAcceptanceCriteria(
    task.acceptance_criteria,
    taskTitle,
    description,
    domainLabels,
  );

  const body = `## 📦 Project

${projectName}

---

## 🧩 Task Overview

${description}

---

## 🎯 Objective

Deliver a production-ready implementation of this feature with proper validation, error handling, and integration into the system.

---

## 🛠 Technical Notes

${technicalNotes}

---

## ✅ Acceptance Criteria

${acceptanceCriteria.map((criteria) => `- [ ] ${criteria}`).join("\n")}

---

## 🏷 Metadata

- **Priority:** ${priority}
- **Type:** ${type}
- **Source:** AI-generated from Notion

---`;

  const labels = dedupeLabels([
    "AI",
    priority,
    type,
    priorityLabel,
    projectLabel,
    ...domainLabels,
    ...(task.labels ?? []).map((label) => normalizeLabel(label)),
  ]);

  return {
    title,
    body,
    labels,
  };
};

const VAGUE_TITLE_PATTERNS: ReadonlyArray<RegExp> = [
  /^implement(?:\s+(?:a|an|the))?\s+(?:feature|task|functionality|module)$/i,
  /^improve(?:\s+(?:the))?\s+(?:system|app|platform|feature)$/i,
  /^update(?:\s+(?:the))?\s+(?:system|app|platform|feature)$/i,
  /^work on (?:feature|improvement)$/i,
];

const normalizeTitle = (value: string, description: string): string => {
  const clean = value.replace(/\s+/g, " ").trim();
  if (!clean.length) {
    return deriveTitleFromDescription(description) ?? "Untitled task";
  }

  if (VAGUE_TITLE_PATTERNS.some((pattern) => pattern.test(clean))) {
    return deriveTitleFromDescription(description) ?? clean;
  }

  return clean;
};

const normalizeProjectName = (value?: string): string => {
  const clean = value?.replace(/\s+/g, " ").trim();
  return clean && clean.length > 0 ? clean : "General";
};

const normalizeBodyText = (value: string): string => {
  const clean = value.replace(/\r\n/g, "\n").trim();
  return clean.length > 0 ? clean : "No description provided.";
};

const normalizePriority = (priority: GithubIssuePriority): GithubIssuePriority =>
  priority === "low" || priority === "medium" || priority === "high"
    ? priority
    : "medium";

const normalizeType = (type?: GithubIssueType): GithubIssueType =>
  type === "feature" || type === "bug" || type === "chore" ? type : "chore";

const normalizeLabel = (label: string): string => {
  const clean = label.trim();
  return clean.length > 0 ? clean : "misc";
};

const normalizeAcceptanceCriteria = (
  acceptanceCriteria?: ReadonlyArray<string>,
  taskTitle?: string,
  description?: string,
  domainLabels: ReadonlyArray<string> = [],
): ReadonlyArray<string> => {
  const cleanCriteria = (acceptanceCriteria ?? [])
    .map((criteria) => criteria.trim())
    .filter((criteria) => criteria.length > 0);

  if (cleanCriteria.length > 0 && !isGenericAcceptanceCriteria(cleanCriteria)) {
    return cleanCriteria;
  }

  return buildContextualAcceptanceCriteria(
    taskTitle ?? "the feature",
    description ?? "",
    domainLabels,
  );
};

const normalizeTechnicalNotes = (
  value: string | undefined,
  taskTitle: string,
  description: string,
  domainLabels: ReadonlyArray<string>,
): string => {
  const extractedSteps = extractTechnicalSteps(value);
  if (extractedSteps.length >= 2 && !areGenericTechnicalSteps(extractedSteps)) {
    return extractedSteps.map((step) => `- ${step}`).join("\n");
  }

  return buildContextualTechnicalNotes(taskTitle, description, domainLabels)
    .map((step) => `- ${step}`)
    .join("\n");
};

const dedupeLabels = (labels: ReadonlyArray<string>): ReadonlyArray<string> => {
  const unique = new Set<string>();
  for (const label of labels) {
    const clean = label.trim();
    if (clean.length > 0) {
      unique.add(clean);
    }
  }
  return Array.from(unique);
};

const slugifyProjectName = (value: string): string => {
  const normalized = value
    .normalize("NFKD")
    .replace(/[\u0300-\u036F]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");

  const fallback = normalized.length > 0 ? normalized : "general";
  const maxSlugLength = 42;
  return fallback.slice(0, maxSlugLength).replace(/-+$/g, "") || "general";
};

const deriveTitleFromDescription = (description: string): string | null => {
  const sentence = description
    .replace(/\r\n/g, "\n")
    .split(/[\n.!?]/)
    .map((part) => part.trim())
    .find((part) => part.length > 0);

  if (!sentence) {
    return null;
  }

  const normalized = sentence.replace(/\s+/g, " ");
  const maxLength = 90;
  const limited =
    normalized.length > maxLength
      ? `${normalized.slice(0, maxLength - 3).trim()}...`
      : normalized;

  return limited.charAt(0).toUpperCase() + limited.slice(1);
};

const areGenericTechnicalSteps = (steps: ReadonlyArray<string>): boolean =>
  steps.every((step) =>
    /define implementation scope|implement core logic|add (automated )?tests|validation|error handling/i.test(
      step,
    ),
  );

const isGenericAcceptanceCriteria = (
  criteria: ReadonlyArray<string>,
): boolean =>
  criteria.every((item) =>
    /works|correctly|properly|completed|done|functional/i.test(item),
  );

const buildContextualTechnicalNotes = (
  taskTitle: string,
  description: string,
  domainLabels: ReadonlyArray<string>,
): ReadonlyArray<string> => {
  const corpus = `${taskTitle} ${description}`.toLowerCase();

  if (corpus.includes("transaction") && corpus.includes("categor")) {
    return [
      "Design categorization engine using merchant/category keyword mapping and deterministic rule priority.",
      "Implement fallback classification for uncategorized transactions with confidence-based handling.",
      "Persist categories in normalized storage and expose retrieval/update through API endpoints.",
    ];
  }

  if (
    domainLabels.includes("domain:payments") ||
    corpus.includes("invoice") ||
    corpus.includes("payment")
  ) {
    return [
      "Model invoice/payment entities with status transitions, due dates, and reconciliation fields.",
      "Implement service and API flows for creation/update, including idempotent handling for callbacks.",
      "Persist transaction state and add automated tests for success, failure, and retry paths.",
    ];
  }

  if (
    domainLabels.includes("domain:notifications") ||
    corpus.includes("reminder") ||
    corpus.includes("notification")
  ) {
    return [
      "Implement notification workflow with template rendering and channel-specific payload builders.",
      "Add scheduling/trigger mechanism with retry policy and deduplication safeguards.",
      "Persist delivery status and expose observability signals for monitoring and debugging.",
    ];
  }

  if (domainLabels.includes("domain:auth") || corpus.includes("auth") || corpus.includes("jwt")) {
    return [
      "Implement authentication flow with secure credential validation and token lifecycle management.",
      "Integrate authorization checks into protected routes and define role/permission boundaries.",
      "Add security-focused tests for invalid credentials, token expiry, and unauthorized access.",
    ];
  }

  return [
    `Define service interfaces, data contracts, and module boundaries for "${taskTitle}".`,
    `Implement the core workflow for "${truncateForSentence(description, 120)}" with explicit persistence/API integration.`,
    "Add automated tests covering success paths, validation failures, and edge cases.",
  ];
};

const buildContextualAcceptanceCriteria = (
  taskTitle: string,
  description: string,
  domainLabels: ReadonlyArray<string>,
): ReadonlyArray<string> => {
  const base = [
    `${taskTitle} is implemented according to the specified workflow and business rules.`,
    "Data changes are persisted correctly and retrievable through the expected API/service interface.",
    "Validation and failure scenarios are handled with deterministic, tested behavior.",
  ];

  if (domainLabels.includes("domain:ui")) {
    return [
      ...base,
      "UI reflects updated state correctly with loading/error states and expected user feedback.",
    ];
  }

  if (domainLabels.includes("domain:notifications")) {
    return [
      ...base,
      "Notification triggers execute once per eligible event and duplicate sends are prevented.",
    ];
  }

  if (domainLabels.includes("domain:payments")) {
    return [
      ...base,
      "Payment/invoice status transitions are consistent across service logic and persisted records.",
    ];
  }

  if (description.toLowerCase().includes("categor")) {
    return [
      "Transactions are categorized based on predefined rules with deterministic precedence.",
      "Uncategorized transactions trigger fallback classification and are flagged for review.",
      "Categorization results are persisted and exposed through API responses and consumer views.",
    ];
  }

  return base;
};

const truncateForSentence = (value: string, maxLength: number): string => {
  const clean = value.replace(/\s+/g, " ").trim();
  if (!clean) {
    return "the task requirements";
  }
  if (clean.length <= maxLength) {
    return clean;
  }
  return `${clean.slice(0, maxLength - 3).trim()}...`;
};

const extractTechnicalSteps = (value?: string): ReadonlyArray<string> => {
  const clean = value?.replace(/\r\n/g, "\n").trim();
  if (!clean) {
    return [];
  }

  const steps = clean
    .split("\n")
    .flatMap((line) => line.split(";"))
    .map((line) => line.replace(/^\s*(?:[-*]|\d+\.)\s*/, "").trim())
    .filter((line) => line.length > 0);

  return steps;
};

const inferDomainLabels = (task: GithubIssueTaskInput): ReadonlyArray<string> => {
  const corpus = [
    task.title,
    task.description,
    task.technical_notes ?? "",
    ...(task.labels ?? []),
  ]
    .join(" ")
    .toLowerCase();

  const rules: ReadonlyArray<{ label: string; keywords: ReadonlyArray<string> }> = [
    { label: "domain:auth", keywords: ["auth", "jwt", "login", "oauth"] },
    { label: "domain:payments", keywords: ["payment", "invoice", "billing", "stripe"] },
    {
      label: "domain:notifications",
      keywords: ["notification", "reminder", "email", "sms", "webhook"],
    },
    { label: "domain:ui", keywords: ["ui", "ux", "frontend", "react", "design"] },
    { label: "domain:api", keywords: ["api", "endpoint", "backend", "fastify"] },
    { label: "domain:data", keywords: ["database", "sql", "schema", "migration"] },
    { label: "domain:infra", keywords: ["deploy", "docker", "infra", "ci", "aws"] },
  ];

  return rules
    .filter((rule) => rule.keywords.some((keyword) => corpus.includes(keyword)))
    .map((rule) => rule.label);
};
