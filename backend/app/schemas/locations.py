"""Location-related Pydantic schemas."""

from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, Field


class LocationCreate(BaseModel):
    name: str | None = Field(None, max_length=255)
    address: str | None = Field(None, max_length=512)
    latitude: float = Field(..., ge=-90, le=90)
    longitude: float = Field(..., ge=-180, le=180)


class LocationUpdate(BaseModel):
    name: str | None = None
    address: str | None = None
    latitude: float | None = None
    longitude: float | None = None
    is_active: bool | None = None


class LocationOut(BaseModel):
    id: int
    name: str | None = None
    address: str | None = None
    latitude: float
    longitude: float
    is_active: bool
    created_at: datetime

    model_config = {"from_attributes": True}
