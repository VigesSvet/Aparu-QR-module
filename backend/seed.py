"""
Seeder script for local development.

Run:
    cd backend
    python seed.py
"""

from __future__ import annotations

import asyncio
import os
import sys

sys.path.insert(0, os.path.dirname(__file__))

from app.database import async_session, engine
from app.models.location import QRLocation
from app.models.tariff import Tariff
from app.models.user import User, UserRole


USERS = [
    {
        "phone": "77000000001",
        "name": "Админ Аparu",
        "role": UserRole.admin,
    },
    {
        "phone": "77000000002",
        "name": "Юзер Аparu",
        "role": UserRole.user,
    },
]

LOCATIONS = [
    {"latitude": 49.942906, "longitude": 82.625514},
    {"latitude": 49.919752, "longitude": 82.627924},
]

TARIFFS = [
    {
        "name": "Эконом",
        "period": "day",
        "base_price": 600,
        "included_distance_km": 2,
        "price_per_km": 90,
        "time_threshold_minutes": 12,
        "price_per_minute": 20,
        "free_waiting_minutes": 3,
        "waiting_price_per_minute": 30,
        "currency": "тг",
        "description": "Первые 2 км — 600 тг, затем 90 тг за км",
    },
    {
        "name": "Оптимал",
        "period": "day",
        "base_price": 700,
        "included_distance_km": 2,
        "price_per_km": 100,
        "time_threshold_minutes": 12,
        "price_per_minute": 20,
        "free_waiting_minutes": 3,
        "waiting_price_per_minute": 30,
        "currency": "тг",
        "description": "Первые 2 км — 700 тг, затем 100 тг за км",
    },
    {
        "name": "Комфорт",
        "period": "day",
        "base_price": 850,
        "included_distance_km": 2,
        "price_per_km": 120,
        "time_threshold_minutes": 12,
        "price_per_minute": 20,
        "free_waiting_minutes": 3,
        "waiting_price_per_minute": 30,
        "currency": "тг",
        "description": "Первые 2 км — 850 тг, затем 120 тг за км",
    },
    {
        "name": "Бизнес",
        "period": "day",
        "base_price": 1200,
        "included_distance_km": 0,
        "price_per_km": 200,
        "time_threshold_minutes": 12,
        "price_per_minute": 20,
        "free_waiting_minutes": 3,
        "waiting_price_per_minute": 30,
        "currency": "тг",
        "description": "Посадка — 1 200 тг, затем 200 тг за км",
    },
    {
        "name": "Эконом",
        "period": "night",
        "base_price": 840,
        "included_distance_km": 2,
        "price_per_km": 120,
        "time_threshold_minutes": 12,
        "price_per_minute": 24,
        "free_waiting_minutes": 3,
        "waiting_price_per_minute": 36,
        "currency": "тг",
        "description": "Ночь: первые 2 км — 840 тг, затем 120 тг за км",
    },
    {
        "name": "Оптимал",
        "period": "night",
        "base_price": 840,
        "included_distance_km": 2,
        "price_per_km": 120,
        "time_threshold_minutes": 12,
        "price_per_minute": 24,
        "free_waiting_minutes": 3,
        "waiting_price_per_minute": 36,
        "currency": "тг",
        "description": "Ночь: первые 2 км — 840 тг, затем 120 тг за км",
    },
    {
        "name": "Комфорт",
        "period": "night",
        "base_price": 1020,
        "included_distance_km": 2,
        "price_per_km": 144,
        "time_threshold_minutes": 12,
        "price_per_minute": 24,
        "free_waiting_minutes": 3,
        "waiting_price_per_minute": 36,
        "currency": "тг",
        "description": "Ночь: первые 2 км — 1 020 тг, затем 144 тг за км",
    },
    {
        "name": "Бизнес",
        "period": "night",
        "base_price": 1440,
        "included_distance_km": 0,
        "price_per_km": 240,
        "time_threshold_minutes": 12,
        "price_per_minute": 24,
        "free_waiting_minutes": 3,
        "waiting_price_per_minute": 36,
        "currency": "тг",
        "description": "Ночь: посадка — 1 440 тг, затем 240 тг за км",
    },
]


async def seed() -> None:
    print("Resetting database...")
    from app.models.base import Base
    import app.models  # noqa: F401

    async with engine.begin() as conn:
        await conn.exec_driver_sql("DROP TABLE IF EXISTS driver_profiles")
        await conn.run_sync(Base.metadata.drop_all)
        await conn.run_sync(Base.metadata.create_all)

    async with async_session() as db:
        print("Creating users...")
        for user_data in USERS:
            db.add(User(**user_data))

        print("Creating QR locations...")
        for loc_data in LOCATIONS:
            db.add(QRLocation(**loc_data))

        print("Creating tariffs...")
        for tariff_data in TARIFFS:
            db.add(Tariff(**tariff_data))

        await db.commit()

    print()
    print("Seed completed. Test accounts:")
    print("-" * 40)
    print("  Админ : +7 (700) 000-00-01")
    print("  Юзер  : +7 (700) 000-00-03")
    print("-" * 40)


if __name__ == "__main__":
    asyncio.run(seed())
