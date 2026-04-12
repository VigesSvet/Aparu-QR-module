"""Order model."""

from __future__ import annotations

import enum
from datetime import datetime, timezone

from sqlalchemy import DateTime, Enum, Float, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base
from app.models.tariff import TariffPeriod


class OrderStatus(str, enum.Enum):
    searching = "searching"
    assigned = "assigned"
    driving = "driving"
    arrived = "arrived"
    in_trip = "in_trip"
    completed = "completed"
    cancelled = "cancelled"


class Order(Base):
    __tablename__ = "orders"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"), nullable=False)
    qr_location_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("qr_locations.id"), nullable=False
    )
    tariff_id: Mapped[int] = mapped_column(Integer, ForeignKey("tariffs.id"), nullable=False)
    tariff_period: Mapped[TariffPeriod] = mapped_column(
        Enum(TariffPeriod),
        default=TariffPeriod.day,
        nullable=False,
    )
    destination_address: Mapped[str] = mapped_column(String(300), default="")
    destination_lat: Mapped[float | None] = mapped_column(Float, nullable=True)
    destination_lng: Mapped[float | None] = mapped_column(Float, nullable=True)
    status: Mapped[OrderStatus] = mapped_column(
        Enum(OrderStatus), default=OrderStatus.searching, nullable=False
    )
    price: Mapped[float] = mapped_column(Float, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    user = relationship("User", back_populates="orders_as_user", foreign_keys=[user_id])
    qr_location = relationship("QRLocation")
    tariff = relationship("Tariff")
