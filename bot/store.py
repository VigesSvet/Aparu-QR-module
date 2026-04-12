"""
SQLite subscriber store.

Stores Telegram chat_ids linked to order/tour IDs for notifications
and the 24-hour retargeting campaign.
"""

from __future__ import annotations

import logging
from datetime import datetime, timezone
from pathlib import Path

import aiosqlite

logger = logging.getLogger(__name__)

DB_PATH = Path(__file__).parent / "bot_store.db"

_CREATE_TABLE = """
CREATE TABLE IF NOT EXISTS subscribers (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    chat_id       INTEGER NOT NULL,
    payload       TEXT    NOT NULL,   -- e.g. "order_42" or "tour_altai-morning"
    subscribed_at TEXT    NOT NULL,   -- ISO-8601 UTC
    retargeted    INTEGER NOT NULL DEFAULT 0,
    UNIQUE(chat_id, payload)
);
"""


async def init_db() -> None:
    """Create the database file and table if they don't exist."""
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute(_CREATE_TABLE)
        await db.commit()
    logger.info("Bot store initialised at %s", DB_PATH)


async def subscribe(chat_id: int, payload: str) -> None:
    """
    Register a subscriber for the given payload.
    Uses INSERT OR REPLACE so re-subscribing resets the 24-hour clock.
    """
    now = datetime.now(timezone.utc).isoformat()
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute(
            """
            INSERT INTO subscribers (chat_id, payload, subscribed_at, retargeted)
            VALUES (?, ?, ?, 0)
            ON CONFLICT(chat_id, payload)
            DO UPDATE SET subscribed_at = excluded.subscribed_at, retargeted = 0
            """,
            (chat_id, payload, now),
        )
        await db.commit()
    logger.info("Subscribed chat_id=%s payload=%s", chat_id, payload)


async def get_due_retargets(now: datetime) -> list[dict]:
    """Return all subscribers whose 24-hour window has elapsed and haven't been messaged."""
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        async with db.execute(
            """
            SELECT id, chat_id, payload, subscribed_at
            FROM subscribers
            WHERE retargeted = 0
              AND datetime(subscribed_at, '+24 hours') <= datetime(?)
            """,
            (now.isoformat(),),
        ) as cursor:
            return [dict(row) async for row in cursor]


async def mark_retargeted(subscriber_id: int) -> None:
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute(
            "UPDATE subscribers SET retargeted = 1 WHERE id = ?",
            (subscriber_id,),
        )
        await db.commit()
