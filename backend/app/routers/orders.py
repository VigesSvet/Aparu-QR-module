"""
Orders router.

User:   POST create, GET list (own), GET detail, PATCH cancel
Driver: GET available, PATCH assign, PATCH status
Admin:  GET all orders
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.auth.security import get_current_user, require_role
from app.database import get_db
from app.models.order import Order, OrderStatus
from app.models.tariff import Tariff
from app.models.location import QRLocation
from app.models.user import User, UserRole
from app.schemas.orders import OrderCreate, OrderOut, OrderStatusUpdate

router = APIRouter(prefix="/api/v1/orders", tags=["Orders"])


def _order_to_out(order: Order) -> OrderOut:
    """Convert Order ORM to OrderOut with nested names."""
    return OrderOut(
        id=order.id,
        user_id=order.user_id,
        driver_id=order.driver_id,
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
        driver_name=order.driver.name if order.driver else None,
        location_name=order.qr_location.name if order.qr_location else None,
        tariff_name=order.tariff.name if order.tariff else None,
    )


def _order_query():
    return (
        select(Order)
        .options(
            selectinload(Order.user),
            selectinload(Order.driver),
            selectinload(Order.qr_location),
            selectinload(Order.tariff),
        )
    )


# ── Create order (user) ─────────────────────────────────


@router.post("", response_model=OrderOut, status_code=status.HTTP_201_CREATED)
async def create_order(
    body: OrderCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """User — create a new taxi order."""
    # Validate location
    loc = await db.get(QRLocation, body.qr_location_id)
    if not loc:
        raise HTTPException(status_code=404, detail="Location not found")

    # Validate tariff
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

    # Reload with relationships
    result = await db.execute(_order_query().where(Order.id == order.id))
    order = result.scalar_one()
    return _order_to_out(order)


# ── List orders ──────────────────────────────────────────


@router.get("", response_model=list[OrderOut])
async def list_orders(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """List orders filtered by role: admin sees all, driver sees available + own, user sees own."""
    q = _order_query()

    if user.role == UserRole.admin:
        q = q.order_by(Order.created_at.desc())
    elif user.role == UserRole.driver:
        q = q.where(
            (Order.driver_id == user.id)
            | (Order.status == OrderStatus.searching)
        ).order_by(Order.created_at.desc())
    else:
        q = q.where(Order.user_id == user.id).order_by(Order.created_at.desc())

    result = await db.execute(q)
    return [_order_to_out(o) for o in result.scalars().all()]


# ── Get single order ─────────────────────────────────────


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

    # Access check
    if user.role == UserRole.user and order.user_id != user.id:
        raise HTTPException(status_code=403, detail="Not your order")
    if user.role == UserRole.driver and order.driver_id != user.id and order.status != OrderStatus.searching:
        raise HTTPException(status_code=403, detail="Not your order")

    return _order_to_out(order)


# ── Driver assigns himself ───────────────────────────────


@router.patch("/{order_id}/assign", response_model=OrderOut)
async def assign_order(
    order_id: int,
    db: AsyncSession = Depends(get_db),
    driver: User = Depends(require_role(UserRole.driver)),
):
    """Driver takes an available order."""
    result = await db.execute(_order_query().where(Order.id == order_id))
    order = result.scalar_one_or_none()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    if order.status != OrderStatus.searching:
        raise HTTPException(status_code=400, detail="Order already taken")

    order.driver_id = driver.id
    order.status = OrderStatus.assigned
    await db.commit()
    await db.refresh(order)

    result = await db.execute(_order_query().where(Order.id == order.id))
    order = result.scalar_one()
    return _order_to_out(order)


# ── Update order status ─────────────────────────────────


DRIVER_TRANSITIONS = {
    OrderStatus.assigned: [OrderStatus.driving],
    OrderStatus.driving: [OrderStatus.arrived],
    OrderStatus.arrived: [OrderStatus.completed],
}

USER_TRANSITIONS = {
    OrderStatus.searching: [OrderStatus.cancelled],
    OrderStatus.assigned: [OrderStatus.cancelled],
}


@router.patch("/{order_id}/status", response_model=OrderOut)
async def update_order_status(
    order_id: int,
    body: OrderStatusUpdate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Update order status. Drivers advance forward, users can cancel."""
    result = await db.execute(_order_query().where(Order.id == order_id))
    order = result.scalar_one_or_none()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    try:
        new_status = OrderStatus(body.status)
    except ValueError:
        raise HTTPException(status_code=400, detail=f"Invalid status: {body.status}")

    if user.role == UserRole.driver:
        if order.driver_id != user.id:
            raise HTTPException(status_code=403, detail="Not your order")
        allowed = DRIVER_TRANSITIONS.get(order.status, [])
        if new_status not in allowed:
            raise HTTPException(
                status_code=400,
                detail=f"Cannot transition from {order.status.value} to {new_status.value}",
            )
    elif user.role == UserRole.user:
        if order.user_id != user.id:
            raise HTTPException(status_code=403, detail="Not your order")
        allowed = USER_TRANSITIONS.get(order.status, [])
        if new_status not in allowed:
            raise HTTPException(
                status_code=400,
                detail=f"Cannot transition from {order.status.value} to {new_status.value}",
            )
    elif user.role == UserRole.admin:
        pass  # admin can set any status
    else:
        raise HTTPException(status_code=403, detail="Forbidden")

    order.status = new_status
    await db.commit()

    result = await db.execute(_order_query().where(Order.id == order.id))
    order = result.scalar_one()
    return _order_to_out(order)
