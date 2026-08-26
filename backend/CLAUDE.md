# NutriScan — Backend

## Stack
- Python 3.11+

## Rules
- All secrets via environment variables — never hardcoded
- All endpoints require JWT auth except /auth/register and /auth/login
- Soft deletes only — never hard delete products or meals, **except** `log_entries`, `meal_portions`, and `user_goals` (see Tracking & Goals below) — those are hard-deleted/overwritten

## Schema (current + planned)
Implemented: `users`, `products`, `refresh_tokens`, `groups`, `product_groups`, `meals`, `meal_ingredients`, `meal_portions` (full CRUD via `meals.py` router, including ingredients and portions sub-resources).

Not yet implemented (see README section 6 for full column definitions):
- `user_goals`, `log_entries`, `log_entry_meal_ingredients` — Phase 4 (Tracking & Goals)

## Tracking & Goals (Phase 5, planned)
- New endpoint groups: `/goals` (GET/PATCH — PATCH creates the row on first call), `/log` (CRUD + `/log/summary`)
- `log_entry_meal_ingredients` is a snapshot taken at log time, not a live reference — editing grams there (e.g. ingredient overrides) never touches the meal's own `meal_ingredients`
- A log entry's macros are computed one of three ways depending on `source_type` (see README section 6, "Computing macros for a log entry"):
  - `product` → `quantity_grams / 100 × product's per-100g macros`
  - `meal` → sum over `log_entry_meal_ingredients`: `grams / 100 × each product's per-100g macros`
  - `manual` → use the `manual_*` fields directly
  - Keep this computation in one shared place (not duplicated per endpoint) — `/log/summary` needs the same downstream math for all three source types
- `user_goals` is a single overwritten row per user, no history (README Open Question #7 is still pending on versioning it — don't add versioning unless asked)

## Offline sync
There is no `/sync` endpoint. Offline-first sync (SQLite queue on mobile,
IndexedDB on web) was built once and deliberately removed — the offline
requirement hadn't been validated by real usage and the added complexity
(conflict resolution, connectivity polling) wasn't worth carrying yet. See
the same note in `mobile/CLAUDE.md` / `web/CLAUDE.md`. If it comes back,
last-write-wins on `updated_at` was the prior conflict policy and is a
reasonable starting point.