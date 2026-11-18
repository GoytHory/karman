"""Видео: список, плеер, реакции, прогресс просмотра и удаление."""

from __future__ import annotations

import mimetypes
from pathlib import Path
from urllib.parse import quote

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from fastapi.responses import FileResponse, RedirectResponse, StreamingResponse
from sqlalchemy import case, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import current_user
from app.db import get_session
from app.models import Playlist, User, UserSettings, Video, ViewEvent, utcnow
from app.schemas import ProgressIn, ReactionIn
from app.serializers import delete_after, iso, video_out
from app.services import files
from app.services.downloads import notify as notify_downloads

router = APIRouter(prefix="/api/videos", tags=["videos"])


def _visible(user: User):
    return (Playlist.user_id == user.id) | (Playlist.is_hidden.is_(False))


def _owner_settings(settings: UserSettings | None) -> UserSettings:
    return settings or UserSettings(user_id=0)


async def _context(
    session: AsyncSession, user: User, video_id: int, *, owner_only: bool = False,
) -> tuple[Video, Playlist, User, UserSettings]:
    row = (await session.execute(
        select(Video, Playlist, User, UserSettings)
        .join(Playlist, Playlist.id == Video.playlist_id)
        .join(User, User.id == Playlist.user_id)
        .outerjoin(UserSettings, UserSettings.user_id == Playlist.user_id)
        .where(Video.id == video_id, _visible(user))
    )).first()
    if row is None:
        raise HTTPException(404, "Видео не найдено")
    video, playlist, owner, settings = row
    if owner_only and playlist.user_id != user.id:
        raise HTTPException(403, "Это видео принадлежит другому аккаунту")
    return video, playlist, owner, _owner_settings(settings)


@router.get("")
async def list_videos(
    scope: str = Query("all", pattern="^(all|mine)$"),
    playlist_id: int | None = None,
    owner_id: int | None = None,
    status: str = "",
    reaction: str = "",
    q: str = "",
    limit: int = Query(60, ge=1, le=200),
    offset: int = Query(0, ge=0),
    user: User = Depends(current_user),
    session: AsyncSession = Depends(get_session),
) -> dict:
    conditions = [_visible(user)]
    if scope == "mine":
        conditions.append(Playlist.user_id == user.id)
    if playlist_id is not None:
        conditions.append(Video.playlist_id == playlist_id)
    if owner_id is not None:
        conditions.append(Playlist.user_id == owner_id)
    wanted_status: list[str] = []
    if status.strip():
        wanted_status = [item.strip() for item in status.split(",") if item.strip()]
        conditions.append(Video.status.in_(wanted_status))
    else:
        conditions.append(Video.status.notin_(["ignored", "deleted"]))
    if reaction.strip():
        conditions.append(Video.reaction == reaction.strip())
    if q.strip():
        pattern = f"%{q.strip()}%"
        conditions.append(Video.title.ilike(pattern) | Video.channel.ilike(pattern))

    base = (
        select(Video, Playlist, User, UserSettings)
        .join(Playlist, Playlist.id == Video.playlist_id)
        .join(User, User.id == Playlist.user_id)
        .outerjoin(UserSettings, UserSettings.user_id == Playlist.user_id)
        .where(*conditions)
    )
    total = (await session.execute(select(func.count()).select_from(base.subquery()))).scalar_one()

    # В «Загрузках» (срез без готовых) ошибки идут первыми: их нужно разобрать.
    if wanted_status and "ready" not in wanted_status:
        order = (
            case(
                (Video.status == "failed", 0),
                (Video.status == "downloading", 1),
                (Video.status == "pending", 2),
                else_=3,
            ),
            Video.created_at.desc(),
            Video.id.desc(),
        )
    else:
        order = (
            case((Video.status == "ready", 0), else_=1),
            Video.downloaded_at.desc(),
            Video.id.desc(),
        )

    rows = (await session.execute(
        base.order_by(*order).offset(offset).limit(limit)
    )).all()
    return {
        "total": total,
        "items": [
            video_out(video, playlist, owner.username, _owner_settings(settings), user)
            for video, playlist, owner, settings in rows
        ],
    }


@router.get("/{video_id}")
async def get_video(
    video_id: int,
    user: User = Depends(current_user),
    session: AsyncSession = Depends(get_session),
) -> dict:
    video, playlist, owner, settings = await _context(session, user, video_id)
    return video_out(video, playlist, owner.username, settings, user)


@router.post("/{video_id}/reaction")
async def react(
    video_id: int,
    body: ReactionIn,
    user: User = Depends(current_user),
    session: AsyncSession = Depends(get_session),
) -> dict:
    video, playlist, owner, settings = await _context(session, user, video_id, owner_only=True)
    previous = video.reaction
    if body.reaction == "like":
        if video.status == "deleted":
            raise HTTPException(409, "Файл уже удалён — видео больше нельзя сохранить")
        video.reaction = "like"
        if video.status == "ready" and previous != "like":
            new_path = files.move_video(video, files.saved_path(owner))
            if new_path:
                video.file_path = new_path
    elif body.reaction == "dislike":
        files.delete_files(video)
        video.reaction = "dislike"
        video.status = "deleted"
        video.deleted_at = utcnow()
        video.delete_reason = "disliked"
        video.progress = 0
    else:
        if video.status == "deleted":
            raise HTTPException(409, "Файл уже удалён")
        if previous == "like" and video.status == "ready":
            new_path = files.move_video(video, files.playlist_path(playlist, owner))
            if new_path:
                video.file_path = new_path
        video.reaction = "none"
    await session.commit()
    return video_out(video, playlist, owner.username, settings, user)


@router.post("/{video_id}/delete")
async def delete_now(
    video_id: int,
    user: User = Depends(current_user),
    session: AsyncSession = Depends(get_session),
) -> dict:
    video, playlist, owner, settings = await _context(session, user, video_id, owner_only=True)
    files.delete_files(video)
    video.status = "deleted"
    video.deleted_at = utcnow()
    video.delete_reason = "manual"
    video.reaction = "none"
    video.progress = 0
    await session.commit()
    return video_out(video, playlist, owner.username, settings, user)


@router.post("/{video_id}/retry")
async def retry(
    video_id: int,
    user: User = Depends(current_user),
    session: AsyncSession = Depends(get_session),
) -> dict:
    video, playlist, owner, settings = await _context(session, user, video_id, owner_only=True)
    if video.status != "failed":
        raise HTTPException(409, "Это видео не в ошибке")
    video.status = "pending"
    video.attempts = 0
    video.error = None
    video.retry_after = None
    await session.commit()
    notify_downloads()
    return video_out(video, playlist, owner.username, settings, user)


@router.post("/{video_id}/progress")
async def progress(
    video_id: int,
    body: ProgressIn,
    user: User = Depends(current_user),
    session: AsyncSession = Depends(get_session),
) -> dict:
    video, playlist, owner, settings = await _context(session, user, video_id)
    now = utcnow()
    event: ViewEvent | None = None
    if body.event_id is not None:
        event = (await session.execute(
            select(ViewEvent).where(ViewEvent.id == body.event_id, ViewEvent.user_id == user.id)
        )).scalar_one_or_none()
        if event is not None and event.video_id != video.id:
            event = None
    if event is None:
        event = ViewEvent(
            user_id=user.id,
            video_id=video.id,
            title=video.title,
            channel=video.channel,
            webpage_url=video.webpage_url,
            owner=owner.username,
            started_at=now,
        )
        session.add(event)
        await session.flush()

    duration = body.duration_s if body.duration_s else video.duration_s
    position = max(0.0, body.position_s)
    completed = body.completed or bool(duration and duration > 0 and position >= duration * 0.9)
    event.position_s = position
    event.duration_s = duration
    event.completed = completed
    event.last_at = now

    if owner.id == user.id and completed and video.watched_at is None:
        video.watched_at = now
        video.watch_position_s = position
    await session.commit()
    return {
        "event_id": event.id,
        "completed": event.completed,
        "watched_at": iso(video.watched_at),
        "delete_after": iso(delete_after(video, settings)),
    }


@router.api_route("/{video_id}/stream", methods=["GET", "HEAD"])
async def stream(
    video_id: int,
    request: Request,
    user: User = Depends(current_user),
    session: AsyncSession = Depends(get_session),
):
    video, _, _, _ = await _context(session, user, video_id)
    path = files.absolute(video)
    if path is None or not path.is_file() or video.status != "ready":
        raise HTTPException(404, "Файла нет — видео ещё не скачано или уже удалено")
    size = path.stat().st_size
    media = mimetypes.guess_type(path.name)[0] or files.media_type(path)
    headers = {
        "Accept-Ranges": "bytes",
        "Cache-Control": "private, max-age=3600",
        "Content-Disposition": f"inline; filename*=UTF-8''{quote(path.name)}",
    }
    range_header = request.headers.get("range")
    if range_header:
        try:
            raw = range_header.split("=", 1)[1]
            start_s, end_s = raw.split("-", 1)
            start = int(start_s) if start_s else 0
            end = int(end_s) if end_s else size - 1
        except (ValueError, IndexError):
            raise HTTPException(416, "Некорректный Range") from None
        if start >= size or start < 0 or end < start:
            return StreamingResponse(iter(()), status_code=416, headers={"Content-Range": f"bytes */{size}"})
        end = min(end, size - 1)
        length = end - start + 1

        def chunks():
            with path.open("rb") as handle:
                handle.seek(start)
                remaining = length
                while remaining > 0:
                    data = handle.read(min(1024 * 256, remaining))
                    if not data:
                        break
                    remaining -= len(data)
                    yield data

        headers.update({"Content-Range": f"bytes {start}-{end}/{size}", "Content-Length": str(length)})
        return StreamingResponse(chunks(), status_code=206, media_type=media, headers=headers)
    return StreamingResponse(
        path.open("rb"), media_type=media, headers={**headers, "Content-Length": str(size)},
    )


@router.get("/{video_id}/download")
async def download(
    video_id: int,
    user: User = Depends(current_user),
    session: AsyncSession = Depends(get_session),
):
    video, _, _, _ = await _context(session, user, video_id)
    path = files.absolute(video)
    if path is None or not path.is_file() or video.status != "ready":
        raise HTTPException(404, "Файла нет")
    return FileResponse(
        path,
        media_type=mimetypes.guess_type(path.name)[0] or files.media_type(path),
        filename=path.name,
    )


@router.get("/{video_id}/thumbnail")
async def thumbnail(
    video_id: int,
    user: User = Depends(current_user),
    session: AsyncSession = Depends(get_session),
):
    video, _, _, _ = await _context(session, user, video_id)
    path = files.absolute(video)
    if path is not None:
        base = path.name[: -len(path.suffix)] if path.suffix else path.name
        for suffix in (".jpg", ".jpeg", ".webp", ".png"):
            candidate: Path = path.with_name(base + suffix)
            if candidate.is_file():
                return FileResponse(candidate, media_type=mimetypes.guess_type(candidate.name)[0] or "image/jpeg")
    # Локальной обложки ещё нет (видео в очереди или ошибке) — отдаём превью YouTube,
    # чтобы карточка не оставалась пустой.
    remote = (video.thumbnail_url or "").strip()
    if remote.startswith(("http://", "https://")):
        return RedirectResponse(remote, status_code=307)
    raise HTTPException(404, "Нет обложки")
