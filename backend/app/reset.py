"""Deletes every conversation and what hangs from it, so a demo starts clean. Refuses to run in production.

Staff, configuration and banking data stay. The audit log stays too: it is append-only by design.
"""

import asyncio

from sqlalchemy import delete

from app.core.config import get_settings
from app.core.db import SessionLocal
from app.models import Conversation, Dispute, DisputeEvent, Handoff, Message, PendingAction, TraceEvent


async def reset() -> None:
    if get_settings().is_prod:
        raise SystemExit("refusing to delete conversations in production")
    async with SessionLocal() as s:
        counts = {}
        # Children first; disputes point at conversations.
        for model in (TraceEvent, Message, Handoff, PendingAction, DisputeEvent, Dispute, Conversation):
            counts[model.__tablename__] = (await s.execute(delete(model))).rowcount
        await s.commit()
    print("deleted " + ", ".join(f"{n} {table}" for table, n in counts.items()))


if __name__ == "__main__":
    asyncio.run(reset())
