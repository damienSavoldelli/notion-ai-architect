# Changelog

All notable changes to this project are documented in this file.

## [Unreleased] - 2026-03-19

### Changed
- Aligned `README.md` to explicitly include Phase 12 and the latest release milestones (`v0.11.1`, `v1.0.0`).
- Clarified roadmap-to-release visibility in docs to reduce ambiguity before final release publishing.

## [v1.0.0] - 2026-03-18

### Added
- Added a dedicated 2-minute live demo script in [`DEMO_SCRIPT.md`](./DEMO_SCRIPT.md).
- Added an explicit fallback plan for live demo failures (status reset, rerun strategy, retry behavior).
- Linked all operational docs (`README`, `RUNBOOK`, `DEMO_SCRIPT`) for a unified demo flow.

### Changed
- Finalized project documentation for contest delivery and release readiness.
- Standardized demo narrative around stateless workflow, AI validation, and GitHub automation output.

## [v0.11.1] - 2026-03-18

### Added
- Added GitHub Actions CI on both `push` and `pull_request`.
- Added TypeScript typecheck gate in CI (`bun run typecheck`).
- Added automated coverage run in CI (`bun run coverage`).
- Added Vitest coverage provider dependency (`@vitest/coverage-v8`).
- Added coverage npm script (`coverage`).

### Changed
- Enforced coverage threshold on lines (`> 90`) in `vitest.config.ts`.
- Renamed CI workflow to `CI - Test & Coverage` for clearer pipeline readability.
- Expanded unit tests significantly to improve branch and line confidence on core mappers.

## [v0.11.0] - 2026-03-18

### Added
- Added demo runbook in [`RUNBOOK.md`](./RUNBOOK.md) with execution checklist and failure handling.
- Added stale `processing` recovery in Notion to reset blocked ideas back to `new`.
- Added simple retry strategy for critical workflow operations.
- Added lightweight GitHub idempotency by checking existing issues before creation.
- Added OpenAI request timeout handling with retry attempts.

### Changed
- Refactored worker flow to continue processing safely without crashing the full cycle on single-idea failure.
- Improved workflow logs for demo visibility with step-level context.
- Strengthened status transition handling (`new -> processing -> done/error`) with safer update paths.

## [v0.10.1] - 2026-03-18

### Added
- Added filtering logic for Notion template instructions and `[EXAMPLE]` blocks in idea content extraction.

### Changed
- Improved signal quality sent to the AI by removing boilerplate/template noise from page content.

## [v0.10.0] - 2026-03-18

### Added
- Added Notion page block extraction to support rich idea input (`title + content`).
- Added content sanitization for idea payload construction (trim, normalization, length limits).
- Added tests for title-only fallback and title+content behavior.

### Changed
- Upgraded AI input from title-only to context-aware prompt input when page content exists.

## [v0.9.0] - 2026-03-18

### Added
- Added stronger AI prompt rules for domain specificity and implementation-focused task quality.
- Added richer issue quality fallback behavior when AI task detail is too generic.
- Added domain-aware issue labels and stronger issue body structure.

### Changed
- Improved generated task/actionability quality for downstream GitHub issue rendering.
- Reduced generic AI output through stricter schema interpretation and prompt constraints.

## [v0.8.0] - 2026-03-16

### Added
- Added Fastify API server with operational endpoints.
- Added worker trigger endpoint (`POST /worker/run`).
- Added health endpoint for runtime readiness checks.

### Changed
- Enabled remote/HTTP control of worker execution instead of worker-only local runs.

## [v0.7.0] - 2026-03-16

### Added
- Added polish layer with clearer logs and baseline docs improvements.

### Changed
- Improved developer/operator readability of workflow execution and setup instructions.

## [v0.6.0] - 2026-03-16

### Added
- Added integration test coverage for the full workflow wiring.
- Added end-to-end worker cycle test coverage.
- Added broader unit tests around core adapters and workflow paths.

### Changed
- Raised confidence level for regression detection across Notion, AI, and GitHub flow.

## [v0.5.0] - 2026-03-16

### Added
- Added main worker orchestration (`Idea -> Project -> Tasks -> GitHub Issues`).
- Added runnable worker entrypoint.
- Added project/task creation flow wiring through application ports.

### Changed
- Moved from isolated integration pieces to one executable end-to-end workflow.

## [v0.4.0] - 2026-03-16

### Added
- Added GitHub repository port and GitHub client adapter.
- Added issue creation integration using Octokit.

### Changed
- Enabled workflow output write-through into GitHub as executable backlog items.

## [v0.3.0] - 2026-03-16

### Added
- Added OpenAI architect client integration.
- Added structured output validation through Zod schema.
- Added generated project parsing into domain model.

### Changed
- Converted idea processing from static data flow to AI-generated project structure flow.

## [v0.2.0] - 2026-03-16

### Added
- Added Notion client implementation for listing ideas and creating projects/tasks.
- Added mapping from Notion payloads into domain entities.
- Added task creation integration with priority/status mapping.

### Changed
- Replaced initial scaffolding with functional Notion read/write workflow components.

## [v0.1.0] - 2026-03-16

### Added
- Initialized Bun + TypeScript backend project.
- Added clean architecture project structure (`domain`, `application`, `infrastructure`, `worker`, `api`).
- Added baseline Notion client scaffold and initial project bootstrap.
- Added initial testing and tooling setup foundations.
