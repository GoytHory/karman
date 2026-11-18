import { useCallback, useEffect, useState } from 'react';
import { api, ApiError } from '../api';
import { ErrorBox, Spinner, formatDate, formatDuration } from '../components/ui';
import type { HistoryEvent } from '../types';

export function HistoryPage() {
  const [items, setItems] = useState<HistoryEvent[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [textMode, setTextMode] = useState(false);

  const load = useCallback(async (offset = 0, append = false) => {
    try {
      const response = await api.history(100, offset);
      setTotal(response.total);
      setItems((previous) => append ? [...previous, ...response.items] : response.items);
      setError('');
    } catch (exc) {
      setError(exc instanceof ApiError ? exc.message : 'Не удалось загрузить историю');
    } finally {
      setLoading(false);
      setBusy(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const text = items.map((event) => {
    const percent = event.duration_s ? Math.round((event.position_s / event.duration_s) * 100) : 0;
    return `${formatDate(event.started_at)} | ${event.title} | ${event.channel || 'без канала'} | `
      + `${formatDuration(event.position_s)} из ${formatDuration(event.duration_s)} (${percent}%) | ${event.webpage_url}`;
  }).join('\n');

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>История просмотров</h1>
          <p className="lede">
            Что и когда вы смотрели. Записи хранятся бессрочно, ссылки ведут на оригинал.
          </p>
        </div>
        <div className="head-actions">
          <button className="btn ghost" onClick={() => setTextMode((value) => !value)}>
            {textMode ? 'Таблицей' : 'Текстом'}
          </button>
          <a className="btn" href="/api/history/export.txt">Скачать .txt</a>
        </div>
      </div>

      {error && <ErrorBox text={error} onRetry={() => void load()} />}

      {loading ? (
        <div className="screen-loader small"><Spinner /> Загружаем историю…</div>
      ) : items.length === 0 ? (
        <div className="empty">
          <h3>Записей нет</h3>
          <p>Начните смотреть видео — записи появятся здесь автоматически.</p>
        </div>
      ) : textMode ? (
        <pre className="history-text">{text}</pre>
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Когда</th>
                <th>Видео</th>
                <th>Канал</th>
                <th>Просмотр</th>
                <th>Владелец</th>
              </tr>
            </thead>
            <tbody>
              {items.map((event) => {
                const percent = event.duration_s ? Math.round((event.position_s / event.duration_s) * 100) : 0;
                return (
                  <tr key={event.id}>
                    <td className="nowrap">{formatDate(event.started_at)}</td>
                    <td className="strong">
                      <a href={event.webpage_url} target="_blank" rel="noreferrer">{event.title}</a>
                      {event.completed && (
                        <span className="status liked" style={{ marginLeft: 10 }}>
                          <i />досмотрено
                        </span>
                      )}
                    </td>
                    <td>{event.channel || '—'}</td>
                    <td className="nowrap">{formatDuration(event.position_s)} / {formatDuration(event.duration_s)} · {percent}%</td>
                    <td>{event.owner || '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
        <span className="mono mute">{items.length} из {total}</span>
        {items.length < total && (
          <button className="btn" disabled={busy} onClick={() => {
            setBusy(true);
            void load(items.length, true);
          }}>{busy ? <Spinner /> : 'Показать ещё'}</button>
        )}
      </div>
    </div>
  );
}
