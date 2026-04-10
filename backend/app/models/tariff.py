"""Tariff model."""

from __future__ import annotations

import enum

from sqlalchemy import Boolean, Enum, Float, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class TariffPeriod(str, enum.Enum):
    day = "day"
    night = "night"


class Tariff(Base):
    __tablename__ = "tariffs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(50), nullable=False)
    period: Mapped[TariffPeriod] = mapped_column(
        Enum(TariffPeriod),
        default=TariffPeriod.day,
        nullable=False,
    )
    base_price: Mapped[float] = mapped_column(Float, nullable=False)
    included_distance_km: Mapped[float] = mapped_column(Float, default=0)
    price_per_km: Mapped[float] = mapped_column(Float, default=0)
    time_threshold_minutes: Mapped[float] = mapped_column(Float, default=12)
    price_per_minute: Mapped[float] = mapped_column(Float, default=20)
    free_waiting_minutes: Mapped[float] = mapped_column(Float, default=3)
    waiting_price_per_minute: Mapped[float] = mapped_column(Float, default=30)
    currency: Mapped[str] = mapped_column(String(10), default="тг")
    description: Mapped[str] = mapped_column(String(200), default="")
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
