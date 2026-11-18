export type User = {
  id: number;
  username: string;
  is_admin: boolean;
  created_at: string;
};

export type Settings = {
  retention_unwatched_days: number;
  retention_watched_days: number;
  default_poll_minutes: number;
};

export type AuthResponse = {
  token?: string;
  user: User;
  settings: Settings;
};

export type PlaylistCounts = {
  videos: number;
  ready: number;
  pending: number;
  failed: number;
};

export type Playlist = {
  id: number;
  title: string;
  url: string;
  youtube_list_id: string;
  owner_id: number;
  owner: string;
  is_hidden: boolean;
  enabled: boolean;
  poll_minutes: number;
  download_existing: boolean;
  baseline_done: boolean;
  last_checked_at: string | null;
  next_check_at: string | null;
  last_error: string | null;
  created_at: string;
  counts: PlaylistCounts;
  cover: string | null;
  cover_last: boolean;
};

export type Video = {
  id: number;
  playlist_id: number;
  playlist_title: string;
  playlist_hidden: boolean;
  owner_id: number;
  owner: string;
  video_id: string;
  title: string;
  channel: string;
  duration_s: number | null;
  thumbnail_url: string | null;
  thumbnail_local: string;
  webpage_url: string;
  upload_date: string | null;
  status: string;
  reaction: 'none' | 'like' | 'dislike';
  progress: number;
  file_size: number | null;
  downloaded_at: string | null;
  watched_at: string | null;
  watch_position_s: number | null;
  in_playlist: boolean;
  deleted_at: string | null;
  delete_reason: string | null;
  delete_after: string | null;
  error: string | null;
  created_at: string;
  can_manage: boolean;
};

export type VideoList = {
  total: number;
  items: Video[];
};

export type HistoryEvent = {
  id: number;
  video_id: number | null;
  title: string;
  channel: string;
  webpage_url: string;
  owner: string;
  started_at: string;
  last_at: string;
  position_s: number;
  duration_s: number | null;
  completed: boolean;
};

export type HistoryList = {
  total: number;
  items: HistoryEvent[];
};

export type SystemStatus = {
  app: string;
  counts: Record<string, number>;
  videos_root: string;
  disk_free: number;
  disk_total: number;
};

export type UserRef = {
  id: number;
  username: string;
};
