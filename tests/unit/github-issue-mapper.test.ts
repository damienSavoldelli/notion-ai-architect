import { describe, expect, it } from "vitest";
import { mapTaskToGithubIssue } from "../../src/application/workflows/github-issue-mapper";

describe("mapTaskToGithubIssue", () => {
  it("maps task to a professional GitHub issue format", () => {
    const mapped = mapTaskToGithubIssue({
      projectName: "Freelance Invoice Assistant",
      title: "Implement JWT authentication system",
      description: "Create secure login system",
      priority: "high",
      type: "feature",
      labels: ["backend", "auth"],
      acceptance_criteria: [
        "User can login",
        "JWT is generated",
        "Protected routes work",
      ],
    });

    expect(mapped.title).toBe(
      "[AI][Freelance Invoice Assistant] Implement JWT authentication system",
    );
    expect(mapped.body).toContain("## 📦 Project");
    expect(mapped.body).toContain("## 🧩 Task Overview");
    expect(mapped.body).toContain("## 🧱 Implementation Scope");
    expect(mapped.body).toContain("## 🛠 Technical Notes");
    expect(mapped.body).toContain("## ✅ Acceptance Criteria");
    expect(mapped.body).toContain("- **Priority:** high");
    expect(mapped.body).toContain("token lifecycle");
    expect(mapped.labels).toEqual([
      "AI",
      "high",
      "feature",
      "priority:high",
      "project:freelance-invoice-assistant",
      "domain:auth",
      "domain:api",
      "backend",
      "auth",
    ]);
  });

  it("uses safe fallback acceptance criteria and no undefined label values", () => {
    const mapped = mapTaskToGithubIssue({
      title: "   ",
      description: "",
      priority: "medium",
      labels: ["", "infra", "infra"],
      acceptance_criteria: [],
    });

    expect(mapped.title).toBe("[AI][General] Untitled task");
    expect(mapped.body).toContain("## 📦 Project");
    expect(mapped.body).toContain("General");
    expect(mapped.body).toContain("## 🧱 Implementation Scope");
    expect(mapped.body).toContain(
      '- Define service interfaces and data contracts for "Untitled task" including request/response schemas.',
    );
    expect(mapped.body).toContain(
      '- [ ] Untitled task is implemented according to the specified workflow and business rules.',
    );
    expect(mapped.body).toContain(
      "- [ ] Data changes are persisted and retrievable through the expected interface",
    );
    expect(mapped.labels).toEqual([
      "AI",
      "medium",
      "chore",
      "priority:medium",
      "project:general",
      "domain:infra",
      "misc",
      "infra",
    ]);
    expect(mapped.labels.some((label) => label === "undefined")).toBe(false);
  });

  it("replaces vague titles using task description context", () => {
    const mapped = mapTaskToGithubIssue({
      projectName: "Recruitment AI",
      title: "Implement feature",
      description:
        "Build candidate scoring pipeline with weighted criteria and persistence.",
      priority: "high",
      type: "feature",
    });

    expect(mapped.title).toBe(
      "[AI][Recruitment AI] Build candidate scoring pipeline with weighted criteria and persistence",
    );
  });

  it("builds concrete implementation scope for document upload tasks", () => {
    const mapped = mapTaskToGithubIssue({
      projectName: "AI Document Processing System",
      title: "Implement document upload functionality with file type validation",
      description:
        "Allow users to upload PDF and image files, ensuring only valid file types are accepted.",
      priority: "high",
      type: "feature",
    });

    expect(mapped.body).toContain("POST /documents/upload");
    expect(mapped.body).toContain('Enqueue "process_document" job');
    expect(mapped.body).toContain("S3-compatible object storage");
    expect(mapped.body).toContain("documents table with status lifecycle");
  });

  it("prioritizes open-banking scope for plaid integration tasks", () => {
    const mapped = mapTaskToGithubIssue({
      projectName: "AI Personal Finance",
      title: "Integrate Plaid API for bank account connections",
      description:
        "Connect user bank accounts and sync transactions securely for financial insights.",
      priority: "high",
      type: "feature",
    });

    expect(mapped.body).toContain("POST /bank-connections/link");
    expect(mapped.body).toContain("Plaid Link token exchange");
    expect(mapped.body).toContain("bank_accounts and transactions tables");
    expect(mapped.body).toContain(
      "Implement secure bank account connectivity with Plaid token exchange",
    );
    expect(mapped.labels).toContain("domain:payments");
  });

  it("keeps explicit technical notes when they are concrete and multi-step", () => {
    const mapped = mapTaskToGithubIssue({
      projectName: "Data Platform",
      title: "Design ETL pipeline contracts",
      description: "Build ingestion contracts for telemetry payloads.",
      priority: "medium",
      type: "chore",
      technical_notes: `
- Define protobuf schema for ingestion payloads
- Implement validation middleware in Fastify
- Persist normalized rows in PostgreSQL staging tables
      `,
      acceptance_criteria: [
        "Schema validation rejects malformed payloads",
        "Valid payloads are stored in staging tables",
      ],
    });

    expect(mapped.body).toContain(
      "- Define protobuf schema for ingestion payloads",
    );
    expect(mapped.body).toContain(
      "- Implement validation middleware in Fastify",
    );
    expect(mapped.body).toContain(
      "- Persist normalized rows in PostgreSQL staging tables",
    );
  });

  it("replaces generic technical notes with transaction categorization notes", () => {
    const mapped = mapTaskToGithubIssue({
      projectName: "Finance Core",
      title: "Implement transaction categorization engine",
      description: "Categorize transactions with deterministic rules.",
      priority: "high",
      type: "feature",
      technical_notes: `
- Define implementation scope
- Implement core logic
- Add automated tests
      `,
      acceptance_criteria: [
        "works correctly",
        "feature done",
      ],
    });

    expect(mapped.body).toContain(
      "Design categorization engine using merchant/category keyword mapping",
    );
    expect(mapped.body).toContain(
      "Implement fallback classification for uncategorized transactions",
    );
    expect(mapped.body).toContain(
      "Persist categories in normalized storage",
    );
  });

  it("builds OCR-specific technical notes and acceptance criteria", () => {
    const mapped = mapTaskToGithubIssue({
      projectName: "Doc AI",
      title: "Extract structured fields from OCR scans",
      description:
        "Parse OCR output into typed entities and persist extraction metadata.",
      priority: "high",
      type: "feature",
      acceptance_criteria: ["works correctly"],
    });

    expect(mapped.body).toContain("Build OCR-to-structured pipeline");
    expect(mapped.body).toContain("Normalize extracted fields into typed payloads");
    expect(mapped.body).toContain("Persist extraction results with versioning");
    expect(mapped.body).toContain(
      "OCR output is transformed into structured fields according to the target schema.",
    );
    expect(mapped.body).toContain(
      "Structured extraction results are persisted and retrievable through API responses.",
    );
  });

  it("builds notification-specific technical notes and acceptance criteria", () => {
    const mapped = mapTaskToGithubIssue({
      projectName: "Ops Assistant",
      title: "Implement reminder notification scheduler",
      description:
        "Trigger reminder notifications with retry and deduplication safeguards.",
      priority: "medium",
      type: "feature",
      acceptance_criteria: ["functional"],
    });

    expect(mapped.body).toContain(
      "Implement notification workflow with template rendering",
    );
    expect(mapped.body).toContain(
      "Add scheduling/trigger mechanism with retry policy and deduplication safeguards.",
    );
    expect(mapped.body).toContain(
      "Notification triggers execute once per eligible event and duplicate sends are prevented.",
    );
  });

  it("falls back to categorization acceptance criteria when generic criteria are provided", () => {
    const mapped = mapTaskToGithubIssue({
      projectName: "Support Ops",
      title: "Categorize support tickets by intent",
      description: "Categorize incoming support tickets and flag low confidence.",
      priority: "medium",
      type: "feature",
      acceptance_criteria: ["done", "works properly"],
    });

    expect(mapped.body).toContain(
      "Transactions are categorized based on predefined rules with deterministic precedence.",
    );
    expect(mapped.body).toContain(
      "Uncategorized transactions trigger fallback classification and are flagged for review.",
    );
    expect(mapped.body).toContain(
      "Categorization results are persisted and exposed through API responses and consumer views.",
    );
  });
});
