"""
Tariffs router.

Public: GET list
Admin:  POST create, PATCH update, DELETE
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.security import require_role
from app.database import get_db
from app.models.tariff import Tariff
from app.models.user import User, UserRole
from app.schemas.tariffs import TariffCreate, TariffOut, TariffUpdate

router = APIRouter(prefix="/api/v1/tariffs", tags=["Tariffs"])


@router.get("", response_model=list[TariffOut])
async def list_tariffs(db: AsyncSession = Depends(get_db)):
    """Public — list all active tariffs."""
    result = await db.execute(
        select(Tariff)
        .where(Tariff.is_active == True)  # noqa: E712
        .order_by(Tariff.period, Tariff.name, Tariff.base_price)
    )
    return [TariffOut.model_validate(t) for t in result.scalars().all()]


@router.post("", response_model=TariffOut, status_code=status.HTTP_201_CREATED)
async def create_tariff(
    body: TariffCreate,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_role(UserRole.admin)),
):
    """Admin — create a new tariff."""
    tariff = Tariff(**body.model_dump())
    db.add(tariff)
    await db.commit()
    await db.refresh(tariff)
    return TariffOut.model_validate(tariff)


@router.patch("/{tariff_id}", response_model=TariffOut)
async def update_tariff(
    tariff_id: int,
    body: TariffUpdate,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_role(UserRole.admin)),
):
    """Admin — update tariff."""
    result = await db.execute(select(Tariff).where(Tariff.id == tariff_id))
    tariff = result.scalar_one_or_none()
    if not tariff:
        raise HTTPException(status_code=404, detail="Tariff not found")

    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(tariff, field, value)

    await db.commit()
    await db.refresh(tariff)
    return TariffOut.model_validate(tariff)


@router.delete("/{tariff_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_tariff(
    tariff_id: int,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_role(UserRole.admin)),
):
    """Admin — soft-delete tariff."""
    result = await db.execute(select(Tariff).where(Tariff.id == tariff_id))
    tariff = result.scalar_one_or_none()
    if not tariff:
        raise HTTPException(status_code=404, detail="Tariff not found")
    tariff.is_active = False
    await db.commit()
