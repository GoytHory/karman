import { Link } from 'react-router-dom';
import type { Video } from '../types';

export function cx(...values: Array<string | false | null | undefined>): string {
  return values.filter(Boolean).join(' ');
}

export function Spinner() {
  return <span className="spinner" />;
}

export function ErrorBox({ text, onRetry }: { text: string; onRetry?: () => void }) {
  return (
    <div className="error-box">
      <span>{text}</span>
      {onRetry && <button className="btn small" onClick={onRetry}>Повторить</button>}
    </div>
  );
}

export function Empty({
  title, text, action,
}: { title: string; text?: string; action?: React.ReactNode }) {
  return (
    <div className="empty">
      <h3>{title}</h3>
      {text && <p>{text}</p>}
      {action}
    </div>
  );
}

const STATUS_LABELS: Record<string, string> = {
  pending: 'В очереди',
  downloading: 'Скачивается',
  ready: 'Готово',
  failed: 'Ошибка',
  ignored: 'Пропущено',
  deleted: 'Удалено',
};

export function statusLabel(status: string): string {
  return STATUS_LABELS[status] || status;
}

type Tone = 'liked' | 'watched' | 'warn' | 'bad' | 'mute' | '';

export function videoStatus(video: Video): { label: string; tone: Tone } {
  if (video.reaction === 'like') return { label: 'Сохранено', tone: 'liked' };
  if (video.reaction === 'dislike') return { label: 'Дизлайк', tone: 'bad' };
  if (video.status === 'downloading') return { label: `Скачивается ${Math.round(video.progress)}%`, tone: 'warn' };
  if (video.status === 'pending') return { label: 'В очереди', tone: 'mute' };
  if (video.status === 'failed') return { label: 'Ошибка', tone: 'bad' };
  if (video.status === 'deleted') return { label: 'Удалено', tone: 'mute' };
  if (video.status === 'ignored') return { label: 'Пропущено', tone: 'mute' };
  if (video.watched_at) return { label: 'Просмотрено', tone: 'watched' };
  return { label: 'Готово', tone: '' };
}

export function Status({ video }: { video: Video }) {
  const { label, tone } = videoStatus(video);
  return <span className={cx('status', tone)}><i />{label}</span>;
}

export function formatDuration(seconds: number | null | undefined): string {
  const total = Math.max(0, Math.round(seconds || 0));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const secs = total % 60;
  if (hours) return `${hours}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  return `${minutes}:${String(secs).padStart(2, '0')}`;
}

export function formatSize(bytes: number | null | undefined): string {
  if (!bytes) return '—';
  if (bytes >= 1024 ** 3) return `${(bytes / 1024 ** 3).toFixed(1)} ГБ`;
  if (bytes >= 1024 ** 2) return `${(bytes / 1024 ** 2).toFixed(0)} МБ`;
  return `${Math.round(bytes / 1024)} КБ`;
}

export function formatDate(value: string | null | undefined): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('ru-RU', { dateStyle: 'short', timeStyle: 'short' }).format(date);
}

export function timeLeft(value: string | null | undefined): string {
  if (!value) return '';
  const diff = new Date(value).getTime() - Date.now();
  if (Number.isNaN(diff)) return '';
  if (diff <= 0) return 'сейчас';
  const hours = Math.floor(diff / 3600000);
  if (hours < 1) return `через ${Math.max(1, Math.round(diff / 60000))} мин`;
  if (hours < 48) return `через ${hours} ч`;
  return `через ${Math.round(hours / 24)} дн`;
}

export function storage(video: Video): { label: string; progress?: number } {
  if (video.status === 'downloading') return { label: `${Math.round(video.progress)}%`, progress: video.progress };
  if (video.status === 'pending') return { label: 'ожидает' };
  if (video.status === 'ready' && video.reaction === 'like') return { label: 'бессрочно' };
  if (video.status === 'ready' && video.delete_after && video.reaction === 'none') {
    return { label: timeLeft(video.delete_after) };
  }
  return { label: '—' };
}

export function thumbnail(video: Video): string {
  return video.thumbnail_local || video.thumbnail_url
    || `https://i.ytimg.com/vi/${video.video_id}/mqdefault.jpg`;
}

export function VideoGrid({
  videos, onRetry, showPlaylist = true,
}: { videos: Video[]; onRetry?: (video: Video) => void; showPlaylist?: boolean }) {
  return (
    <div className="vgrid">
      {videos.map((video) => {
        const store = storage(video);
        return (
          <article className="vcard" key={video.id}>
            <Link to={`/videos/${video.id}`} className="vcard-thumb" tabIndex={-1} aria-hidden="true">
              <img src={thumbnail(video)} alt="" loading="lazy" onError={(event) => {
                const img = event.currentTarget;
                const remote = video.thumbnail_url;
                if (remote && img.src !== remote) {
                  img.src = remote;
                  return;
                }
                img.style.display = 'none';
              }} />
              {video.duration_s ? <span className="dur">{formatDuration(video.duration_s)}</span> : null}
              {video.status === 'downloading' && (
                <span className="vcard-track"><span style={{ width: `${video.progress}%` }} /></span>
              )}
            </Link>

            <div className="vcard-body">
              <Link to={`/videos/${video.id}`} className="vcard-title">{video.title}</Link>
              <div className="vcard-meta">
                <span>{video.channel || 'без канала'}</span>
                <span className="sep">/</span>
                <span>{video.owner}</span>
              </div>
              {showPlaylist && (
                <Link to={`/playlists/${video.playlist_id}`} className="vcard-playlist">
                  {video.playlist_title}
                  {video.playlist_hidden && <span className="panel-mark"> скрыт</span>}
                </Link>
              )}
              <div className="vcard-foot">
                <Status video={video} />
                {video.status === 'failed' && onRetry ? (
                  <button className="btn small" onClick={() => onRetry(video)}>Повторить</button>
                ) : store.progress !== undefined ? (
                  <span className="mono mute">{store.label}</span>
                ) : (
                  <span className={cx('mono', 'vstore', store.label === 'бессрочно' && 'ok')}>{store.label}</span>
                )}
              </div>
            </div>
          </article>
        );
      })}
    </div>
  );
}
