"""Файлы видео: папки пользователя, перенос в «Сохранённые», удаление вместе с обложкой и субтитрами."""

from __future__ import annotations

import logging
import shutil
from pathlib import Path

from app.config import get_settings
from app.models import Playlist, User, Video
from app.serializers import file_base, playlist_dir, saved_dir, user_dir

log = logging.getLogger(__name__)


def absolute(video: Video) -> Path | None:
    if not video.file_path:
        return None
    return get_settings().video_root / video.file_path


def companions(path: Path) -> list[Path]:
    """Главный файл и всё, что yt-dlp положил рядом: .info.json, обложка, субтитры.

    Ищем по префиксу имени, а не через glob: yt-dlp добавляет в имя видео `[id]`,
    а glob принимает квадратные скобки за шаблон и не находит ни одного файла.
    """
    base = file_base(path)
    if not path.parent.is_dir():
        return []
    prefix = base + "."
    return [p for p in path.parent.iterdir() if p.is_file() and p.name.startswith(prefix)]


def _unique(path: Path) -> Path:
    if not path.exists():
        return path
    for index in range(2, 1000):
        candidate = path.with_name(f"{path.stem} ({index}){path.suffix}")
        if not candidate.exists():
            return candidate
    return path


def move_video(video: Video, target_dir: Path) -> str | None:
    """Переносит файл и спутники в другую папку; возвращает новый относительный путь."""
    source = absolute(video)
    if source is None or not source.is_file():
        return video.file_path
    target_dir.mkdir(parents=True, exist_ok=True)
    moved_main: Path | None = None
    for item in companions(source):
        destination = _unique(target_dir / item.name)
        shutil.move(str(item), str(destination))
        if item == source:
            moved_main = destination
    if moved_main is None:
        return video.file_path
    return moved_main.relative_to(get_settings().video_root).as_posix()


def delete_files(video: Video) -> None:
    path = absolute(video)
    if path is None:
        return
    for item in companions(path):
        try:
            item.unlink(missing_ok=True)
        except OSError:
            log.warning("не удалось удалить %s", item)


def playlist_path(playlist: Playlist, user: User) -> Path:
    return playlist_dir(playlist, user, get_settings().video_root)


def saved_path(user: User) -> Path:
    return saved_dir(user, get_settings().video_root)


def ensure_user_dirs(user: User) -> None:
    (user_dir(user, get_settings().video_root) / "playlists").mkdir(parents=True, exist_ok=True)
    saved_path(user).mkdir(parents=True, exist_ok=True)


def find_main(directory: Path, video_id: str) -> Path | None:
    if not directory.is_dir():
        return None
    candidates = [
        p for p in directory.iterdir()
        if p.is_file() and f"[{video_id}]" in p.name and p.suffix.lower() in {".mp4", ".mkv", ".webm", ".mov"}
    ]
    if not candidates:
        return None
    return max(candidates, key=lambda p: p.stat().st_mtime)
