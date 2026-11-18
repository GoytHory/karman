import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { Link, NavLink, Navigate, Outlet, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { api } from './api';
import { AuthProvider, useAuth } from './auth';
import { icons } from './components/icons';
import { AllVideosPage } from './pages/AllVideos';
import { HistoryPage } from './pages/History';
import { LoginPage } from './pages/Login';
import { MyPlaylistsPage } from './pages/MyPlaylists';
import { PlaylistPage } from './pages/Playlist';
import { SettingsPage } from './pages/Settings';
import { VideoPage } from './pages/Video';
import type { SystemStatus } from './types';

type NavItem = { to: string; label: string; icon: ReactNode; end: boolean; badge?: 'queue' | 'errors'; extra?: string };

const NAV: Array<{ title: string; items: NavItem[] }> = [
  {
    title: 'Библиотека',
    items: [
      { to: '/', label: 'Все видео', icon: icons.library, end: true },
      { to: '/saved', label: 'Сохранённые', icon: icons.thumbUp, end: true },
      { to: '/queue', label: 'Загрузки', icon: icons.download, end: true, badge: 'queue' },
      { to: '/my', label: 'Плейлисты', icon: icons.playlists, end: true, extra: '/playlists/' },
    ],
  },
  {
    title: 'Аккаунт',
    items: [
      { to: '/history', label: 'История', icon: icons.history, end: true },
      { to: '/settings', label: 'Настройки', icon: icons.settings, end: true },
    ],
  },
];

function sectionFor(path: string): string {
  if (path === '/' || path.startsWith('/saved') || path.startsWith('/queue')
    || path.startsWith('/errors') || path === '/my' || path.startsWith('/playlists/')
    || path.startsWith('/videos/')) {
    return 'Библиотека';
  }
  return 'Аккаунт';
}

function useStatus() {
  const [status, setStatus] = useState<SystemStatus | null>(null);

  const load = useCallback(async () => {
    try {
      setStatus(await api.status());
    } catch {
      // статус — вспомогательный, интерфейс работает и без него
    }
  }, []);

  useEffect(() => {
    void load();
    const timer = window.setInterval(() => void load(), 20000);
    return () => window.clearInterval(timer);
  }, [load]);

  return status;
}

function Layout() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const status = useStatus();
  const [expanded, setExpanded] = useState(() => window.localStorage.getItem('karman.sidebar') === '1');
  const [drawer, setDrawer] = useState(false);
  const [mobile, setMobile] = useState(() => window.matchMedia('(max-width: 900px)').matches);

  useEffect(() => {
    const query = window.matchMedia('(max-width: 900px)');
    const onChange = () => setMobile(query.matches);
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  }, []);

  useEffect(() => {
    window.scrollTo({ top: 0 });
    setDrawer(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!mobile) window.localStorage.setItem('karman.sidebar', expanded ? '1' : '0');
  }, [expanded, mobile]);

  const counts = status?.counts || {};
  const queue = (counts.pending || 0) + (counts.downloading || 0);
  const failed = counts.failed || 0;
  const shown = mobile ? drawer : expanded;

  const leave = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  return (
    <div className="app">
      {mobile && drawer && <div className="sidebar-scrim" onClick={() => setDrawer(false)} />}

      <aside className={shown ? 'sidebar open' : 'sidebar'} aria-hidden={mobile && !drawer ? true : undefined}>
        <div className="sidebar-inner">
          <div className="sidebar-head">
            <Link to="/" className="sidebar-logo" title="Карман">К</Link>
            <span className="sidebar-name">Карман</span>
          </div>

          <nav className="sidebar-nav">
            {NAV.map((group) => (
              <div className="sidebar-group" key={group.title}>
                <div className="sidebar-group-title">{group.title}</div>
                {group.items.map((item) => {
                  return (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      end={item.end}
                      title={item.label}
                      aria-label={item.label}
                      className={({ isActive }) => (
                        isActive || (item.extra && location.pathname.startsWith(item.extra))
                          ? 'sidebar-link active' : 'sidebar-link'
                      )}
                    >
                      <span className="sidebar-ic">{item.icon}</span>
                      <span className="sidebar-label">{item.label}</span>
                      {item.badge === 'queue' && queue > 0 && (
                        <span className="sidebar-badge">{queue}</span>
                      )}
                      {item.badge === 'queue' && failed > 0 && (
                        <span className="sidebar-badge bad" title={`${failed} с ошибкой`}>{failed}</span>
                      )}
                    </NavLink>
                  );
                })}
              </div>
            ))}
          </nav>

          <div className="sidebar-foot">
            <button
              className="sidebar-btn"
              onClick={() => { if (mobile) setDrawer(false); else setExpanded((value) => !value); }}
              title={mobile || expanded ? 'Свернуть меню' : 'Развернуть меню'}
              aria-label={mobile || expanded ? 'Свернуть меню' : 'Развернуть меню'}
              aria-expanded={mobile ? drawer : expanded}
            >
              <span className="sidebar-ic">{mobile || expanded ? icons.chevronLeft : icons.chevronRight}</span>
              <span className="sidebar-label">{mobile || expanded ? 'Свернуть' : 'Развернуть'}</span>
            </button>
            <button className="sidebar-btn" onClick={() => void leave()} title="Выйти" aria-label="Выйти">
              <span className="sidebar-ic">{icons.logout}</span>
              <span className="sidebar-label">Выйти</span>
            </button>
            <div className="sidebar-user" title={`${user?.username} · ${user?.is_admin ? 'администратор' : 'аккаунт'}`}>
              <span className="sidebar-avatar">{(user?.username || '?').slice(0, 1)}</span>
              <div className="sidebar-user-text">
                <strong>{user?.username}</strong>
                <span>{user?.is_admin ? 'администратор' : 'аккаунт'}</span>
              </div>
            </div>
          </div>
        </div>
      </aside>

      <div className="main">
        <header className="topbar">
          <div className="topbar-left">
            <button className="icon-btn menu-btn" onClick={() => setDrawer(true)}
              aria-label="Открыть меню" title="Открыть меню">
              {icons.menu}
            </button>
            <span className="topbar-section">{sectionFor(location.pathname)}</span>
          </div>
        </header>

        <main className="view">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

function Protected() {
  const { user, loading } = useAuth();
  if (loading) return <div className="screen-loader"><span className="spinner" /> Загружаем…</div>;
  if (!user) return <Navigate to="/login" replace />;
  return <Layout />;
}

function LoginRoute() {
  const { user, loading } = useAuth();
  if (loading) return <div className="screen-loader"><span className="spinner" /> Загружаем…</div>;
  if (user) return <Navigate to="/" replace />;
  return <LoginPage />;
}

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/login" element={<LoginRoute />} />
        <Route element={<Protected />}>
          <Route index element={<AllVideosPage />} />
          <Route path="/saved" element={<AllVideosPage key="saved" preset="saved" />} />
          <Route path="/queue" element={<AllVideosPage key="queue" preset="queue" />} />
          <Route path="/errors" element={<Navigate to="/queue" replace />} />
          <Route path="/my" element={<MyPlaylistsPage />} />
          <Route path="/playlists/:id" element={<PlaylistPage />} />
          <Route path="/videos/:id" element={<VideoPage />} />
          <Route path="/history" element={<HistoryPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </AuthProvider>
  );
}
