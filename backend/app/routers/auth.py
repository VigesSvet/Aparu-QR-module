"""Auth router for phone-based verification."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

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
    VerifyCodeRequest,
)

router = APIRouter(prefix="/api/v1/auth", tags=["Auth"])


@router.post("/send-code", response_model=SendCodeResponse)
async def send_code(body: SendCodeRequest, db: AsyncSession = Depends(get_db)):
    """Generate a mock SMS verification code and return it in the response."""
    code = await store_code(db, body.phone)
    return SendCodeResponse(message="SMS code sent", code=code)


@router.post("/verify-code", response_model=AuthResponse)
async def verify_code(body: VerifyCodeRequest, db: AsyncSession = Depends(get_db)):
    """Verify the SMS code and return auth token."""
    if not await check_code(db, body.phone, body.code):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Неверный код подтверждения",
        )

    phone_digits = normalize_phone(body.phone)
    result = await db.execute(select(User).where(User.phone == phone_digits))
    user = result.scalar_one_or_none()

    if not user:
        user = User(
            phone=phone_digits,
            name="Пользователь",
            role=UserRole.user,
        )
        db.add(user)
        await db.commit()
        await db.refresh(user)

    token = create_token(user.id, user.role.value)
    return AuthResponse(token=token, user=UserOut.model_validate(user))


@router.get("/me", response_model=UserOut)
async def me(user: User = Depends(get_current_user)):
    """Get current authenticated user."""
    return UserOut.model_validate(user)
