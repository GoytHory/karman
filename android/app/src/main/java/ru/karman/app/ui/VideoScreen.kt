package ru.karman.app.ui

import android.content.Intent
import android.net.Uri
import android.widget.Toast
import androidx.compose.foundation.background
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
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.Download
import androidx.compose.material.icons.rounded.OpenInNew
import androidx.compose.material.icons.rounded.ThumbDown
import androidx.compose.material.icons.rounded.ThumbUp
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
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
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlinx.coroutines.launch
import ru.karman.app.data.DownloadWorker
import ru.karman.app.data.ProgressBody
import ru.karman.app.data.Repo
import ru.karman.app.data.Video
import androidx.compose.runtime.rememberCoroutineScope

@Composable
fun VideoScreen(videoId: Int) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    var video by remember { mutableStateOf<Video?>(null) }
    var loading by remember { mutableStateOf(true) }
    var error by remember { mutableStateOf("") }
    var busy by remember { mutableStateOf(false) }
    var confirmDislike by remember { mutableStateOf(false) }
    var eventId by remember { mutableStateOf<Int?>(null) }
    var reload by remember { mutableIntStateOf(0) }

    LaunchedEffect(videoId, reload) {
        loading = true
        try {
            video = Repo.api().video(videoId)
            error = ""
        } catch (exc: Exception) {
            error = Repo.humanMessage(exc)
        } finally {
            loading = false
        }
    }

    fun postProgress(position: Double, duration: Double) {
        val current = video ?: return
        if (current.status != "ready" || duration <= 0) return
        scope.launch {
            runCatching {
                val result = Repo.api().progress(
                    current.id,
                    ProgressBody(
                        event_id = eventId,
                        position_s = position,
                        duration_s = duration,
                        completed = position >= duration * 0.9,
                    ),
                )
                eventId = result.event_id
            }
        }
    }

    fun react(reaction: String) {
        val current = video ?: return
        busy = true
        scope.launch {
            try {
                video = Repo.api().reaction(current.id, ru.karman.app.data.ReactionBody(reaction))
            } catch (exc: Exception) {
                Toast.makeText(context, Repo.humanMessage(exc), Toast.LENGTH_LONG).show()
            } finally {
                busy = false
            }
        }
    }

    when {
        loading -> LoadingBox()
        video == null -> ErrorState(error.ifBlank { "Видео не найдено" }) { reload++ }
        else -> {
            val item = video!!
            val ready = item.status == "ready"
            val deleted = item.status == "deleted"
            val liked = item.reaction == "like"

            Column(
                modifier = Modifier
                    .fillMaxSize()
                    .verticalScroll(rememberScrollState())
                    .padding(horizontal = 16.dp),
            ) {
                Text(
                    item.title,
                    color = TextMain,
                    fontSize = 18.sp,
                    fontWeight = FontWeight.SemiBold,
                    lineHeight = 24.sp,
                    modifier = Modifier.padding(top = 12.dp),
                )
                Text(
                    listOfNotNull(item.channel, item.owner, item.playlist_title).joinToString(" · "),
                    color = TextDim,
                    fontSize = 11.5.sp,
                    modifier = Modifier.padding(top = 4.dp),
                )

                Spacer(Modifier.height(12.dp))

                if (ready) {
                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .aspectRatio(16f / 9f)
                            .clip(RoundedCornerShape(8.dp))
                            .background(Color.Black),
                    ) {
                        PlayerSurface(
                            url = Repo.streamUrl(item.id),
                            withAuth = true,
                            modifier = Modifier.fillMaxSize(),
                            onProgress = { position, duration -> postProgress(position, duration) },
                        )
                    }
                } else {
                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .aspectRatio(16f / 9f)
                            .clip(RoundedCornerShape(8.dp))
                            .background(Panel),
                        contentAlignment = Alignment.Center,
                    ) {
                        Column(
                            horizontalAlignment = Alignment.CenterHorizontally,
                            verticalArrangement = Arrangement.spacedBy(8.dp),
                            modifier = Modifier.padding(20.dp),
                        ) {
                            when {
                                deleted -> {
                                    Text("Файл удалён", color = TextMain, fontSize = 14.sp, fontWeight = FontWeight.Medium)
                                    Text(
                                        when (item.delete_reason) {
                                            "disliked" -> "Вы поставили дизлайк."
                                            "watched" -> "Видео просмотрено, срок хранения истёк."
                                            "expired" -> "Срок хранения истёк."
                                            else -> "Файл удалён вручную."
                                        },
                                        color = TextDim,
                                        fontSize = 12.sp,
                                    )
                                }
                                item.status == "failed" -> {
                                    Text("Не удалось скачать", color = TextMain, fontSize = 14.sp, fontWeight = FontWeight.Medium)
                                    Text(
                                        item.error ?: "Неизвестная ошибка",
                                        color = Danger,
                                        fontSize = 11.5.sp,
                                        lineHeight = 16.sp,
                                    )
                                    if (item.can_manage) {
                                        TextButton(onClick = {
                                            busy = true
                                            scope.launch {
                                                try {
                                                    video = Repo.api().retry(item.id)
                                                } catch (exc: Exception) {
                                                    Toast.makeText(context, Repo.humanMessage(exc), Toast.LENGTH_LONG).show()
                                                } finally {
                                                    busy = false
                                                }
                                            }
                                        }) { Text("Повторить") }
                                    }
                                }
                                item.status == "ignored" -> {
                                    Text("Видео не скачивалось", color = TextMain, fontSize = 14.sp)
                                    Text("Оно уже было в плейлисте до добавления.", color = TextDim, fontSize = 12.sp)
                                }
                                else -> {
                                    Text("Скачивается", color = TextMain, fontSize = 14.sp)
                                    LinearProgressIndicator(
                                        progress = { (item.progress / 100.0).toFloat() },
                                        modifier = Modifier.fillMaxWidth().height(3.dp),
                                        color = Lime,
                                        trackColor = Line,
                                    )
                                    Text("${item.progress.toInt()}%", color = TextDim, fontSize = 11.sp)
                                }
                            }
                        }
                    }
                }

                if (error.isNotBlank()) {
                    Text(error, color = Danger, fontSize = 12.sp, modifier = Modifier.padding(top = 8.dp))
                }

                Row(
                    modifier = Modifier.fillMaxWidth().padding(top = 10.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(4.dp),
                ) {
                    if (item.can_manage && !deleted) {
                        IconButton(
                            onClick = { react(if (liked) "none" else "like") },
                            enabled = !busy,
                        ) {
                            Icon(
                                Icons.Rounded.ThumbUp,
                                contentDescription = if (liked) "Убрать из сохранённых" else "Сохранить навсегда",
                                tint = if (liked) Lime else TextDim,
                            )
                        }
                        IconButton(
                            onClick = { confirmDislike = true },
                            enabled = !busy,
                        ) {
                            Icon(Icons.Rounded.ThumbDown, contentDescription = "Дизлайк и удалить", tint = TextDim)
                        }
                    }
                    Spacer(Modifier.weight(1f))
                    if (ready) {
                        Button(
                            onClick = {
                                DownloadWorker.start(context, item)
                                Toast.makeText(context, "Загрузка на телефон началась", Toast.LENGTH_SHORT).show()
                            },
                            colors = ButtonDefaults.buttonColors(
                                containerColor = Color(0xFFEDEDF0),
                                contentColor = Ink,
                            ),
                        ) {
                            Icon(Icons.Rounded.Download, contentDescription = null, modifier = Modifier.size(17.dp))
                            Spacer(Modifier.width(6.dp))
                            Text("Скачать на телефон", fontSize = 12.sp)
                        }
                    }
                }

                if (!item.webpage_url.isNullOrBlank()) {
                    TextButton(onClick = {
                        runCatching {
                            context.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(item.webpage_url)))
                        }
                    }) {
                        Text("Открыть оригинал на YouTube", color = TextDim, fontSize = 12.sp)
                        Icon(
                            Icons.Rounded.OpenInNew,
                            contentDescription = null,
                            tint = TextDim,
                            modifier = Modifier.size(14.dp),
                        )
                    }
                }

                HorizontalDivider(color = Line, modifier = Modifier.padding(vertical = 6.dp))

                InfoRow("Статус", statusOf(item).first)
                InfoRow("Длительность", if (item.duration_s != null) formatDuration(item.duration_s) else "—")
                InfoRow("Размер файла", formatSize(item.file_size))
                InfoRow("Скачано", formatDate(item.downloaded_at))
                InfoRow("Просмотрено", formatDate(item.watched_at))
                InfoRow(
                    "Удаление с сервера",
                    when {
                        liked -> "бессрочно"
                        item.delete_after != null -> formatDate(item.delete_after)
                        else -> "—"
                    },
                )
                InfoRow("Плейлист", item.playlist_title ?: "—")
                Spacer(Modifier.height(28.dp))
            }

            if (confirmDislike) {
                AlertDialog(
                    onDismissRequest = { confirmDislike = false },
                    title = { Text("Удалить видео?") },
                    text = { Text("Дизлайк сразу удаляет файл с сервера. Это необратимо.") },
                    confirmButton = {
                        TextButton(onClick = {
                            confirmDislike = false
                            react("dislike")
                        }) { Text("Удалить", color = Danger) }
                    },
                    dismissButton = {
                        TextButton(onClick = { confirmDislike = false }) { Text("Отмена") }
                    },
                )
            }
        }
    }
}

@Composable
private fun InfoRow(label: String, value: String) {
    Row(
        modifier = Modifier.fillMaxWidth().padding(vertical = 7.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text(label, color = TextDim, fontSize = 12.sp, modifier = Modifier.weight(1f))
        Text(value, color = TextMain, fontSize = 12.sp)
    }
}
