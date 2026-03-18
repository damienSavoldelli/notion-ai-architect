# notion-ai-architect

AI workflow engine that turns Notion ideas into executable projects using AI.

## Vision

Turn a raw idea into an executable software project:

`Idea in Notion -> AI architecture output -> Notion project/tasks -> GitHub issues`

## Stack

- Runtime: Bun
- Language: TypeScript
- Framework: Fastify
- Functional toolkit: Effect
- Validation: Zod
- Testing: Vitest

## Project structure

```text
src/
  domain/
    entities/
  application/
    ports/
    workflows/
  infrastructure/
    notion/
    ai/
    github/
  worker/
  api/
  config/
tests/
  unit/
  integration/
  e2e/
```

## Setup

1. Install dependencies: `bun install`
2. Create env file: `cp .env.example .env`
3. Fill `.env` with your Notion, OpenAI and GitHub credentials
4. Run tests: `bun test`
5. Run one worker cycle: `bun run worker:run`
6. Run API server: `bun run api:run`

## Environment variables

- `NOTION_API_TOKEN`
- `NOTION_IDEAS_DATABASE_ID`
- `NOTION_PROJECTS_DATABASE_ID`
- `NOTION_TASKS_DATABASE_ID`
- `OPENAI_API_KEY`
- `OPENAI_MODEL` (default suggested: `gpt-5.2`)
- `GITHUB_TOKEN`
- `GITHUB_OWNER`
- `GITHUB_REPO`
- `API_HOST` (default `0.0.0.0`)
- `API_PORT` (default `3000`)

## Scripts

- `bun run start`
- `bun run dev`
- `bun run api:run`
- `bun run worker:run`
- `bun run test`
- `bun run typecheck`

## Phase 11 (Demo Hardening)

Current hardening scope on `main` is focused on demo reliability:

- Worker-safe processing with per-idea error isolation (`done` / `error` without full-cycle crash)
- Simple retry strategy (3 attempts) on critical operations
- Auto-recovery for stale `processing` ideas
- OpenAI request timeout (default 15s) with retry
- Lightweight GitHub idempotence (reuse issue when same title already exists)
- Clear step-by-step logs for live demo visibility

Operational guide:

- See [RUNBOOK.md](./RUNBOOK.md)

## Releases

The roadmap is tracked with git tags:

- `v0.1.0` Phase 1 - setup
- `v0.2.0` Phase 2 - Notion integration
- `v0.3.0` Phase 3 - AI integration
- `v0.4.0` Phase 4 - GitHub integration
- `v0.5.0` Phase 5 - worker orchestration
- `v0.6.0` Phase 6 - test coverage
- `v0.7.0` Phase 7 - polish baseline
- `v0.8.0` Phase 8 - release discipline
- `v0.9.0` Phase 9 - rich idea content extraction
- `v0.10.0` Phase 10 - professional GitHub issue generation
- `v0.10.1` Phase 10 patch - formatting/context improvements
- `v0.11.0` Phase 11 - demo hardening (worker recovery, retry, timeout, idempotence light)
