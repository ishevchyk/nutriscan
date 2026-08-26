---
description: Audit the NutriScan codebase for refactor opportunities — misplaced types, duplicated components/logic, backend pattern drift, dead code
argument-hint: [backend|mobile|web|all]
---

# NutriScan Structure Audit

Scope: $ARGUMENTS (default to `all` if empty).

You are auditing, not refactoring. Produce a report. Do not edit any files in this pass — if the user wants a fix applied after reading the report, that's a separate, explicit follow-up request per item.

## 1. Orient

- If scope includes `backend`: look at `backend/app/{models,schemas,routers}/`.
- If scope includes `mobile`: look at the Expo app (React Native), typically `../../mobile` or `app`.
- If scope includes `web`: look at the Vite React app, typically `web/src/`.
- Skim `../../README.md` in the repo root if present, to recall the locked-in conventions (soft delete, ownership, shared Zustand store logic between mobile/web, per-100g nutrition math). Don't re-derive these from scratch if a project README already states them — use it as the source of truth for what "correct" looks like.

## 2. Checks to run

### A. Type placement (frontend)
- Search for `interface` / `type` declarations defined inside component files (`.tsx`) rather than in a shared `types/` folder.
- Flag any type that is imported by, or structurally duplicated in, 2+ files — that's the threshold for "should be extracted," not just size or complexity.
- Flag types that are near-duplicates of the backend Pydantic schemas (e.g. a hand-maintained `Product` interface that's drifted from `schemas/product.py`) — these are prone to silently going stale.
- Don't flag a one-off local type used in exactly one file — extracting single-use types is churn, not cleanup.

### B. Component / logic duplication (mobile vs. web)
- The README states Zustand store logic should be shared "where possible" — diff store files between mobile and web by responsibility (not literal text) and flag stores that implement the same domain logic (e.g. product list filtering, log entry grouping by meal) independently instead of sharing a package/module.
- Flag near-identical UI components across the two apps only if the *logic* (not just markup) is duplicated — visual/layout differences between mobile and web are expected and not a smell by themselves.

### C. Backend pattern drift (against `references/conventions.md` from the nutriscan-crud-scaffold skill, if installed — otherwise against the README's locked decisions)
- Routers that inline an ownership-check query (`.filter(Model.id == ..., Model.user_id == ...)`) instead of calling a shared helper — flag if the same inline pattern appears in 2+ routers, since that's exactly what `_get_owned_or_404` exists to avoid.
- Soft-delete resources (`products`, `meals`) missing any of: `deleted_at` filter on list, `/deleted` route, `/restore` route.
- Non-soft-delete resources that still carry a `deleted_at` column or restore route (drift in the other direction).
- Endpoints missing `Depends(get_current_user)`.
- `PATCH` handlers that forget to bump `updated_at`.

### D. Dead code
- Exported functions/components/types with zero importers elsewhere in the repo.
- Routers registered in `main.py` with no corresponding frontend caller (may be intentional — report, don't assume).

### E. File-level concerns
- Backend files mixing model + schema + route-handler logic in one file instead of the `models/`/`schemas/`/`routers/` split.
- Any single file over ~300 lines — name it and suggest a split point along existing domain boundaries, don't propose a generic "split into smaller files."

## 3. Output format

Group findings by category (A–E above). For each finding:
- File path(s) involved
- One-sentence description of the issue
- One-sentence suggested fix
- Rough priority: **high** (causes bugs or active drift from documented conventions), **medium** (maintenance cost, no active bug), **low** (nice-to-have)

Sort each category by priority, high first. End with a 2-3 sentence summary of the top 3 things worth doing first across the whole report.

If a category has zero findings, say so briefly rather than omitting it — an empty category is useful signal too.
