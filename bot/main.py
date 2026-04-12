"""
Aparu Telegram Bot — entry point.

Deep-link format:  t.me/AparuVertexBot?start=order_42
                   t.me/AparuVertexBot?start=tour_altai-morning

Run:
    python main.py

Requires BOT_TOKEN in environment (or .env file).
"""

from __future__ import annotations

import asyncio
import logging
import os

from aiogram import Bot, Dispatcher
from aiogram.client.default import DefaultBotProperties
from aiogram.enums import ParseMode
from aiogram.filters import Command, CommandObject
from aiogram.types import Message
from dotenv import load_dotenv

from store import init_db, subscribe
from retargeting import retargeting_loop

load_dotenv()

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-8s  %(name)s — %(message)s",
)
logger = logging.getLogger(__name__)

# ── Bot / Dispatcher ──────────────────────────────────────────────────────────

BOT_TOKEN: str = os.environ["BOT_TOKEN"]

bot = Bot(
    token=BOT_TOKEN,
    default=DefaultBotProperties(parse_mode=ParseMode.HTML),
)
dp = Dispatcher()


# ── Helpers ───────────────────────────────────────────────────────────────────

def _parse_payload(args: str | None) -> tuple[str, str | None]:
    """
    Parse the deep-link start parameter.

    Returns (kind, ref_id) where kind is 'order', 'tour', or 'unknown'.
    Examples:
        "order_42"         → ("order", "42")
        "tour_altai-morning" → ("tour", "altai-morning")
        None / garbage     → ("unknown", None)
    """
    if not args:
        return "unknown", None
    for prefix in ("order_", "tour_"):
        if args.startswith(prefix):
            kind = prefix.rstrip("_")
            ref_id = args[len(prefix):]
            return kind, ref_id if ref_id else None
    return "unknown", None


# ── Handlers ─────────────────────────────────────────────────────────────────

@dp.message(Command("start"))
async def handle_start(message: Message, command: CommandObject) -> None:
    """
    Handle /start with or without a deep-link payload.

    Telegram sends:  /start order_42
    command.args  →  "order_42"
    """
    kind, ref_id = _parse_payload(command.args)

    if kind == "order" and ref_id:
        payload = f"order_{ref_id}"
        await subscribe(message.from_user.id, payload)
        await message.answer(
            f"✅ <b>Ваш заказ #{ref_id} принят!</b>\n\n"
            "Я пришлю уведомление, когда водитель будет на месте.\n\n"
            "Следите за статусом прямо здесь — в Telegram. 🗺"
        )

    elif kind == "tour" and ref_id:
        payload = f"tour_{ref_id}"
        await subscribe(message.from_user.id, payload)
        await message.answer(
            f"🌄 <b>Маршрут сохранён!</b>\n\n"
            "Ваш туристический маршрут закреплён. Билеты и детали будут "
            "доступны здесь — никаких лишних приложений.\n\n"
            "Хорошей поездки с Aparu! 🚕"
        )

    else:
        await message.answer(
            "Добро пожаловать в <b>Aparu</b>! 🚕\n\n"
            "Оформите заказ в приложении, чтобы получать уведомления "
            "прямо здесь, в Telegram."
        )


@dp.message(Command("help"))
async def handle_help(message: Message) -> None:
    await message.answer(
        "<b>Aparu Bot</b>\n\n"
        "Я присылаю уведомления о статусе ваших заказов и маршрутов.\n\n"
        "Просто откройте приложение и нажмите «Открыть трекер» — "
        "я подхвачу ваш заказ автоматически."
    )


# ── Entry point ───────────────────────────────────────────────────────────────

async def main() -> None:
    await init_db()
    # Start retargeting in the background without blocking polling
    asyncio.create_task(retargeting_loop(bot))
    logger.info("Starting polling…")
    await dp.start_polling(bot, allowed_updates=["message"])


if __name__ == "__main__":
    asyncio.run(main())
