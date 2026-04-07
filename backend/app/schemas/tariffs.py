"""Tariff-related Pydantic schemas."""

from __future__ import annotations

from pydantic import BaseModel, Field


class TariffCreate(BaseModel):
    name: str = Field(..., max_length=50)
    base_price: float = Field(..., gt=0)
    currency: str = Field(default="₸", max_length=10)
    description: str = Field(default="", max_length=200)


class TariffUpdate(BaseModel):
    name: str | None = None
    base_price: float | None = None
    currency: str | None = None
    description: str | None = None
    is_active: bool | None = None


class TariffOut(BaseModel):
    id: int
    name: str
    base_price: float
    currency: str
    description: str
    is_active: bool

    model_config = {"from_attributes": True}
