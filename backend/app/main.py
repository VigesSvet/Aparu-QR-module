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
from app.routers import maps


# ── Lifespan ─────────────────────────────────────────────


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup / shutdown hooks.

    Database init would go here once models are implemented.
    """
    # startup
    yield
    # shutdown


# ── App factory ──────────────────────────────────────────


app = FastAPI(
    title=settings.APP_TITLE,
    version=settings.APP_VERSION,
    description=(
        "Backend API for the Aparu QR taxi-ordering module.\n\n"
        "Proxies Aparu Maps API (geocode, reverse-geocode, routing, tiles) "
        "and will host business logic once the database layer is wired up."
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

app.include_router(maps.router)


# ── Health-check ─────────────────────────────────────────


@app.get("/health", tags=["System"])
async def health():
    """Simple liveness probe."""
    return {"status": "ok"}
