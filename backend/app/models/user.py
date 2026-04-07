"""User & DriverProfile models."""

from __future__ import annotations

import enum
from datetime import datetime, timezone

from sqlalchemy import Boolean, DateTime, Enum, Float, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base


class UserRole(str, enum.Enum):
    admin = "admin"
    driver = "driver"
    user = "user"


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    phone: Mapped[str] = mapped_column(String(20), unique=True, nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    role: Mapped[UserRole] = mapped_column(Enum(UserRole), nullable=False, default=UserRole.user)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
    )

    # relationships
    driver_profile: Mapped[DriverProfile | None] = relationship(
        "DriverProfile", back_populates="user", uselist=False
    )
    orders_as_user: Mapped[list] = relationship(
        "Order", back_populates="user", foreign_keys="Order.user_id"
    )
    orders_as_driver: Mapped[list] = relationship(
        "Order", back_populates="driver", foreign_keys="Order.driver_id"
    )


class DriverProfile(Base):
    __tablename__ = "driver_profiles"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id"), unique=True, nullable=False
    )
    car_model: Mapped[str] = mapped_column(String(100), nullable=False)
    car_color: Mapped[str] = mapped_column(String(50), nullable=False)
    plate_number: Mapped[str] = mapped_column(String(20), nullable=False)
    rating: Mapped[float] = mapped_column(Float, default=5.0)
    is_online: Mapped[bool] = mapped_column(Boolean, default=False)

    user: Mapped[User] = relationship("User", back_populates="driver_profile")
