# NutriScan — Project Specification

> Cross-platform nutrition tracker with AI-powered food scanning and a conversational product editor.

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Decisions Locked In](#2-decisions-locked-in)
3. [Core Features](#3-core-features)
4. [Tech Stack](#4-tech-stack)
5. [Architecture Overview](#5-architecture-overview)
6. [Database Schema](#6-database-schema)
7. [API Endpoints](#7-api-endpoints)
8. [AI Integration](#8-ai-integration)
9. [Auth Flow](#9-auth-flow)
10. [Build Phases](#10-build-phases)
11. [Open Questions](#11-open-questions)

---

## 1. Project Overview

NutriScan is a personal nutrition tracking app that lets users build a library of products they commonly buy, scan new products using AI vision, organize them into groups, and assemble meals with automatic nutrition calculations.

**Target platforms:** iOS, Android (React Native + Expo), and web (React).

**Core value:** One place to store your real-world food data — not crowd-sourced guesses — enriched by AI when you need it.

---

## 2. Decisions Locked In

| Topic | Decision |
|---|---|
| Authentication | Yes — user accounts with cross-device sync |
| Offline mode | **Not implemented** — app requires connectivity |
| AI scanning | Claude API Vision + in-app AI chat editor |
| Product groups | Yes — system categories + user-defined custom groups, many-to-many |
| System group visibility | Users can hide individual system groups from their own view (not delete — just hidden per-user) |
| Deletion model | Soft delete — 30-day recovery window (Recently Deleted), then hard delete via background job |
| Social / sharing | TBD — personal-only for now, revisit later |
| Calorie/macro goals | Single active goal set per user (calories, protein, fat, carbs), user-entered and editable at any time — no goal calculator yet, may add later |
| Meal ingredients | Each ingredient stores its own nutrition snapshot (name, brand, macros) and *optionally* links to a saved product — a meal never requires every ingredient to exist in the Product Library |
| Linked product deletion | If a linked product is hard-purged, the ingredient's `product_id` is set to `null` (not cascade-deleted) — the ingredient keeps its last-known name/macros, nothing in the meal silently disappears |
| Ingredient units | Users can enter ingredients in household units (tbsp, tsp, cup, piece, etc.), converted to grams via a per-product `grams_per_unit` factor — conversion is ingredient-specific (a tbsp of sugar ≠ a tbsp of oil), never a single global factor |
| Display units (metric/imperial) | All data is stored and calculated in metric (grams) always; oz/lb display is a client-side formatting layer driven by `user_settings.units`, not a backend concern |
| Meal vs. meal slot naming | "Meal" refers to the saved recipe-like entity (ingredients + nutrition); "meal slot" refers to the time-of-day bucket a log entry is filed under (Breakfast/Lunch/Dinner/Snack) — the two are intentionally kept as separate terms to avoid ambiguity |

---

## 3. Core Features

### 3.1 Product Library
- Store commonly bought products with full nutritional profiles
- Fields: name, brand, barcode (optional), calories, protein, fat, carbohydrates, fiber, sugar, salt, and custom micronutrients
- Searchable and filterable
- Fully editable at any time
- Synced to user account, fetched live from the server

### 3.2 Product Groups
- Every product can belong to one or more groups (many-to-many)
- Two kinds of groups:
  - **System groups** - a small built-in set shipped with the app (Dairy, Fruits, Breakfast, Snacks, etc.)
  - **Custom groups** - user-created and named (e.g. "Meal prep staples", "Kid snacks")
- The Product Library view can show:
  - A flat "All Products" list with each product's group(s) shown as badges
  - A per-group filtered view
- Users can create, rename, and delete their own custom groups at any time (system groups cannot be deleted, only unassigned)
- The AI Photo Scanner can suggest a system group as part of its draft output, which the user can accept or change before saving

### 3.3 AI Photo Scanner
- User points camera at a product or its nutrition label
- Image is sent to Claude API (Vision)
- Claude returns structured nutritional data as a JSON draft, including a suggested group
- Draft is shown as an editable card before the user confirms and saves
- Falls back gracefully if the image is unclear (prompts user to retake or enter manually)

### 3.4 AI Chat Editor
- Available after scanning or on any existing product
- Multi-turn Claude chat scoped to a single product
- Example interactions:
  - "This is the low-fat version, update fat to 2g"
  - "Find the correct fiber value for Alpro Oat Original"
  - "The protein looks wrong — it should be per 100g not per serving"
  - "Move this to my Snacks group"
- Claude proposes field changes (including group membership); user confirms before they are written to the database
- Chat history is ephemeral (per session, not persisted)

### 3.5 Meals & Nutrition
- Build meals by adding ingredients - each ingredient either links to a saved product from the library, or is entered directly with its own name/brand/macros (no library entry required). Most users will have far more meals than saved products, so this is the common case, not an edge case.
- Ingredient rows show whether they're linked to a saved product (checkmark) or not (neutral "not saved" state — never treated as an error)
- Linked ingredients can be re-linked/swapped to a different product at any time (e.g. 72% butter → 82% butter, or one manufacturer's cottage cheese → another's); swapping refreshes that ingredient's macro snapshot and the meal's nutrition recalculates
- Unlinked ingredients can be promoted to a saved product ("Add to Product Library") straight from their existing snapshot data
- Editing an ingredient's name/brand/macros directly is always available, independent of link state, and never changes or clears the product link
- Ingredient quantity can be entered in grams directly, or in a household unit (tbsp, tsp, cup, piece, etc.) — household units convert to grams via a per-product conversion factor, since the same unit weighs differently per ingredient (a tbsp of sugar isn't a tbsp of oil). If a product has no saved conversion factor for the chosen unit yet, the user is prompted to enter one once; it's then reused everywhere that product is used with that unit.
- Nutrition is auto-calculated in three views:
  - **Per whole meal** - total macros for the entire meal as written
  - **Per 100g** - total macros ÷ total meal grams × 100
  - **Per custom portion** - any number of named portions per meal (e.g. "1 slice", "1 bowl"), each just a gram amount; one portion can be marked default
- Users can create, rename, and delete portions on any meal at any time
- Create, edit, browse, and delete meals
- Each meal has: name, description, ingredients (product + grams), one or more named portions, photo (optional)

### 3.6 Calorie & Macro Tracker
- A dedicated **Log** page for tracking daily intake against personal goals
- Three ways to log an entry:
  - **From the Product Library** - pick a product, enter grams consumed
  - **From Meals** - pick a meal and either a named portion or a custom gram amount; the meal's ingredient list is shown with editable grams per ingredient (e.g. "used 50g cheese instead of the meal's 70g"), and macros recompute live before saving. This only overrides that one logged entry — the meal itself is untouched.
  - **Manual entry** - type in calories/protein/fat/carbs directly, no product needed (e.g. for restaurant meals)
- Entries are grouped by meal slot (breakfast, lunch, dinner, snack) and by day
- Daily summary shows totals vs. the user's active goal, per macro
- **Two entry points into logging, same underlying flow:**
  - **Per-meal-slot buttons** ("+ Add to Breakfast/Lunch/Dinner/Snack") - `meal_slot` is pre-filled by which button was tapped; user goes straight to source selection (Product / Meal / Manual)
  - **Global "+ Log" button** (top of page, not slot-specific) - opens a modal that first asks the user to pick a meal slot (Breakfast / Lunch / Dinner / Snack), then continues into the same source-selection step as above
  - Both paths converge on the same three source options and the same `POST /log` call — the only difference is whether `meal_slot` is chosen implicitly (per-slot button) or explicitly in a first modal step (global button)
- **Goals**: one active set per user (calories, protein, fat, carbs), entered manually and editable any time. No goal calculator yet — planned for later (see Open Questions)

---

## 4. Tech Stack

### Frontend — Mobile
| Layer | Choice | Notes |
|---|---|---|
| Framework | React Native + Expo | Managed workflow for simplicity |
| Navigation | Expo Router | File-based routing |
| Camera | expo-camera | For AI photo scanning |
| Secure storage | expo-secure-store | JWT token storage |
| State management | Zustand | Lightweight, easy to persist |
| API client | Axios | |

### Frontend — Web
| Layer | Choice | Notes |
|---|---|---|
| Framework | React + Vite | Fast dev server |
| Routing | React Router v6 | |
| State management | Zustand | Same store logic as mobile where possible |

### Backend
| Layer | Choice | Notes |
|---|---|---|
| Framework | FastAPI (Python) | Async, fast, great for AI integration |
| Database | PostgreSQL | Main data store |
| ORM | SQLAlchemy + Alembic | Schema migrations |
| Auth | JWT (access + refresh tokens) | PyJWT library |
| AI | Anthropic Python SDK | Claude Vision + chat |
| Hosting | TBD (Railway / Render / Fly.io) | |

---

## 5. Architecture Overview

```
┌─────────────────────┐     ┌─────────────────────┐
│   React Native App  │     │     React Web App    │
│  (iOS / Android)    │     │      (Vite)          │
│                     │     │                      │
│  Zustand store      │     │  Zustand store       │
└────────┬────────────┘     └──────────┬───────────┘
         │                             │
         │        REST API (HTTPS)     │
         └──────────────┬──────────────┘
                        │
              ┌─────────▼──────────┐
              │   FastAPI Backend  │
              │                    │
              │  /auth             │
              │  /products         │
              │  /groups           │
              │  /meals            │
              │  /goals            │
              │  /log              │
              │  /settings         │
              │  /ai/scan          │
              │  /ai/chat          │
              └─────────┬──────────┘
                        │
            ┌───────────┴───────────┐
            │                       │
     ┌──────▼──────┐     ┌─────────▼────────┐
     │ PostgreSQL  │     │  Anthropic API   │
     │             │     │  (Claude Vision  │
     │  Users      │     │   + chat)        │
     │  Products   │     └──────────────────┘
     │  Groups     │
     │  Meals      │
     │  MealPortions │
     │  UserGoals  │
     │  LogEntries │
     │  UserSettings │
     │  UserHiddenGroups │
     └─────────────┘
```

---

## 6. Database Schema

### users
```sql
id            UUID PRIMARY KEY
email         TEXT UNIQUE NOT NULL
password_hash TEXT NOT NULL
created_at    TIMESTAMPTZ DEFAULT now()
updated_at    TIMESTAMPTZ DEFAULT now()
```

### products
```sql
id            UUID PRIMARY KEY
user_id       UUID REFERENCES users(id)
name          TEXT NOT NULL
brand         TEXT
barcode       TEXT
calories      NUMERIC        -- per 100g
protein       NUMERIC        -- per 100g
fat           NUMERIC        -- per 100g
carbs         NUMERIC        -- per 100g
fiber         NUMERIC        -- per 100g
sugar         NUMERIC        -- per 100g
salt          NUMERIC        -- per 100g
notes         TEXT
source        TEXT           -- 'manual' | 'ai_scan' | 'ai_chat'
created_at    TIMESTAMPTZ DEFAULT now()
updated_at    TIMESTAMPTZ DEFAULT now()
deleted_at    TIMESTAMPTZ    -- soft delete, powers Recently Deleted
```

### groups
```sql
id            UUID PRIMARY KEY
user_id       UUID REFERENCES users(id)   -- null for system groups (shared across all users)
name          TEXT NOT NULL
is_system     BOOLEAN DEFAULT false        -- true for built-in groups like Dairy, Fruits, Breakfast, Snacks
created_at    TIMESTAMPTZ DEFAULT now()
```

### product_groups
```sql
product_id    UUID REFERENCES products(id)
group_id      UUID REFERENCES groups(id)
PRIMARY KEY (product_id, group_id)
```

### user_hidden_groups
```sql
user_id     UUID REFERENCES users(id)
group_id    UUID REFERENCES groups(id)   -- only ever references system groups (is_system = true)
PRIMARY KEY (user_id, group_id)
```
Lets a user hide specific **system** groups from their own view (e.g. they never buy anything from "Dairy" and don't want it cluttering their chip row). The group itself is untouched — other users are unaffected, and it can be un-hidden any time. Custom groups don't need this table since the owning user can just delete their own custom group outright.

### user_settings
```sql
user_id                 UUID PRIMARY KEY REFERENCES users(id)
units                   TEXT DEFAULT 'metric'     -- 'metric' | 'imperial'
timezone                TEXT DEFAULT 'UTC'         -- IANA tz name, used to compute day boundaries for /log grouping
notifications_enabled   BOOLEAN DEFAULT true
created_at              TIMESTAMPTZ DEFAULT now()
updated_at              TIMESTAMPTZ DEFAULT now()
```
Note: no `notifications_enabled` delivery infra exists yet (no push service wired up) — this toggle ships as a stored preference regardless, so the UI and schema are ready whenever push is added (see Open Questions).

### meals
```sql
id              UUID PRIMARY KEY
user_id         UUID REFERENCES users(id)
name            TEXT NOT NULL
description     TEXT
photo_url       TEXT
created_at      TIMESTAMPTZ DEFAULT now()
updated_at      TIMESTAMPTZ DEFAULT now()
deleted_at      TIMESTAMPTZ    -- soft delete, powers Recently Deleted
```
Note: the old single `portion_grams` field is replaced by `meal_portions` below, which supports multiple named portions per meal.

### meal_ingredients
```sql
id            UUID PRIMARY KEY
meal_id       UUID REFERENCES meals(id)
product_id    UUID REFERENCES products(id) ON DELETE SET NULL   -- optional link; null = unlinked
name          TEXT NOT NULL       -- snapshot, e.g. "President butter 82%"
brand         TEXT
calories      NUMERIC NOT NULL    -- per 100g, snapshot
protein       NUMERIC NOT NULL
fat           NUMERIC NOT NULL
carbs         NUMERIC NOT NULL
fiber         NUMERIC
sugar         NUMERIC
salt          NUMERIC
input_amount  NUMERIC NOT NULL    -- raw quantity as entered, e.g. 3
input_unit    TEXT NOT NULL       -- 'g' | 'tbsp' | 'tsp' | 'cup' | 'ml' | 'piece' | ...
grams         NUMERIC NOT NULL    -- computed weight actually used in nutrition calc
```
Nutrition fields are a snapshot copied from the linked product at add/relink time (or entered manually if unlinked) — not a live reference. This is what makes an ingredient resolvable even if its linked product is later deleted/purged (see `product_id` FK behavior above), and what allows a linked ingredient's values to be hand-edited without affecting the product itself.

`grams` is always the value the nutrition calc function reads — `input_amount`/`input_unit` are kept only so the UI can display and edit the original entry (e.g. "3 tbsp") instead of a raw gram number. When `input_unit != 'g'`, `grams` is computed via `product_unit_conversions` below at entry/edit time, not recomputed on every read.

### product_unit_conversions
```sql
id              UUID PRIMARY KEY
product_id      UUID REFERENCES products(id)
unit            TEXT NOT NULL     -- 'tsp' | 'tbsp' | 'cup' | 'ml' | 'piece' | ...
grams_per_unit  NUMERIC NOT NULL
UNIQUE (product_id, unit)
```
Per-product volume/count → weight conversion (a tbsp of sugar and a tbsp of oil have different `grams_per_unit`). Populated the first time a user enters that product in that unit; reused on every subsequent use of that product+unit across all meals. Unlinked ingredients (no `product_id`) skip this table entirely — the user enters `grams` directly for those, or the UI can still ask for a one-off amount→grams conversion that isn't persisted anywhere.

### meal_portions
```sql
id            UUID PRIMARY KEY
meal_id       UUID REFERENCES meals(id)
name          TEXT NOT NULL      -- e.g. "1 slice", "1 bowl", "half recipe"
grams         NUMERIC NOT NULL
is_default    BOOLEAN DEFAULT false
created_at    TIMESTAMPTZ DEFAULT now()
```
A meal can have any number of these. Nutrition per portion = (meal's per-100g macros) × grams / 100.

### user_goals
```sql
id              UUID PRIMARY KEY
user_id         UUID REFERENCES users(id)
calories_goal   NUMERIC
protein_goal    NUMERIC
fat_goal        NUMERIC
carbs_goal      NUMERIC
updated_at      TIMESTAMPTZ DEFAULT now()
```
Single active row per user — no history table for now. Updating goals overwrites this row (`PATCH`, not versioned). A goal calculator may set these values automatically in a future phase, but for now the user enters them directly.

### log_entries
```sql
id                UUID PRIMARY KEY
user_id           UUID REFERENCES users(id)
logged_at         TIMESTAMPTZ NOT NULL   -- date+time the food was consumed
meal_slot         TEXT NOT NULL          -- 'breakfast' | 'lunch' | 'dinner' | 'snack'
source_type       TEXT NOT NULL          -- 'product' | 'meal' | 'manual'
product_id        UUID REFERENCES products(id)         -- set if source_type = 'product'
quantity_grams    NUMERIC                               -- set if source_type = 'product' or 'manual'
meal_id           UUID REFERENCES meals(id)             -- set if source_type = 'meal'
portion_id        UUID REFERENCES meal_portions(id)     -- optional, if a named portion was selected
manual_calories   NUMERIC   -- set if source_type = 'manual'
manual_protein    NUMERIC
manual_fat        NUMERIC
manual_carbs      NUMERIC
created_at        TIMESTAMPTZ DEFAULT now()
```
Note: `meal_slot` (breakfast/lunch/dinner/snack) is a separate concept from the `meals` entity above — a `meal_slot` is a time-of-day bucket a log entry is filed under, and any `source_type` (product, meal, or manual) can be logged into any `meal_slot`. See the naming decision in §2.

### log_entry_meal_ingredients
```sql
id            UUID PRIMARY KEY
log_entry_id  UUID REFERENCES log_entries(id)
product_id    UUID REFERENCES products(id)
grams         NUMERIC NOT NULL   -- defaults to meal_ingredients.grams at time of logging, editable
```
Only populated when `log_entries.source_type = 'meal'`. This is a snapshot, not a live reference — editing grams here (e.g. "used 50g cheese not 70g") only affects this one logged entry, never the meal itself.

### Computing macros for a log entry
- `source_type = 'product'` → `quantity_grams / 100 × product's per-100g macros`
- `source_type = 'meal'` → sum over `log_entry_meal_ingredients`: `grams / 100 × each product's per-100g macros`
- `source_type = 'manual'` → use `manual_*` fields directly

### Soft deletes & recovery
- `DELETE` on a product or meal never removes the row immediately — it sets `deleted_at` and the item moves to Recently Deleted
- Deleted products remain resolvable by any meal still referencing them, so existing meals don't break
- Users can browse `GET /products/deleted` and restore anything within the 30-day window
- A background job permanently removes rows where `deleted_at` is older than 30 days
- Kept independent of offline sync — if offline access gets added later, this same `deleted_at` field is what would let deletions propagate between devices, so no schema change would be needed then

---

## 7. API Endpoints

### Auth
```
POST   /auth/register        Create account
POST   /auth/login           Returns access + refresh tokens
POST   /auth/refresh         Rotate refresh token
POST   /auth/logout          Invalidate refresh token
```

### Products
```
GET    /products             List user's products (optionally filter by ?group_id=)
POST   /products             Create product
GET    /products/:id         Get single product
PATCH  /products/:id         Update product
DELETE /products/:id         Soft delete (sets deleted_at, recoverable for 30 days)
GET    /products/deleted     List recently-deleted products (within 30-day window)
POST   /products/:id/restore Restore a recently-deleted product

GET    /products/:id/unit-conversions        List saved unit conversions for a product
POST   /products/:id/unit-conversions        Save a conversion (unit, grams_per_unit) — upsert on (product_id, unit)
```

### Groups
```
GET    /groups               List system groups + user's custom groups
POST   /groups               Create custom group
PATCH  /groups/:id           Rename custom group
DELETE /groups/:id           Delete custom group (system groups cannot be deleted)
POST   /products/:id/groups      Assign product to one or more groups
DELETE /products/:id/groups/:group_id   Remove product from a group
```

### Meals
```
GET    /meals                    List user's meals
POST   /meals                    Create meal
GET    /meals/:id                Get meal with ingredients + nutrition (per_meal, per_100g, portions[])
PATCH  /meals/:id                Update meal
DELETE /meals/:id                Soft delete (sets deleted_at, recoverable for 30 days)
POST   /meals/:id/restore        Restore a recently-deleted meal

GET    /meals/:id/portions       List named portions for a meal
POST   /meals/:id/portions       Create a named portion
PATCH  /meals/:id/portions/:id   Update a named portion (name, grams, is_default)
DELETE /meals/:id/portions/:id   Delete a named portion

POST   /meals/:id/ingredients                  Add an ingredient (linked: {product_id, input_amount, input_unit} or unlinked: {name, brand, macros, input_amount, input_unit})
PATCH  /meals/:id/ingredients/:id              Edit snapshot values directly (name/brand/macros/grams) — does not change product_id
PATCH  /meals/:id/ingredients/:id/relink       Swap the linked product (or link an unlinked ingredient) — refreshes the snapshot from the target product
POST   /meals/:id/ingredients/:id/promote      Create a product from this ingredient's snapshot and link it (unlinked → linked)
DELETE /meals/:id/ingredients/:id              Remove an ingredient from the meal
```

### Goals
```
GET    /goals                 Get the user's active goal set
PATCH  /goals                  Update the user's active goal set (creates it on first call)
```

### Log (Calorie & Macro Tracker)
```
GET    /log?date=YYYY-MM-DD    List log entries for a given day, grouped by meal slot
POST   /log                    Create a log entry
                                Body varies by source_type:
                                - product: { source_type: 'product', product_id, quantity_grams, meal_slot, logged_at }
                                - meal:    { source_type: 'meal', meal_id, portion_id?, ingredient_overrides?: [{product_id, grams}], meal_slot, logged_at }
                                - manual:  { source_type: 'manual', manual_calories, manual_protein, manual_fat, manual_carbs, meal_slot, logged_at }
PATCH  /log/:id                Update a log entry (e.g. edit an ingredient override, change grams)
DELETE /log/:id                Delete a log entry
GET    /log/summary?date=      Daily totals (calories, protein, fat, carbs) vs. active goals
```

### Settings
```
GET    /settings                    Get current user's settings (units, timezone, notifications)
PATCH  /settings                    Update settings
POST   /auth/change-password        Change password
DELETE /auth/account                Delete account (see Open Questions re: soft vs. hard delete)

GET    /groups/hidden               List system group ids hidden by current user
POST   /groups/:id/hide             Hide a system group for current user (400 if not is_system)
DELETE /groups/:id/hide             Un-hide it
```
Note: once this phase ships, `GET /groups` should exclude hidden system groups by default; add `?include_hidden=true` for the settings screen itself to manage the hide/show list.

### AI
```
POST   /ai/scan              Send image → get draft product JSON back (including suggested group)
POST   /ai/chat              Multi-turn chat for product editing
                             Body: { product_id, messages: [{role, content}] }
```

---

## 8. AI Integration

### Scanning flow
```
User taps "Scan" → Camera opens
→ Photo taken → base64 encoded
→ POST /ai/scan { image: base64 }
→ Backend sends to Claude API (Vision)
   Prompt instructs Claude to return:
   { name, brand, calories, protein, fat, carbs, fiber, sugar, salt, suggested_group, confidence }
→ Backend returns draft JSON
→ App shows editable draft card, with the suggested group pre-selected
→ User confirms → POST /products (+ POST /products/:id/groups)
```

### Claude system prompt for scanning (draft)
```
You are a nutrition data extraction assistant.
The user will send you a photo of a food product or its nutrition label.
Extract the nutritional information and return ONLY valid JSON in this exact shape:
{
  "name": string,
  "brand": string | null,
  "calories": number | null,     // per 100g
  "protein": number | null,      // per 100g
  "fat": number | null,          // per 100g
  "carbs": number | null,        // per 100g
  "fiber": number | null,        // per 100g
  "sugar": number | null,        // per 100g
  "salt": number | null,         // per 100g
  "suggested_group": string | null,   // one of the user's known system groups, e.g. "Dairy"
  "confidence": "high" | "medium" | "low",
  "notes": string | null         // flag anything unclear
}
All numeric values are per 100g. If a value is not visible or cannot be determined, use null.
Do not include any text outside the JSON object.
```

### Chat editor flow
```
User opens chat on a product
→ Current product fields (including group membership) sent as context in system prompt
→ User types message
→ POST /ai/chat { product_id, messages }
→ Backend forwards to Claude with product context
→ Claude proposes updated field values and/or group changes
→ App shows a diff of what would change
→ User confirms → PATCH /products/:id (+ group assignment calls as needed)
```

---

## 9. Auth Flow

```
Register / Login
→ Server returns { access_token (15min), refresh_token (30d) }
→ access_token stored in memory (Zustand)
→ refresh_token stored in expo-secure-store (mobile) / httpOnly cookie (web)

Every API request
→ Authorization: Bearer <access_token>

On 401 response
→ Client calls POST /auth/refresh with refresh_token
→ Gets new access_token, retries original request
→ If refresh also fails → log user out
```

---

## 10. Build Phases

### Phase 1 — Foundation
- [x] FastAPI project setup (folder structure, config, error handling)
- [x] PostgreSQL schema + Alembic migrations
- [x] Auth endpoints (register, login, refresh, logout)
- [x] Product CRUD endpoints (soft delete + restore)
- [x] Basic React Native screens: login, product list, product detail, add product form
- [x] Recently Deleted screen (view + restore soft-deleted products/meals)
- [x] Background job: hard-delete rows with `deleted_at` older than 30 days
- [x] Zustand store wired to API

### Phase 2 — Product Groups
- [x] `groups` and `product_groups` tables + migrations
- [x] Seed built-in system groups (Dairy, Fruits, Breakfast, Snacks, etc.)
- [x] Group CRUD endpoints (custom groups only)
- [x] Product ↔ group assignment endpoints
- [x] Product list UI: group badges + per-group filter view
- [x] Custom group management UI (create, rename, delete)

### Phase 3 — Meals
- [x] Meal CRUD endpoints
- [x] `meal_ingredients` table as a self-contained snapshot (name/brand/macros) with optional `product_id` (`ON DELETE SET NULL`)
- [x] `product_unit_conversions` table (per-product, per-unit `grams_per_unit`) — `GET`/`POST /products/:id/unit-conversions` (upsert) built
- [x] Ingredient endpoints: add (linked/unlinked, with input_amount/input_unit → grams conversion), edit snapshot (incl. relink via `product_id` in the same PATCH) — promote unlinked → saved product built (composed client-side from `POST /products` + the ingredient PATCH, no dedicated endpoint)
- [x] Meal builder UI: add ingredients linked or unlinked, enter quantity in grams or household units, link/unlink indicator per row
- [x] Swap-product and add-to-library flows on ingredient rows
- [x] Nutrition calculation logic (per whole meal + per 100g), reading from ingredient snapshots
- [x] `meal_portions` table + CRUD endpoints (multiple named portions per meal)
- [x] Meal detail UI: per-100g, per-meal, and per-portion nutrition views + portion management
- [x] Meal list + detail screens

### Phase 4 — Tracking & Goals
- [ ] `user_goals` table + `GET`/`PATCH /goals` endpoints
- [ ] Goal setting UI (manual entry of calories/protein/fat/carbs)
- [ ] `log_entries` + `log_entry_meal_ingredients` tables + migrations
- [ ] `/log` CRUD endpoints + `/log/summary` aggregation endpoint
- [ ] Log page UI: daily view grouped by meal slot, add-entry flow (product / meal+portion / manual)
- [ ] Global "+ Log" modal: meal-slot-selection step (Breakfast/Lunch/Dinner/Snack) followed by source selection, feeding into the same add-entry flow as the per-slot buttons
- [ ] Meal-logging flow: editable per-ingredient grams with live macro recalculation before saving
- [ ] Daily summary UI: totals vs. goals per macro (progress bars/rings)

### Phase 5 — User Settings
- [ ] `user_settings` table + migration (units, timezone, notifications)
- [ ] `user_hidden_groups` table + migration
- [ ] `GET`/`PATCH /settings` endpoints
- [ ] Change password + delete account endpoints
- [ ] Hide/un-hide system group endpoints; update `GET /groups` to exclude hidden ones by default
- [ ] Settings screen UI: units toggle, timezone, notification toggle
- [ ] System group visibility management UI (show/hide list, separate from custom group management)
- [ ] Account section UI: change password, delete account (with confirmation)

### Phase 6 — Web & Deploy
- [ ] React web app (Vite) with shared API client
- [ ] CI/CD pipeline (GitHub Actions)
- [ ] Deploy backend (Railway / Render / Fly.io)
- [ ] Deploy web app (Vercel / Netlify)
- [ ] Environment config (dev / prod)

### Phase 7 — AI Scanning & Chat
- [ ] Camera screen with capture flow
- [ ] `POST /ai/scan` endpoint + Claude Vision integration (incl. suggested group)
- [ ] Draft product card UI with group pre-selection
- [ ] AI chat screen + `POST /ai/chat` endpoint
- [ ] Diff confirmation UI before saving AI edits (fields + group changes)

### Phase 8 — Recipes → Meals Rename
- [x] Alembic migration: rename `recipes`→`meals`, `recipe_ingredients`→`meal_ingredients`, `recipe_portions`→`meal_portions` (`backend/alembic/versions/0008_rename_recipes_to_meals.py`)
- [ ] `log_entries.recipe_id`→`meal_id`, `log_entries.meal_type`→`meal_slot`, `log_entry_recipe_ingredients`→`log_entry_meal_ingredients`, `source_type` value `'recipe'`→`'meal'` — N/A for now: `log_entries` doesn't exist yet (unbuilt Phase 4/5 feature). Build it directly with `meal_id`/`meal_slot`/`log_entry_meal_ingredients` naming when it lands; no separate rename needed.
- [x] Backend: rename SQLAlchemy models, Pydantic schemas, and router paths (`/recipes/*` → `/meals/*`)
- [ ] Backend: update `POST /log` request/response handling for `meal_id` and `meal_slot` — N/A for now, `/log` doesn't exist yet (see above)
- [x] Backend tests: update fixtures and assertions referencing recipe/meal_type naming
- [x] Frontend (mobile): rename Zustand store, components, types, and routes (`useRecipeStore`→`useMealStore`, `/recipes`→`/meals`, etc.). Web has no code yet (`web/src` doesn't exist) — `web/CLAUDE.md`'s planned filenames/store updated to match.
- [x] UI copy sweep: "Recipe" → "Meal" in nav labels, screen titles, buttons, empty states
- [x] Final grep sweep across repo for stray `recipe`/`Recipe`/`RECIPE` occurrences (seed data, error messages, comments)

---

## 11. Open Questions

| # | Question | Status |
|---|---|---|
| 1 | Social features: personal-only for now, or plan schema for sharing? | Personal-only for v1 |
| 2 | Hosting provider for backend | **Pending** |
| 3 | Should meals also support AI-assisted creation ("build me a meal with these products")? | **Pending** |
| 4 | Photo storage for meals: local only, or upload to object storage (S3 / Cloudflare R2)? | **Pending** |
| 5 | Should custom groups be shareable/reusable across users, or strictly private per user? | **Pending** |
| 6 | Goal calculator (auto-compute calorie/macro goals from age, weight, activity level, target) | Planned for later — manual entry only for now |
| 7 | Should `user_goals` keep a history (versioned by date) instead of a single overwritten row, so past days are checked against the goal active at the time? | **Pending** |
| 8 | Delete account: hard-delete immediately, or route through the same 30-day recovery pattern as products/meals? | **Pending** |
| 9 | Notification settings: no push infra exists yet — is the toggle a stub for future use, or does Phase 5 need to build actual delivery? | Stub only for now — see Phase 5 |
| 10 | Global "+ Log" modal: should the meal-slot-selection step default to a guess based on current time of day (e.g. auto-select "Lunch" at 1pm, user can still change it), or always start unselected? | **Pending** |

---

*Last updated: August 26, 2026. Update this file as decisions are made.*