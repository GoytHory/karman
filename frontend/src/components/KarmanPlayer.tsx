import { useCallback, useEffect, useRef, useState, type MouseEvent as ReactMouseEvent, type PointerEvent as ReactPointerEvent } from 'react';
import { icons } from './icons';

export type PlaybackNeighbour = { id: number; title: string } | null;

type Props = {
  src: string;
  poster?: string | null;
  startAt?: number;
  preview?: { url: string; step: number } | null;
  next?: PlaybackNeighbour;
  prev?: PlaybackNeighbour;
  title?: string;
  subtitle?: string;
  onBack?: () => void;
  onOpen?: (id: number) => void;
  onProgress?: (position: number, duration: number, completed: boolean) => void;
  onLeave?: (position: number, duration: number) => void;
};

const RATES = [0.75, 1, 1.25, 1.5, 2];
const HIDE_AFTER = 2600;

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

export function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
  const total = Math.floor(seconds);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}` : `${m}:${String(s).padStart(2, '0')}`;
}

const storedNumber = (key: string, fallback: number) => {
  const raw = window.localStorage.getItem(key);
  const value = raw == null ? NaN : Number(raw);
  return Number.isFinite(value) ? value : fallback;
};

export function KarmanPlayer({
  src, poster, startAt = 0, preview, next, prev, title, subtitle, onBack, onOpen, onProgress, onLeave,
}: Props) {
  const shellRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const railRef = useRef<HTMLDivElement>(null);
  const hideTimer = useRef<number | undefined>(undefined);
  const seekTimer = useRef<number | undefined>(undefined);
  const volumeTimer = useRef<number | undefined>(undefined);
  const tapTimer = useRef<number | undefined>(undefined);
  const lastPointer = useRef('mouse');
  // Пользователь сам поставил паузу — автозапуск не должен её снимать.
  const userPaused = useRef(false);
  const lastTap = useRef({ at: 0, x: 0, y: 0 });
  const seekRef = useRef(false);
  const prefetched = useRef(new Set<string>());

  const onProgressRef = useRef(onProgress);
  const onLeaveRef = useRef(onLeave);
  onProgressRef.current = onProgress;
  onLeaveRef.current = onLeave;

  const [playing, setPlaying] = useState(false);
  const [current, setCurrent] = useState(0);
  const [duration, setDuration] = useState(0);
  const [buffered, setBuffered] = useState(0);
  const [volume, setVolume] = useState(() => clamp(storedNumber('karman.volume', 1), 0, 1));
  const [muted, setMuted] = useState(false);
  const [rate, setRate] = useState(() => {
    const saved = storedNumber('karman.rate', 1);
    return RATES.includes(saved) ? saved : 1;
  });
  const [controls, setControls] = useState(true);
  const [waiting, setWaiting] = useState(true);
  const [blocked, setBlocked] = useState(false);
  const [failed, setFailed] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [pip, setPip] = useState(false);
  const [menu, setMenu] = useState(false);
  const [hover, setHover] = useState<{ time: number; ratio: number } | null>(null);
  const [resume, setResume] = useState<number | null>(null);
  const [seekFlash, setSeekFlash] = useState<{ id: number; dir: number } | null>(null);
  const [volumeFlash, setVolumeFlash] = useState<{ id: number; value: number } | null>(null);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [ended, setEnded] = useState(false);

  const report = useCallback((completed = false) => {
    const player = videoRef.current;
    if (!player || !Number.isFinite(player.duration) || player.duration <= 0) return;
    onProgressRef.current?.(player.currentTime, player.duration, completed);
  }, []);

  const scheduleHide = useCallback(() => {
    window.clearTimeout(hideTimer.current);
    hideTimer.current = window.setTimeout(() => {
      const player = videoRef.current;
      if (player && !player.paused && seekRef.current === false) setControls(false);
    }, HIDE_AFTER);
  }, []);

  const wake = useCallback(() => {
    setControls(true);
    scheduleHide();
  }, [scheduleHide]);

  const flashSeek = useCallback((dir: number) => {
    window.clearTimeout(seekTimer.current);
    setSeekFlash({ id: Date.now(), dir });
    seekTimer.current = window.setTimeout(() => setSeekFlash(null), 620);
  }, []);

  const flashVolume = useCallback((value: number) => {
    window.clearTimeout(volumeTimer.current);
    setVolumeFlash({ id: Date.now(), value });
    volumeTimer.current = window.setTimeout(() => setVolumeFlash(null), 760);
  }, []);

  const togglePlay = useCallback(() => {
    const player = videoRef.current;
    if (!player) return;
    setEnded(false);
    setCountdown(null);
    if (player.paused || player.ended) {
      userPaused.current = false;
      if (player.ended) player.currentTime = 0;
      void player.play().catch(() => setBlocked(true));
      wake();
    } else {
      userPaused.current = true;
      player.pause();
    }
  }, [wake]);

  const seekBy = useCallback((delta: number) => {
    const player = videoRef.current;
    if (!player || !Number.isFinite(player.duration)) return;
    player.currentTime = clamp(player.currentTime + delta, 0, player.duration - 0.15);
    setCurrent(player.currentTime);
    setEnded(false);
    setCountdown(null);
    flashSeek(delta > 0 ? 1 : -1);
    wake();
  }, [flashSeek, wake]);

  const changeVolume = useCallback((value: number, showFlash = true) => {
    const player = videoRef.current;
    if (!player) return;
    const nextValue = clamp(value, 0, 1);
    player.volume = nextValue;
    player.muted = nextValue === 0;
    setVolume(nextValue);
    setMuted(nextValue === 0);
    window.localStorage.setItem('karman.volume', String(nextValue));
    if (showFlash) flashVolume(nextValue);
  }, [flashVolume]);

  const changeRate = useCallback((value: number) => {
    const player = videoRef.current;
    if (!player) return;
    player.playbackRate = value;
    setRate(value);
    window.localStorage.setItem('karman.rate', String(value));
    setMenu(false);
  }, []);

  const restart = useCallback(() => {
    const player = videoRef.current;
    if (!player) return;
    player.currentTime = 0;
    setCurrent(0);
    setResume(null);
    setEnded(false);
    setCountdown(null);
    userPaused.current = false;
    void player.play().catch(() => setBlocked(true));
    wake();
  }, [wake]);

  const toggleFullscreen = useCallback(async () => {
    const shell = shellRef.current;
    const player = videoRef.current as (HTMLVideoElement & { webkitEnterFullscreen?: () => void }) | null;
    if (!shell || !player) return;
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      } else if (shell.requestFullscreen) {
        await shell.requestFullscreen();
      } else if (player.webkitEnterFullscreen) {
        player.webkitEnterFullscreen();
      }
    } catch {
      // полноэкранный режим может быть запрещён — молча остаёмся как есть
    }
  }, []);

  const togglePip = useCallback(async () => {
    const player = videoRef.current;
    if (!player) return;
    try {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
      } else if (document.pictureInPictureEnabled) {
        await player.requestPictureInPicture();
      }
    } catch {
      // PiP недоступен в этом браузере
    }
  }, []);

  const seekToClientX = useCallback((clientX: number) => {
    const rail = railRef.current;
    const player = videoRef.current;
    if (!rail || !player || !Number.isFinite(player.duration) || player.duration <= 0) return;
    const rect = rail.getBoundingClientRect();
    const ratio = clamp((clientX - rect.left) / rect.width, 0, 1);
    const time = ratio * player.duration;
    player.currentTime = time;
    setCurrent(time);
    if (railRef.current) setHover({ time, ratio });
  }, []);

  // ---------- события видео ----------

  useEffect(() => {
    const onFullscreen = () => setFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', onFullscreen);
    return () => document.removeEventListener('fullscreenchange', onFullscreen);
  }, []);

  useEffect(() => {
    const player = videoRef.current;
    if (!player) return;
    const enter = () => setPip(true);
    const leave = () => setPip(false);
    player.addEventListener('enterpictureinpicture', enter);
    player.addEventListener('leavepictureinpicture', leave);
    return () => {
      player.removeEventListener('enterpictureinpicture', enter);
      player.removeEventListener('leavepictureinpicture', leave);
    };
  }, []);

  useEffect(() => {
    const onPageHide = () => {
      const player = videoRef.current;
      if (player && Number.isFinite(player.duration) && player.currentTime > 0) {
        onLeaveRef.current?.(player.currentTime, player.duration);
      }
    };
    window.addEventListener('pagehide', onPageHide);
    return () => {
      window.removeEventListener('pagehide', onPageHide);
      window.clearTimeout(hideTimer.current);
      window.clearTimeout(seekTimer.current);
      window.clearTimeout(volumeTimer.current);
      window.clearTimeout(tapTimer.current);
      const player = videoRef.current;
      if (player && Number.isFinite(player.duration) && player.currentTime > 0) {
        onLeaveRef.current?.(player.currentTime, player.duration);
      }
    };
  }, []);

  useEffect(() => {
    if (!playing) return;
    const timer = window.setInterval(() => report(false), 10_000);
    return () => window.clearInterval(timer);
  }, [playing, report]);

  // Отсчёт до следующего видео
  useEffect(() => {
    if (countdown == null) return;
    if (countdown <= 0) {
      setCountdown(null);
      if (next) onOpen?.(next.id);
      return;
    }
    const timer = window.setTimeout(() => setCountdown((value) => (value == null ? null : value - 1)), 1000);
    return () => window.clearTimeout(timer);
  }, [countdown, next, onOpen]);

  // Горячие клавиши
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target && (/^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName) || target.isContentEditable)) return;
      const player = videoRef.current;
      if (!player) return;
      const key = event.key.toLowerCase();
      if (key === ' ' || key === 'k') {
        event.preventDefault();
        togglePlay();
      } else if (key === 'arrowleft') {
        event.preventDefault();
        seekBy(-5);
      } else if (key === 'arrowright') {
        event.preventDefault();
        seekBy(5);
      } else if (key === 'j') {
        seekBy(-10);
      } else if (key === 'l') {
        seekBy(10);
      } else if (key === 'arrowup') {
        event.preventDefault();
        changeVolume(player.volume + 0.05);
      } else if (key === 'arrowdown') {
        event.preventDefault();
        changeVolume(player.volume - 0.05);
      } else if (key === 'm') {
        changeVolume(player.volume === 0 ? 1 : 0);
      } else if (key === 'f') {
        void toggleFullscreen();
      } else if (key === 'p') {
        void togglePip();
      } else if (key === 'n' && next) {
        onOpen?.(next.id);
      } else if (key === 'escape') {
        setMenu(false);
      } else if (/^[0-9]$/.test(key) && Number.isFinite(player.duration)) {
        player.currentTime = (Number(key) / 10) * player.duration;
        setCurrent(player.currentTime);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [changeVolume, next, onOpen, seekBy, togglePlay, toggleFullscreen, togglePip]);

  // Закрываем меню скорости по клику мимо
  useEffect(() => {
    if (!menu) return;
    const close = (event: PointerEvent) => {
      const target = event.target as HTMLElement;
      if (!target.closest('.kp-speed-wrap')) setMenu(false);
    };
    document.addEventListener('pointerdown', close);
    return () => document.removeEventListener('pointerdown', close);
  }, [menu]);

  // ---------- разметка ----------

  const progress = duration > 0 ? clamp(current / duration, 0, 1) : 0;
  const bufferRatio = duration > 0 ? clamp(buffered / duration, 0, 1) : 0;
  const previewStep = preview?.step || 5;
  const previewBucket = hover ? Math.floor(hover.time / previewStep) * previewStep : 0;
  const previewSrc = preview && hover ? preview.url.replace('{t}', String(previewBucket)) : '';

  useEffect(() => {
    if (!previewSrc || prefetched.current.has(previewSrc)) return;
    prefetched.current.add(previewSrc);
    const image = new Image();
    image.src = previewSrc;
  }, [previewSrc]);

  const onVideoLoaded = () => {
    const player = videoRef.current;
    if (!player) return;
    const total = Number.isFinite(player.duration) ? player.duration : 0;
    setDuration(total);
    player.volume = volume;
    player.muted = muted && volume === 0;
    player.playbackRate = rate;
    if (startAt > 3 && (!total || startAt < total - 8)) {
      player.currentTime = startAt;
      setCurrent(startAt);
      setResume(startAt);
      window.setTimeout(() => setResume(null), 8000);
    }
    if (!userPaused.current) {
      void player.play().then(() => setBlocked(false)).catch(() => setBlocked(true));
    }
  };

  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    lastPointer.current = event.pointerType;
    if (event.pointerType === 'mouse') return;
    seekRef.current = false;
    (event.currentTarget as HTMLDivElement).dataset.startX = String(event.clientX);
    (event.currentTarget as HTMLDivElement).dataset.startY = String(event.clientY);
    (event.currentTarget as HTMLDivElement).dataset.startVolume = String(videoRef.current?.volume ?? 1);
    (event.currentTarget as HTMLDivElement).dataset.swiped = '';
  };

  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.pointerType === 'mouse') return;
    const host = event.currentTarget as HTMLDivElement;
    const startX = Number(host.dataset.startX || 0);
    const startY = Number(host.dataset.startY || 0);
    if (!host.dataset.startVolume) return;
    const dx = event.clientX - startX;
    const dy = event.clientY - startY;
    if (Math.abs(dy) > 34 && Math.abs(dy) > Math.abs(dx) * 1.4) {
      host.dataset.swiped = '1';
      const base = Number(host.dataset.startVolume);
      changeVolume(base - dy / 260);
    }
  };

  const onShellClick = (event: ReactMouseEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    // Тач-события уже обрабатываются в onPointerUp, синтетический click не нужен.
    if (lastPointer.current !== 'mouse') return;
    const target = event.target as HTMLElement;
    // Клик по самому видео (или пустой области) — пауза/воспроизведение.
    // Клики по контролам, плашкам и оверлеям сюда не доходят.
    if (!(target instanceof HTMLVideoElement) && target !== shellRef.current) return;
    togglePlay();
  };

  const onPointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.pointerType === 'mouse') return;
    const host = event.currentTarget as HTMLDivElement;
    const startX = Number(host.dataset.startX || 0);
    const startY = Number(host.dataset.startY || 0);
    const swiped = host.dataset.swiped === '1';
    host.dataset.swiped = '';
    host.dataset.startVolume = '';
    if (swiped) return;
    const dx = event.clientX - startX;
    const dy = event.clientY - startY;
    if (Math.abs(dx) > 14 || Math.abs(dy) > 14) return;

    const now = Date.now();
    const rect = host.getBoundingClientRect();
    const zone = (event.clientX - rect.left) / rect.width;
    if (now - lastTap.current.at < 300 && Math.abs(event.clientX - lastTap.current.x) < 48
      && Math.abs(event.clientY - lastTap.current.y) < 48) {
      lastTap.current = { at: 0, x: 0, y: 0 };
      window.clearTimeout(tapTimer.current);
      if (zone < 0.36) seekBy(-10);
      else if (zone > 0.64) seekBy(10);
      else togglePlay();
      return;
    }
    lastTap.current = { at: now, x: event.clientX, y: event.clientY };
    window.clearTimeout(tapTimer.current);
    tapTimer.current = window.setTimeout(() => {
      lastTap.current = { at: 0, x: 0, y: 0 };
      const player = videoRef.current;
      if (player && player.paused) togglePlay();
      else if (controls) setControls(false);
      else wake();
    }, 300);
  };

  return (
    <div
      ref={shellRef}
      className={`kp${controls ? ' is-awake' : ''}${fullscreen ? ' is-full' : ''}`}
      onClick={onShellClick}
      onPointerDown={onPointerDown}
      onPointerMove={(event) => {
        if (event.pointerType === 'mouse') wake();
        else onPointerMove(event);
      }}
      onPointerUp={onPointerUp}
      onPointerLeave={() => {
        if (videoRef.current && !videoRef.current.paused) setControls(false);
        setHover(null);
      }}
      onKeyDown={(event) => {
        if (event.key === 'Escape') setMenu(false);
      }}
    >
      <video
        ref={videoRef}
        className="kp-video"
        src={src}
        poster={poster || undefined}
        playsInline
        preload="metadata"
        onClick={(event) => event.preventDefault()}
        onLoadedMetadata={onVideoLoaded}
        onDurationChange={() => {
          const player = videoRef.current;
          if (player && Number.isFinite(player.duration)) setDuration(player.duration);
        }}
        onPlay={() => {
          setPlaying(true);
          setBlocked(false);
          setEnded(false);
          scheduleHide();
          report(false);
        }}
        onPause={() => {
          setPlaying(false);
          setControls(true);
          report(false);
        }}
        onTimeUpdate={() => {
          const player = videoRef.current;
          if (player) setCurrent(player.currentTime);
        }}
        onProgress={() => {
          const player = videoRef.current;
          if (!player || !player.buffered.length) return;
          setBuffered(player.buffered.end(player.buffered.length - 1));
        }}
        onWaiting={() => setWaiting(true)}
        onCanPlay={() => setWaiting(false)}
        onPlaying={() => setWaiting(false)}
        onVolumeChange={() => {
          const player = videoRef.current;
          if (!player) return;
          setVolume(player.volume);
          setMuted(player.muted);
        }}
        onRateChange={() => {
          const player = videoRef.current;
          if (player) setRate(player.playbackRate);
        }}
        onEnded={() => {
          setPlaying(false);
          setControls(true);
          setWaiting(false);
          report(true);
          if (next) setCountdown(5);
          else setEnded(true);
        }}
        onError={() => {
          setFailed(true);
          setWaiting(false);
        }}
      />

      {waiting && !failed && <div className="kp-spinner" aria-hidden="true">{icons.loading}</div>}

      {failed && (
        <div className="kp-fatal">
          <strong>Не удалось воспроизвести</strong>
          <p>Файл мог ещё не докачаться или сервер недоступен.</p>
          <button
            className="kp-pill"
            onClick={() => {
              const player = videoRef.current;
              if (!player) return;
              setFailed(false);
              setWaiting(true);
              userPaused.current = false;
              player.load();
              void player.play().catch(() => setBlocked(true));
            }}
          >
            Повторить
          </button>
        </div>
      )}

      <div className="kp-ui">
        <div className="kp-top" onPointerDown={(e) => e.stopPropagation()} onPointerUp={(e) => e.stopPropagation()}>
          {onBack && (
            <button className="kp-round" onClick={onBack} aria-label="Назад" title="Назад">
              {icons.back}
            </button>
          )}
          <div className="kp-heading">
            <span className="kp-title">{title}</span>
            {subtitle && <span className="kp-subtitle">{subtitle}</span>}
          </div>
          <div className="kp-heading-actions">
            {prev && (
              <button className="kp-chip" onClick={() => onOpen?.(prev.id)} title={prev.title}>
                {icons.prev}<span>Предыдущее</span>
              </button>
            )}
            {next && (
              <button className="kp-chip" onClick={() => onOpen?.(next.id)} title={next.title}>
                <span>Следующее</span>{icons.next}
              </button>
            )}
          </div>
        </div>

        {!playing && !ended && !failed && countdown == null && (
          <div className="kp-center" onPointerDown={(e) => e.stopPropagation()} onPointerUp={(e) => e.stopPropagation()}>
            <button className="kp-skip" onClick={() => seekBy(-10)} aria-label="Назад на 10 секунд" title="−10 секунд">
              {icons.skipBack}
            </button>
            <button className="kp-cta" onClick={togglePlay} aria-label="Смотреть" title="Смотреть">
              {icons.play}
            </button>
            <button className="kp-skip" onClick={() => seekBy(10)} aria-label="Вперёд на 10 секунд" title="+10 секунд">
              {icons.skipForward}
            </button>
            {blocked && <span className="kp-blocked">Нажмите, чтобы начать</span>}
          </div>
        )}

        {ended && countdown == null && (
          <div className="kp-center" onPointerDown={(e) => e.stopPropagation()} onPointerUp={(e) => e.stopPropagation()}>
            <button className="kp-cta" onClick={restart} aria-label="Смотреть снова" title="Смотреть снова">
              {icons.replay}
            </button>
            <span className="kp-blocked">Смотреть снова</span>
          </div>
        )}

        {countdown != null && next && (
          <div className="kp-next" onPointerDown={(e) => e.stopPropagation()} onPointerUp={(e) => e.stopPropagation()}>
            <div className="kp-next-ring">
              <svg viewBox="0 0 40 40" width="40" height="40" aria-hidden="true">
                <circle cx="20" cy="20" r="17" fill="none" stroke="rgba(255,255,255,0.16)" strokeWidth="2.5" />
                <circle
                  cx="20" cy="20" r="17" fill="none" stroke="var(--accent)" strokeWidth="2.5"
                  strokeLinecap="round" strokeDasharray={107}
                  strokeDashoffset={107 * (1 - countdown / 5)}
                  transform="rotate(-90 20 20)"
                />
              </svg>
              <b>{countdown}</b>
            </div>
            <div className="kp-next-text">
              <span className="kp-next-label">Далее</span>
              <strong>{next.title}</strong>
            </div>
            <div className="kp-next-actions">
              <button className="kp-pill accent" onClick={() => { setCountdown(null); onOpen?.(next.id); }}>Смотреть</button>
              <button className="kp-pill" onClick={() => { setCountdown(null); setEnded(true); }}>Отмена</button>
            </div>
          </div>
        )}

        {resume != null && (
          <div className="kp-resume" onPointerDown={(e) => e.stopPropagation()} onPointerUp={(e) => e.stopPropagation()}>
            <span>Продолжаем с {formatTime(resume)}</span>
            <button onClick={restart}>Сначала</button>
          </div>
        )}

        {seekFlash && (
          <div key={seekFlash.id} className={`kp-seek ${seekFlash.dir < 0 ? 'left' : 'right'}`} aria-hidden="true">
            <span className="kp-seek-ring">{seekFlash.dir < 0 ? icons.skipBack : icons.skipForward}</span>
            <span>{seekFlash.dir < 0 ? '−10 секунд' : '+10 секунд'}</span>
          </div>
        )}

        {volumeFlash && (
          <div key={volumeFlash.id} className="kp-volume-flash" aria-hidden="true">
            {volumeFlash.value === 0 ? icons.volumeOff : icons.volume}
            <span>{Math.round(volumeFlash.value * 100)}%</span>
          </div>
        )}

        <div className="kp-bottom" onPointerDown={(e) => e.stopPropagation()} onPointerUp={(e) => e.stopPropagation()}>
          <div
            ref={railRef}
            className="kp-timeline"
            role="slider"
            tabIndex={0}
            aria-label="Позиция видео"
            aria-valuemin={0}
            aria-valuemax={Math.round(duration)}
            aria-valuenow={Math.round(current)}
            aria-valuetext={`${formatTime(current)} из ${formatTime(duration)}`}
            onPointerDown={(event) => {
              seekRef.current = true;
              event.currentTarget.setPointerCapture(event.pointerId);
              seekToClientX(event.clientX);
            }}
            onPointerMove={(event) => {
              const rail = railRef.current;
              const player = videoRef.current;
              if (!rail || !player || !Number.isFinite(player.duration) || player.duration <= 0) return;
              const rect = rail.getBoundingClientRect();
              const ratio = clamp((event.clientX - rect.left) / rect.width, 0, 1);
              setHover({ time: ratio * player.duration, ratio });
              if (seekRef.current) seekToClientX(event.clientX);
            }}
            onPointerUp={(event) => {
              seekRef.current = false;
              event.currentTarget.releasePointerCapture(event.pointerId);
            }}
            onPointerLeave={() => {
              if (!seekRef.current) setHover(null);
            }}
            onKeyDown={(event) => {
              const player = videoRef.current;
              if (!player) return;
              if (event.key === 'ArrowLeft') { event.preventDefault(); seekBy(-5); }
              else if (event.key === 'ArrowRight') { event.preventDefault(); seekBy(5); }
              else if (event.key === 'Home') { event.preventDefault(); player.currentTime = 0; setCurrent(0); }
              else if (event.key === 'End' && Number.isFinite(player.duration)) {
                event.preventDefault();
                player.currentTime = player.duration - 0.2;
              }
            }}
          >
            <div className="kp-rail">
              <span className="kp-buffer" style={{ width: `${bufferRatio * 100}%` }} />
              <span className="kp-fill" style={{ width: `${progress * 100}%` }} />
            </div>
            <span className="kp-dot" style={{ left: `${progress * 100}%` }} />
            {hover && (
              <div className="kp-hover" style={{ left: `${clamp(hover.ratio, 0.04, 0.96) * 100}%` }}>
                {previewSrc && <img src={previewSrc} alt="" draggable={false} />}
                <span>{formatTime(previewBucket)}</span>
              </div>
            )}
          </div>

          <div className="kp-row">
            <button
              className="kp-btn" onClick={togglePlay}
              aria-label={playing ? 'Пауза' : 'Смотреть'} title={playing ? 'Пауза (пробел)' : 'Смотреть (пробел)'}
            >
              {playing ? icons.pause : icons.play}
            </button>
            <button className="kp-btn kp-hide-sm" onClick={() => seekBy(-10)} aria-label="Назад на 10 секунд" title="−10 секунд (J)">
              {icons.skipBack}
            </button>
            <button className="kp-btn kp-hide-sm" onClick={() => seekBy(10)} aria-label="Вперёд на 10 секунд" title="+10 секунд (L)">
              {icons.skipForward}
            </button>

            <div className="kp-volume">
              <button
                className="kp-btn" onClick={() => changeVolume(volume === 0 ? 1 : 0)}
                aria-label={muted || volume === 0 ? 'Включить звук' : 'Выключить звук'}
                title="Звук (M)"
              >
                {muted || volume === 0 ? icons.volumeOff : icons.volume}
              </button>
              <input
                className="kp-vol" type="range" min={0} max={1} step={0.02}
                value={muted ? 0 : volume}
                aria-label="Громкость"
                onChange={(event) => changeVolume(Number(event.target.value), false)}
              />
            </div>

            <span className="kp-time">
              <b>{formatTime(current)}</b>
              <span className="kp-time-sep">/</span>
              {formatTime(duration)}
            </span>

            <span className="kp-grow" />

            <div className="kp-speed-wrap">
              <button
                className={`kp-btn kp-speed${rate !== 1 ? ' on' : ''}`}
                onClick={() => setMenu((value) => !value)}
                aria-haspopup="menu"
                aria-expanded={menu}
                aria-label={`Скорость ${rate}×`}
                title="Скорость"
              >
                {rate}×
              </button>
              {menu && (
                <div className="kp-menu" role="menu">
                  <span className="kp-menu-label">Скорость</span>
                  {RATES.map((value) => (
                    <button
                      key={value}
                      role="menuitemradio"
                      aria-checked={rate === value}
                      className={rate === value ? 'on' : ''}
                      onClick={() => changeRate(value)}
                    >
                      {value}×
                      {rate === value && <span className="kp-menu-check">{icons.check}</span>}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {typeof document !== 'undefined' && document.pictureInPictureEnabled && (
              <button
                className={`kp-btn${pip ? ' on' : ''}`} onClick={() => void togglePip()}
                aria-label="Картинка в картинке" title="Картинка в картинке (P)"
              >
                {icons.pip}
              </button>
            )}

            <button
              className="kp-btn" onClick={() => void toggleFullscreen()}
              aria-label={fullscreen ? 'Выйти из полноэкранного режима' : 'Полный экран'}
              title={fullscreen ? 'Выйти из полноэкранного режима (F)' : 'Полный экран (F)'}
            >
              {fullscreen ? icons.fullscreenExit : icons.fullscreen}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
