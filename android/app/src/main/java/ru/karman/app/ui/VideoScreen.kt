package ru.karman.app.ui

import android.content.Intent
import android.content.pm.ActivityInfo
import android.graphics.drawable.ColorDrawable
import android.net.Uri
import android.os.Build
import android.view.WindowManager
import android.widget.Toast
import androidx.activity.compose.BackHandler
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
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalView
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import androidx.compose.ui.window.DialogWindowProvider
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat
import androidx.core.view.WindowInsetsControllerCompat
import androidx.media3.common.util.UnstableApi
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch
import ru.karman.app.data.DownloadWorker
import ru.karman.app.data.PlaybackInfo
import ru.karman.app.data.ProgressBody
import ru.karman.app.data.ReactionBody
import ru.karman.app.data.Repo
import ru.karman.app.data.Video

/** Отчёт о прогрессе не должен теряться при уходе с экрана. */
private val progressScope = CoroutineScope(SupervisorJob() + Dispatchers.Main)

@OptIn(UnstableApi::class)
@Composable
fun VideoScreen(videoId: Int, onOpen: (Int) -> Unit) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    var playback by remember(videoId) { mutableStateOf<PlaybackInfo?>(null) }
    var loading by remember(videoId) { mutableStateOf(true) }
    var error by remember(videoId) { mutableStateOf("") }
    var busy by remember(videoId) { mutableStateOf(false) }
    var confirmDislike by remember(videoId) { mutableStateOf(false) }
    var eventId by remember(videoId) { mutableStateOf<Int?>(null) }
    var reload by remember(videoId) { mutableIntStateOf(0) }
    var fullscreen by remember(videoId) { mutableStateOf(false) }

    LaunchedEffect(videoId, reload) {
        loading = true
        try {
            playback = Repo.api().playback(videoId)
            error = ""
        } catch (exc: Exception) {
            error = Repo.humanMessage(exc)
        } finally {
            loading = false
        }
    }

    val item = playback?.video
    val ready = item?.status == "ready"
    val stream = Repo.absolute(playback?.stream_url)
    val previewUrl = playback?.preview?.url
    val previewStep = playback?.preview?.step ?: 5
    val next = playback?.next

    fun postProgress(position: Double, duration: Double, completed: Boolean = false) {
        val current = item ?: return
        if (current.status != "ready" || duration <= 0) return
        progressScope.launch {
            runCatching {
                val result = Repo.api().progress(
                    current.id,
                    ProgressBody(
                        event_id = eventId,
                        position_s = position,
                        duration_s = duration,
                        completed = completed || position >= duration * 0.9,
                    ),
                )
                eventId = result.event_id
            }
        }
    }

    fun react(reaction: String) {
        val current = item ?: return
        busy = true
        scope.launch {
            try {
                val updated = Repo.api().reaction(current.id, ReactionBody(reaction))
                playback = playback?.copy(video = updated)
            } catch (exc: Exception) {
                Toast.makeText(context, Repo.humanMessage(exc), Toast.LENGTH_LONG).show()
            } finally {
                busy = false
            }
        }
    }

    val controller = rememberVideoController(
        url = stream.orEmpty(),
        title = item?.title.orEmpty(),
        subtitle = listOfNotNull(item?.channel, item?.owner).joinToString(" · ").ifBlank { null },
        startAt = playback?.position_s ?: 0.0,
        enabled = ready && !stream.isNullOrBlank(),
    )

    BackHandler(enabled = fullscreen) { fullscreen = false }

    LaunchedEffect(controller) {
        if (controller == null) fullscreen = false
    }

    if (loading) {
        LoadingBox()
        return
    }

    if (item == null) {
        ErrorState(error.ifBlank { "Видео не найдено" }) { reload++ }
        return
    }

    if (fullscreen && controller != null) {
        FullscreenPlayer(onDismiss = { fullscreen = false }) {
            KarmanPlayer(
                controller = controller,
                modifier = Modifier.fillMaxSize(),
                previewUrl = previewUrl,
                previewStep = previewStep,
                nextTitle = next?.title,
                fullscreen = true,
                onToggleFullscreen = { fullscreen = false },
                onNext = next?.let { neighbour -> { onOpen(neighbour.id) } },
                onProgress = { position, duration, completed -> postProgress(position, duration, completed) },
                onLeave = { position, duration -> postProgress(position, duration) },
            )
        }
    }

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

        Box(
            modifier = Modifier
                .fillMaxWidth()
                .aspectRatio(16f / 9f)
                .clip(RoundedCornerShape(8.dp))
                .background(Color.Black),
        ) {
            if (ready) {
                if (controller != null) {
                    KarmanPlayer(
                        controller = controller,
                        modifier = Modifier.fillMaxSize(),
                        previewUrl = previewUrl,
                        previewStep = previewStep,
                        nextTitle = next?.title,
                        fullscreen = false,
                        onToggleFullscreen = { fullscreen = true },
                        onNext = next?.let { neighbour -> { onOpen(neighbour.id) } },
                        onProgress = { position, duration, completed ->
                            postProgress(position, duration, completed)
                        },
                        onLeave = { position, duration -> postProgress(position, duration) },
                    )
                } else {
                    Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                        CircularProgressIndicator(
                            modifier = Modifier.size(26.dp),
                            color = Lime,
                            strokeWidth = 2.dp,
                        )
                    }
                }
            } else {
                PlayerPlaceholder(
                    item = item,
                    busy = busy,
                    onRetry = {
                        busy = true
                        scope.launch {
                            try {
                                val updated = Repo.api().retry(item.id)
                                playback = playback?.copy(video = updated)
                            } catch (exc: Exception) {
                                Toast.makeText(context, Repo.humanMessage(exc), Toast.LENGTH_LONG).show()
                            } finally {
                                busy = false
                            }
                        }
                    },
                )
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
                        containerColor = Raised,
                        contentColor = TextMain,
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

        next?.let { neighbour ->
            NextCard(title = neighbour.title, onClick = { onOpen(neighbour.id) })
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

@Composable
private fun PlayerPlaceholder(item: Video, busy: Boolean, onRetry: () -> Unit) {
    Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
        Column(
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(8.dp),
            modifier = Modifier.padding(20.dp),
        ) {
            when {
                item.status == "deleted" -> {
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
                        TextButton(onClick = onRetry, enabled = !busy) { Text("Повторить") }
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

@Composable
private fun NextCard(title: String, onClick: () -> Unit) {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .padding(top = 12.dp)
            .clip(RoundedCornerShape(8.dp))
            .background(Panel)
            .clickable(onClick = onClick)
            .padding(horizontal = 12.dp, vertical = 10.dp),
    ) {
        Text("Следующее", color = TextDim, fontSize = 10.sp, letterSpacing = 0.8.sp)
        Text(
            title,
            color = TextMain,
            fontSize = 13.sp,
            fontWeight = FontWeight.Medium,
            maxLines = 2,
            overflow = TextOverflow.Ellipsis,
            modifier = Modifier.padding(top = 3.dp),
        )
    }
}

/**
 * Полноэкранный плеер в отдельном окне: прячем системные панели и
 * переводим активность в горизонтальную ориентацию, пока окно открыто.
 */
@Composable
private fun FullscreenPlayer(onDismiss: () -> Unit, content: @Composable () -> Unit) {
    val context = LocalContext.current
    val activity = context.findActivity()

    Dialog(
        onDismissRequest = onDismiss,
        properties = DialogProperties(
            usePlatformDefaultWidth = false,
            decorFitsSystemWindows = false,
            dismissOnBackPress = true,
            dismissOnClickOutside = false,
        ),
    ) {
        val view = LocalView.current
        val window = (view.parent as? DialogWindowProvider)?.window

        DisposableEffect(window) {
            window?.let { host ->
                host.setLayout(
                    WindowManager.LayoutParams.MATCH_PARENT,
                    WindowManager.LayoutParams.MATCH_PARENT,
                )
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
                    host.attributes.layoutInDisplayCutoutMode =
                        WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES
                }
                WindowCompat.setDecorFitsSystemWindows(host, false)
                // Плотный фон окна: никакие края активности не просвечивают по краям плеера.
                host.setBackgroundDrawable(ColorDrawable(0xFF000000.toInt()))
                host.decorView.setBackgroundColor(0xFF000000.toInt())
                WindowInsetsControllerCompat(host, host.decorView).apply {
                    hide(WindowInsetsCompat.Type.systemBars())
                    systemBarsBehavior =
                        WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
                }
            }
            activity?.requestedOrientation = ActivityInfo.SCREEN_ORIENTATION_SENSOR_LANDSCAPE

            onDispose {
                activity?.requestedOrientation = ActivityInfo.SCREEN_ORIENTATION_UNSPECIFIED
                activity?.let { host ->
                    WindowCompat.getInsetsController(host.window, host.window.decorView)
                        .show(WindowInsetsCompat.Type.systemBars())
                }
            }
        }

        Box(
            modifier = Modifier
                .fillMaxSize()
                .background(Color.Black),
        ) {
            content()
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
