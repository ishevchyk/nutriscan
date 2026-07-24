# NutriScan — Mobile

## Project spec
See docs/nutriscan_project_spec.md for full project overview,
database schema, API endpoints, and AI integration details.

## Stack
- React Native + Expo (managed workflow)
- Expo Router — file-based navigation
- Zustand — state management
- Axios — direct API client (see note below on offline support)
- expo-camera — camera for AI photo scanning
- expo-secure-store — JWT refresh token storage

> **Offline support (SQLite + sync queue) was deliberately deferred.**
> The app currently reads and writes directly against the backend API on
> every action — no local database, no offline queue. This was cut to keep
> early development simple; it was previously implemented (`expo-sqlite`,
> a `sync_queue` table, `POST /sync` on the backend) but that added
> meaningful complexity (two schemas to keep in sync, conflict resolution,
> connectivity polling) for an offline requirement that hadn't been
> validated by real usage. Revisit if/when real usage shows the app needs
> to work with no network connection.

## Project structure
```
mobile/
├── app/                        # Expo Router screens (file = route)
│   ├── (auth)/
│   │   ├── login.tsx
│   │   └── register.tsx
│   ├── (tabs)/
│   │   ├── products/
│   │   │   ├── index.tsx       # Product list
│   │   │   ├── [id].tsx        # Product detail
│   │   │   └── add.tsx         # Add product form
│   │   ├── recipes/
│   │   │   ├── index.tsx       # Recipe list
│   │   │   ├── [id].tsx        # Recipe detail
│   │   │   └── add.tsx         # Recipe builder
│   │   ├── log/
│   │   │   ├── index.tsx       # Daily log, grouped by meal, summary vs. goals
│   │   │   └── add.tsx         # Add-entry flow (product / recipe+portion / manual)
│   │   ├── goals.tsx           # View/edit the single active goal set
│   │   └── scan.tsx            # Camera / AI scan screen
│   └── _layout.tsx
├── components/                 # Shared UI components
├── store/                      # Zustand stores
│   ├── authStore.ts
│   ├── productStore.ts
│   └── recipeStore.ts
├── lib/
│   ├── api.ts                  # Axios instance + interceptors
│   └── nutrition.ts            # Per-100g / per-portion calculations
├── hooks/                      # Custom hooks
├── constants/                  # Colors, spacing, typography
├── .env
├── .env.example
└── app.json
```

## Rules
- All API base URLs and keys via environment variables — never hardcoded
- All reads and writes go straight to the backend API (see offline note above)
- access_token stored in Zustand memory only (never persisted to disk)
- refresh_token stored in expo-secure-store only
- On 401 response: auto-refresh token, retry request, log out if refresh fails
- TypeScript strict mode throughout
- No inline styles — use StyleSheet.create or a consistent styling approach

## AI scanning flow
1. User taps Scan tab → camera opens
2. Photo captured → base64 encoded
3. POST /ai/scan sent to backend
4. Draft product card shown to user (editable)
5. User can open AI chat to refine fields
6. User confirms → product saved via the API

## Log & Goals (Phase 5, planned)
- **Goals screen** — simple form to view/edit the single active goal set (calories, protein, fat, carbs); no goal calculator yet, values are entered manually
- **Log screen** — daily view grouped by meal (breakfast/lunch/dinner/snack), with a summary vs. active goals per macro
- **Add-entry flow**, three source paths:
  - Product — pick from library, enter grams consumed
  - Recipe — pick a recipe + named portion (or custom grams); shows the recipe's ingredients with editable per-ingredient grams and live macro recalculation before save. This only overrides that one log entry, not the recipe itself.
  - Manual — type calories/protein/fat/carbs directly, no product needed
- The recipe-logging path depends on Phase 4 (recipes) being implemented first — currently `app/(tabs)/recipes.tsx` is a placeholder screen, so that path can't be built yet. Product and manual entry don't have this dependency.
