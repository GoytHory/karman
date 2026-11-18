"""Настройки пользователя и состояние сервиса."""

from __future__ import annotations

import shutil

from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import current_user, user_settings
from app.config import get_settings
from app.db import get_session
from app.models import Playlist, User, Video
from app.schemas import SettingsIn

router = APIRouter(prefix="/api", tags=["settings"])


def _payload(settings) -> dict:  # type: ignore[no-untyped-def]
    return {
        "retention_unwatched_days": settings.retention_unwatched_days,
        "retention_watched_days": settings.retention_watched_days,
        "default_poll_minutes": settings.default_poll_minutes,
    }


@router.get("/settings")
async def get_settings_endpoint(
    user: User = Depends(current_user),
    session: AsyncSession = Depends(get_session),
) -> dict:
    return _payload(await user_settings(session, user))


@router.put("/settings")
async def update_settings(
    body: SettingsIn,
    user: User = Depends(current_user),
    session: AsyncSession = Depends(get_session),
) -> dict:
    settings = await user_settings(session, user)
    settings.retention_unwatched_days = body.retention_unwatched_days
    settings.retention_watched_days = body.retention_watched_days
    settings.default_poll_minutes = body.default_poll_minutes
    await session.commit()
    return _payload(settings)


@router.get("/status")
async def status(
    user: User = Depends(current_user),
    session: AsyncSession = Depends(get_session),
) -> dict:
    rows = (await session.execute(
        select(
            Video.status,
            func.count(Video.id),
        )
        .join(Playlist, Playlist.id == Video.playlist_id)
        .where((Playlist.user_id == user.id) | (Playlist.is_hidden.is_(False)))
        .group_by(Video.status)
    )).all()
    counts = {status: int(count) for status, count in rows}
    settings = get_settings()
    free = total = 0
    try:
        usage = shutil.disk_usage(settings.video_root)
        free, total = usage.free, usage.total
    except OSError:
        pass
    return {
        "app": settings.app_name,
        "counts": counts,
        "videos_root": str(settings.video_root),
        "disk_free": free,
        "disk_total": total,
    }
