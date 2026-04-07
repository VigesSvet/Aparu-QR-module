"""
Drivers router.

Driver: GET /me profile, PATCH /me/online toggle
Admin:  GET list of all drivers
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.auth.security import get_current_user, require_role
from app.database import get_db
from app.models.user import DriverProfile, User, UserRole
from app.schemas.auth import DriverProfileOut, UserWithProfileOut

router = APIRouter(prefix="/api/v1/drivers", tags=["Drivers"])


@router.get("/me", response_model=UserWithProfileOut)
async def driver_me(
    driver: User = Depends(require_role(UserRole.driver)),
):
    """Driver — get own profile."""
    return UserWithProfileOut.model_validate(driver)


@router.patch("/me/online", response_model=DriverProfileOut)
async def toggle_online(
    db: AsyncSession = Depends(get_db),
    driver: User = Depends(require_role(UserRole.driver)),
):
    """Driver — toggle online/offline status."""
    if not driver.driver_profile:
        raise HTTPException(status_code=404, detail="Driver profile not found")
    driver.driver_profile.is_online = not driver.driver_profile.is_online
    await db.commit()
    await db.refresh(driver.driver_profile)
    return DriverProfileOut.model_validate(driver.driver_profile)


@router.get("", response_model=list[UserWithProfileOut])
async def list_drivers(
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_role(UserRole.admin)),
):
    """Admin — list all drivers."""
    result = await db.execute(
        select(User)
        .options(selectinload(User.driver_profile))
        .where(User.role == UserRole.driver)
        .order_by(User.id)
    )
    return [UserWithProfileOut.model_validate(u) for u in result.scalars().all()]
