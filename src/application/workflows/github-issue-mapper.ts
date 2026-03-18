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

interface ImplementationScope {
  api: string;
  processing: string;
  storage: string;
  database: string;
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
  const implementationScope = buildImplementationScope(
    taskTitle,
    description,
    domainLabels,
  );
  const taskOverview = buildTaskOverview(
    taskTitle,
    description,
    implementationScope,
    domainLabels,
  );
  const technicalNotes = normalizeTechnicalNotes(
    task.technical_notes,
    taskTitle,
    description,
    domainLabels,
    implementationScope,
  );
  const acceptanceCriteria = normalizeAcceptanceCriteria(
    task.acceptance_criteria,
    taskTitle,
    description,
    domainLabels,
    implementationScope,
  );

  const body = `## 📦 Project

${projectName}

---

## 🧩 Task Overview

${taskOverview}

---

## 🧱 Implementation Scope

- **API**:
  - ${implementationScope.api}
- **Processing**:
  - ${implementationScope.processing}
- **Storage**:
  - ${implementationScope.storage}
- **Database**:
  - ${implementationScope.database}

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
  scope?: ImplementationScope,
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
    scope ?? buildImplementationScope(taskTitle ?? "the feature", description ?? "", domainLabels),
  );
};

const normalizeTechnicalNotes = (
  value: string | undefined,
  taskTitle: string,
  description: string,
  domainLabels: ReadonlyArray<string>,
  scope: ImplementationScope,
): string => {
  const extractedSteps = extractTechnicalSteps(value);
  if (extractedSteps.length >= 2 && !areGenericTechnicalSteps(extractedSteps)) {
    return extractedSteps.map((step) => `- ${step}`).join("\n");
  }

  return buildContextualTechnicalNotes(taskTitle, description, domainLabels, scope)
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
  scope: ImplementationScope,
): ReadonlyArray<string> => {
  const corpus = `${taskTitle} ${description}`.toLowerCase();
  const isDocumentWorkflow =
    /document|upload|file|ocr|extract|parsing|processing/.test(corpus);
  const isOpenBankingWorkflow =
    /plaid|bank account|account connection|open banking|transaction feed|institution/.test(
      corpus,
    );

  if (corpus.includes("transaction") && corpus.includes("categor")) {
    return [
      "Design categorization engine using merchant/category keyword mapping and deterministic rule priority.",
      "Implement fallback classification for uncategorized transactions with confidence-based handling.",
      "Persist categories in normalized storage and expose retrieval/update through API endpoints.",
    ];
  }

  if (isDocumentWorkflow && /upload|file/.test(corpus)) {
    return [
      "Validate MIME type and file signature server-side before accepting upload payloads.",
      "Store raw files in S3-compatible object storage and persist storage keys with document metadata.",
      "Enqueue asynchronous processing jobs (e.g. BullMQ/Redis) and track lifecycle status in persistence.",
    ];
  }

  if (isDocumentWorkflow && /ocr|extract|structured/.test(corpus)) {
    return [
      "Build OCR-to-structured pipeline with schema-based extraction and confidence/error handling.",
      "Normalize extracted fields into typed payloads before persistence and downstream API exposure.",
      "Persist extraction results with versioning and processing metadata for traceability.",
    ];
  }

  if (isOpenBankingWorkflow) {
    return [
      "Integrate Plaid Link token flow with secure public_token exchange and encrypted access token storage.",
      "Implement account and transaction sync workflow with incremental cursors, retry handling, and webhook-triggered refresh.",
      "Persist normalized bank account/transaction entities and expose retrieval endpoints for downstream analytics.",
    ];
  }

  if (
    !isDocumentWorkflow &&
    (domainLabels.includes("domain:payments") ||
      corpus.includes("invoice") ||
      corpus.includes("payment"))
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
    `Define service interfaces and data contracts for "${taskTitle}" including request/response schemas.`,
    `Implement workflow with explicit API and processing boundaries: ${scope.api}; ${scope.processing}.`,
    `Persist state in storage/database layers: ${scope.storage}; ${scope.database}.`,
  ];
};

const buildContextualAcceptanceCriteria = (
  taskTitle: string,
  description: string,
  domainLabels: ReadonlyArray<string>,
  scope: ImplementationScope,
): ReadonlyArray<string> => {
  const corpus = `${taskTitle} ${description}`.toLowerCase();
  const isDocumentWorkflow =
    /document|upload|file|ocr|extract|parsing|processing/.test(corpus);
  const isOpenBankingWorkflow =
    /plaid|bank account|account connection|open banking|transaction feed|institution/.test(
      corpus,
    );

  if (isOpenBankingWorkflow) {
    return [
      "User can complete Plaid account linking and connected accounts are persisted with secure token handling.",
      "Account and transaction sync fetches incremental updates and handles upstream API failures deterministically.",
      "Connected account and transaction data is retrievable via API endpoints used by product workflows.",
    ];
  }

  if (isDocumentWorkflow && /upload|file/.test(corpus)) {
    return [
      "Uploaded files pass server-side MIME/signature validation before processing.",
      "Valid uploads are stored in object storage and linked to persisted document records.",
      "Asynchronous processing jobs are enqueued with status transitions (pending, processing, done, failed).",
    ];
  }

  if (isDocumentWorkflow && /ocr|extract|structured/.test(corpus)) {
    return [
      "OCR output is transformed into structured fields according to the target schema.",
      "Low-confidence or malformed extraction results are flagged with deterministic fallback/error handling.",
      "Structured extraction results are persisted and retrievable through API responses.",
    ];
  }

  const base = [
    `${taskTitle} is implemented according to the specified workflow and business rules.`,
    `Data changes are persisted and retrievable through the expected interface (${scope.database}).`,
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

  if (corpus.includes("categor")) {
    return [
      "Transactions are categorized based on predefined rules with deterministic precedence.",
      "Uncategorized transactions trigger fallback classification and are flagged for review.",
      "Categorization results are persisted and exposed through API responses and consumer views.",
    ];
  }

  return base;
};

const buildTaskOverview = (
  taskTitle: string,
  description: string,
  scope: ImplementationScope,
  domainLabels: ReadonlyArray<string>,
): string => {
  const cleanDescription = normalizeBodyText(description);
  const corpus = `${taskTitle} ${cleanDescription}`.toLowerCase();
  const isGeneric =
    cleanDescription.length < 60 ||
    /allow users|create module|implement feature|build system|develop logic/.test(corpus);
  const isOpenBankingWorkflow =
    /plaid|bank account|account connection|open banking|transaction feed|institution/.test(
      corpus,
    );

  if (/document|upload|file/.test(corpus)) {
    return "Implement secure document upload with server-side file validation, temporary object storage, and asynchronous processing handoff.";
  }

  if (/ocr|extract|structured/.test(corpus)) {
    return "Implement structured data extraction from OCR output with schema mapping, confidence handling, and persistent API-ready results.";
  }

  if (isOpenBankingWorkflow) {
    return "Implement secure bank account connectivity with Plaid token exchange, incremental transaction sync, and persisted account/transaction state for downstream product workflows.";
  }

  if (!isGeneric) {
    return cleanDescription;
  }

  const uiHint = domainLabels.includes("domain:ui")
    ? " and UI state updates"
    : "";
  return `${normalizeOverviewTitle(taskTitle)} with ${scope.api} ${scope.processing} ${scope.database}${uiHint}`;
};

const buildImplementationScope = (
  taskTitle: string,
  description: string,
  domainLabels: ReadonlyArray<string>,
): ImplementationScope => {
  const corpus = `${taskTitle} ${description}`.toLowerCase();
  const isOpenBankingWorkflow =
    /plaid|bank account|account connection|open banking|transaction feed|institution/.test(
      corpus,
    );

  if (isOpenBankingWorkflow) {
    return {
      api: "POST /bank-connections/link, GET /bank-connections/:id/accounts, and sync trigger endpoints.",
      processing:
        "Handle Plaid Link token exchange, fetch account/transaction data, and schedule periodic sync jobs.",
      storage: "Store provider access tokens encrypted and keep sync checkpoints for incremental updates.",
      database:
        "Persist bank_accounts and transactions tables with connection status and reconciliation metadata.",
    };
  }

  if (/upload|file|document/.test(corpus) && !/extract|ocr/.test(corpus)) {
    return {
      api: "POST /documents/upload (multipart) with server-side type/size validation.",
      processing:
        'Enqueue "process_document" job in an asynchronous queue (BullMQ/Redis) after successful upload.',
      storage: "Store raw files in S3-compatible object storage using scoped temporary access.",
      database:
        "Persist documents table with status lifecycle (pending, processing, done, failed) and storage key.",
    };
  }

  if (/ocr|extract|structured/.test(corpus)) {
    return {
      api: "POST /documents/:id/extract and GET /documents/:id/extraction-result endpoints.",
      processing:
        "Run OCR normalization and schema-based extraction pipeline with retry/error handling.",
      storage: "Store OCR raw output and normalized extraction payload artifacts for traceability.",
      database:
        "Persist extracted_data records with confidence score, schema version, and document linkage.",
    };
  }

  if (domainLabels.includes("domain:payments") || /invoice|payment|billing/.test(corpus)) {
    return {
      api: "Expose payment/invoice service endpoints for create, update, and status retrieval.",
      processing: "Execute idempotent payment workflow with callback handling and retry-safe transitions.",
      storage: "Store payment event payloads and reconciliation artifacts for auditability.",
      database:
        "Persist invoice/payment tables with explicit status transitions and indexed references.",
    };
  }

  if (domainLabels.includes("domain:auth") || /auth|jwt|login/.test(corpus)) {
    return {
      api: "Expose authentication endpoints for sign-in/token refresh and protected resource access.",
      processing: "Run credential verification and token issuance/validation with expiry handling.",
      storage: "Store secure credential hashes and token/session revocation state.",
      database:
        "Persist user/session data model with role/permission mapping for authorization checks.",
    };
  }

  return {
    api: `Expose API/service contract required for "${taskTitle}".`,
    processing:
      "Implement deterministic processing workflow with explicit error handling and retry behavior.",
    storage: "Store input/output artifacts in durable storage with access lifecycle management.",
    database:
      "Persist state transitions and processing metadata in relational storage for retrieval and auditing.",
  };
};

const normalizeOverviewTitle = (taskTitle: string): string => {
  const clean = taskTitle.replace(/\s+/g, " ").trim();
  if (!clean) {
    return "Implement the task";
  }

  const isVerbLed =
    /^(implement|integrate|build|create|develop|design|configure|add|setup|set up|expose|persist|validate)\b/i.test(
      clean,
    );

  if (isVerbLed) {
    return clean;
  }

  return `Implement ${clean.toLowerCase()}`;
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
    {
      label: "domain:payments",
      keywords: [
        "plaid",
        "bank account",
        "account connection",
        "transaction",
        "finance",
        "payment",
        "invoice",
        "billing",
        "stripe",
      ],
    },
    { label: "domain:auth", keywords: ["auth", "jwt", "login", "oauth"] },
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
