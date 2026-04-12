"""
24-hour retargeting loop.

Runs as a background asyncio task. Every 60 seconds it checks the store
for subscribers whose 24-hour window has passed and sends them a
re-engagement message.
"""

from __future__ import annotations

import asyncio
import logging
from datetime import datetime, timezone

from aiogram import Bot
from aiogram.exceptions import TelegramForbiddenError, TelegramBadRequest

from store import get_due_retargets, mark_retargeted

logger = logging.getLogger(__name__)

_RETARGET_MSG = (
    "Надеемся, вам понравилась поездка! 🚕\n\n"
    "Нужна машина на завтра? Откройте приложение — ваш маршрут сохранён.\n\n"
    "Aparu всегда рядом 🗺"
)

_CHECK_INTERVAL_SECONDS = 60


async def retargeting_loop(bot: Bot) -> None:
    """Infinite loop — poll every minute, fire messages when due."""
    logger.info("Retargeting loop started (interval=%ds)", _CHECK_INTERVAL_SECONDS)
    while True:
        await asyncio.sleep(_CHECK_INTERVAL_SECONDS)
        now = datetime.now(timezone.utc)
        try:
            due = await get_due_retargets(now)
        except Exception as exc:
            logger.error("Failed to query due retargets: %s", exc)
            continue

        for row in due:
            try:
                await bot.send_message(row["chat_id"], _RETARGET_MSG)
                await mark_retargeted(row["id"])
                logger.info(
                    "Retargeted chat_id=%s payload=%s",
                    row["chat_id"],
                    row["payload"],
                )
            except TelegramForbiddenError:
                # User blocked the bot — mark as done so we don't retry endlessly
                await mark_retargeted(row["id"])
                logger.warning("Bot blocked by chat_id=%s, skipping", row["chat_id"])
            except TelegramBadRequest as exc:
                logger.warning("Bad request for chat_id=%s: %s", row["chat_id"], exc)
            except Exception as exc:
                logger.error(
                    "Unexpected error retargeting chat_id=%s: %s",
                    row["chat_id"],
                    exc,
                )
