# Runbook (Demo)

## Goal

Run a clean end-to-end demo:

`Notion Idea -> AI plan -> Notion Project/Tasks -> GitHub Issues`

For the live pitch sequence, use [DEMO_SCRIPT.md](./DEMO_SCRIPT.md).

## Prerequisites

- `.env` is filled with valid Notion/OpenAI/GitHub credentials.
- `OPENAI_MODEL` is pinned to `gpt-4o-mini` for predictable demo behavior.
- Notion databases are configured (`Ideas`, `Projects`, `Tasks`).
- The new idea has `Status = new`.

## Quick Start

1. Install deps:
   `bun install`
2. Run one worker cycle:
   `bun run worker:run`
3. Optional API mode:
   `bun run api:run`
   then `POST /worker/run`

## Expected Logs

- `[Worker] Starting workflow cycle.`
- `[Worker] Found X new idea(s) to process.`
- `[Worker][Idea ...] Calling OpenAI architect.`
- `[Worker][Idea ...] Created GitHub issue ...`
- `[Worker] Workflow summary: ideas=..., projects=..., tasks=..., issues=...`

## Validation Checklist

1. In Notion `Ideas`: status moves `new -> processing -> done` (or `error` on failure).
2. In Notion `Projects`: one project page created and linked to the idea.
3. In Notion `Tasks`: tasks created and linked to project + GitHub URL.
4. In GitHub: structured issues created with project/type/priority labels.

## Failure Handling

- OpenAI timeout/error:
  - Retry is automatic (up to 3 attempts).
  - Relaunch `bun run worker:run` if needed.
- Stuck ideas in `processing`:
  - Auto-recovery resets stale ideas to `new` at cycle start.
- Duplicate GitHub issues:
  - Light idempotence checks existing issue by title before create.

## Reset Procedure (Demo Prep)

1. In `Ideas`, ensure target idea is `new`.
2. Remove test/demo projects/tasks if needed.
3. Close/delete old demo issues if you want a clean GitHub board.
4. Run `bun run worker:run` once.
