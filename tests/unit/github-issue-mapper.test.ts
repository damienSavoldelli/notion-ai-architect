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

    expect(mapped).toEqual({
      title: "[AI][Freelance Invoice Assistant] Implement JWT authentication system",
      body: `## 📦 Project

Freelance Invoice Assistant

---

## 🧩 Task Overview

Create secure login system

---

## 🎯 Objective

Deliver a production-ready implementation of this feature with proper validation, error handling, and integration into the system.

---

## 🛠 Technical Notes

- Define implementation scope, interfaces, and data contracts for "Implement JWT authentication system".
- Implement core logic with validation and error handling.
- Add automated tests for success path, validation failures, and edge cases.

---

## ✅ Acceptance Criteria

- [ ] User can login
- [ ] JWT is generated
- [ ] Protected routes work

---

## 🏷 Metadata

- **Priority:** high
- **Type:** feature
- **Source:** AI-generated from Notion

---`,
      labels: [
        "AI",
        "high",
        "feature",
        "priority:high",
        "project:freelance-invoice-assistant",
        "domain:auth",
        "domain:api",
        "backend",
        "auth",
      ],
    });
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
    expect(mapped.body).toContain(
      '- Define implementation scope, interfaces, and data contracts for "Untitled task".',
    );
    expect(mapped.body).toContain("- [ ] Implementation is completed and reviewed.");
    expect(mapped.body).toContain("- [ ] Tests are added or updated.");
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
});
