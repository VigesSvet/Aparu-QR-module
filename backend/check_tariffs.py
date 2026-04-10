"""Check what the API actually returns for tariffs."""
import asyncio
import os, sys
sys.path.insert(0, os.path.dirname(__file__))
sys.stdout.reconfigure(encoding='utf-8')

from app.models.tariff import Tariff, TariffPeriod
from app.schemas.tariffs import TariffOut
from sqlalchemy import select
from app.database import async_session

async def run():
    async with async_session() as db:
        result = await db.execute(
            select(Tariff)
            .where(Tariff.is_active == True)
            .order_by(Tariff.period, Tariff.name, Tariff.base_price)
        )
        tariffs = result.scalars().all()
        print(f"Found {len(tariffs)} tariffs\n")
        
        for t in tariffs:
            out = TariffOut.model_validate(t)
            print(f"Pydantic output: id={out.id}, name={out.name}, period={out.period!r}, period_type={type(out.period).__name__}")
            d = out.model_dump()
            print(f"  model_dump: period={d['period']!r}, type={type(d['period']).__name__}")
            d_json = out.model_dump(mode='json')
            print(f"  model_dump(json): period={d_json['period']!r}, type={type(d_json['period']).__name__}")
            print()

asyncio.run(run())
