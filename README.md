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
| Authentication | Yes — user accounts with cross-device sync. Three sign-in methods: email + password, **Google**, and **Apple** |
| Sign in with Apple | Required alongside Google: App Store guideline 4.8 requires an equivalent privacy-focused login next to any third-party login, and email + password doesn't count. Offered on **all** platforms (native on iOS, web flow on Android/web) so an Apple-only user can still reach their account on every device |
| Sign-in identities | One user can have several sign-in methods (password and/or linked Google/Apple identities). Social identities are keyed on the provider's stable user id (`sub`), never on email. A user must always keep at least one working sign-in method |
| Account linking | **No auto-linking by email.** Password accounts don't verify email, so auto-linking would let someone pre-register a victim's address and inherit their Google sign-ins. If a social sign-in's email matches an existing account, the user is asked to sign in the usual way and connect the provider from Profile → Sign-in methods |
| Offline mode | **Not implemented** — app requires connectivity |
| AI scanning | Claude API Vision + in-app AI chat editor |
| Product groups | Yes — system categories + user-defined custom groups, many-to-many |
| System group visibility | Users can hide individual system groups from their own view (not delete — just hidden per-user) |
| Deletion model | Soft delete — 30-day recovery window (Recently Deleted), then hard delete via background job |
| Social / sharing | TBD — personal-only for now, revisit later |
| Calorie/macro goals | Single active goal set per user (calories, protein, fat, carbs), user-entered and editable at any time from Profile → Daily goals (the Log page links there) — no goal calculator yet, may add later |
| Meal ingredients | Each ingredient stores its own nutrition snapshot (name, brand, macros) and *optionally* links to a saved product — a meal never requires every ingredient to exist in the Product Library |
| Linked product deletion | If a linked product is hard-purged, the ingredient's `product_id` is set to `null` (not cascade-deleted) — the ingredient keeps its last-known name/macros, nothing in the meal silently disappears |
| Ingredient units | Users can enter ingredients in household units (tbsp, tsp, cup, piece, etc.), converted to grams via a per-product `grams_per_unit` factor — conversion is ingredient-specific (a tbsp of sugar ≠ a tbsp of oil), never a single global factor |
| Display units (metric/imperial) | All data is stored and calculated in metric (grams) always; oz/lb display is a client-side formatting layer driven by `user_settings.units`, not a backend concern |
| Meal vs. meal slot naming | "Meal" refers to the saved recipe-like entity (ingredients + nutrition); "meal slot" refers to the time-of-day bucket a log entry is filed under (Breakfast/Lunch/Dinner/Snack) — the two are intentionally kept as separate terms to avoid ambiguity |
| Profile screen | A single **Profile** tab holds identity (display name, avatar, email), body stats, daily goals, preferences (units / timezone / notifications), system group visibility, and account controls. Personal content sits at the top, configuration below. "Settings" is the Preferences section *within* Profile, not a separate screen |
| Goal editing location | One editor, two entry points: goals are edited in Profile → Daily goals, and the Log page's daily summary has an "Edit goals" link that deep-links there |
| Body stats | Optional, current values only (no weight history yet), always stored in metric (cm, kg) — imperial is display-only like everything else. Nothing in the app requires them until a goal calculator exists |
| User roles | Two roles: `user` (default) and `admin`. Admins see an extra **Admin** section on the Profile screen. Role is always enforced server-side — the client only uses it to decide what to render. Nobody can become admin through registration or any regular endpoint |

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
  - **Per 100g** - total macros ÷ total meal grams × 100. A meal can optionally record `cooked_weight_grams` (the dish's weight after cooking, since water evaporation/absorption means it's rarely the same as the raw ingredient total); when set, **Per 100g** normalizes against that cooked weight instead, and **Per custom portion** below inherits the fix since it derives from Per 100g. **Per whole meal** is unaffected either way — cooking doesn't change total calories/macros, only water content.
  - `cooked_weight_grams` is a measured value, not a derived one (how much water is lost/absorbed during cooking isn't a fixed ratio of raw ingredient weight) — editing an ingredient's grams never adjusts it automatically anywhere. The two mobile flows that touch it treat it differently on purpose:
    - **Meal edit** (`mobile/app/meal/[id].tsx`, `noticeCookedWeightMayBeStale`) changes the saved meal itself, possibly for a long time — an ingredient edit here only shows a dismissible notice that the recorded cooked weight may now be stale, with no suggested number and no auto-fill. The user decides whether/when to re-weigh.
    - **Tracker log entry** (`mobile/components/tracker/MealSourceStep.tsx`, `handleIngredientBlur`) only affects that one log entry, never the saved meal — an ingredient override here can offer a proportional *estimate* for this entry's logged amount (`quantity_grams`) as a one-tap accept/dismiss, since a wrong guess there is scoped to a single entry, not a standing recipe value.
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
- **Goals**: one active set per user (calories, protein, fat, carbs), entered manually and editable any time. No goal calculator yet — planned for later (see Open Questions). Goals are edited in Profile → Daily goals (§3.7); the daily summary's "Edit goals" link deep-links there.

### 3.7 Profile
- A dedicated **Profile** tab — everything about the user and how the app behaves for them, on one scrollable screen. Sections, top to bottom:
  - **Header card** - avatar (optional, initials fallback), display name, email. Tapping it opens Edit profile. For users who sign up with Google, display name and avatar are pre-filled from the Google account on first sign-in (editable afterwards); Apple provides the name only, and only on the very first sign-in.
  - **Body stats** - date of birth, sex, height, current weight, activity level. All optional; shown as a compact summary, and the empty state invites rather than nags. Will feed the goal calculator once it exists (Open Questions #6).
  - **Daily goals** - calories, protein, fat, carbs: the same single active goal set as §3.6. Shows the calories implied by the macros (4/9/4 kcal per gram) as a non-blocking hint — values that don't add up are allowed. This is the deep-link target of the Log page's "Edit goals".
  - **Preferences** - units (metric/imperial, display-only), timezone (IANA picker with a "Use device timezone" shortcut; defines where each day starts and ends in the tracker), notifications toggle (stored preference only — no delivery yet, and the UI says so).
  - **Product groups** - show/hide toggle per system group (per-user, reversible, nothing deleted). Custom group management stays in the Product Library; this section only links to it.
  - **Account** - sign-in methods, password, log out, delete account.
    - **Sign-in methods** - shows which of password / Google / Apple are active; connect or disconnect Google and Apple. The last remaining method can't be removed.
    - **Password** - "Change password" for users who have one; "Set a password" for social-only users (adds password as an extra sign-in method).
    - **Delete account** - destructive, two-step confirmation by typing "DELETE" (works for every user, including those with no password).
  - **Admin** *(admins only)* - see §3.8.
  - Footer: app version, privacy policy, support.

### 3.8 Admin Tools
- An **Admin** section appears on the Profile screen only when `users.role = 'admin'`. Regular users never see it — not even as a disabled row.
- Proposed actions (final scope pending, see Open Questions #11):
  - **Manage system groups** - create and rename the built-in groups every user sees (today that's only possible via seed data). Deleting a system group is deliberately left out: it would silently strip group membership from every user's products.
  - **User management** - searchable user list (email, sign-up date, sign-in methods, role, status); disable / re-enable an account (blocks every sign-in method and token refresh, data untouched); promote / demote admins.
  - **App stats** - read-only counts: total users, recent sign-ups, products, meals, log entries. AI scan/chat usage can be added once Phase 7 ships.
- Guardrails:
  - An admin can't disable or demote themselves, and the last remaining admin can't be demoted.
  - Admin tools cover app-wide config and account status only — they never read or edit another user's products, meals, goals, or log (see Open Questions #12).
  - The first admin is created out of band via a CLI command, never through an endpoint.

---

## 4. Tech Stack

### Frontend — Mobile
| Layer | Choice | Notes |
|---|---|---|
| Framework | React Native + Expo | Managed workflow for simplicity |
| Navigation | Expo Router | File-based routing |
| Camera | expo-camera | For AI photo scanning |
| Secure storage | expo-secure-store | JWT token storage |
| Google sign-in | @react-native-google-signin/google-signin | Native module — requires an Expo development build (won't run in Expo Go) |
| Apple sign-in | expo-apple-authentication (iOS); web flow on Android | |
| State management | Zustand | Lightweight, easy to persist |
| API client | Axios | |

### Frontend — Web
| Layer | Choice | Notes |
|---|---|---|
| Framework | React + Vite | Fast dev server |
| Routing | React Router v6 | |
| Social sign-in | Google Identity Services + Sign in with Apple JS | |
| State management | Zustand | Same store logic as mobile where possible |

### Backend
| Layer | Choice | Notes |
|---|---|---|
| Framework | FastAPI (Python) | Async, fast, great for AI integration |
| Database | PostgreSQL | Main data store |
| ORM | SQLAlchemy + Alembic | Schema migrations |
| Auth | JWT (access + refresh tokens) | PyJWT library |
| Social token verification | google-auth (Google ID tokens); PyJWT + Apple's public keys (Apple identity tokens) | Backend verifies the provider token, then issues its own JWTs |
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
              │  /me               │
              │  /profile          │
              │  /settings         │
              │  /admin            │
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
     │  UserProfiles │
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
password_hash TEXT           -- null for users who only sign in with Google/Apple
role          TEXT NOT NULL DEFAULT 'user'   -- 'user' | 'admin'
disabled_at   TIMESTAMPTZ                    -- set by an admin; blocks login + token refresh, data untouched
created_at    TIMESTAMPTZ DEFAULT now()
updated_at    TIMESTAMPTZ DEFAULT now()
```

`role` is the only thing that grants admin access (§3.8). It can't be set via registration or any regular endpoint — the first admin is created with a CLI command, later ones are promoted by an existing admin. `disabled_at` is an account-status flag, not a delete: data is untouched and re-enabling restores access.

`email` for an Apple user who chose "Hide My Email" is an Apple relay address (`…@privaterelay.appleid.com`) — treat it as a normal, working email.

### user_auth_identities
```sql
id                UUID PRIMARY KEY
user_id           UUID REFERENCES users(id)
provider          TEXT NOT NULL      -- 'google' | 'apple'
provider_subject  TEXT NOT NULL      -- the provider's stable user id (`sub` claim)
email             TEXT               -- email the provider reported at link time (informational only)
created_at        TIMESTAMPTZ DEFAULT now()
UNIQUE (provider, provider_subject)
UNIQUE (user_id, provider)           -- at most one Google and one Apple identity per user
```
A user's sign-in methods = `password_hash IS NOT NULL` plus their rows here. Lookups on social sign-in go through `(provider, provider_subject)`, never through `email`.

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
System groups are seeded at install and can afterwards be created/renamed by admins (§3.8, `/admin/groups`). Regular users can only hide them (`user_hidden_groups`), never edit them.

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

### user_profiles
```sql
user_id         UUID PRIMARY KEY REFERENCES users(id)
display_name    TEXT
avatar_url      TEXT          -- storage pending, see Open Questions #4 / #15
date_of_birth   DATE          -- not age: age goes stale
sex             TEXT          -- options pending, see Open Questions #14
height_cm       NUMERIC
weight_kg       NUMERIC       -- current weight only, no history (see Open Questions #13)
activity_level  TEXT          -- 'sedentary' | 'light' | 'moderate' | 'active' | 'very_active'
created_at      TIMESTAMPTZ DEFAULT now()
updated_at      TIMESTAMPTZ DEFAULT now()
```
All fields nullable — the Profile screen works with an empty row. Kept separate from `users` so the auth table stays minimal. Stored in metric always; `user_settings.units` only affects display.

### meals
```sql
id              UUID PRIMARY KEY
user_id         UUID REFERENCES users(id)
name            TEXT NOT NULL
description     TEXT
photo_url       TEXT
cooked_weight_grams NUMERIC    -- optional; overrides the per_100g normalization denominator (see §3.5) when set
created_at      TIMESTAMPTZ DEFAULT now()
updated_at      TIMESTAMPTZ DEFAULT now()
deleted_at      TIMESTAMPTZ    -- soft delete, powers Recently Deleted
```
Note: the old single `portion_grams` field is replaced by `meal_portions` below, which supports multiple named portions per meal. `cooked_weight_grams` is unrelated to that history — it's a normalization override, not a portion.

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
quantity_grams    NUMERIC                               -- set if source_type = 'product' or 'meal' (see below)
meal_id           UUID REFERENCES meals(id)             -- set if source_type = 'meal'
portion_id        UUID REFERENCES meal_portions(id)     -- optional, if a named portion was selected
manual_calories   NUMERIC   -- set if source_type = 'manual'
manual_protein    NUMERIC
manual_fat        NUMERIC
manual_carbs      NUMERIC
created_at        TIMESTAMPTZ DEFAULT now()
```
Note: `meal_slot` (breakfast/lunch/dinner/snack) is a separate concept from the `meals` entity above — a `meal_slot` is a time-of-day bucket a log entry is filed under, and any `source_type` (product, meal, or manual) can be logged into any `meal_slot`. See the naming decision in §2.

For `source_type = 'meal'`, `quantity_grams` is the dish's logged weight — a named portion's own `grams`, a custom amount, or the meal's reference weight (§3.5's `cooked_weight_grams` when set, else the raw ingredient total) for an unscaled whole-meal log. It's **not** derived from `log_entry_meal_ingredients` below and can disagree with the sum of it once the meal has a `cooked_weight_grams` — see that table's note.

### log_entry_meal_ingredients
```sql
id            UUID PRIMARY KEY
log_entry_id  UUID REFERENCES log_entries(id)
product_id    UUID REFERENCES products(id)
grams         NUMERIC NOT NULL   -- defaults to meal_ingredients.grams at time of logging, editable
```
Only populated when `log_entries.source_type = 'meal'`. This is a snapshot, not a live reference — editing grams here (e.g. "used 50g cheese not 70g") only affects this one logged entry, never the meal itself.

`grams` here is a **raw-ingredient-equivalent** breakdown, not the weight of the dish that was logged — it exists only to drive the per-ingredient macro calc below. When the meal has a `cooked_weight_grams`, a named portion's ingredients are scaled against that (§3.5), so summing this table's `grams` no longer equals the portion's own weight; use `log_entries.quantity_grams` for the displayed/loggable amount instead.

### Computing macros for a log entry
- `source_type = 'product'` → `quantity_grams / 100 × product's per-100g macros`
- `source_type = 'meal'` → sum over `log_entry_meal_ingredients`: `grams / 100 × each product's per-100g macros` (uses that table's raw-equivalent grams, not `log_entries.quantity_grams`)
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
POST   /auth/google          Body: { id_token } — sign in, or create an account on first use. Returns access + refresh tokens
POST   /auth/apple           Body: { identity_token, name? } — same as above; name is only sent by Apple on the very first sign-in
                             Both return 409 { code: 'account_exists' } if the email belongs to an existing account
                             that isn't linked to this identity (see §2 Account linking)

GET    /auth/identities                 List the current user's sign-in methods ({ has_password, providers: [...] })
POST   /auth/identities/google          Connect Google to the signed-in account (body: { id_token })
POST   /auth/identities/apple           Connect Apple to the signed-in account (body: { identity_token })
DELETE /auth/identities/:provider       Disconnect a provider (409 if it's the last sign-in method)
POST   /auth/set-password               Add a password to a social-only account (400 if one already exists)
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
                                - meal:    { source_type: 'meal', meal_id, portion_id?, ingredient_overrides?: [{product_id, grams}], quantity_grams?, meal_slot, logged_at } -- quantity_grams is the dish's logged weight; omit to let the server derive it (portion.grams, or the meal's reference weight)
                                - manual:  { source_type: 'manual', manual_calories, manual_protein, manual_fat, manual_carbs, meal_slot, logged_at }
PATCH  /log/:id                Update a log entry (e.g. edit an ingredient override, change grams -- quantity_grams is editable on 'product' and 'meal' entries)
DELETE /log/:id                Delete a log entry
GET    /log/summary?date=      Daily totals (calories, protein, fat, carbs) vs. active goals
GET    /log/logged-days?year=&month=   Day-of-month numbers (1-31) that have at least one log entry that month -- powers the tracker's calendar view (all days are still navigable; unlogged days just render lighter, no highlight)
```

### Profile & Settings
```
GET    /me                          Everything the Profile root needs in one call: { user: {id, email, role}, sign_in_methods, profile, settings, goals }
GET    /profile                     Get current user's profile (display name, avatar, body stats)
PATCH  /profile                     Update profile (creates the row on first call)
GET    /settings                    Get current user's settings (units, timezone, notifications)
PATCH  /settings                    Update settings
POST   /auth/change-password        Change password (400 for social-only users — use /auth/set-password)
DELETE /auth/account                Delete account; body { confirm: 'DELETE' } (see Open Questions re: soft vs. hard delete)

GET    /groups/hidden               List system group ids hidden by current user
POST   /groups/:id/hide             Hide a system group for current user (400 if not is_system)
DELETE /groups/:id/hide             Un-hide it
```
Goals keep their own `GET`/`PATCH /goals` endpoints (§Goals) — the Profile screen just calls them. Log out uses the existing `POST /auth/logout`. Avatar upload has no endpoint yet (blocked on Open Questions #4).
Note: once this phase ships, `GET /groups` should exclude hidden system groups by default; add `?include_hidden=true` for the settings screen itself to manage the hide/show list.

### Admin
```
All /admin/* routes require role = 'admin', re-checked against the DB on every request → 403 otherwise.

GET    /admin/groups                List system groups (with how many products use each)
POST   /admin/groups                Create a system group
PATCH  /admin/groups/:id            Rename a system group
GET    /admin/users?q=&cursor=      Search/list users (email, created_at, sign-in methods, role, disabled)
PATCH  /admin/users/:id             Change role and/or disabled status
                                     400 on self-demote, self-disable, or demoting the last admin
GET    /admin/stats                 App-wide counts (users, sign-ups last 7/30 days, products, meals, log entries)
```
Scope is a proposal — see §3.8 and Open Questions #11.

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

### Google / Apple sign-in
```
User taps "Continue with Google" / "Continue with Apple"
→ Native SDK (mobile) or provider JS (web) returns a provider token
→ POST /auth/google { id_token }  or  POST /auth/apple { identity_token, name? }
→ Backend verifies signature, issuer, expiry, and audience
  (Google: must match one of the iOS / Android / web client IDs; Apple: bundle ID or Services ID)
→ Look up user_auth_identities by (provider, sub)
   → found            → sign in
   → not found, email not used by any account → create user (no password) + identity + profile prefill
   → not found, email already used            → 409 account_exists
→ From here on: same access/refresh token flow as password login
```

### Email collision (409 account_exists)
```
App shows: "An account with this email already exists. Sign in with your existing method,
            then connect Google/Apple from Profile → Sign-in methods."
→ No automatic linking, ever (see §2 Account linking)
```

### Roles & disabled accounts
```
access_token carries a `role` claim
→ Client uses it only to decide whether to render the Admin section

/admin/* routes
→ Re-check role from the DB on every request (not just the claim),
  so a demotion takes effect immediately, not after the token expires

Disabled account (users.disabled_at set)
→ POST /auth/login, /auth/google and /auth/apple all return 403
→ POST /auth/refresh fails → client logs the user out
  (an already-issued access token keeps working until it expires, max 15 min)
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
- [x] `user_goals` table + `GET`/`PATCH /goals` endpoints
- Goal setting UI → moved to Phase 5 (Profile → Daily goals)
- [x] `log_entries` + `log_entry_meal_ingredients` tables + migrations
- [x] `/log` CRUD endpoints + `/log/summary` aggregation endpoint
- [x] Log page UI: daily view grouped by meal slot, add-entry flow (product / meal+portion / manual)
- [x] Global "+ Log" modal: meal-slot-selection step (Breakfast/Lunch/Dinner/Snack) followed by source selection, feeding into the same add-entry flow as the per-slot buttons
- [x] Meal-logging flow: editable per-ingredient grams with live macro recalculation before saving
- [x] Daily summary UI: totals vs. goals per macro (progress bars/rings)

### Phase 5 — Social Sign-In, Profile & Settings

**Social sign-in — deferred, later TODO.** Blocked on enrolling in the Apple Developer Program (needed for any signed iOS build, not just Apple Sign-In specifically — `@react-native-google-signin/google-signin` also requires a signed dev build). The rest of Phase 5 has no dependency on social sign-in and ships first; only the Profile screen's Account → sign-in methods row (connect/disconnect Google & Apple) waits on it. Revisit the three checklists below once enrolled — Android could unblock Google sign-in sooner if that's wanted before Apple lands.

**Social sign-in — setup** *(later TODO — blocked on Apple Developer Program enrollment)*
- [ ] Google Cloud OAuth client IDs (iOS, Android, web); Apple Services ID, key, and Sign in with Apple capability; secrets in env config
- [ ] Move mobile to an Expo development build (native sign-in modules don't run in Expo Go)

**Social sign-in — backend** *(later TODO — blocked on Apple Developer Program enrollment)*
- [ ] Migration: `users.password_hash` nullable + `user_auth_identities` table
- [ ] Google ID token verification (all three client IDs as accepted audiences)
- [ ] Apple identity token verification (Apple public keys); persist name on first sign-in; accept private-relay emails
- [ ] `POST /auth/google` + `POST /auth/apple` (sign in / create, 409 on email collision)
- [ ] Identity endpoints: list, connect, disconnect (last-method guardrail), `POST /auth/set-password`
- [ ] Prefill `user_profiles.display_name` / `avatar_url` from the provider on account creation
- [ ] Tests: new user, returning user, email collision, disconnect-last-method, disabled account on every method

**Social sign-in — UI** *(later TODO — blocked on Apple Developer Program enrollment)*
- [ ] Login + register screens (built in Phase 1): "Continue with Google" / "Continue with Apple" buttons, on every platform
- [ ] Email-collision screen with guidance to sign in and connect from Profile

**Backend — data**
- [ ] `users.role` (`'user'` | `'admin'`, default `'user'`) + `users.disabled_at` columns + migration
- [ ] `user_profiles` table + migration
- [ ] `user_settings` table + migration (units, timezone, notifications)
- [ ] `user_hidden_groups` table + migration
- [ ] CLI command to create/promote the first admin (no API path to admin)

**Backend — endpoints**
- [ ] `GET /me` (user + profile + settings + goals in one response)
- [ ] `GET`/`PATCH /profile`
- [ ] `GET`/`PATCH /settings`
- [ ] Change password + delete account endpoints (delete confirmed by typed "DELETE", no password needed)
- [ ] Hide/un-hide system group endpoints; update `GET /groups` to exclude hidden ones by default
- [ ] `/log`, `/log/summary`, `/log/logged-days` compute day boundaries from `user_settings.timezone` (Phase 4 shipped before this setting existed — verify what it assumes today)
- [ ] Login and refresh reject disabled accounts
- [ ] Avatar upload — blocked on Open Questions #4

**Backend — admin**
- [ ] `require_admin` dependency (DB role check) applied to every `/admin/*` route
- [ ] System group create/rename endpoints
- [ ] User list/search + role/disable endpoint, with self and last-admin guardrails
- [ ] Stats endpoint
- [ ] Tests: non-admin gets 403 on every `/admin/*` route; guardrail cases

**UI — Profile tab**
- [ ] Profile tab + root screen with section layout (header, body stats, goals, preferences, groups, account)
- [ ] Edit profile screen (display name, avatar, body stats), incl. empty / first-run state
- [ ] Daily goals editor (moved from Phase 4) with implied-calories hint
- [ ] "Edit goals" link on the Log page's daily summary, deep-linking to Profile → Daily goals
- [ ] Preferences: units toggle, timezone picker, notifications toggle (with "coming soon" caption)
- [ ] System group visibility screen (separate from custom group management, links to it)
- [ ] Account: change password, log out, delete account (two-step, typed "DELETE") — ship now; sign-in methods screen (connect/disconnect Google & Apple) is *later TODO*, blocked with the rest of social sign-in above
- [ ] Apply `user_settings.units` to every weight/height/quantity display across the app
- [ ] Admin section, rendered only for `role = 'admin'`: system groups, user management (incl. sign-in methods column), stats

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
| 6 | Goal calculator (auto-compute calorie/macro goals from the Profile body stats — age, sex, height, weight, activity level — plus a target) | Planned for later — manual entry only for now; body stats are collected from Phase 5 so the inputs are ready |
| 7 | Should `user_goals` keep a history (versioned by date) instead of a single overwritten row, so past days are checked against the goal active at the time? | **Pending** |
| 8 | Delete account: hard-delete immediately, or route through the same 30-day recovery pattern as products/meals? Either way, deleting also removes linked Google/Apple identities (and should revoke the Apple token, which Apple requires for account deletion) | **Pending** |
| 9 | Notification settings: no push infra exists yet — is the toggle a stub for future use, or does Phase 5 need to build actual delivery? | Stub only for now — see Phase 5 |
| 10 | Global "+ Log" modal: should the meal-slot-selection step default to a guess based on current time of day (e.g. auto-select "Lunch" at 1pm, user can still change it), or always start unselected? | **Pending** |
| 11 | Admin scope: which proposed actions (§3.8 — system groups, user management, stats) ship in Phase 5, and are others needed? | **Pending** |
| 12 | Should admins ever see a user's food data (e.g. for support), or stay limited to account status + app-wide config? | Proposed: no access |
| 13 | Weight history: keep only current weight, or track weigh-ins over time (also a natural input for a goal calculator / progress chart)? | Current only for now |
| 14 | `sex` field: which options and wording? Needed for BMR formulas in a goal calculator, should include a "prefer not to say" option | **Pending** |
| 15 | Avatar: depends on #4 (object storage) — ship initials-only until then? | Partly solved — Google users get their Google photo URL as `avatar_url` without any storage; uploads still depend on #4, initials fallback ships regardless |
| 16 | Should social-only users be nudged to also set a password (or connect a second provider) as a backup sign-in method? | **Pending** |
| 17 | Email changes: if a user's Google/Apple email changes, do we update `users.email`, or keep the email from sign-up? | Proposed: keep sign-up email; `user_auth_identities.email` is informational only |

---

*Last updated: September 24, 2026. Update this file as decisions are made.*