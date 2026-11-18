"""Удаление по сроку: нелайкнутое лежит N дней, досмотренное без реакции — M дней."""

from __future__ import annotations

import asyncio
import logging
from datetime import timedelta

from sqlalchemy import delete, select

from app.db import session_scope
from app.models import LoginSession, Playlist, UserSettings, Video, utcnow
from app.serializers import delete_after
from app.services import files

log = logging.getLogger(__name__)


async def run_cleanup() -> int:
    removed = 0
    now = utcnow()
    async with session_scope() as session:
        rows = (await session.execute(
            select(Video, UserSettings)
            .join(Playlist, Playlist.id == Video.playlist_id)
            .join(UserSettings, UserSettings.user_id == Playlist.user_id)
            .where(
                Video.status == "ready",
                Video.reaction == "none",
                Video.deleted_at.is_(None),
            )
        )).all()
        for video, settings in rows:
            deadline = delete_after(video, settings)
            if deadline is None or deadline > now:
                continue
            files.delete_files(video)
            video.status = "deleted"
            video.deleted_at = now
            video.delete_reason = "watched" if video.watched_at is not None else "expired"
            video.progress = 0
            removed += 1
        await session.execute(delete(LoginSession).where(LoginSession.expires_at <= now))
        await session.execute(delete(LoginSession).where(
            LoginSession.expires_at <= now + timedelta(days=1),
            LoginSession.created_at <= now - timedelta(days=60),
        ))
    if removed:
        log.info("удалено по сроку: %s видео", removed)
    return removed


async def cleanup_loop() -> None:
    while True:
        try:
            await run_cleanup()
        except asyncio.CancelledError:
            raise
        except Exception:
            log.exception("уборка по сроку упала")
        try:
            await asyncio.sleep(15 * 60)
        except asyncio.CancelledError:
            raise


def start_tasks() -> list[asyncio.Task]:
    return [asyncio.create_task(cleanup_loop(), name="karman-cleanup")]
