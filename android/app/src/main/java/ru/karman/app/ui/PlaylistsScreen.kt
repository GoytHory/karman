package ru.karman.app.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.PlaylistPlay
import androidx.compose.material.icons.rounded.Refresh
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil.compose.AsyncImage
import ru.karman.app.data.Playlist
import ru.karman.app.data.Repo

@Composable
fun PlaylistsScreen(onOpen: (Int) -> Unit) {
    var playlists by remember { mutableStateOf<List<Playlist>>(emptyList()) }
    var loading by remember { mutableStateOf(true) }
    var error by remember { mutableStateOf("") }
    var reload by remember { mutableIntStateOf(0) }

    LaunchedEffect(reload) {
        loading = true
        error = ""
        try {
            playlists = Repo.api().playlists()
        } catch (exc: Exception) {
            error = Repo.humanMessage(exc)
        } finally {
            loading = false
        }
    }

    Column(modifier = Modifier.fillMaxSize()) {
        Row(
            modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Text(
                "Плейлисты всех пользователей",
                color = TextDim,
                fontSize = 11.sp,
                modifier = Modifier.weight(1f),
            )
            IconButton(onClick = { reload++ }) {
                Icon(Icons.Rounded.Refresh, contentDescription = "Обновить", tint = TextDim)
            }
        }

        when {
            loading && playlists.isEmpty() -> LoadingBox()
            error.isNotBlank() && playlists.isEmpty() -> ErrorState(error) { reload++ }
            playlists.isEmpty() -> EmptyState(
                title = "Плейлистов пока нет",
                text = "Добавьте ссылку на плейлист YouTube в веб-интерфейсе.",
            )
            else -> LazyColumn(
                modifier = Modifier.fillMaxSize(),
                contentPadding = androidx.compose.foundation.layout.PaddingValues(16.dp),
                verticalArrangement = Arrangement.spacedBy(18.dp),
            ) {
                items(playlists, key = { it.id }) { playlist ->
                    PlaylistCard(playlist) { onOpen(playlist.id) }
                }
            }
        }
    }
}

@Composable
private fun PlaylistCard(playlist: Playlist, onClick: () -> Unit) {
    Column(modifier = Modifier.fillMaxWidth().clickable(onClick = onClick)) {
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .aspectRatio(16f / 9f)
                .clip(RoundedCornerShape(8.dp))
                .background(Panel),
            contentAlignment = Alignment.Center,
        ) {
            val cover = Repo.absolute(playlist.cover)
            if (cover != null) {
                AsyncImage(
                    model = cover,
                    contentDescription = null,
                    contentScale = ContentScale.Crop,
                    modifier = Modifier.matchParentSize(),
                )
            } else {
                Icon(Icons.Rounded.PlaylistPlay, contentDescription = null, tint = Line)
            }
            Box(
                modifier = Modifier
                    .align(Alignment.BottomEnd)
                    .padding(8.dp)
                    .clip(RoundedCornerShape(3.dp))
                    .background(androidx.compose.ui.graphics.Color(0xCC040406))
                    .padding(horizontal = 6.dp, vertical = 2.dp),
            ) {
                Text("${playlist.counts.videos}", color = androidx.compose.ui.graphics.Color(0xFFD7D7DB), fontSize = 10.sp)
            }
        }
        Spacer(Modifier.height(8.dp))
        Text(
            playlist.title,
            color = TextMain,
            fontSize = 14.sp,
            fontWeight = FontWeight.Medium,
            maxLines = 2,
            overflow = TextOverflow.Ellipsis,
        )
        Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
            Text(playlist.owner ?: "", color = TextDim, fontSize = 11.sp)
            if (playlist.is_hidden) Text("скрытый", color = Warn, fontSize = 11.sp)
            Text("· ${playlist.counts.ready} готово", color = TextDim, fontSize = 11.sp)
            if (playlist.counts.failed > 0) {
                Text("· ${playlist.counts.failed} с ошибкой", color = Danger, fontSize = 11.sp)
            }
        }
    }
}
