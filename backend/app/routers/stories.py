"""
Stories router.

Public: GET list (for /storis page)
Admin:  POST upload, DELETE, PATCH reorder
"""

from __future__ import annotations

import os
import uuid
from pathlib import Path

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.security import require_role
from app.database import get_db
from app.models.story import Story
from app.models.user import User, UserRole
from app.schemas.stories import StoryOut, StoryReorderRequest

router = APIRouter(prefix="/api/v1/stories", tags=["Stories"])

UPLOAD_DIR = Path("uploads/stories")
ALLOWED_TYPES = {"image/jpeg", "image/png", "image/webp", "image/gif"}
MAX_FILE_SIZE = 10 * 1024 * 1024  # 10 MB


def _ensure_upload_dir() -> None:
    UPLOAD_DIR.mkdir(parents=True, exist_ok=True)


# ── Public ────────────────────────────────────────────────


@router.get("", response_model=list[StoryOut])
async def list_stories(db: AsyncSession = Depends(get_db)):
    """Public — list active stories sorted by sort_order."""
    result = await db.execute(
        select(Story)
        .where(Story.is_active == True)  # noqa: E712
        .order_by(Story.sort_order, Story.id)
    )
    return [StoryOut.model_validate(s) for s in result.scalars().all()]


# ── Admin ─────────────────────────────────────────────────


@router.post("", response_model=StoryOut, status_code=status.HTTP_201_CREATED)
async def upload_story(
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_role(UserRole.admin)),
):
    """Admin — upload a new story image."""
    if file.content_type not in ALLOWED_TYPES:
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail=f"Unsupported file type: {file.content_type}",
        )

    contents = await file.read()
    if len(contents) > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail="File exceeds 10 MB limit",
        )

    _ensure_upload_dir()
    ext = Path(file.filename or "story.jpg").suffix.lower() or ".jpg"
    filename = f"{uuid.uuid4().hex}{ext}"
    (UPLOAD_DIR / filename).write_bytes(contents)

    # Assign sort_order = max + 1
    result = await db.execute(select(Story).order_by(Story.sort_order.desc()).limit(1))
    last = result.scalar_one_or_none()
    next_order = (last.sort_order + 1) if last else 0

    story = Story(filename=filename, sort_order=next_order)
    db.add(story)
    await db.commit()
    await db.refresh(story)
    return StoryOut.model_validate(story)


@router.delete("/{story_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_story(
    story_id: int,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_role(UserRole.admin)),
):
    """Admin — delete a story and its file."""
    result = await db.execute(select(Story).where(Story.id == story_id))
    story = result.scalar_one_or_none()
    if not story:
        raise HTTPException(status_code=404, detail="Story not found")

    file_path = UPLOAD_DIR / story.filename
    if file_path.exists():
        file_path.unlink()

    await db.delete(story)
    await db.commit()


@router.patch("/reorder", status_code=status.HTTP_204_NO_CONTENT)
async def reorder_stories(
    body: StoryReorderRequest,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_role(UserRole.admin)),
):
    """Admin — update sort_order for multiple stories at once."""
    ids = [item.id for item in body.items]
    result = await db.execute(select(Story).where(Story.id.in_(ids)))
    stories_map = {s.id: s for s in result.scalars().all()}

    for item in body.items:
        if item.id in stories_map:
            stories_map[item.id].sort_order = item.sort_order

    await db.commit()
