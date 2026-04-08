"""Location-related Pydantic schemas."""

from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, Field


class LocationCreate(BaseModel):
    latitude: float = Field(..., ge=-90, le=90)
    longitude: float = Field(..., ge=-180, le=180)


class LocationUpdate(BaseModel):
    latitude: float | None = None
    longitude: float | None = None
    is_active: bool | None = None


class LocationOut(BaseModel):
    id: int
    latitude: float
    longitude: float
    is_active: bool
    created_at: datetime

    model_config = {"from_attributes": True}
