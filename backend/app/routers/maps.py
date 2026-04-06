"""
Maps API router.

Proxies requests to Aparu Maps API:
  - POST /api/v1/maps/geocode
  - POST /api/v1/maps/reverse-geocode
  - POST /api/v1/maps/route
  - GET  /api/v1/maps/tiles
  - GET  /api/v1/maps/tiles/config
  - GET  /api/v1/maps/style
"""

from __future__ import annotations

from fastapi import APIRouter

from app.schemas.maps import (
    GeocodeRequest,
    GeocodeResponse,
    ReverseGeocodeRequest,
    ReverseGeocodeResponse,
    RouteErrorResponse,
    RouteRequest,
    RouteResponse,
    TilesConfigResponse,
)
from app.services import maps_service

router = APIRouter(prefix="/api/v1/maps", tags=["Maps"])


# ── Forward Geocoding ────────────────────────────────────


@router.post(
    "/geocode",
    response_model=GeocodeResponse,
    summary="Forward geocoding — search address by text",
    description=(
        "Searches addresses by text query with proximity bias "
        "towards the given coordinates."
    ),
)
async def geocode(body: GeocodeRequest):
    data = await maps_service.geocode(
        text=body.text,
        latitude=body.latitude,
        longitude=body.longitude,
        with_cities=body.withCities,
    )
    return data


# ── Reverse Geocoding ────────────────────────────────────


@router.post(
    "/reverse-geocode",
    response_model=ReverseGeocodeResponse,
    summary="Reverse geocoding — address by coordinates",
    description=(
        "Determines address, area and nearest locality "
        "from latitude / longitude."
    ),
)
async def reverse_geocode(body: ReverseGeocodeRequest):
    data = await maps_service.reverse_geocode(
        latitude=body.latitude,
        longitude=body.longitude,
    )
    return data


# ── Routing ──────────────────────────────────────────────


@router.post(
    "/route",
    response_model=RouteResponse,
    responses={400: {"model": RouteErrorResponse}},
    summary="Build a driving route",
    description="Builds a driving route between 2 or more points.",
)
async def build_route(body: RouteRequest):
    points = [p.model_dump() for p in body.points]
    data = await maps_service.build_route(points)
    return data


# ── Tiles & Map Style ───────────────────────────────────


@router.get(
    "/tiles",
    response_model=TilesConfigResponse,
    summary="Get tile configuration",
    description="Returns tile URL template and zoom range for vector PBF tiles.",
)
async def get_tiles_config():
    return await maps_service.get_tiles_config()


@router.get(
    "/tiles/config",
    summary="Get TileJSON metadata",
    description="Returns full TileJSON 2.0.0 metadata with layer info.",
)
async def get_tiles_json():
    return await maps_service.get_tiles_json()


@router.get(
    "/style",
    summary="Get map style (style.json)",
    description=(
        "Returns a MapLibre GL JS / Mapbox GL JS compatible style JSON."
    ),
)
async def get_map_style():
    return await maps_service.get_map_style()
