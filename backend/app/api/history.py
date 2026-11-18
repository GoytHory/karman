"""История просмотров: список в интерфейсе и текстовый экспорт."""

from __future__ import annotations

from fastapi import APIRouter, Depends, Query
from fastapi.responses import PlainTextResponse
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import current_user
from app.db import get_session
from app.models import User, ViewEvent
from app.serializers import history_out, local_time

router = APIRouter(prefix="/api/history", tags=["history"])


def _duration(seconds: float | None) -> str:
    total = int(seconds or 0)
    hours, rest = divmod(total, 3600)
    minutes, secs = divmod(rest, 60)
    return f"{hours}:{minutes:02d}:{secs:02d}" if hours else f"{minutes}:{secs:02d}"


@router.get("")
async def list_history(
    limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0),
    user: User = Depends(current_user),
    session: AsyncSession = Depends(get_session),
) -> dict:
    condition = ViewEvent.user_id == user.id
    total = (await session.execute(select(func.count(ViewEvent.id)).where(condition))).scalar_one()
    rows = (await session.execute(
        select(ViewEvent).where(condition).order_by(ViewEvent.last_at.desc()).offset(offset).limit(limit)
    )).scalars().all()
    return {"total": total, "items": [history_out(event) for event in rows]}


@router.get("/export.txt", response_class=PlainTextResponse)
async def export_history(
    user: User = Depends(current_user),
    session: AsyncSession = Depends(get_session),
) -> PlainTextResponse:
    rows = (await session.execute(
        select(ViewEvent).where(ViewEvent.user_id == user.id).order_by(ViewEvent.last_at.desc())
    )).scalars().all()
    lines = [
        "История просмотра — Карман",
        f"Пользователь: {user.username}",
        f"Записей: {len(rows)}",
        "",
    ]
    for event in rows:
        watched = _duration(event.position_s)
        total = _duration(event.duration_s)
        percent = int(round((event.position_s / event.duration_s) * 100)) if event.duration_s else 0
        mark = "досмотрено" if event.completed else "не досмотрено"
        lines.append(
            f"{local_time(event.started_at)} | {event.title} | {event.channel or 'без канала'} | "
            f"{watched} из {total} ({percent}%, {mark}) | {event.owner or '—'} | {event.webpage_url}"
        )
    return PlainTextResponse(
        "\n".join(lines) + "\n",
        headers={"Content-Disposition": 'attachment; filename="karman-history.txt"'},
    )
