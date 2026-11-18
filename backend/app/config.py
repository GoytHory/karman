"""Настройки «Кармана»: секреты и пути из окружения, остальное — значения по умолчанию."""

from __future__ import annotations

from functools import lru_cache
from pathlib import Path

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=None, extra="ignore", case_sensitive=False)

    app_name: str = "Карман"
    data_dir: Path = Path("/data")
    video_root: Path = Path("/video")
    database_url: str = ""  # пусто — SQLite в DATA_DIR

    # Открытая регистрация: любой в домашней сети может создать аккаунт.
    allow_registration: bool = True
    session_days: int = 30
    timezone: str = "Europe/Moscow"

    # Проверка плейлистов: как часто просыпается планировщик и сколько качаем одновременно.
    poll_check_s: float = Field(default=30.0, ge=5)
    max_parallel_downloads: int = Field(default=2, ge=1, le=4)
    download_retries: int = Field(default=3, ge=0, le=10)
    max_video_height: int = Field(default=1080, ge=144, le=4320)

    # yt-dlp / ffmpeg
    ytdlp_bin: str = "yt-dlp"
    ffmpeg_bin: str = "ffmpeg"
    ffprobe_bin: str = "ffprobe"
    metadata_timeout_s: float = Field(default=180.0, ge=10)
    download_timeout_s: float = Field(default=6 * 3600.0, ge=60)
    ytdlp_cookies_file: Path = Path("/secrets/cookies.txt")
    ytdlp_pot_base_url: str = ""

    log_level: str = "INFO"
    disable_background: bool = False  # тесты: не поднимать фоновые задачи

    @property
    def db_path(self) -> Path:
        return self.data_dir / "karman.sqlite3"

    @property
    def users_dir(self) -> Path:
        return self.video_root / "users"

    def sqlalchemy_url(self) -> str:
        if self.database_url:
            return self.database_url
        return f"sqlite+aiosqlite:///{self.db_path.as_posix()}"


@lru_cache
def get_settings() -> Settings:
    return Settings()


def reset_settings_cache() -> None:
    get_settings.cache_clear()
