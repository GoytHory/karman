import { useCallback, useEffect, useRef, useState } from 'react';
import { api, ApiError } from '../api';
import { ErrorBox, Empty, Spinner, VideoGrid } from '../components/ui';
import { icons } from '../components/icons';
import type { UserRef, Video } from '../types';

type Preset = 'saved' | 'queue';

const PRESETS: Record<Preset, {
  title: string; lede: string; status?: string; reaction?: string;
  emptyTitle: string; emptyText: string;
}> = {
  saved: {
    title: 'Сохранённые',
    lede: 'Видео, которые вы отметили лайком. Пока лайк стоит, срок хранения не действует.',
    reaction: 'like',
    emptyTitle: 'Пока ничего не сохранено',
    emptyText: 'Откройте видео и нажмите иконку «палец вверх» — оно появится здесь и останется на диске.',
  },
  queue: {
    title: 'Загрузки',
    lede: 'Видео, которые сервис скачивает или готовится скачать. Сбойные ролики остаются здесь — их можно отправить на повторную попытку.',
    status: 'pending,downloading,failed',
    emptyTitle: 'Загрузок нет',
    emptyText: 'Новые ролики из плейлистов появятся здесь автоматически — скачивать вручную не нужно.',
  },
};

export function AllVideosPage({ preset }: { preset?: Preset }) {
  const config = preset ? PRESETS[preset] : null;
  const [items, setItems] = useState<Video[]>([]);
  const [total, setTotal] = useState(0);
  const [users, setUsers] = useState<UserRef[]>([]);
  const [q, setQ] = useState('');
  const [owner, setOwner] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busyMore, setBusyMore] = useState(false);
  const queryRef = useRef({ q: '', owner: '' });
  queryRef.current = { q, owner };

  const load = useCallback(async (offset = 0, append = false, silent = false) => {
    if (!append && !silent) setLoading(true);
    setError('');
    try {
      const response = await api.videos({
        scope: config ? 'mine' : 'all',
        q: queryRef.current.q || undefined,
        owner_id: !config && queryRef.current.owner ? Number(queryRef.current.owner) : undefined,
        status: config?.status || undefined,
        reaction: config?.reaction,
        limit: 60,
        offset,
      });
      setTotal(response.total);
      setItems((previous) => append ? [...previous, ...response.items] : response.items);
    } catch (exc) {
      setError(exc instanceof ApiError ? exc.message : 'Не удалось загрузить видео');
    } finally {
      if (!append && !silent) setLoading(false);
      setBusyMore(false);
    }
  }, [config]);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(0, false), 220);
    return () => window.clearTimeout(timer);
  }, [q, owner, load]);

  useEffect(() => {
    if (config) return;
    api.users().then(setUsers).catch(() => undefined);
  }, [config]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      if (items.some((item) => item.status === 'pending' || item.status === 'downloading')) {
        void load(0, false, true);
      }
    }, 6000);
    return () => window.clearInterval(timer);
  }, [items, load]);

  const retry = useCallback(async (video: Video) => {
    try {
      await api.retryVideo(video.id);
      await load(0, false, true);
    } catch (exc) {
      setError(exc instanceof ApiError ? exc.message : 'Не удалось повторить');
    }
  }, [load]);

  const hasMore = items.length < total;

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>{config?.title ?? 'Все видео'}</h1>
          <p className="lede">
            {config ? config.lede : (
              <>
                {total > 0 ? `${total} в архиве` : 'Архив пуст'} · открытые плейлисты всех пользователей.
                Скрытые видео видны только владельцу.
              </>
            )}
          </p>
        </div>
      </div>

      <div className="filters">
        <label className="search-box">
          {icons.search}
          <input
            value={q}
            onChange={(event) => setQ(event.target.value)}
            placeholder="Поиск по названию или каналу"
            aria-label="Поиск по названию или каналу"
          />
        </label>

        {!config && (
          <div className="filters-right">
            <select className="input" value={owner} onChange={(event) => setOwner(event.target.value)} aria-label="Владелец">
              <option value="">Все пользователи</option>
              {users.map((user) => <option key={user.id} value={user.id}>{user.username}</option>)}
            </select>
          </div>
        )}
      </div>

      {error && <ErrorBox text={error} onRetry={() => void load()} />}

      {loading ? (
        <div className="screen-loader small"><Spinner /> Загружаем видео…</div>
      ) : items.length === 0 ? (
        <Empty
          title={config?.emptyTitle ?? 'Пока пусто'}
          text={config?.emptyText ?? 'Добавьте плейлист YouTube в разделе «Плейлисты» — новые видео появятся здесь автоматически.'}
        />
      ) : (
        <>
          <VideoGrid videos={items} onRetry={preset === 'queue' ? retry : undefined} />
          {hasMore && (
            <div className="center">
              <button className="btn" disabled={busyMore} onClick={() => {
                setBusyMore(true);
                void load(items.length, true);
              }}>
                {busyMore ? <Spinner /> : `Показать ещё · ${total - items.length}`}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
