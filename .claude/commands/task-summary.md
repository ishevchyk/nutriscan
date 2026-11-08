---
description: Summarize this session's changes into separate Backend and Frontend tracker tasks (split further by feature when large), ready to paste
argument-hint: [base-ref (default: main)]
---

Generate Task titles and descriptions from the code changes made in this session, so they can be pasted straight into a tracker (Jira/Linear-style). Never collapse everything into one task — split by layer and by feature (see section 3).

Base ref for comparison: $ARGUMENTS (default to `main` if empty).

## 1. Gather the diff

Run these and read the actual output before writing anything:
- `git status` — working tree state
- `git diff` and `git diff --staged` — uncommitted changes
- `git log <base-ref>..HEAD --oneline` — commits already made on this branch, if any
- `git diff <base-ref>...HEAD` — full diff of the branch vs. base, if the branch has diverged

Treat "this session's changes" as: any uncommitted diff, plus any commits made on the current branch since it diverged from `<base-ref>`. If both are empty, say so and stop — don't invent a task for a no-op session.

## 2. Understand the change, don't just list files

- Group changed files by feature/concern (e.g. "settings endpoints", "log timezone handling"), not by directory.
- Skim `CLAUDE.md` in the current directory (and parent, if present) for the domain vocabulary and any "Still open" / "not yet implemented" notes — use its terminology instead of inventing new names for the same concepts.
- Infer the *why* only from what's actually in the diff or CLAUDE.md context — don't fabricate motivation that isn't evidenced.

## 3. Split into tasks

- **Always split by layer first:** `backend/` (API, models, migrations, backend tests) is a Backend task; `mobile/` (and `web/` if present) is a Frontend task. Never put both layers in the same task. Name each task's layer in its title prefix: `[BE]` or `[FE]`.
- **Then split by feature:** if a layer's changes cover several independent features (e.g. extended nutrition vs. autosave form vs. frozen log entries), make one task per feature in that layer. Keep a single task per layer only when the changes are one cohesive feature or small (roughly under 10 files).
- Pair tasks across layers: where an FE task depends on a BE task, say so under its Description ("Depends on: <BE task title>").
- Docs-only or tooling changes (`README.md`, `CLAUDE.md`, `.claude/`) go into the task of the feature they document; if they belong to none, group them in one final `[Docs]` task.
- Assign every changed file to exactly one task; don't repeat bullets across tasks.

## 4. Output format

Produce one fenced block per task, ordered Backend first, then Frontend, then Docs, so each can be copied as-is:

```
Title: [BE|FE|Docs] <imperative, <=70 chars incl. prefix, matches this repo's PR-title style — e.g. "[BE] Add user settings endpoints" not "Added" or "Adding">

Description:
<1-2 sentence summary of what this does and why>
Depends on: <other task title — only if applicable>

Changes:
- <bullet per logical change, file paths in backticks where useful>

Testing:
- <what was actually run/verified this session — tests, manual checks — or "Not yet verified" if none were>

Follow-ups:
- <anything explicitly deferred or left open, only if the diff or CLAUDE.md actually says so — omit this section entirely if there's nothing>
```

Before the blocks, add a one-line overview of the split (e.g. "3 tasks: 2 BE, 1 FE"). Do not create or push anything — this command only produces text for the user to paste into their own tracker. Do not add any Claude/AI attribution line to the output.
