import json
from pathlib import Path

import httpx

from app.catalog.off_client import OffClient
from app.config import Settings

FIXTURES = Path(__file__).parent / "fixtures" / "off"


def load_fixture(name: str) -> dict:
    return json.loads((FIXTURES / f"{name}.json").read_text())


def make_settings(**overrides) -> Settings:
    base = dict(off_enabled=True, off_use_staging=True, off_contact_email="test@example.com",
                off_search_backend="search_a_licious")
    return Settings(**{**base, **overrides})


def make_client(handler, **settings_overrides) -> tuple[OffClient, list[httpx.Request]]:
    """OffClient over httpx.MockTransport; returns the client and the request log."""
    seen: list[httpx.Request] = []

    def wrapped(request: httpx.Request) -> httpx.Response:
        seen.append(request)
        return handler(request)

    return OffClient(transport=httpx.MockTransport(wrapped), cfg=make_settings(**settings_overrides)), seen
