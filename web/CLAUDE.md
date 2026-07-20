# NutriScan — Web

## Project spec
See docs/nutriscan_project_spec.md for full project overview,
database schema, API endpoints, and AI integration details.

## Stack
- React + Vite
- React Router v6 — client-side routing
- Zustand — state management (shared logic with mobile where possible)
- Axios — direct API client (see note below on offline support)
- TypeScript

> **Offline support (IndexedDB + sync queue) was deliberately deferred.**
> Same decision as mobile: the app reads and writes directly against the
> backend API on every action — no local database, no offline queue, no
> Dexie.js. This keeps early development simple and avoids maintaining a
> second schema + conflict-resolution + connectivity-polling layer for an
> offline requirement that hasn't been validated by real usage. Revisit if
> real usage shows it's needed — mirror whatever mobile lands on if/when
> that happens, so the two clients don't diverge on sync semantics.

## Project structure
```
web/
├── src/
│   ├── pages/
│   │   ├── auth/
│   │   │   ├── Login.tsx
│   │   │   └── Register.tsx
│   │   ├── products/
│   │   │   ├── ProductList.tsx
│   │   │   ├── ProductDetail.tsx
│   │   │   └── AddProduct.tsx
│   │   ├── recipes/
│   │   │   ├── RecipeList.tsx
│   │   │   ├── RecipeDetail.tsx
│   │   │   └── RecipeBuilder.tsx
│   │   └── scan/
│   │       └── Scan.tsx         # File upload fallback (no native camera)
│   ├── components/              # Shared UI components
│   ├── store/                   # Zustand stores
│   │   ├── authStore.ts
│   │   ├── productStore.ts
│   │   └── recipeStore.ts
│   ├── lib/
│   │   ├── api.ts               # Axios instance + interceptors
│   │   └── nutrition.ts         # Per-100g / per-portion calculations
│   ├── hooks/                   # Custom hooks
│   ├── constants/               # Colors, spacing, typography
│   └── main.tsx
├── index.html
├── vite.config.ts
├── .env
├── .env.example
└── tsconfig.json
```

## Rules
- All API base URLs via environment variables — never hardcoded
- All reads and writes go straight to the backend API (see offline note above)
- access_token stored in Zustand memory only
- refresh_token stored in httpOnly cookie (set by backend)
- On 401 response: auto-refresh token, retry request, log out if refresh fails
- TypeScript strict mode throughout
- No inline styles — use CSS modules or a consistent styling approach

## Web-specific notes
- No native camera access — AI scan uses file upload input instead

## AI scanning flow
1. User opens Scan page → file upload input shown
2. Image selected → base64 encoded
3. POST /ai/scan sent to backend
4. Draft product card shown to user (editable)
5. User can open AI chat to refine fields
6. User confirms → product saved via the API
