# API «Кармана»

Базовый URL: `http://<сервер>:8095`. Все ответы — JSON, кроме потокового видео, обложек и текстового экспорта.

## Аутентификация

Веб использует HttpOnly cookie `karman_session`, мобильные клиенты — заголовок:

```
Authorization: Bearer <token>
```

Токен приходит в ответах `register` и `login` (поле `token`). Хранится в базе только SHA-256 от токена, поэтому восстановить его нельзя — при потере нужен новый вход.

```http
POST /api/auth/register
{ "username": "artem", "password": "secret123" }
→ { "token": "...", "user": { "id": 1, "username": "artem", "is_admin": true }, "settings": {...} }
```

```http
POST /api/auth/login
{ "username": "artem", "password": "secret123" }
→ { "token": "...", "user": {...}, "settings": {...} }
```

```http
POST /api/auth/logout        → { "ok": true }
GET  /api/auth/me            → { "user": {...}, "settings": {...} }
GET  /api/users              → [{ "id": 1, "username": "artem" }]
```

Первый зарегистрированный пользователь получает `is_admin: true`. Если `ALLOW_REGISTRATION=false`, новые аккаунты не создаются (первый — всегда можно).

## Ошибки

```
400/401/403/404/409 → { "detail": "текст для человека" }
500                 → { "detail": "Внутренняя ошибка сервера" }
```

## Плейлисты

```http
GET /api/playlists?scope=mine|all
```

`mine` — только свои, `all` — свои и открытые чужие. Элемент:

```json
{
  "id": 4,
  "title": "Музыка в машину",
  "url": "https://www.youtube.com/playlist?list=...",
  "youtube_list_id": "PL...",
  "owner_id": 1,
  "owner": "artem",
  "is_hidden": false,
  "enabled": true,
  "poll_minutes": 15,
  "download_existing": false,
  "baseline_done": true,
  "last_checked_at": "2026-11-17T15:46:50",
  "next_check_at": "2026-11-17T16:01:50",
  "last_error": null,
  "created_at": "2026-10-30T15:52:50",
  "cover": "/api/videos/103/thumbnail",
  "cover_last": false,
  "counts": { "videos": 4, "ready": 2, "pending": 2, "failed": 0 }
}
```

Превью (`cover`) — обложка первого либо последнего добавленного готового видео; переключается полем `cover_last`.

```http
POST /api/playlists
{ "url": "...", "hidden": false, "download_existing": false, "poll_minutes": 15 }
→ плейлист
```

`download_existing=false` — скачивать только новые ролики (по умолчанию). Существующие докачиваются, если флаг включён.

```http
PATCH /api/playlists/{id}
{ "title"?: "...", "hidden"?: true, "enabled"?: false,
  "poll_minutes"?: 30, "cover_last"?: true }
→ обновлённый плейлист
```

Менять и удалять плейлист может только владелец. Выключение слежения не удаляет файлы.

```http
POST   /api/playlists/{id}/sync   → запустить проверку сейчас
DELETE /api/playlists/{id}        → удалить плейлист и все его файлы
```

## Видео

```http
GET /api/videos
  ?scope=all|mine
  &playlist_id=4
  &owner_id=1
  &status=pending,downloading,failed   # можно несколько через запятую
  &reaction=like|dislike|none
  &q=поиск
  &limit=60&offset=0
→ { "total": 12, "items": [ ... ] }
```

Без `status` в выборку не попадают `ignored` и `deleted`. Сортировка: готовые выше, затем по дате скачивания.

Элемент видео:

```json
{
  "id": 103,
  "playlist_id": 4,
  "playlist_title": "Музыка в машину",
  "playlist_hidden": false,
  "owner_id": 1,
  "owner": "artem",
  "video_id": "dQw4w9WgXcQ",
  "title": "Rick Astley — Never Gonna Give You Up",
  "channel": "Rick Astley",
  "duration_s": 213,
  "thumbnail_url": "https://i.ytimg.com/vi/.../hqdefault.jpg",
  "thumbnail_local": "/api/videos/103/thumbnail",
  "webpage_url": "https://www.youtube.com/watch?v=...",
  "status": "ready",
  "reaction": "like",
  "progress": 100,
  "file_size": 48234000,
  "downloaded_at": "2026-11-14T18:52:00",
  "watched_at": null,
  "watch_position_s": null,
  "in_playlist": true,
  "deleted_at": null,
  "delete_reason": null,
  "delete_after": null,
  "error": null,
  "created_at": "2026-11-15T18:52:00",
  "can_manage": true
}
```

Статусы: `pending` → `downloading` → `ready`; сбой — `failed` с текстом в `error`; `deleted` — файла нет; `ignored` — не скачивался (например, существовал до добавления без флага).

```http
GET  /api/videos/{id}                 → одно видео
GET  /api/videos/{id}/stream          → Range-поток MP4 (только ready и владелец)
GET  /api/videos/{id}/thumbnail       → локальная обложка (или редирект на превью YouTube)
GET  /api/videos/{id}/download        → файл целиком (Android)
POST /api/videos/{id}/reaction        { "reaction": "like|dislike|none" }
POST /api/videos/{id}/delete          → удалить файл сейчас
POST /api/videos/{id}/retry           → повторить неудачную загрузку
```

Реакции и удаление доступны только владельцу плейлиста. Лайк переносит файл в `saved`, дизлайк удаляет сразу. `can_manage` подсказывает интерфейсу, показывать ли действия.

```http
POST /api/videos/{id}/progress
{ "event_id"?: 12, "position_s": 154.2, "duration_s": 213, "completed": false }
→ { "event_id": 12, "completed": false, "watched_at": "...", "delete_after": "..." }
```

`delete_after` — расчётный срок удаления; `null`, если действует лайк или файла уже нет. История пишется всем, сроки считаются по настройкам владельца.

## История

```http
GET /api/history?limit=100&offset=0
→ { "total": 40, "items": [
    { "id": 12, "video_id": 103, "title": "...", "channel": "...",
      "webpage_url": "...", "owner": "artem", "position_s": 154,
      "duration_s": 213, "percent": 72, "completed": false,
      "started_at": "...", "last_at": "..." }
  ] }
```

```http
GET /api/history/export.txt   → text/plain, файл karman-history.txt
```

Экспорт содержит только историю текущего пользователя, включая удалённые видео.

## Настройки

```http
GET /api/settings
→ { "retention_unwatched_days": 7, "retention_watched_days": 1, "default_poll_minutes": 15 }

PUT /api/settings
{ "retention_unwatched_days": 7, "retention_watched_days": 1, "default_poll_minutes": 15 }
→ обновлённые настройки
```

```http
GET /api/status
→ {
    "app": "Карман",
    "counts": { "ready": 9, "pending": 1, "downloading": 1, "failed": 1 },
    "videos_root": "G:\\Video",
    "disk_free": 687194767360,
    "disk_total": 1997159792640
  }
```

Счётчики в `/api/status` используются для бейджей «Загрузки» в боковой панели: `failed` показывается красной цифрой.
