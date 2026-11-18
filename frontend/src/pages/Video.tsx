import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api, ApiError } from '../api';
import { ErrorBox, Spinner, Status, formatDate, formatDuration, formatSize, timeLeft } from '../components/ui';
import { icons } from '../components/icons';
import type { Video } from '../types';

function progressBeacon(videoId: number, eventId: number | null, position: number, duration: number, completed: boolean) {
  const payload = JSON.stringify({ event_id: eventId, position_s: position, duration_s: duration, completed });
  const blob = new Blob([payload], { type: 'application/json' });
  if (navigator.sendBeacon) {
    navigator.sendBeacon(`/api/videos/${videoId}/progress`, blob);
    return;
  }
  void fetch(`/api/videos/${videoId}/progress`, {
    method: 'POST', body: payload, headers: { 'Content-Type': 'application/json' }, keepalive: true,
  });
}

export function VideoPage() {
  const { id } = useParams();
  const videoId = Number(id);
  const navigate = useNavigate();
  const [video, setVideo] = useState<Video | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const playerRef = useRef<HTMLVideoElement>(null);
  const eventIdRef = useRef<number | null>(null);
  const lastSentRef = useRef(0);
  const videoRef = useRef<Video | null>(null);
  videoRef.current = video;

  const load = useCallback(async () => {
    if (!Number.isFinite(videoId)) return;
    try {
      const item = await api.video(videoId);
      setVideo(item);
      setError('');
    } catch (exc) {
      setError(exc instanceof ApiError ? exc.message : 'Не удалось загрузить видео');
    } finally {
      setLoading(false);
    }
  }, [videoId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!video || (video.status !== 'pending' && video.status !== 'downloading')) return;
    const timer = window.setInterval(() => void load(), 3000);
    return () => window.clearInterval(timer);
  }, [video, load]);

  const sendProgress = useCallback(async (completed = false) => {
    const player = playerRef.current;
    const current = videoRef.current;
    if (!player || !current || current.status !== 'ready') return;
    const position = player.currentTime || 0;
    const duration = Number.isFinite(player.duration) ? player.duration : (current.duration_s || 0);
    try {
      const response = await api.progress(current.id, {
        event_id: eventIdRef.current,
        position_s: position,
        duration_s: duration,
        completed,
      });
      eventIdRef.current = response.event_id;
      lastSentRef.current = Date.now();
      if (completed || response.completed) {
        setVideo((previous) => previous ? { ...previous, watched_at: response.watched_at, delete_after: response.delete_after } : previous);
      }
    } catch {
      // история не должна мешать просмотру
    }
  }, []);

  useEffect(() => {
    const player = playerRef.current;
    if (!player || !video || video.status !== 'ready') return;
    const onPlay = () => { void sendProgress(false); };
    const onTimeUpdate = () => {
      if (Date.now() - lastSentRef.current > 10_000) void sendProgress(false);
    };
    const onPause = () => { void sendProgress(false); };
    const onEnded = () => { void sendProgress(true); void load(); };
    player.addEventListener('play', onPlay);
    player.addEventListener('timeupdate', onTimeUpdate);
    player.addEventListener('pause', onPause);
    player.addEventListener('ended', onEnded);
    return () => {
      player.removeEventListener('play', onPlay);
      player.removeEventListener('timeupdate', onTimeUpdate);
      player.removeEventListener('pause', onPause);
      player.removeEventListener('ended', onEnded);
    };
  }, [video?.id, video?.status, sendProgress, load]);

  useEffect(() => {
    return () => {
      const current = videoRef.current;
      const player = playerRef.current;
      if (!current || !player || current.status !== 'ready') return;
      const position = player.currentTime || 0;
      const duration = Number.isFinite(player.duration) ? player.duration : (current.duration_s || 0);
      if (position > 0) progressBeacon(current.id, eventIdRef.current, position, duration, false);
    };
  }, []);

  const react = async (reaction: 'like' | 'dislike' | 'none') => {
    if (!video) return;
    if (reaction === 'dislike' && !window.confirm('Поставить дизлайк и удалить файл с сервера безвозвратно?')) return;
    setBusy(true);
    try {
      setVideo(await api.react(video.id, reaction));
    } catch (exc) {
      setError(exc instanceof ApiError ? exc.message : 'Не удалось изменить реакцию');
    } finally {
      setBusy(false);
    }
  };

  const deleteNow = async () => {
    if (!video || !window.confirm('Удалить файл с сервера сейчас? Это необратимо.')) return;
    setBusy(true);
    try {
      setVideo(await api.deleteVideo(video.id));
    } catch (exc) {
      setError(exc instanceof ApiError ? exc.message : 'Не удалось удалить');
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <div className="screen-loader"><Spinner /> Загружаем видео…</div>;
  if (!video) return <ErrorBox text={error || 'Видео не найдено'} onRetry={() => void load()} />;

  const deleted = video.status === 'deleted';
  const ready = video.status === 'ready';
  const liked = video.reaction === 'like';

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <button className="text-link" onClick={() => navigate(-1)} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            {icons.back} Назад
          </button>
          <h1 style={{ marginTop: 10, fontSize: 24 }}>{video.title}</h1>
          <p className="video-meta-line" style={{ marginTop: 6 }}>
            <span>{video.channel || 'без канала'}</span>
            <span className="sep">/</span>
            <span>{video.owner}</span>
            <span className="sep">/</span>
            <Link to={`/playlists/${video.playlist_id}`}>{video.playlist_title}</Link>
            {video.playlist_hidden && <span className="tag">скрытый</span>}
            {!video.in_playlist && <span className="tag warn">нет в источнике</span>}
            <span className="sep">/</span>
            <a href={video.webpage_url} target="_blank" rel="noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              Оригинал на YouTube {icons.external}
            </a>
          </p>
        </div>
      </div>

      {error && <ErrorBox text={error} onRetry={() => void load()} />}

      <div className="video-layout">
        <div className="player-shell">
          {ready ? (
            <video
              ref={playerRef}
              className="player"
              controls
              playsInline
              preload="metadata"
              poster={video.thumbnail_url || undefined}
              src={`/api/videos/${video.id}/stream`}
            />
          ) : (
            <div className="player-placeholder">
              {deleted ? (
                <>
                  <div className="placeholder-title">Файл удалён</div>
                  <p className="hint" style={{ textAlign: 'center' }}>
                    {video.delete_reason === 'disliked' ? 'Вы поставили дизлайк.'
                      : video.delete_reason === 'watched' ? 'Видео было просмотрено и срок хранения истёк.'
                        : video.delete_reason === 'expired' ? 'Срок хранения истёк.'
                          : 'Файл удалён вручную.'}
                  </p>
                  <a className="btn" href={video.webpage_url} target="_blank" rel="noreferrer">
                    Смотреть на YouTube {icons.external}
                  </a>
                </>
              ) : video.status === 'failed' ? (
                <>
                  <div className="placeholder-title">Не удалось скачать</div>
                  <p className="hint" style={{ textAlign: 'center', maxWidth: '60ch' }}>{video.error || 'Неизвестная ошибка'}</p>
                  {video.can_manage && (
                    <button className="btn" onClick={async () => {
                      try { setVideo(await api.retryVideo(video.id)); } catch (exc) {
                        setError(exc instanceof ApiError ? exc.message : 'Не удалось повторить');
                      }
                    }}>Повторить</button>
                  )}
                </>
              ) : (
                <>
                  <div className="placeholder-title">Видео скачивается</div>
                  <p className="hint">Прогресс: {Math.round(video.progress)}%</p>
                  <div className="track" style={{ width: 220, height: 3 }}>
                    <span style={{ width: `${video.progress}%` }} />
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        <div className="block video-facts">
          <div className="block-head">
            <span className="block-title">Сведения</span>
            {video.can_manage && !deleted && (
              <div className="video-actions">
                <button
                  className={liked ? 'icon-btn on' : 'icon-btn'}
                  disabled={busy}
                  onClick={() => void react(liked ? 'none' : 'like')}
                  title={liked ? 'Убрать из сохранённых' : 'Сохранить навсегда'}
                  aria-label={liked ? 'Убрать из сохранённых' : 'Сохранить навсегда'}
                  aria-pressed={liked}
                >
                  {icons.thumbUp}
                </button>
                <button
                  className="icon-btn danger"
                  disabled={busy}
                  onClick={() => void react('dislike')}
                  title="Дизлайк и удалить файл"
                  aria-label="Дизлайк и удалить файл"
                >
                  {icons.thumbDown}
                </button>
                <button
                  className="icon-btn danger"
                  disabled={busy}
                  onClick={() => void deleteNow()}
                  title="Удалить файл сейчас"
                  aria-label="Удалить файл сейчас"
                >
                  {icons.trash}
                </button>
              </div>
            )}
          </div>
          <div className="block-rows">
            <div className="block-row"><span>Статус</span><strong><Status video={video} /></strong></div>
            <div className="block-row"><span>Длительность</span><strong className="mono">{video.duration_s ? formatDuration(video.duration_s) : '—'}</strong></div>
            <div className="block-row"><span>Размер файла</span><strong className="mono">{formatSize(video.file_size)}</strong></div>
            <div className="block-row"><span>Скачано</span><strong className="mono">{formatDate(video.downloaded_at)}</strong></div>
            <div className="block-row"><span>Просмотрено</span><strong className="mono">{formatDate(video.watched_at)}</strong></div>
            <div className="block-row">
              <span>Удаление с сервера</span>
              <strong className="mono">
                {ready && video.reaction === 'none' && video.delete_after
                  ? `${timeLeft(video.delete_after)} · ${formatDate(video.delete_after)}`
                  : liked ? 'бессрочно' : '—'}
              </strong>
            </div>
            <div className="block-row"><span>Добавлено</span><strong className="mono">{formatDate(video.created_at)}</strong></div>
          </div>
        </div>
      </div>
    </div>
  );
}
