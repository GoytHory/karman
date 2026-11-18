"""YouTube через yt-dlp: разбор ссылки на плейлист, чтение списка и скачивание одного ролика."""

from __future__ import annotations

import asyncio
import json
import logging
import os
import re
import shutil
from dataclasses import dataclass
from pathlib import Path
from typing import Awaitable, Callable
from urllib.parse import parse_qs, urlparse

from app.config import get_settings

log = logging.getLogger(__name__)

LIST_RE = re.compile(r"^[A-Za-z0-9_-]{10,}$")
WATCH_URL = "https://www.youtube.com/watch?v={id}"
PROGRESS_RE = re.compile(r"\[download\]\s+(\d+(?:[.,]\d+)?)%")
FILE_MARKER = "KARMAN_FILE:"


class YoutubeError(Exception):
    """Ошибка, текст которой можно показать пользователю."""


@dataclass
class Entry:
    video_id: str
    title: str
    channel: str
    duration_s: float | None
    thumbnail_url: str | None
    webpage_url: str
    upload_date: str | None


@dataclass
class PlaylistInfo:
    title: str
    entries: list[Entry]


def parse_playlist_url(url: str) -> tuple[str, str]:
    """Проверяет ссылку и возвращает (id плейлиста, нормализованный URL)."""
    value = (url or "").strip()
    if not value:
        raise YoutubeError("Вставьте ссылку на плейлист YouTube")
    if not re.match(r"^https?://", value, re.I):
        value = "https://" + value
    parsed = urlparse(value)
    host = (parsed.hostname or "").lower()
    if host.startswith("www."):
        host = host[4:]
    if host not in {"youtube.com", "m.youtube.com", "music.youtube.com", "youtu.be"}:
        raise YoutubeError("Нужна ссылка на youtube.com или youtu.be")
    list_id = (parse_qs(parsed.query).get("list") or [""])[0].strip()
    if not LIST_RE.match(list_id):
        raise YoutubeError("В ссылке нет плейлиста: нужен адрес вида youtube.com/playlist?list=…")
    return list_id, f"https://www.youtube.com/playlist?list={list_id}"


def _cookies_args() -> list[str]:
    settings = get_settings()
    path = settings.ytdlp_cookies_file
    if path and path.is_file():
        return ["--cookies", str(path)]
    return []


def _common_args() -> list[str]:
    settings = get_settings()
    args = [
        "--no-color",
        "--no-warnings",
        "--socket-timeout", "30",
        "--retries", "5",
        "--fragment-retries", "5",
        *_cookies_args(),
    ]
    if shutil.which("deno"):
        args += ["--js-runtimes", "deno"]
    return args


def _env() -> dict[str, str]:
    env = dict(os.environ)
    env.setdefault("PYTHONIOENCODING", "utf-8")
    settings = get_settings()
    if settings.ytdlp_pot_base_url:
        env["YTDLP_POT_BASE_URL"] = settings.ytdlp_pot_base_url
    env.setdefault("YTDLP_CACHE_DIR", str(settings.data_dir / "yt-dlp-cache"))
    return env


async def _read_stream(proc: asyncio.subprocess.Process, lines: list[str]) -> None:
    assert proc.stdout is not None
    while True:
        raw = await proc.stdout.readline()
        if not raw:
            break
        line = raw.decode("utf-8", "replace").rstrip()
        if line:
            lines.append(line)
            del lines[:-40]


def _entry_from_json(item: dict) -> Entry | None:
    video_id = (item.get("id") or "").strip()
    if not video_id:
        url = item.get("url") or ""
        match = re.search(r"(?:[?&]v=|youtu\.be/)([A-Za-z0-9_-]{6,})", url)
        if match:
            video_id = match.group(1)
    if not video_id:
        return None
    thumb = item.get("thumbnail")
    if not thumb:
        thumbs = item.get("thumbnails") or []
        if thumbs:
            thumb = thumbs[-1].get("url")
    duration = item.get("duration")
    try:
        duration_s = float(duration) if duration is not None else None
    except (TypeError, ValueError):
        duration_s = None
    return Entry(
        video_id=video_id,
        title=(item.get("title") or "Без названия").strip(),
        channel=(item.get("uploader") or item.get("channel") or "").strip(),
        duration_s=duration_s,
        thumbnail_url=thumb,
        webpage_url=item.get("webpage_url") or WATCH_URL.format(id=video_id),
        upload_date=item.get("upload_date"),
    )


async def fetch_playlist(url: str) -> PlaylistInfo:
    settings = get_settings()
    cmd = [
        settings.ytdlp_bin,
        "--flat-playlist",
        "--dump-single-json",
        "--skip-download",
        "--ignore-errors",
        "--no-progress",
        *_common_args(),
        url,
    ]
    proc = await asyncio.create_subprocess_exec(
        *cmd, stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.DEVNULL, env=_env(),
    )
    lines: list[str] = []
    reader = asyncio.create_task(_read_stream(proc, lines))
    try:
        await asyncio.wait_for(proc.wait(), timeout=settings.metadata_timeout_s)
    except TimeoutError as exc:
        proc.kill()
        await proc.wait()
        raise YoutubeError("YouTube не ответил за отведённое время") from exc
    finally:
        await reader

    output = "\n".join(lines).strip()
    if proc.returncode != 0:
        tail = " ".join(lines[-3:])[:500] or "yt-dlp завершился с ошибкой"
        raise YoutubeError(_human_error(tail))
    try:
        data = json.loads(output)
    except json.JSONDecodeError as exc:
        raise YoutubeError("Не удалось прочитать ответ YouTube") from exc
    if not isinstance(data, dict):
        raise YoutubeError("Это не похоже на плейлист YouTube")
    entries = [entry for item in (data.get("entries") or []) if isinstance(item, dict)
               if (entry := _entry_from_json(item)) is not None]
    if not entries and data.get("_type") not in {"playlist", "multi_video"}:
        raise YoutubeError("В ссылке нет плейлиста")
    return PlaylistInfo(title=(data.get("title") or "Плейлист YouTube").strip(), entries=entries)


def _human_error(text: str) -> str:
    low = text.lower()
    if "private" in low or "приват" in low:
        return "Плейлист закрыт. Добавьте cookies YouTube (README, «Закрытые плейлисты»)"
    if "sign in" in low or "bot" in low or "cookies" in low:
        return "YouTube просит вход или проверку. Добавьте файл cookies (README)"
    if "unavailable" in low or "not available" in low:
        return "Видео или плейлист недоступны"
    if "404" in low or "not found" in low:
        return "Плейлист не найден"
    return text


async def download(
    url: str,
    video_id: str,
    directory: Path,
    on_progress: Callable[[float], Awaitable[None]] | None = None,
) -> Path:
    """Скачивает один ролик в directory. Возвращает путь к готовому файлу."""
    settings = get_settings()
    directory.mkdir(parents=True, exist_ok=True)
    height = settings.max_video_height
    fmt = (
        f"bv*[height<={height}][vcodec^=avc1]+ba[acodec^=mp4a]/"
        f"bv*[height<={height}][vcodec^=avc1]+ba/"
        f"bv*[height<={height}]+ba/"
        f"b[height<={height}]/b"
    )
    cmd = [
        settings.ytdlp_bin,
        "--no-playlist",
        "--newline",
        "--progress",
        "--no-mtime",
        "--windows-filenames",
        "--trim-filenames", "150",
        "--format", fmt,
        "--merge-output-format", "mp4",
        "--write-info-json",
        "--write-thumbnail",
        "--convert-thumbnails", "jpg",
        "--print", f"after_move:{FILE_MARKER}%(filepath)s",
        "--output", str(directory / "%(title).120B [%(id)s].%(ext)s"),
        *_common_args(),
        url,
    ]
    proc = await asyncio.create_subprocess_exec(
        *cmd, stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.STDOUT, env=_env(),
    )
    lines: list[str] = []
    final_path: Path | None = None
    last_progress = -1.0

    async def pump() -> None:
        nonlocal final_path, last_progress
        assert proc.stdout is not None
        while True:
            raw = await proc.stdout.readline()
            if not raw:
                break
            line = raw.decode("utf-8", "replace").rstrip()
            if not line:
                continue
            lines.append(line)
            del lines[:-40]
            if FILE_MARKER in line:
                final_path = Path(line.split(FILE_MARKER, 1)[1].strip())
                continue
            match = PROGRESS_RE.search(line)
            if match and on_progress is not None:
                percent = float(match.group(1).replace(",", "."))
                if percent - last_progress >= 0.5:
                    last_progress = percent
                    await on_progress(percent)

    reader = asyncio.create_task(pump())
    try:
        await asyncio.wait_for(proc.wait(), timeout=settings.download_timeout_s)
    except TimeoutError as exc:
        proc.kill()
        await proc.wait()
        raise YoutubeError("Скачивание не уложилось в отведённое время") from exc
    finally:
        await reader

    if final_path is None or not final_path.is_file():
        final_path = _find_downloaded(directory, video_id)
    if proc.returncode != 0 and final_path is None:
        tail = " ".join(lines[-4:])[:600] or "yt-dlp завершился с ошибкой"
        raise YoutubeError(_human_error(tail))
    if final_path is None:
        raise YoutubeError("Файл не появился после скачивания")
    return final_path


def _find_downloaded(directory: Path, video_id: str) -> Path | None:
    candidates = [
        p for p in directory.iterdir()
        if p.is_file() and f"[{video_id}]" in p.name
        and p.suffix.lower() in {".mp4", ".mkv", ".webm", ".mov", ".m4v"}
    ]
    return max(candidates, key=lambda p: p.stat().st_mtime) if candidates else None


async def _probe(path: Path) -> dict:
    settings = get_settings()
    proc = await asyncio.create_subprocess_exec(
        settings.ffprobe_bin, "-v", "error", "-show_entries", "stream=codec_type,codec_name",
        "-of", "json", str(path), stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.DEVNULL,
    )
    out, _ = await asyncio.wait_for(proc.communicate(), timeout=120)
    try:
        return json.loads(out.decode("utf-8", "replace"))
    except json.JSONDecodeError:
        return {}


async def ensure_h264(path: Path) -> Path:
    """Гарантирует MP4/H.264 + AAC: то, что точно откроется на ПК, телевизоре и телефоне."""
    settings = get_settings()
    try:
        info = await _probe(path)
    except (TimeoutError, OSError) as exc:
        log.warning("ffprobe не смог прочитать %s: %s", path.name, exc)
        return path
    video_codec = audio_codec = None
    for stream in info.get("streams") or []:
        if stream.get("codec_type") == "video" and video_codec is None:
            video_codec = (stream.get("codec_name") or "").lower()
        elif stream.get("codec_type") == "audio" and audio_codec is None:
            audio_codec = (stream.get("codec_name") or "").lower()
    video_ok = video_codec == "h264"
    audio_ok = audio_codec is None or audio_codec in {"aac", "mp3"}
    if video_ok and audio_ok and path.suffix.lower() == ".mp4":
        return path

    target = path.with_name(path.stem + ".karman-tmp.mp4")
    if video_ok:
        audio_args = ["-c:v", "copy", "-c:a", "aac", "-b:a", "192k"]
    else:
        audio_args = ["-c:v", "libx264", "-preset", "veryfast", "-crf", "20", "-c:a", "aac", "-b:a", "192k"]
    cmd = [
        settings.ffmpeg_bin, "-y", "-i", str(path), "-map", "0:v:0", "-map", "0:a:0?",
        *audio_args, "-movflags", "+faststart", str(target),
    ]
    proc = await asyncio.create_subprocess_exec(
        *cmd, stdout=asyncio.subprocess.DEVNULL, stderr=asyncio.subprocess.DEVNULL,
    )
    try:
        code = await asyncio.wait_for(proc.wait(), timeout=2 * 3600)
    except TimeoutError:
        proc.kill()
        await proc.wait()
        log.warning("перекодирование %s не уложилось во время", path.name)
        target.unlink(missing_ok=True)
        return path
    if code != 0 or not target.is_file() or target.stat().st_size == 0:
        log.warning("не удалось перекодировать %s (код %s)", path.name, code)
        target.unlink(missing_ok=True)
        return path
    final = path if path.suffix.lower() == ".mp4" else path.with_suffix(".mp4")
    target.replace(final)
    if final != path:
        path.unlink(missing_ok=True)
    return final
