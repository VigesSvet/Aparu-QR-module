"""Auth router for phone-based verification and Telegram Mini App login."""

from __future__ import annotations

import hashlib
import hmac
import urllib.parse

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.security import (
    check_code,
    create_token,
    get_current_user,
    normalize_phone,
    store_code,
)
from app.config import settings
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


# ── Telegram initData validation ─────────────────────────────────────────────

class TgLoginRequest(BaseModel):
    init_data: str


def _validate_telegram_init_data(init_data: str, bot_token: str) -> dict:
    """
    Validate Telegram WebApp initData HMAC signature.

    Algorithm (https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app):
    1. Parse the query string.
    2. Extract and remove the 'hash' field.
    3. Sort remaining key=value pairs alphabetically, join with '\\n'.
    4. Compute HMAC-SHA256(data_check_string, key=HMAC-SHA256("WebAppData", bot_token)).
    5. Compare with the extracted hash (constant-time).

    Raises HTTPException(401) if validation fails.
    Returns the parsed data dict on success.
    """
    try:
        parsed: dict = dict(urllib.parse.parse_qsl(init_data, keep_blank_values=True))
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Malformed initData") from exc

    received_hash = parsed.pop("hash", "")
    if not received_hash:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing hash in initData")

    data_check_string = "\n".join(
        f"{k}={v}" for k, v in sorted(parsed.items())
    )

    # Derive the secret key: HMAC-SHA256("WebAppData", bot_token)
    secret_key = hmac.new(b"WebAppData", bot_token.encode("utf-8"), hashlib.sha256).digest()
    computed_hash = hmac.new(secret_key, data_check_string.encode("utf-8"), hashlib.sha256).hexdigest()

    if not hmac.compare_digest(computed_hash, received_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid initData signature")

    return parsed


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


@router.post("/tg-login", response_model=AuthResponse)
async def tg_login(body: TgLoginRequest, db: AsyncSession = Depends(get_db)):
    """
    Authenticate a Telegram Mini App user via initData HMAC validation.

    Flow:
    1. Validate the initData signature from Telegram.WebApp.initData.
    2. Extract the Telegram user object embedded in the 'user' field.
    3. Find or create a backend user with synthetic phone 'tg_{telegram_id}'.
    4. Return the same {token, user} shape as /verify-code.

    The frontend calls this once on TMA mount so subsequent API calls
    (e.g. orders.create) carry a valid Bearer token — no SMS needed.
    """
    import json as _json

    parsed = _validate_telegram_init_data(body.init_data, settings.BOT_TOKEN)

    tg_user_raw = parsed.get("user")
    if not tg_user_raw:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No user field in initData")

    try:
        tg_user: dict = _json.loads(tg_user_raw)
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Malformed user field") from exc

    telegram_id: int = tg_user.get("id")
    if not telegram_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Missing Telegram user id")

    # Synthetic phone — never displayed to the user
    synthetic_phone = f"tg{telegram_id}"

    first_name = tg_user.get("first_name", "")
    last_name = tg_user.get("last_name", "")
    display_name = f"{first_name} {last_name}".strip() or "Telegram User"

    result = await db.execute(select(User).where(User.phone == synthetic_phone))
    user = result.scalar_one_or_none()

    if not user:
        user = User(phone=synthetic_phone, name=display_name, role=UserRole.user)
        db.add(user)
        await db.commit()
        await db.refresh(user)
    elif user.name != display_name:
        # Keep name in sync if the Telegram profile changes
        user.name = display_name
        await db.commit()

    token = create_token(user.id, user.role.value)
    return AuthResponse(token=token, user=UserOut.model_validate(user))
