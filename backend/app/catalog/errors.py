from fastapi import HTTPException


class CatalogError(Exception):
    pass


class CatalogBusy(CatalogError):
    """Local OFF rate budget is exhausted; fail fast instead of queueing."""

    def __init__(self, retry_after: int = 30):
        self.retry_after = retry_after


class CatalogUnavailable(CatalogError):
    """OFF returned 429/503/5xx, timed out, is disabled, or the breaker is open."""

    def __init__(self, retry_after: int = 60):
        self.retry_after = retry_after


def api_error(status: int, code: str, **extra) -> HTTPException:
    """Structured error body: {"detail": {"code": ..., ...}}."""
    headers = {"Retry-After": str(extra["retry_after"])} if "retry_after" in extra else None
    return HTTPException(status_code=status, detail={"code": code, **extra}, headers=headers)


def unavailable(exc: CatalogError) -> HTTPException:
    return api_error(503, "catalog_unavailable", retry_after=getattr(exc, "retry_after", 60))
