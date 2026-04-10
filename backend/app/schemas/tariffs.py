"""Tariff-related Pydantic schemas."""

from __future__ import annotations

from pydantic import BaseModel, Field

from app.models.tariff import TariffPeriod


class TariffCreate(BaseModel):
    name: str = Field(..., max_length=50)
    period: TariffPeriod = TariffPeriod.day
    base_price: float = Field(..., gt=0)
    included_distance_km: float = Field(default=0, ge=0)
    price_per_km: float = Field(default=0, ge=0)
    time_threshold_minutes: float = Field(default=12, ge=0)
    price_per_minute: float = Field(default=20, ge=0)
    free_waiting_minutes: float = Field(default=3, ge=0)
    waiting_price_per_minute: float = Field(default=30, ge=0)
    currency: str = Field(default="тг", max_length=10)
    description: str = Field(default="", max_length=200)


class TariffUpdate(BaseModel):
    name: str | None = None
    period: TariffPeriod | None = None
    base_price: float | None = None
    included_distance_km: float | None = None
    price_per_km: float | None = None
    time_threshold_minutes: float | None = None
    price_per_minute: float | None = None
    free_waiting_minutes: float | None = None
    waiting_price_per_minute: float | None = None
    currency: str | None = None
    description: str | None = None
    is_active: bool | None = None


class TariffOut(BaseModel):
    id: int
    name: str
    period: TariffPeriod
    base_price: float
    included_distance_km: float
    price_per_km: float
    time_threshold_minutes: float
    price_per_minute: float
    free_waiting_minutes: float
    waiting_price_per_minute: float
    currency: str
    description: str
    is_active: bool

    model_config = {"from_attributes": True}
