package ru.karman.app.ui

import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.Refresh
import androidx.compose.material.icons.rounded.Search
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlinx.coroutines.delay
import ru.karman.app.data.Repo
import ru.karman.app.data.Video

@Composable
fun LibraryScreen(onOpen: (Int) -> Unit) {
    var query by rememberSaveable { mutableStateOf("") }
    var videos by remember { mutableStateOf<List<Video>>(emptyList()) }
    var total by remember { mutableStateOf(0) }
    var loading by remember { mutableStateOf(true) }
    var error by remember { mutableStateOf("") }
    var reload by remember { mutableIntStateOf(0) }

    LaunchedEffect(query, reload) {
        if (query.isNotBlank()) delay(350)
        loading = true
        error = ""
        try {
            val response = Repo.api().videos(q = query.ifBlank { null }, limit = 100)
            videos = response.items
            total = response.total
        } catch (exc: Exception) {
            error = Repo.humanMessage(exc)
        } finally {
            loading = false
        }
    }

    Column(modifier = Modifier.fillMaxSize().padding(horizontal = 16.dp)) {
        OutlinedTextField(
            value = query,
            onValueChange = { query = it },
            placeholder = { Text("Поиск по названию или каналу") },
            leadingIcon = { Icon(Icons.Rounded.Search, contentDescription = null) },
            singleLine = true,
            modifier = Modifier.fillMaxWidth().padding(top = 10.dp),
        )

        Row(
            modifier = Modifier.fillMaxWidth().padding(top = 4.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Text(
                text = if (total > 0) "$total в архиве" else "Архив пуст",
                color = TextDim,
                fontSize = 11.sp,
                modifier = Modifier.weight(1f),
            )
            IconButton(onClick = { reload++ }) {
                Icon(Icons.Rounded.Refresh, contentDescription = "Обновить", tint = TextDim)
            }
        }

        if (loading && videos.isEmpty()) {
            LoadingBox()
        } else if (error.isNotBlank() && videos.isEmpty()) {
            ErrorState(error) { reload++ }
        } else if (videos.isEmpty()) {
            EmptyState(
                title = if (query.isBlank()) "Пока пусто" else "Ничего не найдено",
                text = if (query.isBlank()) {
                    "Добавьте плейлист YouTube в веб-интерфейсе — новые видео появятся здесь автоматически."
                } else {
                    "Попробуйте другой запрос."
                },
            )
        } else {
            if (loading) {
                LinearProgressIndicator(
                    modifier = Modifier.fillMaxWidth().height(1.dp),
                    color = Lime,
                    trackColor = Line,
                )
            }
            LazyColumn(modifier = Modifier.weight(1f)) {
                items(videos, key = { it.id }) { video ->
                    VideoCard(video) { onOpen(video.id) }
                }
                item { Spacer(Modifier.height(24.dp)) }
            }
        }
    }
}
