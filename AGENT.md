# Core Commands

```bash
# Install dependencies
bun install

# Run main entrypoint
bun run start

# Run API server (Fastify)
bun run api:run

# Run one worker cycle (Notion -> AI -> Notion -> GitHub)
bun run worker:run

# Run test suite
bun run test

# Run tests in watch mode
bun run test:watch

# Static type checking
bun run typecheck
```

# Development Tools

- Runtime: `Bun`
- Language: `TypeScript` (strict mode)
- API Framework: `Fastify`
- Functional Toolkit: `Effect`
- Validation: `Zod`
- Testing: `Vitest`
- Notion integration: `@notionhq/client`
- OpenAI integration: `openai`
- GitHub integration: `@octokit/rest`

Quality gates before merge:
- `bun run typecheck`
- `bun run test`

# Architecture Overview

This backend follows a clean architecture approach:

- `domain`: core entities (`Idea`, `Project`, `Task`, `GeneratedProject`)
- `application`: ports + workflow orchestration use cases
- `infrastructure`: Notion, OpenAI, GitHub adapters
- `worker`: execution entrypoints for workflow cycles
- `api`: operational HTTP control surface
- `config`: runtime environment validation

Execution flow:
1. Read new ideas from Notion.
2. Generate structured project JSON with OpenAI.
3. Create project and tasks in Notion.
4. Create GitHub issues from generated tasks.
5. Return a workflow summary.

# Project Structure

```text
src/
  api/
    run-api.ts
    server.ts
  application/
    ports/
    workflows/
  config/
    env.ts
  domain/
    entities/
  infrastructure/
    ai/
    github/
    notion/
  worker/
    idea-worker.ts
    run-worker.ts
  index.ts

tests/
  unit/
  integration/
  e2e/
```

# Important Features

- End-to-end idea processing pipeline (`Notion -> AI -> Notion -> GitHub`)
- Strong runtime validation for AI payloads (Zod schema)
- Adapter-based integrations for external providers
- Worker-first orchestration with API trigger endpoint (`POST /worker/run`)
- Unit, integration, and e2e test coverage

# Code Conventions

## Naming Conventions

- Types, classes, interfaces: `PascalCase`
- Variables, functions, methods: `camelCase`
- Constants: `UPPER_SNAKE_CASE`
- File names: `kebab-case.ts`

## Language Conventions

- Use English for source code, identifiers, and technical comments.
- Keep comments short and useful.
- Avoid vague comments and duplicated information.

## Style Conventions

- Prefer explicit return types on exported functions and methods.
- Keep side effects inside infrastructure and worker layers.
- Keep domain entities framework-agnostic.
- Fail fast on invalid external payloads.

# Forms and Server Actions

- Not applicable for the current backend-only scope.
- If a frontend is introduced later, form handling and server actions must stay outside domain logic.

# Authentication

- No user authentication is currently implemented.
- API endpoints are operational endpoints and should be protected before production exposure.
- Target: token-based protection for `POST /worker/run`.

# Database

- There is no local SQL database in the current MVP.
- Notion databases are the primary persistence layer.
- Keys and IDs are loaded from environment variables and validated at startup.

# Testing

## Unit Testing

- Test entities, mappers, parsers, and single adapters in isolation.
- Mock external SDK calls.
- Keep tests deterministic and fast.

## E2E Testing

- Validate full cycle behavior through in-memory fakes or controlled adapters.
- Focus on workflow outcomes, not SDK internals.

## Integration Testing

- Validate interactions between application workflow and concrete infrastructure adapters.
- Use mocked SDK boundaries but real adapter implementations.

# Important Files

- `src/application/workflows/idea-to-project-workflow.ts`
- `src/infrastructure/notion/notion-client.ts`
- `src/infrastructure/ai/openai-architect-client.ts`
- `src/infrastructure/github/github-client.ts`
- `src/config/env.ts`
- `src/api/server.ts`
- `src/worker/run-worker.ts`

# Development Notes

- Never commit `.env`.
- Keep `.env.example` current with every new required variable.
- Keep README and AGENT aligned when architecture or scripts change.
- Keep tags in sync with roadmap milestones.

# File Naming Rules

- One responsibility per file where practical.
- Use clear feature-oriented names (`notion-client.ts`, `idea-worker.ts`).
- Test files must mirror target modules when possible.
- Naming pattern: `<module>.test.ts` for unit tests.

# Debugging Complete Tasks

Before marking a task complete:
1. Run `bun run typecheck`.
2. Run `bun run test`.
3. Verify affected command path manually (`api:run`, `worker:run`) if relevant.
4. Confirm docs/env examples are updated if needed.

# Important Imports Rules

- Import types using `import type` when possible.
- Avoid circular imports between layers.
- Domain must not import infrastructure modules.
- Infrastructure can depend on application ports and domain entities.

# Workflow

1. Pick a small scoped change.
2. Implement in the correct layer.
3. Add or update tests.
4. Run validation commands.
5. Update docs if behavior or setup changed.
6. Commit with a focused message.
7. Tag milestone releases when applicable.

# Pull Request Standard

## Content Rules

- Explain what changed and why.
- Keep scope tight to the described objective.
- Highlight risk areas and rollback strategy if needed.
- If docs are not updated, explicitly state this in `Out of Scope`.

## Validation Format

Include this block in PR description:

```text
Validation
- bun run typecheck: PASS/FAIL
- bun run test: PASS/FAIL
- Manual checks: <list>

Out of Scope
- <explicit list>
```

## Discipline

- Keep PR text factual and concise.
- Do not mix future roadmap work into current PR scope.
- If docs are not updated in the PR, state it explicitly in `Out of Scope`.

# Versioning

Use semantic versioning:

- `v1.0.0`
- `v1.1.0`
- `v2.0.0`

Prompt changes may require a minor or major bump.

# Agent Behavior Rules

- Stay within the requested scope.
- Prioritize correctness over speed.
- Prefer incremental delivery with working checkpoints.
- Keep changes testable and reproducible.
- Surface blockers immediately with concrete remediation steps.
