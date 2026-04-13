"""
Aparu Telegram Bot — entry point.

Deep-link formats
─────────────────
  Classic:    t.me/AparuVertexBot?start=order_42
              t.me/AparuVertexBot?start=tour_altai-morning
  Mini App:   t.me/AparuVertexBot/app?startapp=qr_42

Commands
────────
  /start   — welcome + Web App launch button
  /order   — quick text-order flow (location → tariff → confirm)
  /status  — mock status of the current ride
  /help    — help message

Run:
    python main.py

Requires BOT_TOKEN (and optionally WEB_APP_URL) in environment or .env file.
"""

from __future__ import annotations

import asyncio
import logging
import os
from typing import Any

from aiogram import Bot, Dispatcher, F
from aiogram.client.default import DefaultBotProperties
from aiogram.enums import ParseMode
from aiogram.filters import Command, CommandObject, StateFilter
from aiogram.fsm.context import FSMContext
from aiogram.fsm.state import State, StatesGroup
from aiogram.fsm.storage.memory import MemoryStorage
from aiogram.types import (
    CallbackQuery,
    InlineKeyboardButton,
    InlineKeyboardMarkup,
    KeyboardButton,
    MenuButtonWebApp,
    Message,
    ReplyKeyboardMarkup,
    ReplyKeyboardRemove,
    WebAppInfo,
)
from dotenv import load_dotenv

from store import init_db, subscribe
from retargeting import retargeting_loop

load_dotenv()

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-8s  %(name)s — %(message)s",
)
logger = logging.getLogger(__name__)

# ── Config ────────────────────────────────────────────────────────────────────

BOT_TOKEN: str = os.environ["BOT_TOKEN"]
# Public URL of the deployed Mini App (must be HTTPS).
# Fallback keeps the bot functional even if the env var is not set yet.
WEB_APP_URL: str = os.getenv("WEB_APP_URL", "https://aparu.kz/app")

# ── Bot / Dispatcher ──────────────────────────────────────────────────────────

bot = Bot(
    token=BOT_TOKEN,
    default=DefaultBotProperties(parse_mode=ParseMode.HTML),
)
dp = Dispatcher(storage=MemoryStorage())


# ── FSM states ────────────────────────────────────────────────────────────────

class OrderStates(StatesGroup):
    """States for the /order command flow."""
    waiting_location = State()   # Bot asked "from where?", waiting for geo
    waiting_tariff   = State()   # Geo received, waiting for tariff selection


# ── Helpers ───────────────────────────────────────────────────────────────────

def _parse_payload(args: str | None) -> tuple[str, str | None]:
    """
    Parse the deep-link start parameter.

    Returns (kind, ref_id):
        "order_42"           → ("order", "42")
        "tour_altai-morning" → ("tour",  "altai-morning")
        "qr_7"               → ("qr",    "7")
        None / unknown       → ("unknown", None)
    """
    if not args:
        return "unknown", None
    for prefix in ("order_", "tour_", "qr_"):
        if args.startswith(prefix):
            kind   = prefix.rstrip("_")
            ref_id = args[len(prefix):]
            return kind, ref_id if ref_id else None
    return "unknown", None


def _web_app_keyboard() -> InlineKeyboardMarkup:
    """Inline keyboard with a single full-width Web App button."""
    return InlineKeyboardMarkup(
        inline_keyboard=[[
            InlineKeyboardButton(
                text="🚕 Открыть Aparu — заказать такси",
                web_app=WebAppInfo(url=WEB_APP_URL),
            )
        ]]
    )


TARIFF_CATALOG: list[dict[str, Any]] = [
    {"id": "econom",  "label": "🚗 Эконом",  "price": 1_200},
    {"id": "comfort", "label": "🚙 Комфорт", "price": 1_800},
    {"id": "tourism", "label": "🌄 Туризм",  "price": 3_500},
]

MOCK_DRIVERS: dict[str, dict[str, str]] = {
    "econom":  {"name": "Тимур Н.",  "car": "Chevrolet Cobalt (белая)",  "plate": "707 ANA 18", "eta": "5"},
    "comfort": {"name": "Диас С.",   "car": "Kia K5 (серая)",            "plate": "313 KFM 18", "eta": "3"},
    "tourism": {"name": "Айдос С.",  "car": "Toyota Camry (чёрная)",     "plate": "777 VIP 16", "eta": "7"},
}


def _tariff_keyboard() -> InlineKeyboardMarkup:
    buttons = [
        [InlineKeyboardButton(
            text=f"{t['label']} — {t['price']:,} тг".replace(",", " "),
            callback_data=f"tariff_{t['id']}",
        )]
        for t in TARIFF_CATALOG
    ]
    return InlineKeyboardMarkup(inline_keyboard=buttons)


def _location_keyboard() -> ReplyKeyboardMarkup:
    return ReplyKeyboardMarkup(
        keyboard=[[
            KeyboardButton(text="📍 Отправить мою геопозицию", request_location=True)
        ]],
        resize_keyboard=True,
        one_time_keyboard=True,
    )


# ── Handlers ─────────────────────────────────────────────────────────────────

@dp.message(Command("start"))
async def handle_start(message: Message, command: CommandObject, state: FSMContext) -> None:
    """
    /start [payload]

    Handles both plain /start and deep-links:
      • order_42          — subscribes and confirms order tracking
      • tour_altai-morning — subscribes and confirms tour tracking
      • qr_42             — user arrived via Mini App QR link (greet + open app)
    """
    await state.clear()  # reset any in-progress order flow
    kind, ref_id = _parse_payload(command.args)

    if kind == "order" and ref_id:
        await subscribe(message.from_user.id, f"order_{ref_id}")
        await message.answer(
            f"✅ <b>Заказ #{ref_id} отслеживается!</b>\n\n"
            "Я пришлю уведомление, как только водитель будет на месте.\n\n"
            "Следите за статусом прямо здесь — в Telegram. 🗺"
        )
        return

    if kind == "tour" and ref_id:
        await subscribe(message.from_user.id, f"tour_{ref_id}")
        await message.answer(
            f"🌄 <b>Маршрут сохранён!</b>\n\n"
            "Ваш туристический маршрут закреплён. Подробности и билеты "
            "появятся здесь — никаких лишних приложений.\n\n"
            "Хорошей поездки с Aparu! 🚕"
        )
        return

    # Plain /start or qr_ link — welcome screen with Web App button
    first_name = message.from_user.first_name or "Друг"
    await message.answer(
        f"Привет, <b>{first_name}</b>! 👋\n\n"
        "Я помогу заказать такси в один клик.\n"
        "Нажми кнопку ниже, чтобы открыть приложение, "
        "или отправь команду /order для текстового заказа.",
        reply_markup=_web_app_keyboard(),
    )


@dp.message(Command("help"))
async def handle_help(message: Message) -> None:
    await message.answer(
        "<b>Aparu Bot</b> — такси и туризм\n\n"
        "<b>Команды:</b>\n"
        "/order — заказать такси через бота (без приложения)\n"
        "/status — статус текущего заказа\n\n"
        "<b>Или откройте приложение прямо здесь:</b>",
        reply_markup=_web_app_keyboard(),
    )


# ── /order flow ───────────────────────────────────────────────────────────────

@dp.message(Command("order"))
async def handle_order(message: Message, state: FSMContext) -> None:
    """/order — начало заказа без Mini App."""
    await state.set_state(OrderStates.waiting_location)
    await message.answer(
        "🚕 <b>Быстрый заказ такси</b>\n\n"
        "Откуда вас забрать?\n"
        "Нажмите кнопку ниже, чтобы отправить геопозицию.",
        reply_markup=_location_keyboard(),
    )


@dp.message(StateFilter(OrderStates.waiting_location), F.location)
async def handle_location(message: Message, state: FSMContext) -> None:
    """Получена геолокация → mock-геокодинг → показываем тарифы."""
    lat = message.location.latitude
    lng = message.location.longitude

    # Mock reverse-geocode (в продакшне здесь будет реальный API-запрос)
    address = f"Ваше местоположение ({lat:.4f}, {lng:.4f})"

    await state.update_data(pickup_lat=lat, pickup_lng=lng, pickup_address=address)
    await state.set_state(OrderStates.waiting_tariff)

    await message.answer(
        f"📍 <b>Точка А определена:</b>\n{address}\n\n"
        "Выберите тариф:",
        reply_markup=ReplyKeyboardRemove(),
    )
    await message.answer(
        "Доступные тарифы:",
        reply_markup=_tariff_keyboard(),
    )


@dp.message(StateFilter(OrderStates.waiting_location))
async def handle_location_text_fallback(message: Message) -> None:
    """Пользователь отправил текст вместо геопозиции."""
    await message.answer(
        "Пожалуйста, нажмите кнопку <b>«📍 Отправить мою геопозицию»</b> "
        "или выберите тариф в приложении.",
        reply_markup=_location_keyboard(),
    )


@dp.callback_query(StateFilter(OrderStates.waiting_tariff), F.data.startswith("tariff_"))
async def handle_tariff_selection(callback: CallbackQuery, state: FSMContext) -> None:
    """Пользователь выбрал тариф → создаём заказ (mock)."""
    tariff_id = callback.data.removeprefix("tariff_")
    tariff = next((t for t in TARIFF_CATALOG if t["id"] == tariff_id), None)

    if not tariff:
        await callback.answer("Неизвестный тариф", show_alert=True)
        return

    data = await state.get_data()
    driver = MOCK_DRIVERS.get(tariff_id, MOCK_DRIVERS["econom"])

    await callback.message.edit_text(
        f"✅ <b>Заказ принят!</b>\n\n"
        f"📍 Откуда: {data.get('pickup_address', '—')}\n"
        f"🚗 Тариф: {tariff['label']}\n"
        f"💰 Стоимость: <b>{tariff['price']:,} тг</b>\n\n"
        f"🔍 Ищем водителя...".replace(",", " "),
    )

    # Simulate a short "search" delay, then show the assigned driver
    await asyncio.sleep(2)

    mock_order_id = abs(hash(f"{callback.from_user.id}_{tariff_id}")) % 100_000
    await subscribe(callback.from_user.id, f"order_{mock_order_id}")

    await callback.message.answer(
        f"🎉 <b>Водитель назначен!</b>\n\n"
        f"👤 Водитель: <b>{driver['name']}</b>\n"
        f"🚗 Автомобиль: <b>{driver['car']}</b>\n"
        f"🔢 Госномер: <b>{driver['plate']}</b>\n\n"
        f"⏱ Прибудет примерно через <b>{driver['eta']} мин</b>.\n\n"
        f"Номер заказа: <code>#{mock_order_id}</code>\n"
        "Команда /status покажет текущий статус."
    )

    await state.clear()
    await callback.answer()


# ── /status ───────────────────────────────────────────────────────────────────

@dp.message(Command("status"))
async def handle_status(message: Message) -> None:
    """/status — mock-статус текущего заказа."""
    # In production this would query the backend for the user's latest order.
    await message.answer(
        "🚗 <b>Ваш заказ в пути</b>\n\n"
        "Автомобиль: <b>Toyota Camry (белая)</b>\n"
        "Госномер: <b>777 ANA 18</b>\n"
        "Водитель: <b>Айдос С.</b>\n\n"
        "⏱ Прибудет через <b>~3 минуты</b>\n\n"
        "Следите за машиной в приложении 👇",
        reply_markup=_web_app_keyboard(),
    )


# ── Entry point ───────────────────────────────────────────────────────────────

async def _setup_menu_button() -> None:
    """
    Configure the persistent Menu button in every chat to open the Mini App.

    This is a global default — it sets the button for all chats where the bot
    has not been given an individual override.
    """
    try:
        await bot.set_chat_menu_button(
            menu_button=MenuButtonWebApp(
                text="🚕 Заказать такси",
                web_app=WebAppInfo(url=WEB_APP_URL),
            )
        )
        logger.info("Menu button set → %s", WEB_APP_URL)
    except Exception as exc:
        logger.warning("Could not set menu button: %s", exc)


async def main() -> None:
    await init_db()
    await _setup_menu_button()
    asyncio.create_task(retargeting_loop(bot))
    logger.info("Starting polling…")
    await dp.start_polling(
        bot,
        allowed_updates=["message", "callback_query"],
    )


if __name__ == "__main__":
    asyncio.run(main())
