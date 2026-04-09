"""
Aparu QR Module — FastAPI application entry-point.

Run with:
    uvicorn app.main:app --reload --port 8000
"""

from __future__ import annotations

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.database import init_db
from app.routers import maps, auth, locations, tariffs, orders


# ── Lifespan ─────────────────────────────────────────────


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup / shutdown hooks."""
    await init_db()
    yield


# ── App factory ──────────────────────────────────────────


app = FastAPI(
    title=settings.APP_TITLE,
    version=settings.APP_VERSION,
    description=(
        "Backend API for the Aparu QR taxi-ordering module.\n\n"
        "Proxies Aparu Maps API (geocode, reverse-geocode, routing, tiles) "
        "and provides business logic for orders, users, and QR locations."
    ),
    lifespan=lifespan,
)

# ── Middleware ────────────────────────────────────────────

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Routers ──────────────────────────────────────────────

app.include_router(auth.router)
app.include_router(maps.router)
app.include_router(locations.router)
app.include_router(tariffs.router)
app.include_router(orders.router)


# ── Health-check ─────────────────────────────────────────


@app.get("/health", tags=["System"])
async def health():
    """Simple liveness probe."""
    return {"status": "ok"}
