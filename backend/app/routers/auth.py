"""
Auth router — phone-based verification.

POST /api/v1/auth/send-code   → send mock SMS
POST /api/v1/auth/verify-code → verify code, return token
GET  /api/v1/auth/me          → current user
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.auth.security import (
    check_code,
    create_token,
    get_current_user,
    normalize_phone,
    store_code,
)
from app.database import get_db
from app.models.user import User, UserRole
from app.schemas.auth import (
    AuthResponse,
    SendCodeRequest,
    SendCodeResponse,
    UserOut,
    UserWithProfileOut,
    VerifyCodeRequest,
)

router = APIRouter(prefix="/api/v1/auth", tags=["Auth"])


@router.post("/send-code", response_model=SendCodeResponse)
async def send_code(body: SendCodeRequest):
    """Send a mock SMS verification code (always 1234)."""
    code = store_code(body.phone)
    return SendCodeResponse(message="SMS code sent", code=code)


@router.post("/verify-code", response_model=AuthResponse)
async def verify_code(body: VerifyCodeRequest, db: AsyncSession = Depends(get_db)):
    """Verify the SMS code and return auth token."""
    if not check_code(body.phone, body.code):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid verification code",
        )

    phone_digits = normalize_phone(body.phone)

    # Find or auto-create user
    result = await db.execute(
        select(User)
        .options(selectinload(User.driver_profile))
        .where(User.phone == phone_digits)
    )
    user = result.scalar_one_or_none()

    if not user:
        # Auto-register as regular user
        user = User(
            phone=phone_digits,
            name=f"Пользователь",
            role=UserRole.user,
        )
        db.add(user)
        await db.commit()
        await db.refresh(user)

    token = create_token(user.id, user.role.value)
    return AuthResponse(
        token=token,
        user=UserOut.model_validate(user),
    )


@router.get("/me", response_model=UserWithProfileOut)
async def me(user: User = Depends(get_current_user)):
    """Get current authenticated user."""
    return UserWithProfileOut.model_validate(user)
