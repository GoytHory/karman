"""Плейлисты: добавить ссылку, синхронизировать, скрыть, удалить."""

from __future__ import annotations

from datetime import timedelta

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import case, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import current_user, user_settings
from app.db import get_session
from app.models import Playlist, User, Video, utcnow
from app.schemas import PlaylistIn, PlaylistPatch
from app.serializers import playlist_dir_name, playlist_out
from app.services import files, youtube
from app.services.sync import request_sync

router = APIRouter(prefix="/api/playlists", tags=["playlists"])


async def _counts(session: AsyncSession, playlist_ids: list[int]) -> dict[int, dict]:
    if not playlist_ids:
        return {}
    rows = (await session.execute(
        select(
            Video.playlist_id,
            func.count(Video.id),
            func.sum(case((Video.status == "ready", 1), else_=0)),
            func.sum(case((Video.status.in_(["pending", "downloading"]), 1), else_=0)),
            func.sum(case((Video.status == "failed", 1), else_=0)),
        )
        .where(Video.playlist_id.in_(playlist_ids))
        .group_by(Video.playlist_id)
    )).all()
    return {
        row[0]: {
            "videos": int(row[1] or 0),
            "ready": int(row[2] or 0),
            "pending": int(row[3] or 0),
            "failed": int(row[4] or 0),
        }
        for row in rows
    }


async def _covers(session: AsyncSession, playlists: list[Playlist]) -> dict[int, str]:
    if not playlists:
        return {}
    rows = (await session.execute(
        select(Video.playlist_id, Video.id)
        .where(Video.playlist_id.in_([item.id for item in playlists]), Video.status == "ready")
        .order_by(Video.playlist_id, Video.id)
    )).all()
    first: dict[int, int] = {}
    last: dict[int, int] = {}
    for playlist_id, video_id in rows:
        first.setdefault(playlist_id, video_id)
        last[playlist_id] = video_id
    return {
        playlist.id: f"/api/videos/{(last if playlist.cover_last else first)[playlist.id]}/thumbnail"
        for playlist in playlists
        if playlist.id in first
    }


def _visible(user: User):
    return (Playlist.user_id == user.id) | (Playlist.is_hidden.is_(False))


async def _get_visible(session: AsyncSession, user: User, playlist_id: int) -> tuple[Playlist, User]:
    row = (await session.execute(
        select(Playlist, User)
        .join(User, User.id == Playlist.user_id)
        .where(Playlist.id == playlist_id, _visible(user))
    )).first()
    if row is None:
        raise HTTPException(404, "Плейлист не найден")
    return row[0], row[1]


async def _get_owned(session: AsyncSession, user: User, playlist_id: int) -> tuple[Playlist, User]:
    row = (await session.execute(
        select(Playlist, User).join(User, User.id == Playlist.user_id)
        .where(Playlist.id == playlist_id, Playlist.user_id == user.id)
    )).first()
    if row is None:
        raise HTTPException(404, "Плейлист не найден")
    return row[0], row[1]


@router.get("")
async def list_playlists(
    scope: str = Query("mine", pattern="^(mine|all)$"),
    user: User = Depends(current_user),
    session: AsyncSession = Depends(get_session),
) -> list[dict]:
    query = select(Playlist, User.username).join(User, User.id == Playlist.user_id)
    if scope == "mine":
        query = query.where(Playlist.user_id == user.id)
    else:
        query = query.where(_visible(user))
    rows = (await session.execute(query.order_by(Playlist.id.desc()))).all()
    playlists = [row[0] for row in rows]
    counts = await _counts(session, [item.id for item in playlists])
    covers = await _covers(session, playlists)
    return [
        playlist_out(playlist, owner, counts.get(playlist.id), covers.get(playlist.id))
        for playlist, owner in rows
    ]


@router.post("")
async def create_playlist(
    body: PlaylistIn,
    user: User = Depends(current_user),
    session: AsyncSession = Depends(get_session),
) -> dict:
    try:
        list_id, url = youtube.parse_playlist_url(body.url)
    except youtube.YoutubeError as exc:
        raise HTTPException(400, str(exc)) from exc
    duplicate = (await session.execute(
        select(Playlist.id).where(Playlist.user_id == user.id, Playlist.youtube_list_id == list_id)
    )).scalar_one_or_none()
    if duplicate is not None:
        raise HTTPException(409, "Этот плейлист уже добавлен")
    settings = await user_settings(session, user)
    playlist = Playlist(
        user_id=user.id,
        url=url,
        youtube_list_id=list_id,
        title="Плейлист YouTube",
        dir_name="",
        is_hidden=body.hidden,
        poll_minutes=body.poll_minutes or settings.default_poll_minutes,
        download_existing=body.download_existing,
        next_check_at=utcnow(),
    )
    session.add(playlist)
    await session.flush()
    playlist.dir_name = playlist_dir_name(playlist.title, playlist.id)
    files.ensure_user_dirs(user)
    await session.commit()
    request_sync(playlist.id)
    return playlist_out(playlist, user.username)


@router.get("/{playlist_id}")
async def get_playlist(
    playlist_id: int,
    user: User = Depends(current_user),
    session: AsyncSession = Depends(get_session),
) -> dict:
    playlist, owner = await _get_visible(session, user, playlist_id)
    counts = await _counts(session, [playlist.id])
    return playlist_out(playlist, owner.username, counts.get(playlist.id))


@router.patch("/{playlist_id}")
async def patch_playlist(
    playlist_id: int,
    body: PlaylistPatch,
    user: User = Depends(current_user),
    session: AsyncSession = Depends(get_session),
) -> dict:
    playlist, owner = await _get_owned(session, user, playlist_id)
    if body.title is not None:
        playlist.title = body.title.strip()
    if body.hidden is not None:
        playlist.is_hidden = body.hidden
    if body.enabled is not None:
        playlist.enabled = body.enabled
        if body.enabled:
            playlist.next_check_at = utcnow()
            request_sync(playlist.id)
    if body.poll_minutes is not None:
        playlist.poll_minutes = body.poll_minutes
        playlist.next_check_at = utcnow() + timedelta(minutes=body.poll_minutes)
    if body.cover_last is not None:
        playlist.cover_last = body.cover_last
    await session.commit()
    counts = await _counts(session, [playlist.id])
    covers = await _covers(session, [playlist])
    return playlist_out(playlist, owner.username, counts.get(playlist.id), covers.get(playlist.id))


@router.post("/{playlist_id}/sync")
async def sync_now(
    playlist_id: int,
    user: User = Depends(current_user),
    session: AsyncSession = Depends(get_session),
) -> dict:
    playlist, owner = await _get_owned(session, user, playlist_id)
    playlist.enabled = True
    playlist.next_check_at = utcnow()
    await session.commit()
    request_sync(playlist.id)
    counts = await _counts(session, [playlist.id])
    return playlist_out(playlist, owner.username, counts.get(playlist.id))


@router.delete("/{playlist_id}")
async def delete_playlist(
    playlist_id: int,
    user: User = Depends(current_user),
    session: AsyncSession = Depends(get_session),
) -> dict:
    playlist, _ = await _get_owned(session, user, playlist_id)
    videos = (await session.execute(select(Video).where(Video.playlist_id == playlist.id))).scalars().all()
    for video in videos:
        files.delete_files(video)
    await session.delete(playlist)
    await session.commit()
    return {"ok": True}
