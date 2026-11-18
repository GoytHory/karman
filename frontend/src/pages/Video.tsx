import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api, ApiError } from '../api';
import { ErrorBox, Spinner, Status, formatDate, formatDuration, formatSize, timeLeft } from '../components/ui';
import { KarmanPlayer } from '../components/KarmanPlayer';
import { icons } from '../components/icons';
import type { PlaybackInfo, Video } from '../types';

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
  const [info, setInfo] = useState<PlaybackInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [nextCard, setNextCard] = useState<Video | null>(null);
  const eventIdRef = useRef<number | null>(null);
  const infoRef = useRef<PlaybackInfo | null>(null);
  infoRef.current = info;

  const load = useCallback(async () => {
    if (!Number.isFinite(videoId)) return;
    try {
      const payload = await api.playback(videoId);
      setInfo(payload);
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
    const status = info?.video.status;
    if (!status || (status !== 'pending' && status !== 'downloading')) return;
    const timer = window.setInterval(() => void load(), 3000);
    return () => window.clearInterval(timer);
  }, [info?.video.status, load]);

  useEffect(() => {
    const next = info?.next;
    if (!next) {
      setNextCard(null);
      return;
    }
    let alive = true;
    api.video(next.id)
      .then((item) => { if (alive) setNextCard(item); })
      .catch(() => { if (alive) setNextCard(null); });
    return () => { alive = false; };
  }, [info?.next?.id]);

  const patchVideo = useCallback((patch: Partial<Video>) => {
    setInfo((previous) => previous ? { ...previous, video: { ...previous.video, ...patch } } : previous);
  }, []);

  const sendProgress = useCallback(async (position: number, duration: number, completed: boolean) => {
    const current = infoRef.current?.video;
    if (!current || current.status !== 'ready') return;
    try {
      const response = await api.progress(current.id, {
        event_id: eventIdRef.current,
        position_s: position,
        duration_s: duration,
        completed,
      });
      eventIdRef.current = response.event_id;
      if (response.completed) {
        patchVideo({
          watched_at: response.watched_at,
          delete_after: response.delete_after,
          watch_position_s: position,
        });
      }
    } catch {
      // история не должна мешать просмотру
    }
  }, [patchVideo]);

  const leave = useCallback((position: number, duration: number) => {
    const current = infoRef.current?.video;
    if (!current || current.status !== 'ready' || position <= 0) return;
    progressBeacon(current.id, eventIdRef.current, position, duration, false);
  }, []);

  const react = async (reaction: 'like' | 'dislike' | 'none') => {
    if (!info) return;
    if (reaction === 'dislike' && !window.confirm('Поставить дизлайк и удалить файл с сервера безвозвратно?')) return;
    setBusy(true);
    try {
      const item = await api.react(info.video.id, reaction);
      setInfo((previous) => previous ? { ...previous, video: item } : previous);
    } catch (exc) {
      setError(exc instanceof ApiError ? exc.message : 'Не удалось изменить реакцию');
    } finally {
      setBusy(false);
    }
  };

  const deleteNow = async () => {
    if (!info || !window.confirm('Удалить файл с сервера сейчас? Это необратимо.')) return;
    setBusy(true);
    try {
      const item = await api.deleteVideo(info.video.id);
      setInfo((previous) => previous ? { ...previous, video: item } : previous);
    } catch (exc) {
      setError(exc instanceof ApiError ? exc.message : 'Не удалось удалить');
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <div className="screen-loader"><Spinner /> Загружаем видео…</div>;
  if (!info) return <ErrorBox text={error || 'Видео не найдено'} onRetry={() => void load()} />;

  const video = info.video;
  const deleted = video.status === 'deleted';
  const ready = video.status === 'ready';
  const liked = video.reaction === 'like';

  return (
    <div className="page video-page">
      <div className="video-topline">
        <button className="text-link" onClick={() => navigate(-1)}>
          {icons.back} Назад
        </button>
        <span className="video-topline-sep">/</span>
        <Link to={`/playlists/${video.playlist_id}`} className="video-topline-link">{video.playlist_title}</Link>
        {video.playlist_hidden && <span className="tag">скрытый</span>}
        {!video.in_playlist && <span className="tag warn">нет в источнике</span>}
      </div>

      {error && <ErrorBox text={error} onRetry={() => void load()} />}

      <div className="video-layout">
        <div className="player-shell">
          {ready ? (
            <KarmanPlayer
              key={video.id}
              src={`/api/videos/${video.id}/stream`}
              poster={video.thumbnail_local || video.thumbnail_url}
              startAt={info.position_s}
              preview={info.preview}
              next={info.next}
              prev={info.prev}
              title={video.title}
              subtitle={video.channel || video.owner}
              onBack={() => navigate(-1)}
              onOpen={(nextId) => navigate(`/videos/${nextId}`)}
              onProgress={(position, duration, completed) => void sendProgress(position, duration, completed)}
              onLeave={leave}
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
                      try {
                        const item = await api.retryVideo(video.id);
                        setInfo((previous) => previous ? { ...previous, video: item } : previous);
                      } catch (exc) {
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

        <div className="video-head">
          <div className="video-head-text">
            <h1 className="video-title">{video.title}</h1>
            <p className="video-meta-line">
              {video.channel && <span>{video.channel}</span>}
              {video.channel && <span className="sep">/</span>}
              <span>{video.owner}</span>
              {video.duration_s && (
                <>
                  <span className="sep">/</span>
                  <span className="mono">{formatDuration(video.duration_s)}</span>
                </>
              )}
              {video.downloaded_at && (
                <>
                  <span className="sep">/</span>
                  <span className="mono">{formatDate(video.downloaded_at)}</span>
                </>
              )}
              <span className="sep">/</span>
              <a href={video.webpage_url} target="_blank" rel="noreferrer" className="video-meta-link">
                Оригинал на YouTube {icons.external}
              </a>
            </p>
          </div>

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
              {ready && (
                <a
                  className="icon-btn"
                  href={`/api/videos/${video.id}/download`}
                  title="Скачать файл"
                  aria-label="Скачать файл"
                >
                  {icons.download}
                </a>
              )}
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

        <div className={info.next ? 'video-grid with-side' : 'video-grid'}>
          <section className="block video-facts">
            <div className="block-head">
              <span className="block-title">Сведения</span>
              <Status video={video} />
            </div>
            <div className="facts-grid">
              <div className="fact"><span>Длительность</span><strong className="mono">{video.duration_s ? formatDuration(video.duration_s) : '—'}</strong></div>
              <div className="fact"><span>Размер файла</span><strong className="mono">{formatSize(video.file_size)}</strong></div>
              <div className="fact"><span>Скачано</span><strong className="mono">{formatDate(video.downloaded_at)}</strong></div>
              <div className="fact"><span>Просмотрено</span><strong className="mono">{formatDate(video.watched_at)}</strong></div>
              <div className="fact">
                <span>Удаление с сервера</span>
                <strong className="mono">
                  {ready && video.reaction === 'none' && video.delete_after
                    ? `${timeLeft(video.delete_after)} · ${formatDate(video.delete_after)}`
                    : liked ? 'бессрочно' : '—'}
                </strong>
              </div>
              <div className="fact"><span>Добавлено</span><strong className="mono">{formatDate(video.created_at)}</strong></div>
            </div>
          </section>

          {info.next && (
            <aside className="block video-next">
              <div className="block-head">
                <span className="block-title">Далее в плейлисте</span>
                {icons.next}
              </div>
              <Link to={`/videos/${info.next.id}`} className="next-card">
                <div className="next-thumb">
                  {nextCard && <img src={nextCard.thumbnail_local || nextCard.thumbnail_url || ''} alt="" loading="lazy" />}
                  <span className="next-play">{icons.play}</span>
                  {nextCard?.duration_s && <span className="next-duration">{formatDuration(nextCard.duration_s)}</span>}
                </div>
                <strong className="next-title">{info.next.title}</strong>
                <span className="next-meta">
                  {nextCard?.channel || video.channel || video.owner}
                  {nextCard?.watched_at ? ' · просмотрено' : ''}
                </span>
              </Link>
            </aside>
          )}
        </div>
      </div>
    </div>
  );
}
