"""Тела запросов и мелкие общие типы."""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field


class RegisterIn(BaseModel):
    username: str
    password: str = Field(min_length=6, max_length=200)


class LoginIn(BaseModel):
    username: str
    password: str


class PlaylistIn(BaseModel):
    url: str
    hidden: bool = False
    download_existing: bool = False
    poll_minutes: int | None = Field(default=None, ge=1, le=1440)


class PlaylistPatch(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=300)
    hidden: bool | None = None
    enabled: bool | None = None
    poll_minutes: int | None = Field(default=None, ge=1, le=1440)
    cover_last: bool | None = None


class ReactionIn(BaseModel):
    reaction: Literal["like", "dislike", "none"]


class ProgressIn(BaseModel):
    event_id: int | None = None
    position_s: float = Field(default=0, ge=0)
    duration_s: float | None = Field(default=None, ge=0)
    completed: bool = False


class SettingsIn(BaseModel):
    retention_unwatched_days: int = Field(default=7, ge=1, le=365)
    retention_watched_days: int = Field(default=1, ge=1, le=90)
    default_poll_minutes: int = Field(default=15, ge=1, le=1440)


class DeletePlaylistIn(BaseModel):
    delete_files: bool = True
