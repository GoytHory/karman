import { useEffect, useMemo, useState } from 'react';
import { api, ApiError } from '../api';
import { useAuth } from '../auth';
import { ErrorBox, Spinner, formatSize } from '../components/ui';
import { THEMES, applyTheme, getTheme, type ThemeId } from '../theme';
import type { SystemStatus } from '../types';

type ParamKey = 'unwatched' | 'watched' | 'poll';

const PARAMS: Array<{
  key: ParamKey; label: string; hint: string; values: number[]; unit: (value: number) => string;
}> = [
  {
    key: 'unwatched',
    label: 'Без просмотра и без лайка',
    hint: 'Видео, которое скачалось, но его так и не открыли.',
    values: [1, 3, 7, 14, 30, 90],
    unit: (value) => `${value} ${value === 1 ? 'день' : value < 5 ? 'дня' : 'дней'}`,
  },
  {
    key: 'watched',
    label: 'Просмотрено, но без лайка',
    hint: 'Отсчёт начинается с момента досмотра.',
    values: [1, 2, 3, 7, 14],
    unit: (value) => `${value} ${value === 1 ? 'день' : value < 5 ? 'дня' : 'дней'}`,
  },
  {
    key: 'poll',
    label: 'Проверка новых плейлистов',
    hint: 'Как часто сервис опрашивает YouTube. Значение по умолчанию — для новых плейлистов.',
    values: [5, 15, 30, 60, 120, 360],
    unit: (value) => `${value} мин`,
  },
];

export function SettingsPage() {
  const { settings, setSettings, user } = useAuth();
  const [param, setParam] = useState<ParamKey>('unwatched');
  const [theme, setTheme] = useState<ThemeId>(() => getTheme());
  const [draft, setDraft] = useState({
    unwatched: settings?.retention_unwatched_days ?? 7,
    watched: settings?.retention_watched_days ?? 1,
    poll: settings?.default_poll_minutes ?? 15,
  });
  const [status, setStatus] = useState<SystemStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    api.status().then(setStatus).catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!settings) return;
    setDraft({
      unwatched: settings.retention_unwatched_days,
      watched: settings.retention_watched_days,
      poll: settings.default_poll_minutes,
    });
  }, [settings]);

  const active = PARAMS.find((item) => item.key === param)!;
  const values = useMemo(() => {
    const base = [...active.values];
    if (!base.includes(draft[param])) base.push(draft[param]);
    return base.sort((a, b) => a - b);
  }, [active, draft, param]);

  const dirty = !!settings && (
    draft.unwatched !== settings.retention_unwatched_days
    || draft.watched !== settings.retention_watched_days
    || draft.poll !== settings.default_poll_minutes
  );

  const submit = async () => {
    setBusy(true);
    setError('');
    setSaved(false);
    try {
      const updated = await api.updateSettings({
        retention_unwatched_days: draft.unwatched,
        retention_watched_days: draft.watched,
        default_poll_minutes: draft.poll,
      });
      setSettings(updated);
      setSaved(true);
    } catch (exc) {
      setError(exc instanceof ApiError ? exc.message : 'Не удалось сохранить настройки');
    } finally {
      setBusy(false);
    }
  };

  const summary = `Без лайка — ${PARAMS[0].unit(draft.unwatched)}, после просмотра — `
    + `${PARAMS[1].unit(draft.watched)}, опрос — ${PARAMS[2].unit(draft.poll)}.`;

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>Настройки</h1>
          <p className="lede">
            Сроки хранения действуют на ваши видео без лайка. Сохранённые не удаляются.
          </p>
        </div>
      </div>

      {error && <ErrorBox text={error} onRetry={() => void submit()} />}

      <div className="block">
        <div className="block-head">
          <span className="block-title">Оформление</span>
          <span className="mono mute">сохраняется в браузере</span>
        </div>
        <div className="theme-grid" role="radiogroup" aria-label="Тема оформления">
          {THEMES.map((item) => (
            <button
              key={item.id}
              type="button"
              role="radio"
              aria-checked={theme === item.id}
              className={theme === item.id ? 'theme-card selected' : 'theme-card'}
              onClick={() => { setTheme(item.id); applyTheme(item.id); }}
            >
              <span
                className="theme-preview"
                style={{ background: item.preview.bg, borderColor: item.preview.panel }}
                aria-hidden="true"
              >
                <span className="theme-preview-head">
                  <i className="theme-preview-dot" style={{ background: item.preview.accent }} />
                  <i className="theme-preview-line wide" style={{ background: item.preview.text }} />
                </span>
                <span className="theme-preview-head">
                  <i className="theme-preview-line wide" style={{ background: item.preview.dim }} />
                  <i className="theme-preview-line short" style={{ background: item.preview.accent }} />
                </span>
                <span className="theme-preview-head">
                  <i className="theme-preview-line mid" style={{ background: item.preview.panel }} />
                  <i className="theme-preview-line short" style={{ background: item.preview.dim }} />
                </span>
              </span>
              <span className="theme-name">{item.name}</span>
              <span className="theme-note">{item.note}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="picker">
        <div className="picker-main">
          <div className="picker-head">
            <span className="block-title">Сроки хранения</span>
            <p className="picker-note">Выберите параметр, затем значение справа.</p>
          </div>
          <div className="option-list">
            {PARAMS.map((item) => (
              <button
                key={item.key}
                className={item.key === param ? 'option-row active' : 'option-row'}
                onClick={() => setParam(item.key)}
                aria-pressed={item.key === param}
              >
                <span className="option-label">
                  <span className="option-title">{item.label}</span>
                  <span className="option-hint">{item.hint}</span>
                </span>
                <span className="option-value mono">{item.unit(draft[item.key])}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="picker-side">
          <div className="picker-head">
            <span className="block-title">{active.label}</span>
          </div>
          <div className="choice-col" role="group" aria-label={active.label}>
            {values.map((value) => (
              <button
                key={value}
                className={draft[param] === value ? 'choice selected' : 'choice'}
                onClick={() => {
                  setDraft((previous) => ({ ...previous, [param]: value }));
                  setSaved(false);
                }}
                aria-pressed={draft[param] === value}
              >
                <span className="mono">{active.unit(value)}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="picker-foot">
          <p className="picker-summary">
            {saved ? 'Настройки сохранены.' : summary}
          </p>
          <div className="picker-foot-actions">
            {dirty && !saved && <span className="picker-dirty">не сохранено</span>}
            <button className="btn primary" disabled={busy || !dirty} onClick={() => void submit()}>
              {busy ? <Spinner /> : 'Сохранить'}
            </button>
          </div>
        </div>
      </div>

      {status && (
        <div className="block">
          <div className="block-head">
            <span className="block-title">Сервис</span>
            <span className="mono mute">{user?.is_admin ? 'администратор' : 'аккаунт'}</span>
          </div>
          <div className="block-rows">
            <div className="block-row">
              <span>Папка видео</span>
              <strong className="mono">{status.videos_root}</strong>
            </div>
            <div className="block-row">
              <span>Свободно на диске</span>
              <strong className="mono">{formatSize(status.disk_free)} из {formatSize(status.disk_total)}</strong>
            </div>
            <div className="block-row">
              <span>Готово · в очереди · ошибок</span>
              <strong className="mono">
                {status.counts.ready || 0} · {(status.counts.pending || 0) + (status.counts.downloading || 0)} · {status.counts.failed || 0}
              </strong>
            </div>
            <div className="block-row">
              <span>Пользователь</span>
              <strong>{user?.username}</strong>
            </div>
          </div>
        </div>
      )}

      <p className="hint">
        Дизлайк удаляет файл сразу. Лайк переносит его в папку «saved» и снимает срок хранения.
        Историю просмотров можно выгрузить на странице «История».
      </p>
    </div>
  );
}
