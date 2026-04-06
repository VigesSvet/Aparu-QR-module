"""
Pydantic schemas for the Maps API (geocode, reverse-geocode, route, tiles).
"""

from __future__ import annotations

from pydantic import BaseModel, Field


# ── Forward Geocoding ────────────────────────────────────


class GeocodeRequest(BaseModel):
    """POST /api/v1/maps/geocode — request body."""

    text: str = Field(..., max_length=150, description="Search text, up to 150 chars")
    latitude: float = Field(..., ge=-90, le=90, description="Latitude for proximity bias")
    longitude: float = Field(..., ge=-180, le=180, description="Longitude for proximity bias")
    withCities: bool = Field(True, description="Include cities in results")


class GeocodeResultItem(BaseModel):
    address: str
    additionalInfo: str
    latitude: float
    longitude: float
    type: str  # s | h | o | c


class GeocodeResponse(BaseModel):
    results: list[GeocodeResultItem]


# ── Reverse Geocoding ────────────────────────────────────


class ReverseGeocodeRequest(BaseModel):
    """POST /api/v1/maps/reverse-geocode — request body."""

    latitude: float = Field(..., ge=-90, le=90)
    longitude: float = Field(..., ge=-180, le=180)


class Locality(BaseModel):
    localityId: int
    name: str
    latitude: float
    longitude: float


class ReverseGeocodeResponse(BaseModel):
    placeName: str
    areaName: str
    accuratePlace: bool
    locality: Locality | None = None


# ── Routing ──────────────────────────────────────────────


class RoutePoint(BaseModel):
    latitude: float = Field(..., ge=-90, le=90)
    longitude: float = Field(..., ge=-180, le=180)


class RouteRequest(BaseModel):
    """POST /api/v1/maps/route — request body."""

    points: list[RoutePoint] = Field(..., min_length=2, description="At least 2 points")


class RouteInstruction(BaseModel):
    distance: float
    time: float
    text: str
    streetName: str
    sign: int
    interval: list[int]


class RouteResponse(BaseModel):
    distance: float
    time: float
    coordinates: list[list[float]]
    bbox: list[float]
    instructions: list[RouteInstruction]


class RouteErrorResponse(BaseModel):
    code: str
    message: str


# ── Tiles ────────────────────────────────────────────────


class TilesConfigResponse(BaseModel):
    tileUrlTemplate: str
    format: str
    minZoom: int
    maxZoom: int
