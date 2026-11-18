"""Приложение «Карман»: локальный видеоархив из плейлистов YouTube."""

from __future__ import annotations

import asyncio
import logging
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles

from app.api import auth, history, playlists, settings as settings_api, videos
from app.config import get_settings
from app.db import init_db
from app.services import cleanup, downloads, sync

log = logging.getLogger(__name__)
settings = get_settings()
logging.basicConfig(
    level=getattr(logging, settings.log_level.upper(), logging.INFO),
    format="%(asctime)s %(levelname)s %(name)s: %(message)s",
)

STATIC_DIR = Path(__file__).parent / "static"


@asynccontextmanager
async def lifespan(_app: FastAPI):
    await init_db()
    if await downloads.reset_stale():
        log.info("незаконченные скачивания возвращены в очередь")
    tasks: list[asyncio.Task] = []
    if not settings.disable_background:
        tasks += downloads.start_tasks()
        tasks += sync.start_tasks()
        tasks += cleanup.start_tasks()
        log.info("фоновые задачи запущены: скачивание ×%s", settings.max_parallel_downloads)
    try:
        yield
    finally:
        for task in tasks:
            task.cancel()
        for task in tasks:
            try:
                await task
            except (asyncio.CancelledError, Exception):
                pass


app = FastAPI(title="Карман", version="1.0.0", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(playlists.router)
app.include_router(videos.router)
app.include_router(history.router)
app.include_router(settings_api.router)


@app.get("/healthz")
async def healthz() -> dict:
    return {"ok": True, "app": settings.app_name}


@app.exception_handler(Exception)
async def unhandled(request: Request, exc: Exception) -> JSONResponse:
    log.exception("необработанная ошибка %s %s", request.method, request.url.path)
    return JSONResponse(status_code=500, content={"detail": "Внутренняя ошибка сервера"})


if (STATIC_DIR / "assets").is_dir():
    app.mount("/assets", StaticFiles(directory=STATIC_DIR / "assets"), name="assets")


@app.get("/{path:path}", include_in_schema=False)
async def spa(path: str):
    if path.startswith("api/"):
        return JSONResponse(status_code=404, content={"detail": "Не найдено"})
    candidate = (STATIC_DIR / path).resolve()
    if STATIC_DIR in candidate.parents and candidate.is_file():
        return FileResponse(candidate)
    index = STATIC_DIR / "index.html"
    if index.is_file():
        return FileResponse(index)
    return JSONResponse(
        status_code=503,
        content={"detail": "Фронтенд не собран. Соберите frontend или используйте Docker."},
    )
