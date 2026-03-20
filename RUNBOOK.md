# Runbook (Demo)

## Goal

Run a clean end-to-end demo:

`Notion Idea -> AI plan -> Notion Project/Tasks -> GitHub Issues`

This runbook is designed for reliable live execution with minimal stress.

For the live pitch sequence, see [DEMO_SCRIPT.md](./DEMO_SCRIPT.md).

## Prerequisites

- `.env` is configured with valid Notion, OpenAI, and GitHub credentials.
- `OPENAI_MODEL=gpt-4o-mini` for stable demo behavior.
- `OPENAI_TIMEOUT_MS=60000` to avoid premature timeout on structured generations.
- Notion databases are ready:
  - `Ideas`
  - `Projects`
  - `Tasks`
- At least one idea has `Status = new`.

## Quick Demo Execution

1. Create or select one idea with `Status = new`.
2. Run one worker cycle:

```bash
bun run worker:run
```

3. Observe logs and verify outputs in Notion and GitHub.
4. Optional API trigger mode (if API server is running):

```bash
curl -X POST http://localhost:3000/worker/run \\
  -H "Authorization: Bearer $API_BEARER_TOKEN"
```

## Expected Results

### In logs

- `[Worker] Starting workflow cycle.`
- `[Worker] Found X new idea(s) to process.`
- `[Worker][Idea ...] Calling OpenAI architect.`
- `[Worker][Idea ...] Created GitHub issue ...`
- `[Worker] Workflow summary: ideas=..., projects=..., tasks=..., issues=...`

### In Notion

- Idea status transitions:
  - `new -> processing -> done`
- Project:
  - created and linked to the idea
- Tasks:
  - created and linked to the project
  - GitHub issue URL attached

### In GitHub

- Issues are created automatically.
- Issue structure includes:
  - title
  - technical description
  - acceptance criteria
- Labels include:
  - `AI`
  - `priority:*`
  - `feature|bug|chore`
  - `project:*`

## Validation Checklist

- [ ] Idea processed successfully
- [ ] Project created in Notion
- [ ] Tasks generated and linked
- [ ] GitHub issues created without duplicates

## Failure Handling

### OpenAI error or timeout

- Retry is automatic (up to 3 attempts).
- If timeouts become frequent, increase `OPENAI_TIMEOUT_MS` before rerunning.
- If needed, rerun:

```bash
bun run worker:run
```

### Idea stuck in `processing`

- Auto-recovery resets stale ideas to `new` at cycle start.
- Manual fallback: reset status to `new` in Notion.

### Duplicate GitHub issues

- Prevented via title-based idempotence.
- Existing issue is reused when found.

## Reset Procedure (Before Demo)

1. Ensure target demo idea has `Status = new`.
2. Clean Notion demo data if needed (projects/tasks).
3. Clean GitHub demo noise if needed (close old demo issues).
4. Run:

```bash
bun run worker:run
```

## Quick Recovery (Plan B)

If something goes wrong during demo:

1. Reset idea status to `new`.
2. Rerun:

```bash
bun run worker:run
```

The system is retry-safe and idempotent by design.

## Notes

- Worker is stateless and safe to rerun.
- Notion is the source of truth.
- Reliability includes retries, timeout handling, and stale-state recovery.
