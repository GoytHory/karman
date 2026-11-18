import type {
  AuthResponse, HistoryList, PlaybackInfo, Playlist, Settings, SystemStatus, UserRef, Video, VideoList,
} from './types';

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  if (init.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
  const response = await fetch(path, { ...init, headers, credentials: 'same-origin' });
  if (!response.ok) {
    let message = `Ошибка ${response.status}`;
    try {
      const data = await response.json();
      if (typeof data?.detail === 'string') message = data.detail;
    } catch {
      // не JSON — оставляем общий текст
    }
    throw new ApiError(message, response.status);
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

function query(params: Record<string, string | number | undefined | null>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') search.set(key, String(value));
  }
  const text = search.toString();
  return text ? `?${text}` : '';
}

export const api = {
  me: () => request<AuthResponse>('/api/auth/me'),
  login: (username: string, password: string) => request<AuthResponse>('/api/auth/login', {
    method: 'POST', body: JSON.stringify({ username, password }),
  }),
  register: (username: string, password: string) => request<AuthResponse>('/api/auth/register', {
    method: 'POST', body: JSON.stringify({ username, password }),
  }),
  logout: () => request<{ ok: boolean }>('/api/auth/logout', { method: 'POST' }),

  users: () => request<UserRef[]>('/api/users'),

  playlists: (scope: 'mine' | 'all' = 'mine') => request<Playlist[]>(`/api/playlists${query({ scope })}`),
  playlist: (id: number) => request<Playlist>(`/api/playlists/${id}`),
  createPlaylist: (body: { url: string; hidden: boolean; download_existing: boolean; poll_minutes?: number }) =>
    request<Playlist>('/api/playlists', { method: 'POST', body: JSON.stringify(body) }),
  patchPlaylist: (
    id: number,
    body: { title?: string; hidden?: boolean; enabled?: boolean; poll_minutes?: number; cover_last?: boolean },
  ) => request<Playlist>(`/api/playlists/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  deletePlaylist: (id: number) => request<{ ok: boolean }>(`/api/playlists/${id}`, { method: 'DELETE' }),
  syncPlaylist: (id: number) => request<Playlist>(`/api/playlists/${id}/sync`, { method: 'POST' }),

  videos: (params: {
    scope?: 'all' | 'mine'; playlist_id?: number; owner_id?: number; status?: string; reaction?: string;
    q?: string; limit?: number; offset?: number;
  } = {}) => request<VideoList>(`/api/videos${query(params)}`),
  video: (id: number) => request<Video>(`/api/videos/${id}`),
  playback: (id: number) => request<PlaybackInfo>(`/api/videos/${id}/playback`),
  react: (id: number, reaction: 'like' | 'dislike' | 'none') =>
    request<Video>(`/api/videos/${id}/reaction`, { method: 'POST', body: JSON.stringify({ reaction }) }),
  deleteVideo: (id: number) => request<Video>(`/api/videos/${id}/delete`, { method: 'POST' }),
  retryVideo: (id: number) => request<Video>(`/api/videos/${id}/retry`, { method: 'POST' }),
  progress: (id: number, body: { event_id?: number | null; position_s: number; duration_s?: number | null; completed?: boolean }) =>
    request<{ event_id: number; completed: boolean; watched_at: string | null; delete_after: string | null }>(
      `/api/videos/${id}/progress`, { method: 'POST', body: JSON.stringify(body) },
    ),

  history: (limit = 100, offset = 0) => request<HistoryList>(`/api/history${query({ limit, offset })}`),

  settings: () => request<Settings>('/api/settings'),
  updateSettings: (body: Settings) => request<Settings>('/api/settings', { method: 'PUT', body: JSON.stringify(body) }),
  status: () => request<SystemStatus>('/api/status'),
};
