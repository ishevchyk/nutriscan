# NutriScan — Backend

## Stack
- Python 3.11+
- FastAPI
- PostgreSQL
- SQLAlchemy (async) + Alembic for migrations
- PyJWT for auth
- Anthropic Python SDK for AI endpoints

## Project structure
backend/
├── app/
│   ├── main.py          # FastAPI app entry point
│   ├── config.py        # Settings from environment variables
│   ├── database.py      # DB connection + session
│   ├── models/          # SQLAlchemy models
│   ├── schemas/         # Pydantic request/response schemas
│   ├── routers/         # One file per domain (auth, products, recipes, ai)
│   └── dependencies.py  # Shared deps (get_current_user, get_db)
├── alembic/             # Migrations
├── .env                 # Never commit this
├── .env.example         # Commit this
└── requirements.txt

## Rules
- All secrets via environment variables — never hardcoded
- All endpoints require JWT auth except /auth/register and /auth/login
- Use async SQLAlchemy throughout
- Pydantic v2 schemas for all request/response shapes
- Soft deletes only — never hard delete products or recipes

## Offline sync
There is no `/sync` endpoint. Offline-first sync (SQLite queue on mobile,
IndexedDB on web) was built once and deliberately removed — the offline
requirement hadn't been validated by real usage and the added complexity
(conflict resolution, connectivity polling) wasn't worth carrying yet. See
the same note in `mobile/CLAUDE.md` / `web/CLAUDE.md`. If it comes back,
last-write-wins on `updated_at` was the prior conflict policy and is a
reasonable starting point.