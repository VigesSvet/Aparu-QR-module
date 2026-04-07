"""
Simplified phone-based auth.

Flow:
1. POST /auth/send-code  { phone }        → stores mock code "1234"
2. POST /auth/verify-code { phone, code }  → returns user + session token
3. GET  /auth/me  (Authorization: Bearer <token>) → current user

Token is a simple base64-encoded JSON with user_id — no JWT needed.
"""

from __future__ import annotations

import base64
import json
from datetime import datetime, timezone

from fastapi import Depends, Header, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.models.user import User, UserRole

# ── Mock verification codes store (phone → code) ─────────
_pending_codes: dict[str, str] = {}
MOCK_CODE = "1234"


def normalize_phone(raw: str) -> str:
    """Strip everything except digits from a phone number."""
    return "".join(c for c in raw if c.isdigit())


def store_code(phone: str) -> str:
    """Store a mock verification code and return it."""
    key = normalize_phone(phone)
    _pending_codes[key] = MOCK_CODE
    return MOCK_CODE


def check_code(phone: str, code: str) -> bool:
    """Validate the verification code. Always accepts '1234'."""
    key = normalize_phone(phone)
    stored = _pending_codes.get(key)
    if stored and stored == code:
        _pending_codes.pop(key, None)
        return True
    # Fallback: always accept MOCK_CODE for hackathon convenience
    if code == MOCK_CODE:
        return True
    return False


# ── Token helpers (simple base64 JSON, NOT JWT) ──────────


def create_token(user_id: int, role: str) -> str:
    payload = json.dumps({"user_id": user_id, "role": role})
    return base64.urlsafe_b64encode(payload.encode()).decode()


def decode_token(token: str) -> dict:
    try:
        payload = base64.urlsafe_b64decode(token.encode()).decode()
        return json.loads(payload)
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token",
        )


# ── FastAPI dependencies ─────────────────────────────────


async def get_current_user(
    authorization: str | None = Header(None, alias="Authorization"),
    db: AsyncSession = Depends(get_db),
) -> User:
    """Extract user from Authorization: Bearer <token> header."""
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing or invalid Authorization header",
        )
    token = authorization.split(" ", 1)[1]
    data = decode_token(token)
    user_id = data.get("user_id")
    if not user_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Bad token")

    result = await db.execute(
        select(User)
        .options(selectinload(User.driver_profile))
        .where(User.id == user_id, User.is_active == True)  # noqa: E712
    )
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")
    return user


def require_role(*roles: UserRole):
    """Return a dependency that checks the user has one of the given roles."""

    async def _check(user: User = Depends(get_current_user)) -> User:
        if user.role not in roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Requires role: {', '.join(r.value for r in roles)}",
            )
        return user

    return _check
