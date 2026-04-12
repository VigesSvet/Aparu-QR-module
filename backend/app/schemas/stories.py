"""Pydantic schemas for Stories."""

from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel


class StoryOut(BaseModel):
    id: int
    filename: str
    sort_order: int
    is_active: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class StoryReorderItem(BaseModel):
    id: int
    sort_order: int


class StoryReorderRequest(BaseModel):
    items: list[StoryReorderItem]
