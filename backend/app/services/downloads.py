"""Очередь скачивания видео с YouTube в локальную папку."""

from __future__ import annotations

import asyncio
import logging
import time
from datetime import timedelta

from sqlalchemy import text

from app.config import get_settings
from app.db import session_scope
from app.models import Playlist, User, Video, utcnow
from app.services import files, youtube

log = logging.getLogger(__name__)

_wakeup = asyncio.Event()


def notify() -> None:
    _wakeup.set()


async def reset_stale() -> int:
    async with session_scope() as session:
        result = await session.execute(
            text("UPDATE videos SET status='pending' WHERE status='downloading'")
        )
        return result.rowcount or 0


async def _claim() -> int | None:
    now = utcnow()
    async with session_scope() as session:
        row = (await session.execute(
            text(
                "UPDATE videos SET status='downloading', progress=0, attempts=attempts+1, "
                "updated_at=:now, error=NULL "
                "WHERE id = (SELECT id FROM videos WHERE status='pending' AND reaction!='dislike' "
                "AND (retry_after IS NULL OR retry_after <= :now) ORDER BY id LIMIT 1) "
                "RETURNING id"
            ),
            {"now": now},
        )).first()
        return int(row[0]) if row else None


async def _progress(video_id: int, percent: float) -> None:
    async with session_scope() as session:
        video = await session.get(Video, video_id)
        if video is not None and video.status == "downloading":
            video.progress = max(0.0, min(100.0, percent))
            video.updated_at = utcnow()


async def _one(video_id: int) -> None:
    async with session_scope() as session:
        video = await session.get(Video, video_id)
        if video is None:
            return
        playlist = await session.get(Playlist, video.playlist_id)
        user = await session.get(User, playlist.user_id) if playlist else None
        if playlist is None or user is None or video.status != "downloading":
            return
        directory = files.playlist_path(playlist, user)
        url = video.webpage_url
        video_ref = video.video_id

    try:
        directory.mkdir(parents=True, exist_ok=True)
        last = 0.0

        async def on_progress(percent: float) -> None:
            nonlocal last
            now = time.monotonic()
            if now - last >= 1.0:
                last = now
                await _progress(video_id, percent)

        path = await youtube.download(url, video_ref, directory, on_progress)
        path = await youtube.ensure_h264(path)
        relative = path.relative_to(get_settings().video_root).as_posix()
        size = path.stat().st_size
        async with session_scope() as session:
            video = await session.get(Video, video_id)
            if video is None:
                return
            video.file_path = relative
            video.file_size = size
            video.status = "ready"
            video.progress = 100
            video.downloaded_at = utcnow()
            video.error = None
            video.retry_after = None
            playlist = await session.get(Playlist, video.playlist_id)
            user = await session.get(User, playlist.user_id) if playlist else None
            if video.reaction == "like" and playlist is not None and user is not None:
                new_path = files.move_video(video, files.saved_path(user))
                if new_path:
                    video.file_path = new_path
        log.info("видео %s скачано (%s МБ)", video_ref, round(size / 1024 / 1024, 1))
    except asyncio.CancelledError:
        raise
    except Exception as exc:  # noqa: BLE001
        log.warning("видео %s: скачивание не удалось: %s", video_ref, exc)
        async with session_scope() as session:
            video = await session.get(Video, video_id)
            if video is None:
                return
            settings = get_settings()
            if video.attempts >= settings.download_retries:
                video.status = "failed"
                video.error = str(exc)[:800]
                video.retry_after = None
            else:
                video.status = "pending"
                video.error = str(exc)[:800]
                video.retry_after = utcnow() + timedelta(seconds=min(3600, 60 * 2 ** video.attempts))
    finally:
        notify()


async def _worker() -> None:
    while True:
        try:
            video_id = await _claim()
            if video_id is None:
                try:
                    await asyncio.wait_for(_wakeup.wait(), timeout=3)
                except TimeoutError:
                    pass
                _wakeup.clear()
                continue
            await _one(video_id)
        except asyncio.CancelledError:
            raise
        except Exception:
            log.exception("очередь скачивания упала")


def start_tasks() -> list[asyncio.Task]:
    count = get_settings().max_parallel_downloads
    return [asyncio.create_task(_worker(), name=f"karman-download-{i}") for i in range(count)]
