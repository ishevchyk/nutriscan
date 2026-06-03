# NutriScan — Project Specification

> Cross-platform nutrition tracker with AI-powered food scanning, offline-first storage, and a conversational product editor.

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Decisions Locked In](#2-decisions-locked-in)
3. [Core Features](#3-core-features)
4. [Tech Stack](#4-tech-stack)
5. [Architecture Overview](#5-architecture-overview)
6. [Database Schema](#6-database-schema)
7. [API Endpoints](#7-api-endpoints)
8. [Offline Sync Strategy](#8-offline-sync-strategy)
9. [AI Integration](#9-ai-integration)
10. [Auth Flow](#10-auth-flow)
11. [Build Phases](#11-build-phases)
12. [Open Questions](#12-open-questions)

---

## 1. Project Overview

NutriScan is a personal nutrition tracking app that lets users build a library of products they commonly buy, scan new products using AI vision, and assemble recipes with automatic nutrition calculations.

**Target platforms:** iOS, Android (React Native + Expo), and web (React).

**Core value:** One place to store your real-world food data — not crowd-sourced guesses — enriched by AI when you need it.

---

## 2. Decisions Locked In

| Topic | Decision |
|---|---|
| Authentication | Yes — user accounts with cross-device sync |
| Offline mode | Yes — local-first, sync on reconnect |
| AI scanning | Claude API Vision + in-app AI chat editor |
| Sync conflict resolution | TBD — last-write-wins (simple) or user-prompted diff |
| Social / sharing | TBD — personal-only for now, revisit later |

---

## 3. Core Features

### 3.1 Product Library
- Store commonly bought products with full nutritional profiles
- Fields: name, brand, barcode (optional), calories, protein, fat, carbohydrates, fiber, sugar, salt, and custom micronutrients
- Searchable and filterable
- Fully editable at any time
- Synced to user account, cached locally on device

### 3.2 AI Photo Scanner
- User points camera at a product or its nutrition label
- Image is sent to Claude API (Vision)
- Claude returns structured nutritional data as a JSON draft
- Draft is shown as an editable card before the user confirms and saves
- Falls back gracefully if the image is unclear (prompts user to retake or enter manually)

### 3.3 AI Chat Editor
- Available after scanning or on any existing product
- Multi-turn Claude chat scoped to a single product
- Example interactions:
  - "This is the low-fat version, update fat to 2g"
  - "Find the correct fiber value for Alpro Oat Original"
  - "The protein looks wrong — it should be per 100g not per serving"
- Claude proposes field changes; user confirms before they are written to the database
- Chat history is ephemeral (per session, not persisted)

### 3.4 Recipes & Meal Nutrition
- Build recipes by selecting products from the library and setting quantities
- Nutrition is auto-calculated:
  - Per 100g of the finished recipe
  - Per usual portion (default portion size set per recipe, adjustable per meal in settings)
- Create, edit, browse, and delete recipes
- Each recipe has: name, description, ingredients (product + grams), portion size, photo (optional)

### 3.5 Offline-First Storage
- All product library and recipe data is cached locally using expo-sqlite (mobile) and IndexedDB (web)
- All reads and writes happen locally first — zero latency for the user
- Changes are queued and synced to the server when connectivity is restored
- Visual indicator when the app is in offline mode

---

## 4. Tech Stack

### Frontend — Mobile
| Layer | Choice | Notes |
|---|---|---|
| Framework | React Native + Expo | Managed workflow for simplicity |
| Navigation | Expo Router | File-based routing |
| Local database | expo-sqlite | SQL interface, works offline |
| Camera | expo-camera | For AI photo scanning |
| Secure storage | expo-secure-store | JWT token storage |
| State management | Zustand | Lightweight, easy to persist |
| API client | Axios | With offline queue middleware |

### Frontend — Web
| Layer | Choice | Notes |
|---|---|---|
| Framework | React + Vite | Fast dev server |
| Local storage | IndexedDB (via Dexie.js) | Offline cache for web |
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
│  expo-sqlite cache  │     │  IndexedDB cache     │
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
              │  /recipes          │
              │  /ai/scan          │
              │  /ai/chat          │
              │  /sync             │
              └─────────┬──────────┘
                        │
            ┌───────────┴───────────┐
            │                       │
     ┌──────▼──────┐     ┌─────────▼────────┐
     │ PostgreSQL  │     │  Anthropic API   │
     │             │     │  (Claude Vision  │
     │  Users      │     │   + chat)        │
     │  Products   │     └──────────────────┘
     │  Recipes    │
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
deleted_at    TIMESTAMPTZ    -- soft delete for sync
```

### recipes
```sql
id              UUID PRIMARY KEY
user_id         UUID REFERENCES users(id)
name            TEXT NOT NULL
description     TEXT
portion_grams   NUMERIC DEFAULT 100
photo_url       TEXT
created_at      TIMESTAMPTZ DEFAULT now()
updated_at      TIMESTAMPTZ DEFAULT now()
deleted_at      TIMESTAMPTZ
```

### recipe_ingredients
```sql
id          UUID PRIMARY KEY
recipe_id   UUID REFERENCES recipes(id)
product_id  UUID REFERENCES products(id)
grams       NUMERIC NOT NULL
```

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
GET    /products             List user's products
POST   /products             Create product
GET    /products/:id         Get single product
PATCH  /products/:id         Update product
DELETE /products/:id         Soft delete
```

### Recipes
```
GET    /recipes              List user's recipes
POST   /recipes              Create recipe
GET    /recipes/:id          Get recipe with ingredients + calculated nutrition
PATCH  /recipes/:id          Update recipe
DELETE /recipes/:id          Soft delete
```

### AI
```
POST   /ai/scan              Send image → get draft product JSON back
POST   /ai/chat              Multi-turn chat for product editing
                             Body: { product_id, messages: [{role, content}] }
```

### Sync
```
POST   /sync                 Send local change queue → receive server changes since last_sync
                             Body: { last_sync_at, changes: [...] }
```

---

## 8. Offline Sync Strategy

### How it works
1. Every local write is stamped with `updated_at` (client time)
2. Changes are added to a local sync queue (expo-sqlite / IndexedDB)
3. When online, the client calls `POST /sync` with its queued changes and its `last_sync_at` timestamp
4. The server applies the changes and returns any server-side changes since `last_sync_at`
5. The client applies server changes and clears its queue

### Conflict resolution — TBD choice
**Option A — Last-write-wins (simple):** whichever record has the latest `updated_at` wins. Easiest to implement, fine for a single-user personal app.

**Option B — User-prompted diff:** if two versions of a product differ, show the user both versions and ask which to keep. Better UX but more complex.

*Decision pending — see Open Questions.*

### Soft deletes
Records are never hard-deleted immediately. A `deleted_at` timestamp is set and synced. Hard deletion can run as a background job after 30 days.

---

## 9. AI Integration

### Scanning flow
```
User taps "Scan" → Camera opens
→ Photo taken → base64 encoded
→ POST /ai/scan { image: base64 }
→ Backend sends to Claude API (Vision)
   Prompt instructs Claude to return:
   { name, brand, calories, protein, fat, carbs, fiber, sugar, salt, confidence }
→ Backend returns draft JSON
→ App shows editable draft card
→ User confirms → POST /products
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
  "confidence": "high" | "medium" | "low",
  "notes": string | null         // flag anything unclear
}
All numeric values are per 100g. If a value is not visible or cannot be determined, use null.
Do not include any text outside the JSON object.
```

### Chat editor flow
```
User opens chat on a product
→ Current product fields sent as context in system prompt
→ User types message
→ POST /ai/chat { product_id, messages }
→ Backend forwards to Claude with product context
→ Claude proposes updated field values
→ App shows a diff of what would change
→ User confirms → PATCH /products/:id
```

---

## 10. Auth Flow

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

Offline
→ Requests bypass auth check and go to local cache
→ Sync call re-authenticates when connectivity returns
```

---

## 11. Build Phases

### Phase 1 — Foundation
- [ ] FastAPI project setup (folder structure, config, error handling)
- [ ] PostgreSQL schema + Alembic migrations
- [ ] Auth endpoints (register, login, refresh, logout)
- [ ] Product CRUD endpoints
- [ ] Basic React Native screens: login, product list, product detail, add product form
- [ ] Zustand store wired to API

### Phase 2 — Offline Sync
- [ ] expo-sqlite local schema mirroring PostgreSQL
- [ ] Local-first read/write logic
- [ ] Sync queue implementation
- [ ] `POST /sync` endpoint on backend
- [ ] Conflict resolution (chosen strategy from Open Questions)
- [ ] Offline indicator UI

### Phase 3 — AI Scanning & Chat
- [ ] Camera screen with capture flow
- [ ] `POST /ai/scan` endpoint + Claude Vision integration
- [ ] Draft product card UI
- [ ] AI chat screen + `POST /ai/chat` endpoint
- [ ] Diff confirmation UI before saving AI edits

### Phase 4 — Recipes
- [ ] Recipe CRUD endpoints
- [ ] Recipe builder UI (select products, set grams)
- [ ] Nutrition calculation logic (per 100g + per portion)
- [ ] Portion size setting per recipe and per meal
- [ ] Recipe list + detail screens

### Phase 5 — Web & Deploy
- [ ] React web app (Vite) with shared API client
- [ ] IndexedDB offline cache for web
- [ ] CI/CD pipeline (GitHub Actions)
- [ ] Deploy backend (Railway / Render / Fly.io)
- [ ] Deploy web app (Vercel / Netlify)
- [ ] Environment config (dev / prod)

---

## 12. Open Questions

| # | Question | Status |
|---|---|---|
| 1 | Sync conflict resolution: last-write-wins or user-prompted diff? | **Pending** |
| 2 | Social features: personal-only for now, or plan schema for sharing? | Personal-only for v1 |
| 3 | Hosting provider for backend | **Pending** |
| 4 | Should recipes also support AI-assisted creation ("build me a recipe with these products")? | **Pending** |
| 5 | Photo storage for recipes: local only, or upload to object storage (S3 / Cloudflare R2)? | **Pending** |

---

*Last updated: May 2026. Update this file as decisions are made.*
