"""Общие преобразования: время, имена файлов, сериализация для API."""

from __future__ import annotations

import re
import unicodedata
from datetime import UTC, datetime, timedelta
from pathlib import Path
from zoneinfo import ZoneInfo

from app.config import get_settings
from app.models import Playlist, User, UserSettings, Video, ViewEvent


def iso(value: datetime | None) -> str | None:
    if value is None:
        return None
    return value.replace(tzinfo=UTC).isoformat().replace("+00:00", "Z")


def local_time(value: datetime | None) -> str:
    if value is None:
        return ""
    try:
        zone = ZoneInfo(get_settings().timezone)
    except Exception:
        zone = UTC
    return value.replace(tzinfo=UTC).astimezone(zone).strftime("%Y-%m-%d %H:%M")


def safe_name(value: str, fallback: str = "video", limit: int = 120) -> str:
    value = unicodedata.normalize("NFKC", value or "")
    value = re.sub(r'[\\/:*?"<>|\x00-\x1f]+', " ", value)
    value = re.sub(r"\s+", " ", value).strip(" .")
    if len(value) > limit:
        value = value[:limit].rstrip(" .")
    return value or fallback


def playlist_dir_name(title: str, playlist_id: int) -> str:
    return f"{safe_name(title, 'playlist', 90)} [p{playlist_id}]"


def user_dir(user: User, root: Path) -> Path:
    return root / "users" / safe_name(user.username, f"user-{user.id}", 32)


def playlist_dir(playlist: Playlist, user: User, root: Path) -> Path:
    return user_dir(user, root) / "playlists" / playlist.dir_name


def saved_dir(user: User, root: Path) -> Path:
    return user_dir(user, root) / "saved"


def file_base(path: Path) -> str:
    """`Название [id].mp4` → `Название [id]` (для .info.json и субтитров)."""
    name = path.name
    return name[: -len(path.suffix)] if path.suffix else name


def media_type(path: Path) -> str:
    return {
        ".mp4": "video/mp4",
        ".mkv": "video/x-matroska",
        ".webm": "video/webm",
        ".mov": "video/quicktime",
        ".m4v": "video/mp4",
    }.get(path.suffix.lower(), "application/octet-stream")


def playlist_out(playlist: Playlist, owner: str, counts: dict | None = None, cover: str | None = None) -> dict:
    counts = counts or {}
    return {
        "id": playlist.id,
        "title": playlist.title,
        "url": playlist.url,
        "youtube_list_id": playlist.youtube_list_id,
        "owner_id": playlist.user_id,
        "owner": owner,
        "is_hidden": playlist.is_hidden,
        "enabled": playlist.enabled,
        "poll_minutes": playlist.poll_minutes,
        "download_existing": playlist.download_existing,
        "cover_last": playlist.cover_last,
        "baseline_done": playlist.baseline_done,
        "last_checked_at": iso(playlist.last_checked_at),
        "next_check_at": iso(playlist.next_check_at),
        "last_error": playlist.last_error,
        "created_at": iso(playlist.created_at),
        "cover": cover,
        "counts": {
            "videos": int(counts.get("videos", 0)),
            "ready": int(counts.get("ready", 0)),
            "pending": int(counts.get("pending", 0)),
            "failed": int(counts.get("failed", 0)),
        },
    }


def delete_after(video: Video, settings: UserSettings) -> datetime | None:
    if video.reaction == "like" or video.deleted_at is not None or video.status != "ready":
        return None
    if video.watched_at is not None:
        return video.watched_at + timedelta(days=settings.retention_watched_days)
    if video.downloaded_at is not None:
        return video.downloaded_at + timedelta(days=settings.retention_unwatched_days)
    return None


def video_out(video: Video, playlist: Playlist, owner: str, settings: UserSettings, viewer: User) -> dict:
    deadline = delete_after(video, settings)
    return {
        "id": video.id,
        "playlist_id": playlist.id,
        "playlist_title": playlist.title,
        "playlist_hidden": playlist.is_hidden,
        "owner_id": playlist.user_id,
        "owner": owner,
        "video_id": video.video_id,
        "title": video.title,
        "channel": video.channel,
        "duration_s": video.duration_s,
        "thumbnail_url": video.thumbnail_url,
        "thumbnail_local": f"/api/videos/{video.id}/thumbnail",
        "webpage_url": video.webpage_url,
        "upload_date": video.upload_date,
        "status": video.status,
        "reaction": video.reaction,
        "progress": round(video.progress or 0, 1),
        "file_size": video.file_size,
        "downloaded_at": iso(video.downloaded_at),
        "watched_at": iso(video.watched_at),
        "watch_position_s": video.watch_position_s,
        "in_playlist": video.in_playlist,
        "deleted_at": iso(video.deleted_at),
        "delete_reason": video.delete_reason,
        "delete_after": iso(deadline),
        "error": video.error,
        "created_at": iso(video.created_at),
        "can_manage": playlist.user_id == viewer.id,
    }


def history_out(event: ViewEvent) -> dict:
    return {
        "id": event.id,
        "video_id": event.video_id,
        "title": event.title,
        "channel": event.channel,
        "webpage_url": event.webpage_url,
        "owner": event.owner,
        "started_at": iso(event.started_at),
        "last_at": iso(event.last_at),
        "position_s": event.position_s,
        "duration_s": event.duration_s,
        "completed": event.completed,
    }
