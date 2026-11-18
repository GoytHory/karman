"""Схема «Кармана»: аккаунты, плейлисты, видео, просмотры и настройки."""

from __future__ import annotations

from datetime import UTC, datetime

from sqlalchemy import Boolean, DateTime, Float, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


def utcnow() -> datetime:
    return datetime.now(UTC).replace(tzinfo=None)


class Base(DeclarativeBase):
    pass


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    username: Mapped[str] = mapped_column(String(32), unique=True, index=True)  # нижний регистр
    password_hash: Mapped[str] = mapped_column(Text)
    is_admin: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)


class LoginSession(Base):
    __tablename__ = "sessions"

    token_hash: Mapped[str] = mapped_column(String(64), primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
    expires_at: Mapped[datetime] = mapped_column(DateTime, index=True)


class UserSettings(Base):
    __tablename__ = "user_settings"

    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    retention_unwatched_days: Mapped[int] = mapped_column(Integer, default=7)
    retention_watched_days: Mapped[int] = mapped_column(Integer, default=1)
    default_poll_minutes: Mapped[int] = mapped_column(Integer, default=15)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, onupdate=utcnow)


class Playlist(Base):
    __tablename__ = "playlists"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    url: Mapped[str] = mapped_column(Text)
    youtube_list_id: Mapped[str] = mapped_column(String(64), index=True)
    title: Mapped[str] = mapped_column(Text)
    dir_name: Mapped[str] = mapped_column(String(180))
    is_hidden: Mapped[bool] = mapped_column(Boolean, default=False)
    enabled: Mapped[bool] = mapped_column(Boolean, default=True)
    poll_minutes: Mapped[int] = mapped_column(Integer, default=15)
    download_existing: Mapped[bool] = mapped_column(Boolean, default=False)
    cover_last: Mapped[bool] = mapped_column(Boolean, default=False)
    baseline_done: Mapped[bool] = mapped_column(Boolean, default=False)
    last_checked_at: Mapped[datetime | None] = mapped_column(DateTime)
    next_check_at: Mapped[datetime | None] = mapped_column(DateTime, index=True)
    last_error: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)

    __table_args__ = (UniqueConstraint("user_id", "youtube_list_id", name="uq_playlist_user_list"),)


class Video(Base):
    """Один ролик YouTube в одном плейлисте. Файл лежит в папке владельца."""

    __tablename__ = "videos"

    id: Mapped[int] = mapped_column(primary_key=True)
    playlist_id: Mapped[int] = mapped_column(ForeignKey("playlists.id", ondelete="CASCADE"), index=True)
    video_id: Mapped[str] = mapped_column(String(32), index=True)
    title: Mapped[str] = mapped_column(Text)
    channel: Mapped[str] = mapped_column(String(256), default="")
    duration_s: Mapped[float | None] = mapped_column(Float)
    thumbnail_url: Mapped[str | None] = mapped_column(Text)
    webpage_url: Mapped[str] = mapped_column(Text)
    upload_date: Mapped[str | None] = mapped_column(String(8))

    # pending → downloading → ready; failed — после исчерпания попыток; ignored — был в плейлисте
    # при первом подключении, когда «скачать уже существующие» выключено; deleted — файла больше нет.
    status: Mapped[str] = mapped_column(String(16), default="pending", index=True)
    reaction: Mapped[str] = mapped_column(String(8), default="none", index=True)  # none|like|dislike
    progress: Mapped[float] = mapped_column(Float, default=0)

    file_path: Mapped[str | None] = mapped_column(Text)  # относительно VIDEO_ROOT
    file_size: Mapped[int | None] = mapped_column(Integer)
    downloaded_at: Mapped[datetime | None] = mapped_column(DateTime)
    watched_at: Mapped[datetime | None] = mapped_column(DateTime)
    watch_position_s: Mapped[float | None] = mapped_column(Float)

    in_playlist: Mapped[bool] = mapped_column(Boolean, default=True)
    last_seen_at: Mapped[datetime | None] = mapped_column(DateTime)
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime)
    delete_reason: Mapped[str | None] = mapped_column(String(32))

    error: Mapped[str | None] = mapped_column(Text)
    attempts: Mapped[int] = mapped_column(Integer, default=0)
    retry_after: Mapped[datetime | None] = mapped_column(DateTime)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, onupdate=utcnow)

    __table_args__ = (UniqueConstraint("playlist_id", "video_id", name="uq_video_playlist_video"),)


class ViewEvent(Base):
    """Сессия просмотра. Снимок названия и ссылки остаётся, даже если видео удалили."""

    __tablename__ = "view_events"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    video_id: Mapped[int | None] = mapped_column(ForeignKey("videos.id", ondelete="SET NULL"), index=True)
    title: Mapped[str] = mapped_column(Text)
    channel: Mapped[str] = mapped_column(String(256), default="")
    webpage_url: Mapped[str] = mapped_column(Text)
    owner: Mapped[str] = mapped_column(String(32), default="")
    started_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, index=True)
    last_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, index=True)
    position_s: Mapped[float] = mapped_column(Float, default=0)
    duration_s: Mapped[float | None] = mapped_column(Float)
    completed: Mapped[bool] = mapped_column(Boolean, default=False)
