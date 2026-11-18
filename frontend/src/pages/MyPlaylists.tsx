import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api, ApiError } from '../api';
import { useAuth } from '../auth';
import { Empty, ErrorBox, Spinner, formatDate } from '../components/ui';
import { icons } from '../components/icons';
import type { Playlist } from '../types';

type Draft = { title: string; hidden: boolean; enabled: boolean; poll: string; coverLast: boolean };

export function MyPlaylistsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [adding, setAdding] = useState(false);
  const [url, setUrl] = useState('');
  const [hidden, setHidden] = useState(false);
  const [downloadExisting, setDownloadExisting] = useState(false);
  const [pollMinutes, setPollMinutes] = useState('');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [formError, setFormError] = useState('');
  const [tech, setTech] = useState(false);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [draft, setDraft] = useState<Draft>({ title: '', hidden: false, enabled: true, poll: '15', coverLast: false });
  const [editBusy, setEditBusy] = useState(false);
  const [editError, setEditError] = useState('');
  const [saved, setSaved] = useState(false);

  const load = useCallback(async () => {
    try {
      setPlaylists(await api.playlists('mine'));
      setError('');
    } catch (exc) {
      setError(exc instanceof ApiError ? exc.message : 'Не удалось загрузить плейлисты');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    const timer = window.setInterval(() => void load(), 5000);
    return () => window.clearInterval(timer);
  }, [load]);

  useEffect(() => {
    if (!tech) return;
    if (playlists.length === 0) {
      setSelectedId(null);
      return;
    }
    if (!playlists.some((playlist) => playlist.id === selectedId)) {
      setSelectedId(playlists[0].id);
    }
  }, [tech, playlists, selectedId]);

  useEffect(() => {
    const playlist = playlists.find((item) => item.id === selectedId);
    if (!playlist) return;
    setDraft({
      title: playlist.title,
      hidden: playlist.is_hidden,
      enabled: playlist.enabled,
      poll: String(playlist.poll_minutes),
      coverLast: playlist.cover_last,
    });
    setSaved(false);
    setEditError('');
    // черновик заполняется только при переключении плейлиста, не при фоновом обновлении
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  const selected = playlists.find((item) => item.id === selectedId) || null;
  const dirty = !!selected && (
    draft.title.trim() !== selected.title
    || draft.hidden !== selected.is_hidden
    || draft.enabled !== selected.enabled
    || Number(draft.poll) !== selected.poll_minutes
    || draft.coverLast !== selected.cover_last
  );

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!url.trim()) return;
    setBusy(true);
    setFormError('');
    try {
      const playlist = await api.createPlaylist({
        url: url.trim(),
        hidden,
        download_existing: downloadExisting,
        poll_minutes: pollMinutes ? Number(pollMinutes) : undefined,
      });
      setUrl('');
      setDownloadExisting(false);
      setHidden(false);
      setPollMinutes('');
      setAdding(false);
      navigate(`/playlists/${playlist.id}`);
    } catch (exc) {
      setFormError(exc instanceof ApiError ? exc.message : 'Не удалось добавить плейлист');
    } finally {
      setBusy(false);
    }
  };

  const remove = async (playlist: Playlist) => {
    if (!window.confirm(`Удалить плейлист «${playlist.title}» и все его видео с диска?`)) return;
    try {
      await api.deletePlaylist(playlist.id);
      if (playlist.id === selectedId) setSelectedId(null);
      await load();
    } catch (exc) {
      setError(exc instanceof ApiError ? exc.message : 'Не удалось удалить плейлист');
    }
  };

  const save = async () => {
    if (!selected) return;
    const minutes = Number(draft.poll);
    if (!draft.title.trim()) {
      setEditError('Название не может быть пустым');
      return;
    }
    if (!Number.isFinite(minutes) || minutes < 1 || minutes > 1440) {
      setEditError('Частота опроса — от 1 до 1440 минут');
      return;
    }
    setEditBusy(true);
    setEditError('');
    setSaved(false);
    try {
      await api.patchPlaylist(selected.id, {
        title: draft.title.trim(),
        hidden: draft.hidden,
        enabled: draft.enabled,
        poll_minutes: minutes,
        cover_last: draft.coverLast,
      });
      await load();
      setSaved(true);
    } catch (exc) {
      setEditError(exc instanceof ApiError ? exc.message : 'Не удалось сохранить плейлист');
    } finally {
      setEditBusy(false);
    }
  };

  const sync = async (playlist: Playlist) => {
    setEditBusy(true);
    setEditError('');
    try {
      await api.syncPlaylist(playlist.id);
      await load();
    } catch (exc) {
      setEditError(exc instanceof ApiError ? exc.message : 'Не удалось запустить проверку');
    } finally {
      setEditBusy(false);
    }
  };

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>Мои плейлисты</h1>
          <p className="lede">
            Сервис следит за плейлистами YouTube и скачивает новые ролики на этот компьютер.
            Скрытые плейлисты видны только вам.
          </p>
        </div>
        <div className="head-actions">
          {!tech && (
            <button className={adding ? 'btn on' : 'btn'} onClick={() => setAdding((value) => !value)}>
              {icons.plus} Добавить
            </button>
          )}
          <button
            className={tech ? 'icon-btn on' : 'icon-btn'}
            onClick={() => setTech((value) => !value)}
            title="Техническое редактирование"
            aria-label="Техническое редактирование"
            aria-pressed={tech}
          >
            {icons.wrench}
          </button>
        </div>
      </div>

      {!tech && adding && (
        <form className="block" onSubmit={submit}>
          <div className="block-head">
            <span className="block-title">Новый плейлист</span>
            <button type="button" className="text-link" onClick={() => setAdding(false)}>Закрыть</button>
          </div>
          <div className="block-body">
            <input
              className="input"
              value={url}
              onChange={(event) => setUrl(event.target.value)}
              placeholder="https://www.youtube.com/playlist?list=…"
              autoCapitalize="off"
              autoCorrect="off"
              autoFocus
              aria-label="Ссылка на плейлист"
            />
            <div className="form-row">
              <label className="check">
                <input type="checkbox" checked={downloadExisting} onChange={(event) => setDownloadExisting(event.target.checked)} />
                <span>Скачать уже существующие видео</span>
              </label>
              <label className="check">
                <input type="checkbox" checked={hidden} onChange={(event) => setHidden(event.target.checked)} />
                <span>Скрытый плейлист</span>
              </label>
              <label className="check" style={{ gap: 8 }}>
                <span className="mute">Опрос, мин</span>
                <input
                  className="input num"
                  type="number"
                  min={1}
                  max={1440}
                  value={pollMinutes}
                  onChange={(event) => setPollMinutes(event.target.value)}
                  placeholder="15"
                />
              </label>
            </div>
            {formError && <div className="error-box">{formError}</div>}
            <div>
              <button className="btn primary" disabled={busy || !url.trim()}>
                {busy ? <Spinner /> : 'Добавить'}
              </button>
            </div>
          </div>
        </form>
      )}

      {error && <ErrorBox text={error} onRetry={() => void load()} />}

      {tech ? (
        <div className="tech">
          <div className="tech-list">
            <div className="tech-list-head">
              <span>Плейлисты</span>
              <span className="mono mute">{playlists.length}</span>
            </div>
            {playlists.length === 0 ? (
              <div className="tech-empty">Плейлистов нет. Выйдите из технического режима и добавьте ссылку.</div>
            ) : playlists.map((playlist) => (
              <button
                key={playlist.id}
                className={playlist.id === selectedId ? 'tech-item active' : 'tech-item'}
                onClick={() => setSelectedId(playlist.id)}
                aria-pressed={playlist.id === selectedId}
              >
                <span className="tech-item-title">{playlist.title}</span>
                <span className="tech-item-meta mono">{playlist.counts.ready}/{playlist.counts.videos}</span>
                {playlist.is_hidden && <span className="tag">скрыт</span>}
                {!playlist.enabled && <span className="tag warn">выкл</span>}
              </button>
            ))}
          </div>

          <div className="tech-edit">
            {selected ? (
              <>
                <div className="tech-head">
                  <div style={{ minWidth: 0 }}>
                    <div className="tech-title">{selected.title}</div>
                    <a className="tech-url mono" href={selected.url} target="_blank" rel="noreferrer">{selected.url}</a>
                  </div>
                  <button className="btn small" disabled={editBusy} onClick={() => void sync(selected)}>
                    {editBusy ? <Spinner /> : 'Проверить'}
                  </button>
                </div>

                <div className="tech-rows">
                  <label className="tech-row">
                    <span>Название</span>
                    <input
                      className="input"
                      value={draft.title}
                      onChange={(event) => { setDraft((value) => ({ ...value, title: event.target.value })); setSaved(false); }}
                    />
                  </label>
                  <label className="tech-row">
                    <span>Частота опроса</span>
                    <span className="tech-inline">
                      <input
                        className="input num"
                        type="number"
                        min={1}
                        max={1440}
                        value={draft.poll}
                        onChange={(event) => { setDraft((value) => ({ ...value, poll: event.target.value })); setSaved(false); }}
                      />
                      <span className="mono mute">мин</span>
                    </span>
                  </label>
                  <label className="tech-row">
                    <span>Скрытый плейлист</span>
                    <span className="check" style={{ justifySelf: 'end' }}>
                      <input
                        type="checkbox"
                        checked={draft.hidden}
                        onChange={(event) => { setDraft((value) => ({ ...value, hidden: event.target.checked })); setSaved(false); }}
                      />
                    </span>
                  </label>
                  <label className="tech-row">
                    <span>Слежение включено</span>
                    <span className="check" style={{ justifySelf: 'end' }}>
                      <input
                        type="checkbox"
                        checked={draft.enabled}
                        onChange={(event) => { setDraft((value) => ({ ...value, enabled: event.target.checked })); setSaved(false); }}
                      />
                    </span>
                  </label>
                  <div className="tech-row">
                    <span>Превью плейлиста</span>
                    <div className="seg" style={{ justifySelf: 'end' }}>
                      <button
                        type="button"
                        className={draft.coverLast ? '' : 'active'}
                        onClick={() => { setDraft((value) => ({ ...value, coverLast: false })); setSaved(false); }}
                      >
                        первое видео
                      </button>
                      <button
                        type="button"
                        className={draft.coverLast ? 'active' : ''}
                        onClick={() => { setDraft((value) => ({ ...value, coverLast: true })); setSaved(false); }}
                      >
                        последнее видео
                      </button>
                    </div>
                  </div>
                  <div className="tech-row"><span>Владелец</span><strong>{selected.owner}</strong></div>
                  <div className="tech-row"><span>Проверен</span><strong className="mono">{formatDate(selected.last_checked_at)}</strong></div>
                  <div className="tech-row"><span>Видео</span><strong className="mono">{selected.counts.videos} в источнике</strong></div>
                  <div className="tech-row">
                    <span>Готово · в очереди · ошибок</span>
                    <strong className="mono">{selected.counts.ready} · {selected.counts.pending} · {selected.counts.failed}</strong>
                  </div>
                </div>

                {selected.last_error && <div className="tech-error">{selected.last_error}</div>}
                {editError && <div className="error-box">{editError}</div>}

                <div className="tech-foot">
                  <button className="btn ghost danger-text" disabled={editBusy} onClick={() => void remove(selected)}>
                    Удалить плейлист и файлы
                  </button>
                  <div className="tech-foot-right">
                    {saved && !dirty && <span className="tech-saved">сохранено</span>}
                    {dirty && <span className="picker-dirty">не сохранено</span>}
                    <button className="btn primary" disabled={!dirty || editBusy} onClick={() => void save()}>
                      {editBusy ? <Spinner /> : 'Сохранить'}
                    </button>
                  </div>
                </div>
              </>
            ) : (
              <div className="tech-empty">Выберите плейлист в списке слева.</div>
            )}
          </div>
        </div>
      ) : loading ? (
        <div className="screen-loader small"><Spinner /> Загружаем…</div>
      ) : playlists.length === 0 ? (
        <Empty
          title="Плейлистов пока нет"
          text="Вставьте ссылку на YouTube-плейлист — сервис проверит его и начнёт скачивать новые видео."
          action={(
            <button className="btn primary" onClick={() => setAdding(true)}>
              {icons.plus} Добавить плейлист
            </button>
          )}
        />
      ) : (
        <div className="pgrid">
          {playlists.map((playlist) => (
            <Link to={`/playlists/${playlist.id}`} className="pcard" key={playlist.id}>
              <div className="pcard-cover">
                {playlist.cover ? (
                  <img
                    src={playlist.cover}
                    alt=""
                    loading="lazy"
                    onError={(event) => { event.currentTarget.style.display = 'none'; }}
                  />
                ) : (
                  <span className="pcard-blank">{icons.playlists}</span>
                )}
                {playlist.is_hidden && <span className="pcard-tag">скрытый</span>}
                <span className="pcard-count mono">
                  {playlist.counts.videos}
                  {icons.playlists}
                </span>
              </div>
              <div className="pcard-body">
                <div className="pcard-title">{playlist.title}</div>
                <div className="pcard-meta">
                  <span>{playlist.owner}</span>
                  <span className="sep">/</span>
                  <span>{playlist.counts.videos} видео</span>
                  {playlist.counts.pending > 0 && (
                    <><span className="sep">/</span><span>{playlist.counts.pending} в очереди</span></>
                  )}
                  {playlist.counts.failed > 0 && (
                    <><span className="sep">/</span><span className="bad">{playlist.counts.failed} с ошибкой</span></>
                  )}
                  {!playlist.enabled && (
                    <><span className="sep">/</span><span className="warn">выключен</span></>
                  )}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}

      {user?.is_admin && !tech && (
        <p className="hint">Вы администратор этого сервера: можете видеть и удалять плейлисты всех пользователей.</p>
      )}
    </div>
  );
}
