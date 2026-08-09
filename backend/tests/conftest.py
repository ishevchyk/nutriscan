import uuid

import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.config import settings
from app.database import Base
from app.dependencies import get_db
from app.main import app
from app.models.group import Group

SYSTEM_GROUP_NAMES = [
    "Dairy",
    "Fruits",
    "Vegetables",
    "Breakfast",
    "Snacks",
    "Meat & Fish",
    "Grains",
    "Beverages",
    "Sweets",
    "Condiments",
]

test_engine = create_async_engine(settings.test_database_url, echo=False)
TestSessionLocal = async_sessionmaker(bind=test_engine, class_=AsyncSession, expire_on_commit=False)


async def _override_get_db():
    async with TestSessionLocal() as session:
        yield session


@pytest_asyncio.fixture(scope="session", autouse=True)
async def _setup_schema():
    if not settings.test_database_url:
        raise RuntimeError("TEST_DATABASE_URL must be set to run tests")
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
        await conn.run_sync(Base.metadata.create_all)
    async with TestSessionLocal() as session:
        for name in SYSTEM_GROUP_NAMES:
            session.add(Group(id=uuid.uuid4(), user_id=None, name=name, is_system=True))
        await session.commit()

    app.dependency_overrides[get_db] = _override_get_db
    yield
    app.dependency_overrides.clear()
    await test_engine.dispose()


@pytest_asyncio.fixture(loop_scope="session")
async def client():
    # Test isolation relies on every test registering its own fresh random
    # user (see auth_headers/second_user_headers below): all queries are
    # scoped by current_user.id (or is_system), so leftover rows from other
    # tests never show up for a new user. Seeded system groups are read-only
    # for these tests and shared across the whole run intentionally.
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        yield ac


async def _register_user(client: AsyncClient) -> dict:
    email = f"test-{uuid.uuid4()}@example.com"
    resp = await client.post("/auth/register", json={"email": email, "password": "testpass123"})
    token = resp.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


@pytest_asyncio.fixture(loop_scope="session")
async def auth_headers(client):
    return await _register_user(client)


@pytest_asyncio.fixture(loop_scope="session")
async def second_user_headers(client):
    return await _register_user(client)
