"""
Seeder script — populates the database with test data.

Run:
    cd backend
    python seed.py

Creates:
  - 3 users: admin, driver, user
  - 1 driver profile
  - 3 QR locations
  - 3 tariffs
"""

from __future__ import annotations

import asyncio
import sys
import os

# Ensure the backend dir is on the path
sys.path.insert(0, os.path.dirname(__file__))

from app.database import engine, async_session
from app.models.user import User, UserRole, DriverProfile
from app.models.location import QRLocation
from app.models.tariff import Tariff


USERS = [
    {
        "phone": "77000000001",
        "name": "Админ Апару",
        "role": UserRole.admin,
    },
    {
        "phone": "77000000002",
        "name": "Алибек С.",
        "role": UserRole.driver,
    },
    {
        "phone": "77000000003",
        "name": "Мария К.",
        "role": UserRole.user,
    },
]

DRIVER_PROFILE = {
    "car_model": "Toyota Camry",
    "car_color": "белый",
    "plate_number": "A 123 BC",
    "rating": 4.9,
    "is_online": True,
}

# Точки А — Усть-Каменогорск (только координаты, название берётся через reverse geocoding)
LOCATIONS = [
    {"latitude": 49.942906, "longitude": 82.625514},  # ADK River, ул. Казахстан, 62
    {"latitude": 49.919752, "longitude": 82.627924},  # Maxi Mall, пр. Сатпаева, 51
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


async def seed():
    print("🌱  Resetting database...")
    from app.models.base import Base
    import app.models  # noqa: F401
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
        await conn.run_sync(Base.metadata.create_all)

    async with async_session() as db:

        # Users
        print("👤  Creating users...")
        user_objects = []
        for u in USERS:
            user = User(**u)
            db.add(user)
            user_objects.append(user)
        await db.flush()

        # Driver profile
        driver_user = next(u for u in user_objects if u.role == UserRole.driver)
        print(f"🚗  Creating driver profile for {driver_user.name}...")
        profile = DriverProfile(user_id=driver_user.id, **DRIVER_PROFILE)
        db.add(profile)

        # Locations
        print("📍  Creating QR locations...")
        for loc_data in LOCATIONS:
            db.add(QRLocation(**loc_data))

        # Tariffs
        print("💰  Creating tariffs...")
        for t_data in TARIFFS:
            db.add(Tariff(**t_data))

        await db.commit()

    print()
    print("✅  Seed completed! Test accounts:")
    print("─" * 50)
    print(f"  Админ    :  +7 (700) 000-00-01  (код: 1234)")
    print(f"  Водитель :  +7 (700) 000-00-02  (код: 1234)")
    print(f"  Юзер     :  +7 (700) 000-00-03  (код: 1234)")
    print("─" * 50)


if __name__ == "__main__":
    asyncio.run(seed())
