"""
Simplified phone-based auth backed by SQLite.

Flow:
1. POST /auth/send-code   { phone }        -> stores a generated mock code
2. POST /auth/verify-code { phone, code }  -> returns user + session token
3. GET  /auth/me (Authorization: Bearer <token>) -> current user

Token is a simple base64-encoded JSON with user_id - no JWT needed.
"""

from __future__ import annotations

import base64
import json
import secrets
from datetime import datetime, timedelta, timezone

from fastapi import Depends, Header, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.user import User, UserRole
from app.models.verification_code import VerificationCode

CODE_LENGTH = 4
CODE_TTL_MINUTES = 5
MAX_CODE_ATTEMPTS = 5
ACTIVE_CODE_SPACE = {
    f"{number:0{CODE_LENGTH}d}"
    for number in range(10 ** (CODE_LENGTH - 1), 10 ** CODE_LENGTH)
}


def normalize_phone(raw: str) -> str:
    """Strip everything except digits from a phone number."""
    return "".join(c for c in raw if c.isdigit())


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


async def _generate_code(db: AsyncSession, previous_code: str | None = None) -> str:
    """Generate a 4-digit code unique among active codes and different from the last one."""
    now = _utcnow()
    active_codes_query = await db.execute(
        select(VerificationCode.code).where(
            VerificationCode.used_at.is_(None),
            VerificationCode.expires_at > now,
        )
    )
    busy_codes = set(active_codes_query.scalars().all())
    if previous_code:
        busy_codes.add(previous_code)

    available_codes = list(ACTIVE_CODE_SPACE - busy_codes)
    if not available_codes:
        raise RuntimeError("No verification codes available")

    return available_codes[secrets.randbelow(len(available_codes))]


async def store_code(db: AsyncSession, phone: str) -> str:
    """Store a generated verification code in the database and return it."""
    normalized_phone = normalize_phone(phone)
    now = _utcnow()

    latest_query = await db.execute(
        select(VerificationCode)
        .where(VerificationCode.phone == normalized_phone)
        .order_by(VerificationCode.created_at.desc())
        .limit(1)
    )
    latest_code = latest_query.scalar_one_or_none()

    active_codes_query = await db.execute(
        select(VerificationCode).where(
            VerificationCode.phone == normalized_phone,
            VerificationCode.used_at.is_(None),
            VerificationCode.expires_at > now,
        )
    )
    for active_code in active_codes_query.scalars():
        active_code.used_at = now

    code = await _generate_code(db, latest_code.code if latest_code else None)
    db.add(
        VerificationCode(
            phone=normalized_phone,
            code=code,
            expires_at=now + timedelta(minutes=CODE_TTL_MINUTES),
        )
    )
    await db.commit()
    return code


async def check_code(db: AsyncSession, phone: str, code: str) -> bool:
    """Validate the latest active verification code for a phone number."""
    normalized_phone = normalize_phone(phone)
    now = _utcnow()

    verification_query = await db.execute(
        select(VerificationCode)
        .where(
            VerificationCode.phone == normalized_phone,
            VerificationCode.used_at.is_(None),
            VerificationCode.expires_at > now,
        )
        .order_by(VerificationCode.created_at.desc())
        .limit(1)
    )
    stored = verification_query.scalar_one_or_none()
    if not stored:
        return False

    if stored.code == code:
        stored.used_at = now
        await db.commit()
        return True

    stored.attempts += 1
    if stored.attempts >= MAX_CODE_ATTEMPTS:
        stored.used_at = now
    await db.commit()
    return False


def create_token(user_id: int, role: str) -> str:
    payload = json.dumps({"user_id": user_id, "role": role})
    return base64.urlsafe_b64encode(payload.encode()).decode()


def decode_token(token: str) -> dict:
    try:
        payload = base64.urlsafe_b64decode(token.encode()).decode()
        return json.loads(payload)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token",
        ) from exc


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
        select(User).where(User.id == user_id, User.is_active == True)  # noqa: E712
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
