"""
Async HTTP client for the Aparu Maps API.

All external calls go through this service so the rest of the app
never imports httpx directly.
"""

from __future__ import annotations

import httpx
from fastapi import HTTPException

from app.config import settings


_TIMEOUT = httpx.Timeout(15.0, connect=5.0)


def _headers() -> dict[str, str]:
    return {
        "Content-Type": "application/json",
        "X-Api-Key": settings.APARU_MAPS_API_KEY,
    }


def _base_url() -> str:
    return settings.APARU_MAPS_BASE_URL.rstrip("/")


# ── Forward geocoding ────────────────────────────────────


async def geocode(
    text: str,
    latitude: float,
    longitude: float,
    with_cities: bool = True,
) -> dict:
    """
    POST /api/v1/maps/geocode
    Forward geocoding — search address by text.
    """
    async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
        resp = await client.post(
            f"{_base_url()}/api/v1/maps/geocode",
            headers=_headers(),
            json={
                "text": text,
                "latitude": latitude,
                "longitude": longitude,
                "withCities": with_cities,
            },
        )

    if resp.status_code != 200:
        raise HTTPException(
            status_code=resp.status_code,
            detail=resp.text,
        )
    raw = resp.json()
    # Aparu API returns PascalCase — normalize to camelCase
    results = raw.get("Results") or raw.get("results") or []
    return {
        "results": [
            {
                "address": r.get("Address") or r.get("address") or "",
                "additionalInfo": r.get("AdditionalInfo") if r.get("AdditionalInfo") is not None else r.get("additionalInfo"),
                "latitude": r.get("Latitude") if r.get("Latitude") is not None else r.get("latitude"),
                "longitude": r.get("Longitude") if r.get("Longitude") is not None else r.get("longitude"),
                "type": r.get("Type") if r.get("Type") is not None else r.get("type"),
            }
            for r in results
        ]
    }


# ── Reverse geocoding ────────────────────────────────────


async def reverse_geocode(latitude: float, longitude: float) -> dict:
    """
    POST /api/v1/maps/reverse-geocode
    Reverse geocoding — address by coordinates.
    """
    async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
        resp = await client.post(
            f"{_base_url()}/api/v1/maps/reverse-geocode",
            headers=_headers(),
            json={"latitude": latitude, "longitude": longitude},
        )

    if resp.status_code != 200:
        raise HTTPException(
            status_code=resp.status_code,
            detail=resp.text,
        )
    raw = resp.json()
    # Aparu API returns PascalCase — normalize to camelCase
    locality = raw.get("Locality") or raw.get("locality")
    return {
        "placeName": raw.get("PlaceName") or raw.get("placeName"),
        "areaName": raw.get("AreaName") or raw.get("areaName"),
        "accuratePlace": raw.get("AccuratePlace") or raw.get("accuratePlace", False),
        "locality": {
            "localityId": locality.get("LocalityId") or locality.get("localityId"),
            "name": locality.get("Name") or locality.get("name"),
            "latitude": locality.get("Latitude") or locality.get("latitude"),
            "longitude": locality.get("Longitude") or locality.get("longitude"),
        } if locality else None,
    }


# ── Routing ──────────────────────────────────────────────


async def build_route(points: list[dict]) -> dict:
    """
    POST /api/v1/maps/route
    Build a driving route between 2+ points.
    """
    async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
        resp = await client.post(
            f"{_base_url()}/api/v1/maps/route",
            headers=_headers(),
            json={"points": points},
        )

    if resp.status_code == 400:
        body = resp.json()
        raise HTTPException(status_code=400, detail=body)

    if resp.status_code != 200:
        raise HTTPException(
            status_code=resp.status_code,
            detail=resp.text,
        )
    raw = resp.json()
    # Aparu API returns PascalCase — normalize to camelCase
    return {
        "distance": raw.get("Distance") or raw.get("distance", 0),
        "time": raw.get("Time") or raw.get("time", 0),
        "coordinates": raw.get("Coordinates") or raw.get("coordinates", []),
        "bbox": raw.get("BBox") or raw.get("bbox", []),
        "instructions": [
            {
                "distance": i.get("Distance") or i.get("distance", 0),
                "time": i.get("Time") or i.get("time", 0),
                "text": i.get("Text") or i.get("text", ""),
                "streetName": i.get("StreetName") or i.get("streetName", ""),
                "sign": i.get("Sign") if i.get("Sign") is not None else i.get("sign", 0),
                "interval": i.get("Interval") or i.get("interval", []),
            }
            for i in (raw.get("Instructions") or raw.get("instructions") or [])
        ],
    }


# ── Tiles ────────────────────────────────────────────────


async def get_tiles_config() -> dict:
    """
    GET /api/v1/maps/tiles
    Returns tile URL template and zoom range.
    """
    async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
        resp = await client.get(
            f"{_base_url()}/api/v1/maps/tiles",
            headers=_headers(),
        )

    if resp.status_code != 200:
        raise HTTPException(
            status_code=resp.status_code,
            detail=resp.text,
        )
    return resp.json()


async def get_tiles_json() -> dict:
    """
    GET /api/v1/maps/tiles/config
    Returns full TileJSON 2.0.0 metadata.
    """
    async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
        resp = await client.get(
            f"{_base_url()}/api/v1/maps/tiles/config",
            headers=_headers(),
        )

    if resp.status_code != 200:
        raise HTTPException(
            status_code=resp.status_code,
            detail=resp.text,
        )
    return resp.json()


async def get_map_style() -> dict:
    """
    GET /api/v1/maps/style
    Returns MapLibre-compatible style JSON.
    """
    async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
        resp = await client.get(
            f"{_base_url()}/api/v1/maps/style",
            headers=_headers(),
        )

    if resp.status_code != 200:
        raise HTTPException(
            status_code=resp.status_code,
            detail=resp.text,
        )
    return resp.json()
