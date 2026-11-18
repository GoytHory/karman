/**
 * Демо-API только для согласования интерфейса.
 * Не часть сервиса: поднимает те же ручки, что и FastAPI, но с придуманными данными.
 * Запуск: node tools/mock-api.mjs   (слушает 127.0.0.1:8095)
 */
import http from 'node:http';

const PORT = Number(process.env.MOCK_PORT || 8095);
const NOW = Date.now();
let authed = false;
const iso = (msAgo) => new Date(NOW - msAgo).toISOString();

const settings = {
  retention_unwatched_days: 7,
  retention_watched_days: 1,
  default_poll_minutes: 15,
};

const user = {
  id: 1,
  username: 'artem',
  is_admin: true,
  created_at: iso(30 * 86400e3),
};

const users = [
  { id: 1, username: 'artem' },
  { id: 2, username: 'lena' },
];

const playlists = [
  {
    id: 4, title: 'Музыка в машину', owner_id: 1, owner: 'artem', is_hidden: false, enabled: true,
    poll_minutes: 15, download_existing: false, baseline_done: true, cover_last: false,
    url: 'https://www.youtube.com/playlist?list=PLcar2026', youtube_list_id: 'PLcar2026',
    last_checked_at: iso(6 * 60e3), next_check_at: iso(-9 * 60e3), last_error: null,
    created_at: iso(18 * 86400e3),
  },
  {
    id: 3, title: 'Тихий вечер', owner_id: 1, owner: 'artem', is_hidden: true, enabled: true,
    poll_minutes: 60, download_existing: true, baseline_done: true, cover_last: false,
    url: 'https://www.youtube.com/playlist?list=PLquiet03', youtube_list_id: 'PLquiet03',
    last_checked_at: iso(42 * 60e3), next_check_at: iso(-18 * 60e3), last_error: null,
    created_at: iso(12 * 86400e3),
  },
  {
    id: 2, title: 'Лена: зарядка', owner_id: 2, owner: 'lena', is_hidden: false, enabled: true,
    poll_minutes: 30, download_existing: false, baseline_done: true, cover_last: false,
    url: 'https://www.youtube.com/playlist?list=PLlenaMix2', youtube_list_id: 'PLlenaMix2',
    last_checked_at: iso(11 * 60e3), next_check_at: iso(-19 * 60e3), last_error: null,
    created_at: iso(9 * 86400e3),
  },
  {
    id: 1, title: 'Любимое, переслушиваю', owner_id: 1, owner: 'artem', is_hidden: false, enabled: true,
    poll_minutes: 15, download_existing: false, baseline_done: true, cover_last: false,
    url: 'https://www.youtube.com/playlist?list=PLfavorites1', youtube_list_id: 'PLfavorites1',
    last_checked_at: iso(3 * 60e3), next_check_at: iso(-12 * 60e3),
    last_error: 'YouTube просит вход или проверку. Добавьте файл cookies (README)',
    created_at: iso(25 * 86400e3),
  },
];

const rawVideos = [
  ['dQw4w9WgXcQ', 'Rick Astley – Never Gonna Give You Up', 'Rick Astley', 213, 1, 'ready', 'like', null, 3 * 86400e3],
  ['9bZkp7q19f0', 'PSY – GANGNAM STYLE (강남스타일)', 'officialpsy', 252, 1, 'ready', 'none', 2 * 86400e3, 5 * 86400e3],
  ['kJQP7kiw5Fk', 'Luis Fonsi – Despacito ft. Daddy Yankee', 'Luis Fonsi', 281, 4, 'ready', 'none', null, 4 * 86400e3],
  ['JGwWNGJdvx8', 'Ed Sheeran – Shape of You', 'Ed Sheeran', 263, 4, 'ready', 'like', null, 20 * 86400e3],
  ['OPf0YbXqDm0', 'Mark Ronson – Uptown Funk ft. Bruno Mars', 'Mark Ronson', 270, 4, 'downloading', 'none', null, null],
  ['RgKAFK5djSk', 'Wiz Khalifa – See You Again ft. Charlie Puth', 'Wiz Khalifa', 237, 4, 'pending', 'none', null, null],
  ['fJ9rUzIMcZQ', 'Queen – Bohemian Rhapsody', 'Queen Official', 359, 1, 'ready', 'none', 6 * 86400e3, 6 * 86400e3],
  ['hT_nvWreIhg', 'OneRepublic – Counting Stars', 'OneRepublic', 257, 1, 'ready', 'like', null, 14 * 86400e3],
  ['CevxZvSJLk8', 'Katy Perry – Roar', 'Katy Perry', 222, 2, 'ready', 'none', null, 3 * 86400e3],
  ['09R8_2nJtjg', 'Maroon 5 – Sugar', 'Maroon 5', 235, 2, 'ready', 'none', 1 * 86400e3, 2 * 86400e3],
  ['2Vv-BfVoq4g', 'Ed Sheeran – Perfect', 'Ed Sheeran', 279, 3, 'ready', 'none', null, 8 * 86400e3],
  ['60ItHLz5WEA', 'Alan Walker – Faded', 'Alan Walker', 212, 3, 'failed', 'none', null, null],
  ['jNQXAC9IVRw', 'Me at the zoo', 'jawed', 19, 3, 'deleted', 'dislike', null, 30 * 86400e3],
];

let nextId = 100;
const videos = rawVideos.map(([video_id, title, channel, duration_s, playlist_id, status, reaction, watchedAgo, downloadAgo], index) => {
  const playlist = playlists.find((item) => item.id === playlist_id);
  return {
    id: ++nextId,
    playlist_id,
    playlist_title: playlist.title,
    playlist_hidden: playlist.is_hidden,
    owner_id: playlist.owner_id,
    owner: playlist.owner,
    video_id,
    title,
    channel,
    duration_s,
    thumbnail_url: `https://i.ytimg.com/vi/${video_id}/hqdefault.jpg`,
    thumbnail_local: `/api/videos/${nextId}/thumbnail`,
    webpage_url: `https://www.youtube.com/watch?v=${video_id}`,
    upload_date: '20240101',
    status,
    reaction,
    progress: status === 'downloading' ? 37 : status === 'ready' ? 100 : 0,
    file_size: status === 'ready' ? 48000000 + index * 7300000 : null,
    downloaded_at: downloadAgo ? iso(downloadAgo) : null,
    watched_at: watchedAgo ? iso(watchedAgo) : null,
    watch_position_s: watchedAgo ? duration_s : null,
    in_playlist: true,
    deleted_at: status === 'deleted' ? iso(86400e3) : null,
    delete_reason: status === 'deleted' ? 'disliked' : null,
    delete_after: null,
    error: status === 'failed' ? 'YouTube просит вход или проверку. Добавьте файл cookies (README)' : null,
    created_at: iso((index + 2) * 86400e3),
    can_manage: playlist.owner_id === user.id,
  };
});

const withDeadline = (video) => {
  if (video.reaction === 'like' || video.status !== 'ready' || video.deleted_at) {
    return { ...video, delete_after: null };
  }
  const base = video.watched_at ? new Date(video.watched_at).getTime() : new Date(video.downloaded_at).getTime();
  const days = video.watched_at ? settings.retention_watched_days : settings.retention_unwatched_days;
  return { ...video, delete_after: new Date(base + days * 86400e3).toISOString() };
};

const history = [
  [0, 58 * 60e3], [7, 5 * 3600e3], [9, 26 * 3600e3], [8, 2 * 86400e3], [4, 3 * 86400e3],
  [11, 4 * 86400e3], [3, 6 * 86400e3], [2, 8 * 86400e3],
].map(([index, ago], position) => {
  const video = videos[index];
  return {
    id: 900 - position,
    video_id: video.id,
    title: video.title,
    channel: video.channel,
    webpage_url: video.webpage_url,
    owner: video.owner,
    started_at: iso(ago),
    last_at: iso(ago),
    position_s: Math.round((video.duration_s || 0) * (position % 3 === 0 ? 1 : 0.45)),
    duration_s: video.duration_s,
    completed: position % 3 === 0,
  };
});

const json = (res, status, body) => {
  const text = JSON.stringify(body);
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Content-Length': Buffer.byteLength(text) });
  res.end(text);
};

const readBody = async (req) => {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  if (!chunks.length) return {};
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { return {}; }
};

const counts = (playlistId) => {
  const list = videos.filter((video) => video.playlist_id === playlistId);
  return {
    videos: list.length,
    ready: list.filter((video) => video.status === 'ready').length,
    pending: list.filter((video) => ['pending', 'downloading'].includes(video.status)).length,
    failed: list.filter((video) => video.status === 'failed').length,
  };
};

const playlistOut = (playlist) => {
  const list = videos.filter((video) => video.playlist_id === playlist.id && video.status === 'ready');
  const cover = playlist.cover_last ? list[list.length - 1] : list[0];
  return { ...playlist, counts: counts(playlist.id), cover: cover ? `/api/videos/${cover.id}/thumbnail` : null };
};

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  const path = url.pathname;
  const method = req.method || 'GET';
  const q = url.searchParams;

  if (path === '/healthz') return json(res, 200, { ok: true, app: 'Карман' });

  if (path.startsWith('/api/')) {
    await new Promise((resolve) => setTimeout(resolve, 120));
  }

  if (path === '/api/auth/me') {
    if (!authed) return json(res, 401, { detail: 'Нужно войти' });
    return json(res, 200, { user, settings });
  }
  if (path === '/api/auth/login' || path === '/api/auth/register') {
    authed = true;
    return json(res, 200, { token: 'demo', user, settings });
  }
  if (path === '/api/auth/logout') {
    authed = false;
    return json(res, 200, { ok: true });
  }
  if (path === '/api/users') return json(res, 200, users);

  if (path === '/api/settings' && method === 'PUT') {
    Object.assign(settings, await readBody(req));
    return json(res, 200, settings);
  }
  if (path === '/api/settings') return json(res, 200, settings);

  if (path === '/api/status') {
    return json(res, 200, {
      app: 'Карман',
      counts: { ready: videos.filter((v) => v.status === 'ready').length, pending: 1, downloading: 1, failed: 1 },
      videos_root: 'G:\\Video',
      disk_free: 640 * 1024 ** 3,
      disk_total: 1860 * 1024 ** 3,
    });
  }

  if (path === '/api/playlists' && method === 'GET') {
    const scope = q.get('scope') || 'mine';
    const list = scope === 'mine'
      ? playlists.filter((playlist) => playlist.owner_id === user.id)
      : playlists.filter((playlist) => !playlist.is_hidden || playlist.owner_id === user.id);
    return json(res, 200, list.map(playlistOut));
  }
  if (path === '/api/playlists' && method === 'POST') {
    const body = await readBody(req);
    const playlist = {
      id: ++nextId, title: 'Новый плейлист', owner_id: user.id, owner: user.username,
      is_hidden: !!body.hidden, enabled: true, poll_minutes: body.poll_minutes || 15,
      download_existing: !!body.download_existing, baseline_done: false,
      url: body.url, youtube_list_id: 'PLnew', last_checked_at: null, next_check_at: iso(0),
      last_error: null, created_at: iso(0),
    };
    playlists.unshift(playlist);
    return json(res, 200, playlistOut(playlist));
  }
  const playlistMatch = path.match(/^\/api\/playlists\/(\d+)(\/sync)?$/);
  if (playlistMatch) {
    const playlist = playlists.find((item) => item.id === Number(playlistMatch[1]));
    if (!playlist) return json(res, 404, { detail: 'Плейлист не найден' });
    if (method === 'GET') return json(res, 200, playlistOut(playlist));
    if (method === 'PATCH') {
      Object.assign(playlist, await readBody(req));
      return json(res, 200, playlistOut(playlist));
    }
    if (method === 'DELETE') return json(res, 200, { ok: true });
    if (method === 'POST') {
      playlist.last_checked_at = iso(0);
      playlist.last_error = null;
      return json(res, 200, playlistOut(playlist));
    }
  }

  if (path === '/api/videos' && method === 'GET') {
    const status = q.get('status') || '';
    const reaction = q.get('reaction') || '';
    const playlistId = q.get('playlist_id');
    const ownerId = q.get('owner_id');
    const search = (q.get('q') || '').toLowerCase();
    let list = videos.filter((video) => {
      if (!playlists.some((playlist) => playlist.id === video.playlist_id)) return false;
      if (video.playlist_hidden && video.owner_id !== user.id) return false;
      if (q.get('scope') === 'mine' && video.owner_id !== user.id) return false;
      if (playlistId && video.playlist_id !== Number(playlistId)) return false;
      if (ownerId && video.owner_id !== Number(ownerId)) return false;
      if (status && !status.split(',').includes(video.status)) return false;
      if (!status && ['ignored', 'deleted'].includes(video.status)) return false;
      if (reaction && video.reaction !== reaction) return false;
      if (search && !`${video.title} ${video.channel}`.toLowerCase().includes(search)) return false;
      return true;
    });
    list = list.sort((a, b) => {
      const queue = status && !status.split(',').includes('ready');
      const rank = queue
        ? (video) => ({ failed: 0, downloading: 1, pending: 2 }[video.status] ?? 3)
        : (video) => (video.status === 'ready' ? 0 : 1);
      return rank(a) - rank(b) || (b.downloaded_at || '').localeCompare(a.downloaded_at || '') || b.id - a.id;
    });
    const limit = Number(q.get('limit') || 60);
    const offset = Number(q.get('offset') || 0);
    return json(res, 200, { total: list.length, items: list.slice(offset, offset + limit).map(withDeadline) });
  }

  const videoMatch = path.match(/^\/api\/videos\/(\d+)(\/[a-z]+)?$/);
  if (videoMatch) {
    const video = videos.find((item) => item.id === Number(videoMatch[1]));
    if (!video) return json(res, 404, { detail: 'Видео не найдено' });
    const tail = videoMatch[2];
    if (!tail && method === 'GET') return json(res, 200, withDeadline(video));
    if (tail === '/thumbnail') {
      res.writeHead(302, { Location: video.thumbnail_url });
      return res.end();
    }
    if (tail === '/stream') return json(res, 404, { detail: 'Демо: потока нет' });
    if (tail === '/reaction') {
      const body = await readBody(req);
      video.reaction = body.reaction;
      if (body.reaction === 'dislike') { video.status = 'deleted'; video.delete_reason = 'disliked'; }
      return json(res, 200, withDeadline(video));
    }
    if (tail === '/delete') {
      video.status = 'deleted';
      video.delete_reason = 'manual';
      return json(res, 200, withDeadline(video));
    }
    if (tail === '/retry') {
      video.status = 'pending';
      video.error = null;
      return json(res, 200, withDeadline(video));
    }
    if (tail === '/progress') {
      return json(res, 200, { event_id: 901, completed: false, watched_at: video.watched_at, delete_after: withDeadline(video).delete_after });
    }
  }

  if (path === '/api/history') {
    const limit = Number(q.get('limit') || 100);
    const offset = Number(q.get('offset') || 0);
    return json(res, 200, { total: history.length, items: history.slice(offset, offset + limit) });
  }
  if (path === '/api/history/export.txt') {
    res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
    return res.end('История просмотра — Карман\n');
  }

  return json(res, 404, { detail: 'Не найдено' });
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`demo api: http://127.0.0.1:${PORT}`);
});
