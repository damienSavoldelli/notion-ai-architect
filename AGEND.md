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
- Language: `TypeScript` (`strict` mode enabled)
- API Framework: `Fastify`
- Functional Toolkit: `Effect`
- Validation: `Zod`
- Testing: `Vitest` (`unit`, `integration`, `e2e`)
- External Integrations:
- Notion: `@notionhq/client`
- OpenAI: `openai`
- GitHub: `@octokit/rest`

Quality gates expected before merge:
- `bun run typecheck`
- `bun run test`

# Architecture Overview

The backend follows a clean architecture style:

- `domain`: core entities and business language (`Idea`, `Project`, `Task`, generated AI output model)
- `application`: ports (interfaces) and orchestrated workflow use cases
- `infrastructure`: concrete adapters for Notion, OpenAI, and GitHub
- `worker`: execution entrypoints for asynchronous workflow processing
- `api`: HTTP control surface (`/health`, `/worker/run`)
- `config`: environment loading and validation

Primary execution flow:
1. Read new ideas from Notion (`Status = new`)
2. Generate structured project plan with OpenAI
3. Create project and tasks in Notion
4. Create GitHub issues from generated tasks
5. Return workflow summary and logs

# Project Structure

```text
src/
  api/
    run-api.ts
    server.ts
  application/
    ports/
      ai-architect-service.ts
      github-repository.ts
      notion-repository.ts
    workflows/
      idea-to-project-workflow.ts
  config/
    env.ts
  domain/
    entities/
      generated-project.ts
      idea.ts
      project.ts
      task.ts
  infrastructure/
    ai/
      generated-project-schema.ts
      openai-architect-client.ts
    github/
      github-client.ts
    notion/
      notion-client.ts
  worker/
    idea-worker.ts
    run-worker.ts
  index.ts

tests/
  unit/
  integration/
  e2e/
```
