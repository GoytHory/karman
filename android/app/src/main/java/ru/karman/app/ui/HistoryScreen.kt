package ru.karman.app.ui

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
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
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import ru.karman.app.data.HistoryItem
import ru.karman.app.data.Repo

@Composable
fun HistoryScreen(onOpen: (Int) -> Unit) {
    var items by remember { mutableStateOf<List<HistoryItem>>(emptyList()) }
    var loading by remember { mutableStateOf(true) }
    var error by remember { mutableStateOf("") }
    var reload by remember { mutableIntStateOf(0) }

    LaunchedEffect(reload) {
        loading = true
        error = ""
        try {
            items = Repo.api().history().items
        } catch (exc: Exception) {
            error = Repo.humanMessage(exc)
        } finally {
            loading = false
        }
    }

    when {
        loading && items.isEmpty() -> LoadingBox()
        error.isNotBlank() && items.isEmpty() -> ErrorState(error) { reload++ }
        items.isEmpty() -> EmptyState(
            title = "История пуста",
            text = "Здесь появятся просмотренные видео — и на компьютере, и на телефоне.",
        )
        else -> LazyColumn(
            modifier = Modifier.fillMaxSize(),
            contentPadding = androidx.compose.foundation.layout.PaddingValues(horizontal = 16.dp, vertical = 6.dp),
        ) {
            items(items, key = { it.id }) { item ->
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clickable { if (item.video_id > 0) onOpen(item.video_id) }
                        .padding(vertical = 10.dp),
                    verticalArrangement = Arrangement.spacedBy(3.dp),
                ) {
                    Text(
                        item.title,
                        color = TextMain,
                        fontSize = 13.sp,
                        fontWeight = FontWeight.Medium,
                        maxLines = 2,
                        overflow = TextOverflow.Ellipsis,
                    )
                    Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                        Text(item.channel ?: "без канала", color = TextDim, fontSize = 11.sp)
                        Text("·", color = Line, fontSize = 11.sp)
                        Text(item.owner ?: "", color = TextDim, fontSize = 11.sp)
                        Text("·", color = Line, fontSize = 11.sp)
                        Text(formatDate(item.last_at), color = TextDim, fontSize = 11.sp)
                    }
                    Text(
                        buildString {
                            val percent = item.percent ?: 0
                            append(if (item.completed) "Просмотрено полностью" else "Просмотрено $percent%")
                            item.duration_s?.let { append(" · ${formatDuration(it)}") }
                        },
                        color = if (item.completed) TextDim else Warn,
                        fontSize = 10.5.sp,
                    )
                }
            }
            item { Spacer(Modifier.padding(bottom = 24.dp)) }
        }
    }
}
