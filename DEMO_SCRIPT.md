# Demo Script (2 Minutes)

## Objective

Show one complete cycle:

`Notion Idea -> AI output -> Notion Project/Tasks -> GitHub Issues`

## Pre-Demo Checklist (30s)

1. `.env` is set and valid (`NOTION_*`, `OPENAI_*`, `GITHUB_*`).
2. `OPENAI_MODEL=gpt-4o-mini`.
3. In Notion `Ideas`, one fresh idea exists with `Status = new`.
4. Terminal is ready in project root.

## Live Demo Flow (90s)

1. Explain the input:
   - Open Notion `Ideas`.
   - Show one idea with `Status = new`.
2. Run the worker:
   - `bun run worker:run`
3. Explain logs quickly:
   - Worker start
   - Idea processing
   - OpenAI generation
   - GitHub issue creation
   - Final summary
4. Show generated outputs:
   - Notion `Projects`: new project linked to the idea
   - Notion `Tasks`: tasks created with priorities + GitHub links
   - GitHub: structured issues with labels and acceptance criteria

## Plan B (Failure Recovery) (30s)

If the run fails:

1. Check `Ideas` status:
   - if `error`: set back to `new` and rerun
   - if stuck in `processing`: rerun worker (auto-recovery handles stale items)
2. Relaunch:
   - `bun run worker:run`
3. If OpenAI/network timeout:
   - rerun once (retry is already built in)

## Key Message To Jury

- Stateless workflow (Notion is source of truth)
- Structured AI output validated and mapped
- Production-like automation with retries, recovery, and CI quality gate
