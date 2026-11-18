package ru.karman.app.ui

import android.net.Uri
import androidx.compose.foundation.ExperimentalFoundationApi
import androidx.compose.foundation.background
import androidx.compose.foundation.combinedClickable
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
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.Close
import androidx.compose.material.icons.rounded.DownloadDone
import androidx.compose.material.icons.rounded.Refresh
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import ru.karman.app.data.Downloads
import ru.karman.app.data.LocalDownload
import java.io.File

@OptIn(ExperimentalFoundationApi::class)
@Composable
fun DownloadsScreen() {
    val context = LocalContext.current
    var refresh by remember { mutableIntStateOf(0) }
    var playing by remember { mutableStateOf<LocalDownload?>(null) }
    var deleting by remember { mutableStateOf<LocalDownload?>(null) }
    val items = remember(refresh) { Downloads.all(context) }

    Column(modifier = Modifier.fillMaxSize()) {
        Row(
            modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Text(
                if (items.isEmpty()) "На телефоне пока пусто" else "${items.size} на телефоне",
                color = TextDim,
                fontSize = 11.sp,
                modifier = Modifier.weight(1f),
            )
            IconButton(onClick = { refresh++ }) {
                Icon(Icons.Rounded.Refresh, contentDescription = "Обновить", tint = TextDim)
            }
        }

        Text(
            "Файлы удаляются только вручную — долгим нажатием. Обычное нажатие открывает плеер.",
            color = TextDim,
            fontSize = 11.sp,
            lineHeight = 16.sp,
            modifier = Modifier.padding(horizontal = 16.dp, vertical = 4.dp),
        )

        if (items.isEmpty()) {
            EmptyState(
                title = "Нет скачанных видео",
                text = "Откройте видео и нажмите «Скачать на телефон». Файл появится здесь и будет доступен без интернета.",
            )
        } else {
            LazyColumn(
                modifier = Modifier.fillMaxSize(),
                contentPadding = androidx.compose.foundation.layout.PaddingValues(horizontal = 16.dp, vertical = 6.dp),
            ) {
                items(items, key = { it.videoId }) { item ->
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .clip(RoundedCornerShape(8.dp))
                            .combinedClickable(
                                onClick = { playing = item },
                                onLongClick = { deleting = item },
                            )
                            .padding(vertical = 10.dp),
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        Box(
                            modifier = Modifier
                                .size(38.dp)
                                .clip(RoundedCornerShape(6.dp))
                                .background(Panel),
                            contentAlignment = Alignment.Center,
                        ) {
                            Icon(Icons.Rounded.DownloadDone, contentDescription = null, tint = Lime)
                        }
                        Spacer(Modifier.width(10.dp))
                        Column(modifier = Modifier.weight(1f)) {
                            Text(
                                item.title,
                                color = TextMain,
                                fontSize = 13.sp,
                                fontWeight = FontWeight.Medium,
                                maxLines = 2,
                                overflow = TextOverflow.Ellipsis,
                            )
                            Text(
                                "${formatSize(item.size)} · ${formatDate(java.time.Instant.ofEpochMilli(item.savedAt).toString())}",
                                color = TextDim,
                                fontSize = 11.sp,
                            )
                        }
                    }
                }
                item { Spacer(Modifier.height(24.dp)) }
            }
        }
    }

    playing?.let { item ->
        Dialog(
            onDismissRequest = { playing = null },
            properties = DialogProperties(usePlatformDefaultWidth = false),
        ) {
            Surface(
                color = Ink,
                shape = RoundedCornerShape(10.dp),
                modifier = Modifier.fillMaxWidth().padding(12.dp),
            ) {
                Column {
                    Row(
                        modifier = Modifier.fillMaxWidth().padding(start = 14.dp, top = 6.dp, bottom = 2.dp),
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        Text(
                            item.title,
                            color = TextMain,
                            fontSize = 12.5.sp,
                            maxLines = 1,
                            overflow = TextOverflow.Ellipsis,
                            modifier = Modifier.weight(1f),
                        )
                        IconButton(onClick = { playing = null }) {
                            Icon(Icons.Rounded.Close, contentDescription = "Закрыть", tint = TextDim)
                        }
                    }
                    LocalPlayer(
                        url = Uri.fromFile(File(item.path)).toString(),
                        modifier = Modifier.fillMaxWidth().aspectRatio(16f / 9f),
                    )
                }
            }
        }
    }

    deleting?.let { item ->
        AlertDialog(
            onDismissRequest = { deleting = null },
            title = { Text("Удалить файл?") },
            text = { Text("«${item.title}» будет удалён с телефона. На сервере видео останется.") },
            confirmButton = {
                TextButton(onClick = {
                    Downloads.remove(context, item)
                    deleting = null
                    refresh++
                }) { Text("Удалить", color = Danger) }
            },
            dismissButton = {
                TextButton(onClick = { deleting = null }) { Text("Отмена") }
            },
        )
    }
}
