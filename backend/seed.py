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
        "name": "Админ Апару",
        "role": UserRole.admin,
    },
    {
        "phone": "77000000003",
        "name": "Мария К.",
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
        "base_price": 800,
        "currency": "₸",
        "description": "Доступный вариант",
    },
    {
        "name": "Комфорт",
        "base_price": 1200,
        "currency": "₸",
        "description": "Просторный салон",
    },
    {
        "name": "Бизнес",
        "base_price": 2000,
        "currency": "₸",
        "description": "Премиальный автомобиль",
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
