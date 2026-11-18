"""Пароли, сессии и текущий пользователь.

Веб-клиент носит сессию в HttpOnly-cookie, Android — в `Authorization: Bearer`.
Оба варианта — один и тот же случайный токен, в базе лежит только его SHA-256.
"""

from __future__ import annotations

import base64
import hashlib
import hmac
import re
import secrets
from datetime import timedelta

from fastapi import Depends, HTTPException, Request, Response
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.db import get_session
from app.models import LoginSession, User, UserSettings, utcnow

COOKIE_NAME = "karman_session"
USERNAME_RE = re.compile(r"^[A-Za-z0-9_.-]{3,32}$")
SCRYPT_N, SCRYPT_R, SCRYPT_P = 2**14, 8, 1


def _b64(data: bytes) -> str:
    return base64.b64encode(data).decode("ascii")


def hash_password(password: str) -> str:
    salt = secrets.token_bytes(16)
    digest = hashlib.scrypt(password.encode("utf-8"), salt=salt, n=SCRYPT_N, r=SCRYPT_R, p=SCRYPT_P, dklen=32)
    return f"scrypt${SCRYPT_N}${SCRYPT_R}${SCRYPT_P}${_b64(salt)}${_b64(digest)}"


def verify_password(password: str, stored: str) -> bool:
    try:
        kind, n, r, p, salt_b64, digest_b64 = stored.split("$")
        if kind != "scrypt":
            return False
        salt = base64.b64decode(salt_b64)
        expected = base64.b64decode(digest_b64)
        actual = hashlib.scrypt(password.encode("utf-8"), salt=salt, n=int(n), r=int(r), p=int(p), dklen=len(expected))
        return hmac.compare_digest(actual, expected)
    except (ValueError, TypeError):
        return False


def normalize_username(username: str) -> str:
    return username.strip().lower()


def validate_username(username: str) -> str:
    value = normalize_username(username)
    if not USERNAME_RE.match(value):
        raise HTTPException(400, "Логин: 3–32 символа, только латиница, цифры, точка, дефис и подчёркивание")
    return value


def token_hash(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


async def create_session(session: AsyncSession, user: User) -> str:
    raw = secrets.token_urlsafe(32)
    session.add(LoginSession(
        token_hash=token_hash(raw),
        user_id=user.id,
        expires_at=utcnow() + timedelta(days=get_settings().session_days),
    ))
    # заодно чистим просроченные сессии этого пользователя
    await session.execute(delete(LoginSession).where(
        LoginSession.user_id == user.id, LoginSession.expires_at <= utcnow()))
    await session.flush()
    return raw


def set_session_cookie(response: Response, raw: str) -> None:
    response.set_cookie(
        COOKIE_NAME,
        raw,
        max_age=get_settings().session_days * 86400,
        httponly=True,
        samesite="lax",
        path="/",
    )


def clear_session_cookie(response: Response) -> None:
    response.delete_cookie(COOKIE_NAME, path="/")


def _request_token(request: Request) -> str | None:
    token = request.cookies.get(COOKIE_NAME)
    if token:
        return token
    header = request.headers.get("authorization", "")
    if header.lower().startswith("bearer "):
        value = header[7:].strip()
        return value or None
    return None


async def current_user(
    request: Request,
    session: AsyncSession = Depends(get_session),
) -> User:
    raw = _request_token(request)
    if not raw:
        raise HTTPException(401, "Нужно войти")
    row = (await session.execute(
        select(User)
        .join(LoginSession, LoginSession.user_id == User.id)
        .where(LoginSession.token_hash == token_hash(raw), LoginSession.expires_at > utcnow())
    )).scalar_one_or_none()
    if row is None:
        raise HTTPException(401, "Сессия истекла — войдите заново")
    return row


async def user_settings(session: AsyncSession, user: User) -> UserSettings:
    settings = await session.get(UserSettings, user.id)
    if settings is None:
        settings = UserSettings(user_id=user.id)
        session.add(settings)
        await session.flush()
    return settings


def require_admin(user: User) -> None:
    if not user.is_admin:
        raise HTTPException(403, "Нужны права администратора")
