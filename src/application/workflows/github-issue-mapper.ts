export type GithubIssuePriority = "low" | "medium" | "high";
export type GithubIssueType = "feature" | "bug" | "chore";

export interface GithubIssueTaskInput {
  title: string;
  description: string;
  priority: GithubIssuePriority;
  type?: GithubIssueType;
  labels?: ReadonlyArray<string>;
  acceptance_criteria?: ReadonlyArray<string>;
}

export interface GithubIssuePayload {
  title: string;
  body: string;
  labels: ReadonlyArray<string>;
}

const DEFAULT_ACCEPTANCE_CRITERIA: ReadonlyArray<string> = [
  "Implementation is completed and reviewed.",
  "Tests are added or updated.",
];

export const mapTaskToGithubIssue = (
  task: GithubIssueTaskInput,
): GithubIssuePayload => {
  const title = `[AI] ${normalizeTitle(task.title)}`;
  const description = normalizeBodyText(task.description);
  const priority = normalizePriority(task.priority);
  const type = normalizeType(task.type);
  const acceptanceCriteria = normalizeAcceptanceCriteria(
    task.acceptance_criteria,
  );

  const body = `## 🧩 Task Overview

${description}

---

## 🎯 Objective

Implement this feature to improve the product functionality.

---

## ✅ Acceptance Criteria

${acceptanceCriteria.map((criteria) => `- [ ] ${criteria}`).join("\n")}

---

## 🏷 Metadata

- Priority: ${priority}
- Type: ${type}
- Source: AI-generated from Notion

---`;

  const labels = dedupeLabels([
    "AI",
    priority,
    type,
    ...(task.labels ?? []).map((label) => normalizeLabel(label)),
  ]);

  return {
    title,
    body,
    labels,
  };
};

const normalizeTitle = (value: string): string => {
  const clean = value.replace(/\s+/g, " ").trim();
  return clean.length > 0 ? clean : "Untitled task";
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
): ReadonlyArray<string> => {
  const cleanCriteria = (acceptanceCriteria ?? [])
    .map((criteria) => criteria.trim())
    .filter((criteria) => criteria.length > 0);

  if (cleanCriteria.length > 0) {
    return cleanCriteria;
  }

  return DEFAULT_ACCEPTANCE_CRITERIA;
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
