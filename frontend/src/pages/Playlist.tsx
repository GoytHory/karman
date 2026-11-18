import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api, ApiError } from '../api';
import { useAuth } from '../auth';
import { Empty, ErrorBox, Spinner, VideoGrid, formatDate } from '../components/ui';
import { icons } from '../components/icons';
import type { Playlist, Video } from '../types';

export function PlaylistPage() {
  const { id } = useParams();
  const playlistId = Number(id);
  const { user } = useAuth();
  const navigate = useNavigate();
  const [playlist, setPlaylist] = useState<Playlist | null>(null);
  const [videos, setVideos] = useState<Video[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');

  const load = useCallback(async () => {
    if (!Number.isFinite(playlistId)) return;
    try {
      const [info, list] = await Promise.all([
        api.playlist(playlistId),
        api.videos({ playlist_id: playlistId, limit: 200 }),
      ]);
      setPlaylist(info);
      setVideos(list.items);
      setTotal(list.total);
      setError('');
    } catch (exc) {
      setError(exc instanceof ApiError ? exc.message : 'Не удалось загрузить плейлист');
    } finally {
      setLoading(false);
    }
  }, [playlistId]);

  useEffect(() => {
    void load();
    const timer = window.setInterval(() => void load(), 4500);
    return () => window.clearInterval(timer);
  }, [load]);

  const isOwner = !!playlist && playlist.owner_id === user?.id;

  const sync = async () => {
    if (!playlist) return;
    setBusy(true);
    setNotice('');
    try {
      await api.syncPlaylist(playlist.id);
      setNotice('Проверка запущена — список обновится через несколько секунд.');
      await load();
    } catch (exc) {
      setError(exc instanceof ApiError ? exc.message : 'Не удалось запустить проверку');
    } finally {
      setBusy(false);
    }
  };

  const retry = async (video: Video) => {
    try {
      await api.retryVideo(video.id);
      await load();
    } catch (exc) {
      setError(exc instanceof ApiError ? exc.message : 'Не удалось повторить');
    }
  };

  const toggleHidden = async () => {
    if (!playlist) return;
    try {
      setPlaylist(await api.patchPlaylist(playlist.id, { hidden: !playlist.is_hidden }));
    } catch (exc) {
      setError(exc instanceof ApiError ? exc.message : 'Не удалось изменить видимость');
    }
  };

  const changePoll = async (minutes: number) => {
    if (!playlist) return;
    try {
      setPlaylist(await api.patchPlaylist(playlist.id, { poll_minutes: minutes }));
    } catch (exc) {
      setError(exc instanceof ApiError ? exc.message : 'Не удалось изменить частоту');
    }
  };

  const remove = async () => {
    if (!playlist) return;
    if (!window.confirm(`Удалить плейлист «${playlist.title}» и все его файлы? Это необратимо.`)) return;
    try {
      await api.deletePlaylist(playlist.id);
      navigate('/my');
    } catch (exc) {
      setError(exc instanceof ApiError ? exc.message : 'Не удалось удалить плейлист');
    }
  };

  if (loading) return <div className="screen-loader"><Spinner /> Загружаем плейлист…</div>;
  if (!playlist) return <ErrorBox text={error || 'Плейлист не найден'} onRetry={() => void load()} />;

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <Link to="/my" className="text-link" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            {icons.back} Мои плейлисты
          </Link>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12 }}>
            {playlist.is_hidden && <span className="tag">скрытый</span>}
            {!playlist.enabled && <span className="tag warn">выключен</span>}
          </div>
          <h1 style={{ marginTop: 6 }}>{playlist.title}</h1>
          <p className="lede">
            {playlist.owner} <span className="mute">/</span> {total} видео <span className="mute">/</span>{' '}
            проверен {formatDate(playlist.last_checked_at)} <span className="mute">/</span> каждые {playlist.poll_minutes} мин
          </p>
          <a className="text-link" href={playlist.url} target="_blank" rel="noreferrer"
            style={{ display: 'inline-flex', alignItems: 'center', gap: 4, marginTop: 6 }}>
            Открыть на YouTube {icons.external}
          </a>
        </div>

        {isOwner && (
          <div className="head-actions">
            <button className="btn" disabled={busy} onClick={() => void sync()}>
              {busy ? <Spinner /> : 'Проверить сейчас'}
            </button>
            <button className="btn ghost" onClick={() => void toggleHidden()}>
              {playlist.is_hidden ? 'Сделать открытым' : 'Скрыть'}
            </button>
            <select
              className="input"
              value={playlist.poll_minutes}
              onChange={(event) => void changePoll(Number(event.target.value))}
              aria-label="Частота проверки"
              style={{ width: 96, height: 30, borderColor: 'var(--line-strong)' }}
            >
              {[5, 15, 30, 60, 120, 360].map((value) => <option key={value} value={value}>{value} мин</option>)}
            </select>
          </div>
        )}
      </div>

      {notice && <div className="notice">{notice}</div>}
      {playlist.last_error && <div className="error-box">Последняя ошибка: {playlist.last_error}</div>}
      {error && <ErrorBox text={error} onRetry={() => void load()} />}

      {videos.length === 0 ? (
        <Empty
          title="Видео пока нет"
          text={playlist.baseline_done ? 'В плейлисте нет роликов или они ещё не подхватились.' : 'Идёт первая проверка плейлиста…'}
        />
      ) : (
        <VideoGrid videos={videos} onRetry={isOwner ? retry : undefined} showPlaylist={false} />
      )}

      {isOwner && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', borderTop: '1px solid var(--line)', paddingTop: 14 }}>
          <button className="btn ghost danger-text" onClick={() => void remove()}>Удалить плейлист и файлы</button>
        </div>
      )}
    </div>
  );
}
