# NutriScan — Mobile

## Project spec
See README.md for full project overview,
database schema, API endpoints, and AI integration details.

## Stack
- expo-camera — camera for AI photo scanning (not yet added as a dependency; needed for Phase 3)

> **Offline support (SQLite + sync queue) was deliberately deferred.**
> The app currently reads and writes directly against the backend API on
> every action — no local database, no offline queue. This was cut to keep
> early development simple; it was previously implemented (`expo-sqlite`,
> a `sync_queue` table, `POST /sync` on the backend) but that added
> meaningful complexity (two schemas to keep in sync, conflict resolution,
> connectivity polling) for an offline requirement that hadn't been
> validated by real usage. Revisit if/when real usage shows the app needs
> to work with no network connection.

## Rules
- All API base URLs and keys via environment variables — never hardcoded
- All reads and writes go straight to the backend API (see offline note above)
- access_token stored in Zustand memory only (never persisted to disk)
- refresh_token stored in expo-secure-store only

## Known issues
- **Meals tab refetches on every mount.** `app/(tabs)/meals.tsx` calls `loadMeals()`/`fetchGroups()` unconditionally on mount and tracks loading via a local `initializing` state instead of the store's `loaded` flag. `app/(tabs)/products.tsx` was moved to the correct guard (`if (!loaded) load...()`) along with tracker/profile; bring Meals in line the same way when picked back up.

## Products screen
- Filters/sort/favourites-only state lives in `store/productFilterStore.ts` (session-only, not persisted); pure logic in `utils/productFilters.ts`. Everything filters client-side — `loadProducts()` always fetches the full library, never `?group_id=`, because the tracker and pickers read the same store list.
- `last_logged_at`/`log_count` come from the backend; `logStore` calls `markStatsStale()` after adding/removing an entry and the Products tab refetches on next focus.

## AI scanning flow
1. User taps Scan tab → camera opens
2. Photo captured → base64 encoded
3. POST /ai/scan sent to backend
4. Draft product card shown to user (editable)
5. User can open AI chat to refine fields
6. User confirms → product saved via the API

## Log & Goals (Phase 4 — Tracking & Goals, shipped)
- **Goals screen** (`app/goals.tsx`) — simple form to view/edit the single active goal set (calories, protein, fat, carbs); no goal calculator yet, values are entered manually
- **Log screen** (`app/(tabs)/tracker.tsx`) — daily view grouped by meal slot (breakfast/lunch/dinner/snack), with a summary vs. active goals per macro
- **Add-entry flow** (`app/log-entry.tsx`), three source paths:
  - Product (`components/tracker/ProductSourceStep.tsx`) — pick from library, enter grams consumed
  - Meal (`components/tracker/MealSourceStep.tsx`) — pick a meal + named portion (or custom grams); shows the meal's ingredients with editable per-ingredient grams and live macro recalculation before save. This only overrides that one log entry, not the meal itself.
  - Manual (`components/tracker/ManualSourceStep.tsx`) — type calories/protein/fat/carbs directly, no product needed
- Meals (Phase 3) are implemented (`useMealStore`, `app/(tabs)/meals.tsx`, `app/meal/[id].tsx`, `app/add-meal.tsx`), so the meal-logging path above is unblocked.
- See `README.md` §10 Phase 4 for the full checklist (all shipped) and Phase 5 for what's still outstanding on Profile/Settings/Admin, which this doc doesn't duplicate.
