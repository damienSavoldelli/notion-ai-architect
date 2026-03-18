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
});
