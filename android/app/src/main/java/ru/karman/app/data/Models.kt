package ru.karman.app.data

data class LoginBody(val username: String, val password: String)

data class UserRef(
    val id: Int = 0,
    val username: String = "",
    val is_admin: Boolean = false,
)

data class AuthResponse(
    val token: String = "",
    val user: UserRef = UserRef(),
)

data class VideoList(
    val total: Int = 0,
    val items: List<Video> = emptyList(),
)

data class Video(
    val id: Int = 0,
    val video_id: String? = null,
    val title: String = "",
    val channel: String? = null,
    val duration_s: Double? = null,
    val thumbnail_url: String? = null,
    val thumbnail_local: String? = null,
    val webpage_url: String? = null,
    val status: String = "ready",
    val reaction: String = "none",
    val progress: Double = 0.0,
    val file_size: Long? = null,
    val downloaded_at: String? = null,
    val watched_at: String? = null,
    val delete_reason: String? = null,
    val delete_after: String? = null,
    val error: String? = null,
    val created_at: String? = null,
    val can_manage: Boolean = false,
    val owner: String? = null,
    val playlist_id: Int = 0,
    val playlist_title: String? = null,
    val playlist_hidden: Boolean = false,
)

data class PlaylistCounts(
    val videos: Int = 0,
    val ready: Int = 0,
    val pending: Int = 0,
    val failed: Int = 0,
)

data class Playlist(
    val id: Int = 0,
    val title: String = "",
    val owner: String? = null,
    val is_hidden: Boolean = false,
    val enabled: Boolean = true,
    val poll_minutes: Int = 15,
    val cover: String? = null,
    val cover_last: Boolean = false,
    val counts: PlaylistCounts = PlaylistCounts(),
)

data class HistoryList(
    val total: Int = 0,
    val items: List<HistoryItem> = emptyList(),
)

data class HistoryItem(
    val id: Int = 0,
    val video_id: Int = 0,
    val title: String = "",
    val channel: String? = null,
    val webpage_url: String? = null,
    val owner: String? = null,
    val position_s: Double? = null,
    val duration_s: Double? = null,
    val percent: Int? = null,
    val completed: Boolean = false,
    val started_at: String? = null,
    val last_at: String? = null,
)

data class StatusCounts(
    val ready: Int = 0,
    val pending: Int = 0,
    val downloading: Int = 0,
    val failed: Int = 0,
)

data class StatusResponse(
    val app: String = "",
    val counts: StatusCounts = StatusCounts(),
    val videos_root: String? = null,
    val disk_free: Long? = null,
    val disk_total: Long? = null,
)

data class ReactionBody(val reaction: String)

data class ProgressBody(
    val event_id: Int?,
    val position_s: Double,
    val duration_s: Double,
    val completed: Boolean,
)

data class ProgressResponse(
    val event_id: Int? = null,
    val completed: Boolean = false,
    val watched_at: String? = null,
    val delete_after: String? = null,
)
