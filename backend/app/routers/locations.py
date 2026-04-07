"""
QR Locations router.

Public: GET list, GET by id
Admin:  POST create, PATCH update, DELETE
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.security import require_role
from app.database import get_db
from app.models.location import QRLocation
from app.models.user import User, UserRole
from app.schemas.locations import LocationCreate, LocationOut, LocationUpdate

router = APIRouter(prefix="/api/v1/locations", tags=["Locations"])


@router.get("", response_model=list[LocationOut])
async def list_locations(db: AsyncSession = Depends(get_db)):
    """Public — list all active QR locations."""
    result = await db.execute(
        select(QRLocation).where(QRLocation.is_active == True).order_by(QRLocation.id)  # noqa: E712
    )
    return [LocationOut.model_validate(loc) for loc in result.scalars().all()]


@router.get("/{location_id}", response_model=LocationOut)
async def get_location(location_id: int, db: AsyncSession = Depends(get_db)):
    """Public — get location by ID (used after QR scan)."""
    result = await db.execute(select(QRLocation).where(QRLocation.id == location_id))
    loc = result.scalar_one_or_none()
    if not loc:
        raise HTTPException(status_code=404, detail="Location not found")
    return LocationOut.model_validate(loc)


@router.post("", response_model=LocationOut, status_code=status.HTTP_201_CREATED)
async def create_location(
    body: LocationCreate,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_role(UserRole.admin)),
):
    """Admin — create a new QR location."""
    loc = QRLocation(**body.model_dump())
    db.add(loc)
    await db.commit()
    await db.refresh(loc)
    return LocationOut.model_validate(loc)


@router.patch("/{location_id}", response_model=LocationOut)
async def update_location(
    location_id: int,
    body: LocationUpdate,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_role(UserRole.admin)),
):
    """Admin — update location."""
    result = await db.execute(select(QRLocation).where(QRLocation.id == location_id))
    loc = result.scalar_one_or_none()
    if not loc:
        raise HTTPException(status_code=404, detail="Location not found")

    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(loc, field, value)

    await db.commit()
    await db.refresh(loc)
    return LocationOut.model_validate(loc)


@router.delete("/{location_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_location(
    location_id: int,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_role(UserRole.admin)),
):
    """Admin — soft-delete location."""
    result = await db.execute(select(QRLocation).where(QRLocation.id == location_id))
    loc = result.scalar_one_or_none()
    if not loc:
        raise HTTPException(status_code=404, detail="Location not found")
    loc.is_active = False
    await db.commit()
