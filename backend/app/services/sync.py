"""Фоновая проверка плейлистов YouTube и добавление новых роликов в очередь скачивания."""

from __future__ import annotations

import asyncio
import logging
from datetime import timedelta

from sqlalchemy import select

from app.config import get_settings
from app.db import session_scope
from app.models import Playlist, User, Video, utcnow
from app.serializers import playlist_dir_name
from app.services import files, youtube

log = logging.getLogger(__name__)

_sync_queue: asyncio.Queue[int] = asyncio.Queue()
_scheduled: set[int] = set()
_running: set[int] = set()
_wakeup = asyncio.Event()


def request_sync(playlist_id: int) -> None:
    if playlist_id in _scheduled or playlist_id in _running:
        return
    _scheduled.add(playlist_id)
    _sync_queue.put_nowait(playlist_id)


def notify_poller() -> None:
    _wakeup.set()


async def sync_playlist(playlist_id: int) -> None:
    async with session_scope() as session:
        playlist = await session.get(Playlist, playlist_id)
        if playlist is None:
            return
        user = await session.get(User, playlist.user_id)
        if user is None:
            return
        enabled = playlist.enabled
        download_existing = playlist.download_existing
        first_run = not playlist.baseline_done
        url = playlist.url
        poll_minutes = playlist.poll_minutes

    if not enabled:
        return
    try:
        info = await youtube.fetch_playlist(url)
    except Exception as exc:  # noqa: BLE001 - ошибка yt-dlp уже переведена в текст
        log.warning("плейлист %s: не удалось прочитать: %s", playlist_id, exc)
        async with session_scope() as session:
            playlist = await session.get(Playlist, playlist_id)
            if playlist is not None:
                playlist.last_error = str(exc)[:800]
                playlist.last_checked_at = utcnow()
                playlist.next_check_at = utcnow() + timedelta(minutes=max(1, poll_minutes))
        return

    now = utcnow()
    new_count = 0
    async with session_scope() as session:
        playlist = await session.get(Playlist, playlist_id)
        if playlist is None:
            return
        files.ensure_user_dirs(user)
        if playlist.title.startswith("Плейлист YouTube") and info.title:
            playlist.title = info.title
        if not playlist.baseline_done and info.title:
            playlist.title = info.title
            playlist.dir_name = playlist_dir_name(info.title, playlist.id)
        playlist.download_existing = download_existing
        existing = {v.video_id: v for v in (await session.execute(
            select(Video).where(Video.playlist_id == playlist.id))).scalars()}
        seen: set[str] = set()
        for entry in info.entries:
            if entry.video_id in seen:
                continue
            seen.add(entry.video_id)
            video = existing.get(entry.video_id)
            if video is None:
                status = "ignored" if first_run and not download_existing else "pending"
                video = Video(
                    playlist_id=playlist.id,
                    video_id=entry.video_id,
                    title=entry.title,
                    channel=entry.channel,
                    duration_s=entry.duration_s,
                    thumbnail_url=entry.thumbnail_url,
                    webpage_url=entry.webpage_url,
                    upload_date=entry.upload_date,
                    status=status,
                    in_playlist=True,
                    last_seen_at=now,
                )
                session.add(video)
                if status == "pending":
                    new_count += 1
            else:
                video.title = entry.title or video.title
                video.channel = entry.channel or video.channel
                video.duration_s = entry.duration_s if entry.duration_s is not None else video.duration_s
                video.thumbnail_url = entry.thumbnail_url or video.thumbnail_url
                video.webpage_url = entry.webpage_url or video.webpage_url
                video.upload_date = entry.upload_date or video.upload_date
                video.in_playlist = True
                video.last_seen_at = now
        for video_id, video in existing.items():
            if video_id not in seen:
                video.in_playlist = False
        playlist.baseline_done = True
        playlist.last_checked_at = now
        playlist.next_check_at = now + timedelta(minutes=max(1, playlist.poll_minutes))
        playlist.last_error = None
    log.info("плейлист %s: проверен, новых роликов к скачиванию — %s", playlist_id, new_count)
    if new_count:
        from app.services.downloads import notify

        notify()


async def _worker() -> None:
    while True:
        playlist_id = await _sync_queue.get()
        _scheduled.discard(playlist_id)
        _running.add(playlist_id)
        try:
            await sync_playlist(playlist_id)
        except asyncio.CancelledError:
            raise
        except Exception:
            log.exception("плейлист %s: проверка упала", playlist_id)
        finally:
            _running.discard(playlist_id)
            _sync_queue.task_done()


async def poll_loop() -> None:
    """Раз в POLL_CHECK_S ставит в очередь плейлисты, которым пора провериться."""
    while True:
        try:
            async with session_scope() as session:
                now = utcnow()
                ids = (await session.execute(
                    select(Playlist.id).where(
                        Playlist.enabled.is_(True),
                        (Playlist.next_check_at.is_(None)) | (Playlist.next_check_at <= now),
                    )
                )).scalars().all()
            for playlist_id in ids:
                request_sync(playlist_id)
        except asyncio.CancelledError:
            raise
        except Exception:
            log.exception("планировщик плейлистов упал")
        try:
            await asyncio.wait_for(_wakeup.wait(), timeout=get_settings().poll_check_s)
            _wakeup.clear()
        except TimeoutError:
            pass


def start_tasks() -> list[asyncio.Task]:
    return [
        asyncio.create_task(_worker(), name="karman-sync"),
        asyncio.create_task(poll_loop(), name="karman-poller"),
    ]
