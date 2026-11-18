import { useState, type FormEvent } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth';
import { ApiError } from '../api';

export function LoginPage() {
  const { user, login, register } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  if (user) return <Navigate to="/" replace />;

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError('');
    setBusy(true);
    try {
      if (mode === 'login') await login(username, password);
      else await register(username, password);
      const back = (location.state as { from?: string } | null)?.from || '/';
      navigate(back, { replace: true });
    } catch (exc) {
      setError(exc instanceof ApiError ? exc.message : 'Не получилось. Попробуйте ещё раз.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="login-screen">
      <div className="login-card">
        <div className="login-brand">
          <span className="brand-mark">К</span>
          <div>
            <h1>Карман</h1>
            <p>Личный видеоархив из плейлистов YouTube</p>
          </div>
        </div>
        <div className="tabs">
          <button className={mode === 'login' ? 'tab active' : 'tab'} onClick={() => { setMode('login'); setError(''); }}>
            Вход
          </button>
          <button className={mode === 'register' ? 'tab active' : 'tab'} onClick={() => { setMode('register'); setError(''); }}>
            Регистрация
          </button>
        </div>
        <form onSubmit={submit} className="stack">
          <label className="field">
            <span>Логин</span>
            <input
              className="input"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              autoCapitalize="off"
              autoCorrect="off"
              placeholder="ivan"
              required
            />
          </label>
          <label className="field">
            <span>Пароль</span>
            <input
              className="input"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="не меньше 6 символов"
              required
              minLength={6}
            />
          </label>
          {error && <div className="error-box">{error}</div>}
          <button className="btn primary block" disabled={busy || !username.trim() || password.length < 6}>
            {busy ? <span className="spinner" /> : mode === 'login' ? 'Войти' : 'Создать аккаунт'}
          </button>
        </form>
        <p className="login-hint">
          {mode === 'register'
            ? 'Первый зарегистрированный аккаунт становится администратором. У каждого аккаунта свои плейлисты, скрытые видео и история.'
            : 'Если аккаунта ещё нет — переключитесь на регистрацию.'}
        </p>
      </div>
    </div>
  );
}
