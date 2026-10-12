import time
from collections import defaultdict, deque

from app.catalog.errors import CatalogBusy


class TokenBucket:
    """Async-safe (single event loop) token bucket; try_acquire never waits.

    NOTE: per-process. A multi-instance deploy shares one OFF IP budget, so it
    would need a shared limiter (Postgres advisory lock or Redis) -- out of
    scope for now.
    """

    def __init__(self, per_minute: int, clock=time.monotonic):
        self.capacity = per_minute
        self.rate = per_minute / 60.0
        self.tokens = float(per_minute)
        self.clock = clock
        self.updated = clock()

    def try_acquire(self) -> None:
        now = self.clock()
        self.tokens = min(self.capacity, self.tokens + (now - self.updated) * self.rate)
        self.updated = now
        if self.tokens < 1:
            raise CatalogBusy(retry_after=max(1, int((1 - self.tokens) / self.rate) + 1))
        self.tokens -= 1


class CircuitBreaker:
    def __init__(self, cooldown: float = 60.0, clock=time.monotonic):
        self.cooldown = cooldown
        self.clock = clock
        self.open_until = 0.0

    def remaining(self) -> int:
        return max(0, int(self.open_until - self.clock()) + 1) if self.clock() < self.open_until else 0

    def trip(self) -> None:
        self.open_until = self.clock() + self.cooldown

    def reset(self) -> None:
        self.open_until = 0.0


class UserLimiter:
    """Sliding window per user so one user can't drain the shared OFF budget."""

    def __init__(self, per_minute: int = 20, clock=time.monotonic):
        self.per_minute = per_minute
        self.clock = clock
        self.hits: dict = defaultdict(deque)

    def check(self, user_id) -> int | None:
        """Returns None if allowed, else seconds until the next slot."""
        now = self.clock()
        q = self.hits[user_id]
        while q and now - q[0] >= 60:
            q.popleft()
        if len(q) >= self.per_minute:
            return max(1, int(60 - (now - q[0])) + 1)
        q.append(now)
        return None
