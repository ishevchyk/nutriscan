# NutriScan — Backend

## Stack
- Python 3.11+

## Rules
- All secrets via environment variables — never hardcoded
- All endpoints require JWT auth except /auth/register and /auth/login
- Soft deletes only — never hard delete products or meals, **except** `log_entries`, `meal_portions`, and `user_goals` (see Tracking & Goals below) — those are hard-deleted/overwritten

## Schema (current + planned)
Implemented: `users`, `products`, `refresh_tokens`, `groups`, `product_groups`, `meals`, `meal_ingredients`, `meal_portions` (full CRUD via `meals.py` router, including ingredients and portions sub-resources), `user_goals` (`goals.py`), `log_entries`, `log_entry_meal_ingredients` (`log.py` + `tracking.py`).

Not yet implemented (see README section 6 for full column definitions):
- `user_settings`, `user_hidden_groups` — Phase 5 (User Settings)

## Tracking & Goals (Phase 4, backend implemented — UI still pending)
- Endpoint groups: `/goals` (GET/PATCH — PATCH creates the row on first call), `/log` (CRUD + `/log/summary`)
- `log_entry_meal_ingredients` is a snapshot taken at log time, not a live reference — editing grams there (e.g. ingredient overrides) never touches the meal's own `meal_ingredients`
- A log entry's macros are computed one of three ways depending on `source_type` (see README section 6, "Computing macros for a log entry"):
  - `product` → `quantity_grams / 100 × product's per-100g macros`
  - `meal` → sum over `log_entry_meal_ingredients`: `grams / 100 × each product's per-100g macros`
  - `manual` → use the `manual_*` fields directly
  - Kept in one shared place (`app/tracking.py`'s `calculate_log_entries_macros`), not duplicated per endpoint — both `GET /log` (per-entry) and `GET /log/summary` (daily totals) call it, batching DB lookups across a whole day's entries rather than querying per-entry
- For `source_type = 'meal'`, `log_entries.quantity_grams` (the dish's logged weight -- portion.grams, a custom amount, or the meal's reference weight) is a *separate* field from `log_entry_meal_ingredients` (a raw-ingredient-equivalent breakdown that only drives the macro calc above). Once a meal has `cooked_weight_grams` set, summing that ingredients table's grams does **not** equal `quantity_grams` -- don't derive one from the other; `_build_meal_snapshot` in `log.py` returns both, computed independently, and `quantity_grams` is what the client should display/edit as "how much was logged"
- `user_goals` is a single overwritten row per user, no history (README Open Question #7 is still pending on versioning it — don't add versioning unless asked)
- Still open (mobile UI, not backend): goal-setting screen, Log page daily view, global "+ Log" modal, editable-grams meal-logging flow, daily summary progress UI — see README Phase 4 checklist

## Offline sync
There is no `/sync` endpoint. Offline-first sync (SQLite queue on mobile,
IndexedDB on web) was built once and deliberately removed — the offline
requirement hadn't been validated by real usage and the added complexity
(conflict resolution, connectivity polling) wasn't worth carrying yet. See
the same note in `mobile/CLAUDE.md` / `web/CLAUDE.md`. If it comes back,
last-write-wins on `updated_at` was the prior conflict policy and is a
reasonable starting point.