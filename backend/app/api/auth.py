"""Регистрация, вход, выход и текущий пользователь."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Request, Response
from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import (
    clear_session_cookie,
    create_session,
    current_user,
    hash_password,
    normalize_username,
    set_session_cookie,
    token_hash,
    user_settings,
    validate_username,
    verify_password,
)
from app.config import get_settings
from app.db import get_session
from app.models import LoginSession, User, UserSettings
from app.schemas import LoginIn, RegisterIn
from app.serializers import iso

router = APIRouter(prefix="/api", tags=["auth"])


def _auth_payload(user: User, settings: UserSettings, token: str) -> dict:
    return {
        "token": token,
        "user": {
            "id": user.id,
            "username": user.username,
            "is_admin": user.is_admin,
            "created_at": iso(user.created_at),
        },
        "settings": _settings_payload(settings),
    }


def _settings_payload(settings: UserSettings) -> dict:
    return {
        "retention_unwatched_days": settings.retention_unwatched_days,
        "retention_watched_days": settings.retention_watched_days,
        "default_poll_minutes": settings.default_poll_minutes,
    }


@router.post("/auth/register")
async def register(
    body: RegisterIn,
    response: Response,
    session: AsyncSession = Depends(get_session),
) -> dict:
    username = validate_username(body.username)
    existing = (await session.execute(select(User.id).where(User.username == username))).scalar_one_or_none()
    if existing is not None:
        raise HTTPException(409, "Такой логин уже занят")
    count = (await session.execute(select(func.count(User.id)))).scalar_one()
    if count > 0 and not get_settings().allow_registration:
        raise HTTPException(403, "Регистрация закрыта — попросите администратора создать аккаунт")
    user = User(username=username, password_hash=hash_password(body.password), is_admin=count == 0)
    session.add(user)
    await session.flush()
    settings = await user_settings(session, user)
    token = await create_session(session, user)
    await session.commit()
    set_session_cookie(response, token)
    return _auth_payload(user, settings, token)


@router.post("/auth/login")
async def login(
    body: LoginIn,
    response: Response,
    session: AsyncSession = Depends(get_session),
) -> dict:
    username = normalize_username(body.username)
    user = (await session.execute(select(User).where(User.username == username))).scalar_one_or_none()
    if user is None or not verify_password(body.password, user.password_hash):
        raise HTTPException(401, "Неверный логин или пароль")
    settings = await user_settings(session, user)
    token = await create_session(session, user)
    await session.commit()
    set_session_cookie(response, token)
    return _auth_payload(user, settings, token)


@router.post("/auth/logout")
async def logout(request: Request, response: Response, session: AsyncSession = Depends(get_session)) -> dict:
    header = request.headers.get("authorization", "")
    raw = request.cookies.get("karman_session") or (header[7:].strip() if header.lower().startswith("bearer ") else "")
    if raw:
        await session.execute(delete(LoginSession).where(LoginSession.token_hash == token_hash(raw)))
        await session.commit()
    clear_session_cookie(response)
    return {"ok": True}


@router.get("/auth/me")
async def me(user: User = Depends(current_user), session: AsyncSession = Depends(get_session)) -> dict:
    settings = await user_settings(session, user)
    return {
        "user": {
            "id": user.id,
            "username": user.username,
            "is_admin": user.is_admin,
            "created_at": iso(user.created_at),
        },
        "settings": _settings_payload(settings),
    }


@router.get("/users")
async def users(_: User = Depends(current_user), session: AsyncSession = Depends(get_session)) -> list[dict]:
    rows = (await session.execute(select(User.id, User.username).order_by(User.username))).all()
    return [{"id": row[0], "username": row[1]} for row in rows]
