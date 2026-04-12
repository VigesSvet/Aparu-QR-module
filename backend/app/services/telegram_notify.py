"""
Telegram push notification service.

Sends order-status updates to users who subscribed via the Telegram bot.
Reads the bot's SQLite subscriber store and calls the Telegram Bot API
directly (no bot framework dependency).
"""

from __future__ import annotations

import logging
from datetime import datetime, timezone
from pathlib import Path

import aiosqlite
import httpx

from app.config import settings

logger = logging.getLogger(__name__)

# ── Status → user-facing message ──────────────────────────────────────────────

_STATUS_MESSAGES: dict[str, str] = {
    "assigned":  "🚕 <b>Водитель найден!</b>\nВаш водитель уже назначен и скоро выедет к вам.",
    "driving":   "🚗 <b>Водитель в пути!</b>\nВодитель выехал к вашей точке посадки.",
    "arrived":   "📍 <b>Водитель на месте!</b>\nВаш водитель прибыл — выходите!",
    "in_trip":   "🛣 <b>Вы в поездке!</b>\nПриятной дороги с Aparu.",
    "completed": (
        "✅ <b>Поездка завершена!</b>\n"
        "Спасибо, что выбрали Aparu. До встречи!\n\n"
        "📲 <b>Скачайте приложение Aparu</b>, чтобы заказывать такси ещё быстрее "
        "и получать бонусы:\n\n"
        '🍏 <a href="https://apps.apple.com/ru/app/aparu-%D0%BB%D1%83%D1%87%D1%88%D0%B5-%D1%87%D0%B5%D0%BC-%D1%82%D0%B0%D0%BA%D1%81%D0%B8/id997499904">App Store</a>\n'
        '🤖 <a href="https://play.google.com/store/apps/details?id=kz.aparu.aparupassenger">Google Play</a>\n'
        '📱 <a href="https://appgallery.huawei.com/#/app/C103097503">AppGallery</a>'
    ),
    "cancelled": "❌ <b>Заказ отменён.</b>\nЕсли передумаете — мы всегда рядом.",
}


async def _get_chat_ids_for_order(order_id: int) -> list[int]:
    """
    Look up subscribers from the bot's SQLite store whose payload
    matches `order_{order_id}`.
    """
    db_path = Path(settings.BOT_STORE_DB_PATH)
    if not db_path.exists():
        logger.debug("Bot store DB not found at %s — skipping notification", db_path)
        return []

    payload = f"order_{order_id}"
    async with aiosqlite.connect(db_path) as db:
        db.row_factory = aiosqlite.Row
        async with db.execute(
            "SELECT chat_id FROM subscribers WHERE payload = ?",
            (payload,),
        ) as cursor:
            rows = [row async for row in cursor]
            return [row["chat_id"] for row in rows]


async def _send_telegram_message(chat_id: int, text: str) -> bool:
    """Send a message via Telegram Bot API. Returns True on success."""
    url = f"https://api.telegram.org/bot{settings.BOT_TOKEN}/sendMessage"
    async with httpx.AsyncClient(timeout=10) as client:
        try:
            resp = await client.post(url, json={
                "chat_id": chat_id,
                "text": text,
                "parse_mode": "HTML",
                "disable_web_page_preview": True,
            })
            if resp.status_code == 200:
                return True
            logger.warning(
                "Telegram API returned %s for chat_id=%s: %s",
                resp.status_code, chat_id, resp.text,
            )
            return False
        except Exception as exc:
            logger.error("Failed to send Telegram message to chat_id=%s: %s", chat_id, exc)
            return False


async def auto_subscribe_for_new_order(
    order_id: int,
    past_order_ids: list[int],
) -> None:
    """
    Auto-subscribe a returning user to their new order.

    Looks up the bot subscriber store for any chat_id associated with the
    user's previous orders.  If found, creates a subscription for the new
    order so they receive notifications without needing to click the
    deep-link again.
    """
    if not past_order_ids:
        return

    db_path = Path(settings.BOT_STORE_DB_PATH)
    if not db_path.exists():
        return

    # Build payload list for all previous orders
    past_payloads = [f"order_{oid}" for oid in past_order_ids]
    placeholders = ",".join("?" for _ in past_payloads)

    async with aiosqlite.connect(db_path) as db:
        db.row_factory = aiosqlite.Row
        async with db.execute(
            f"SELECT DISTINCT chat_id FROM subscribers WHERE payload IN ({placeholders})",
            past_payloads,
        ) as cursor:
            rows = [row async for row in cursor]

        if not rows:
            return

        new_payload = f"order_{order_id}"
        now_iso = datetime.now(timezone.utc).isoformat()
        for row in rows:
            chat_id = row["chat_id"]
            await db.execute(
                """
                INSERT INTO subscribers (chat_id, payload, subscribed_at, retargeted)
                VALUES (?, ?, ?, 0)
                ON CONFLICT(chat_id, payload)
                DO UPDATE SET subscribed_at = excluded.subscribed_at, retargeted = 0
                """,
                (chat_id, new_payload, now_iso),
            )
        await db.commit()
        logger.info(
            "Auto-subscribed %d chat(s) to order_%s from %d previous orders",
            len(rows), order_id, len(past_order_ids),
        )


async def notify_order_status(order_id: int, new_status: str) -> None:
    """
    Send a Telegram push notification to all subscribers of the given order.

    Safe to call even if the bot token is not configured — it will silently
    skip.
    """
    if not settings.BOT_TOKEN:
        logger.debug("BOT_TOKEN not configured — telegram notification skipped")
        return

    text = _STATUS_MESSAGES.get(new_status)
    if text is None:
        return  # no message for this status (e.g. 'searching')

    chat_ids = await _get_chat_ids_for_order(order_id)
    if not chat_ids:
        logger.debug("No subscribers for order_%s — notification skipped", order_id)
        return

    for chat_id in chat_ids:
        ok = await _send_telegram_message(chat_id, text)
        if ok:
            logger.info("Notified chat_id=%s about order #%s → %s", chat_id, order_id, new_status)
