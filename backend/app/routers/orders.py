"""
Orders router.

Order statuses are emulated automatically without driver logic.
"""

from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.auth.security import get_current_user
from app.database import get_db
from app.models.location import QRLocation
from app.models.order import Order, OrderStatus
from app.models.tariff import Tariff
from app.models.user import User, UserRole
from app.schemas.orders import OrderCreate, OrderOut, OrderStatusUpdate

router = APIRouter(prefix="/api/v1/orders", tags=["Orders"])

EMULATION_TIMELINE = (
    (5, OrderStatus.assigned),
    (15, OrderStatus.driving),
    (30, OrderStatus.arrived),
)

USER_TRANSITIONS = {
    OrderStatus.searching: [OrderStatus.cancelled],
    OrderStatus.assigned: [OrderStatus.cancelled],
    OrderStatus.driving: [OrderStatus.cancelled],
    OrderStatus.arrived: [OrderStatus.completed],
}


def _order_to_out(order: Order) -> OrderOut:
    return OrderOut(
        id=order.id,
        user_id=order.user_id,
        qr_location_id=order.qr_location_id,
        tariff_id=order.tariff_id,
        destination_address=order.destination_address,
        destination_lat=order.destination_lat,
        destination_lng=order.destination_lng,
        status=order.status.value,
        price=order.price,
        created_at=order.created_at,
        updated_at=order.updated_at,
        user_name=order.user.name if order.user else None,
        location_name=getattr(order.qr_location, "name", None),
        tariff_name=order.tariff.name if order.tariff else None,
    )


def _order_query():
    return (
        select(Order)
        .options(
            selectinload(Order.user),
            selectinload(Order.qr_location),
            selectinload(Order.tariff),
        )
    )


def _normalize_dt(value: datetime) -> datetime:
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc)


def _emulated_status(order: Order) -> OrderStatus:
    if order.status in {OrderStatus.completed, OrderStatus.cancelled}:
        return order.status

    elapsed_seconds = (datetime.now(timezone.utc) - _normalize_dt(order.created_at)).total_seconds()
    target = OrderStatus.searching
    for threshold, status_value in EMULATION_TIMELINE:
        if elapsed_seconds >= threshold:
            target = status_value
    return target


async def _apply_status_emulation(db: AsyncSession, orders: list[Order]) -> None:
    changed = False
    for order in orders:
        target = _emulated_status(order)
        if target != order.status:
            order.status = target
            changed = True

    if changed:
        await db.commit()


@router.post("", response_model=OrderOut, status_code=status.HTTP_201_CREATED)
async def create_order(
    body: OrderCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """User — create a new taxi order."""
    loc = await db.get(QRLocation, body.qr_location_id)
    if not loc:
        raise HTTPException(status_code=404, detail="Location not found")

    tariff = await db.get(Tariff, body.tariff_id)
    if not tariff:
        raise HTTPException(status_code=404, detail="Tariff not found")

    order = Order(
        user_id=user.id,
        qr_location_id=body.qr_location_id,
        tariff_id=body.tariff_id,
        destination_address=body.destination_address,
        destination_lat=body.destination_lat,
        destination_lng=body.destination_lng,
        price=tariff.base_price,
        status=OrderStatus.searching,
    )
    db.add(order)
    await db.commit()

    result = await db.execute(_order_query().where(Order.id == order.id))
    return _order_to_out(result.scalar_one())


@router.get("", response_model=list[OrderOut])
async def list_orders(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """List orders filtered by role."""
    q = _order_query()

    if user.role == UserRole.admin:
        q = q.order_by(Order.created_at.desc())
    else:
        q = q.where(Order.user_id == user.id).order_by(Order.created_at.desc())

    result = await db.execute(q)
    orders = result.scalars().all()
    await _apply_status_emulation(db, orders)
    return [_order_to_out(order) for order in orders]


@router.get("/{order_id}", response_model=OrderOut)
async def get_order(
    order_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    result = await db.execute(_order_query().where(Order.id == order_id))
    order = result.scalar_one_or_none()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    if user.role != UserRole.admin and order.user_id != user.id:
        raise HTTPException(status_code=403, detail="Not your order")

    await _apply_status_emulation(db, [order])
    return _order_to_out(order)


@router.patch("/{order_id}/status", response_model=OrderOut)
async def update_order_status(
    order_id: int,
    body: OrderStatusUpdate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Update order status in the simplified emulation flow."""
    result = await db.execute(_order_query().where(Order.id == order_id))
    order = result.scalar_one_or_none()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    if user.role != UserRole.admin and order.user_id != user.id:
        raise HTTPException(status_code=403, detail="Not your order")

    await _apply_status_emulation(db, [order])

    try:
        new_status = OrderStatus(body.status)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=f"Invalid status: {body.status}") from exc

    if user.role == UserRole.admin:
        order.status = new_status
    else:
        allowed = USER_TRANSITIONS.get(order.status, [])
        if new_status not in allowed:
            raise HTTPException(
                status_code=400,
                detail=f"Cannot transition from {order.status.value} to {new_status.value}",
            )
        order.status = new_status

    await db.commit()
    return _order_to_out(order)
