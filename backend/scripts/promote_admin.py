"""Promote (or demote) a user to admin. There is deliberately no API path to the first admin.

    .venv/bin/python -m scripts.promote_admin someone@example.com
    .venv/bin/python -m scripts.promote_admin someone@example.com --demote
"""
import argparse
import asyncio
import sys

from sqlalchemy import select

from app.database import AsyncSessionLocal, engine
from app.models.user import User


async def set_role(email: str, role: str) -> int:
    async with AsyncSessionLocal() as db:
        user = (await db.execute(select(User).where(User.email == email))).scalar_one_or_none()
        if user is None:
            print(f"No user with email {email}", file=sys.stderr)
            return 1
        user.role = role
        await db.commit()
        print(f"{email} is now role={role}")
    await engine.dispose()
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("email")
    parser.add_argument("--demote", action="store_true", help="set role back to 'user'")
    args = parser.parse_args()
    return asyncio.run(set_role(args.email, "user" if args.demote else "admin"))


if __name__ == "__main__":
    sys.exit(main())
