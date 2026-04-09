"""Order-related Pydantic schemas."""

from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, Field


class OrderCreate(BaseModel):
    qr_location_id: int
    tariff_id: int
    destination_address: str = ""
    destination_lat: float | None = None
    destination_lng: float | None = None


class OrderStatusUpdate(BaseModel):
    status: str = Field(..., description="New status: assigned, driving, arrived, completed, cancelled")


class OrderOut(BaseModel):
    id: int
    user_id: int
    qr_location_id: int
    tariff_id: int
    destination_address: str
    destination_lat: float | None
    destination_lng: float | None
    status: str
    price: float
    created_at: datetime
    updated_at: datetime

    # Nested info (filled via from_attributes)
    user_name: str | None = None
    location_name: str | None = None
    tariff_name: str | None = None

    model_config = {"from_attributes": True}
