package ru.karman.app.ui

import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import ru.karman.app.data.Repo
import ru.karman.app.data.Video

@Composable
fun PlaylistVideosScreen(playlistId: Int, onOpen: (Int) -> Unit) {
    var videos by remember { mutableStateOf<List<Video>>(emptyList()) }
    var loading by remember { mutableStateOf(true) }
    var error by remember { mutableStateOf("") }
    var reload by remember { mutableIntStateOf(0) }

    LaunchedEffect(playlistId, reload) {
        loading = true
        error = ""
        try {
            videos = Repo.api().videos(playlistId = playlistId, limit = 200).items
        } catch (exc: Exception) {
            error = Repo.humanMessage(exc)
        } finally {
            loading = false
        }
    }

    Column(modifier = Modifier.fillMaxSize()) {
        val title = videos.firstOrNull()?.playlist_title ?: "Плейлист"
        Text(
            title,
            color = TextMain,
            fontSize = 20.sp,
            fontWeight = FontWeight.SemiBold,
            modifier = Modifier.padding(horizontal = 16.dp, vertical = 10.dp),
        )

        when {
            loading && videos.isEmpty() -> LoadingBox()
            error.isNotBlank() && videos.isEmpty() -> ErrorState(error) { reload++ }
            videos.isEmpty() -> EmptyState("В плейлисте пока нет видео")
            else -> LazyColumn(modifier = Modifier.fillMaxWidth()) {
                items(videos, key = { it.id }) { video ->
                    Column(modifier = Modifier.padding(horizontal = 16.dp)) {
                        VideoCard(video) { onOpen(video.id) }
                    }
                }
                item { Spacer(Modifier.height(24.dp)) }
            }
        }
    }
}
