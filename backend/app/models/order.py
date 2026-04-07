"""Order model."""

from __future__ import annotations

import enum
from datetime import datetime, timezone

from sqlalchemy import DateTime, Enum, Float, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base


class OrderStatus(str, enum.Enum):
    searching = "searching"
    assigned = "assigned"
    driving = "driving"
    arrived = "arrived"
    completed = "completed"
    cancelled = "cancelled"


class Order(Base):
    __tablename__ = "orders"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"), nullable=False)
    driver_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("users.id"), nullable=True)
    qr_location_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("qr_locations.id"), nullable=False
    )
    tariff_id: Mapped[int] = mapped_column(Integer, ForeignKey("tariffs.id"), nullable=False)
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

    # relationships
    user = relationship("User", back_populates="orders_as_user", foreign_keys=[user_id])
    driver = relationship("User", back_populates="orders_as_driver", foreign_keys=[driver_id])
    qr_location = relationship("QRLocation")
    tariff = relationship("Tariff")
