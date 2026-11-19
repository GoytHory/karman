package ru.karman.app.ui

import android.app.Activity
import android.app.PictureInPictureParams
import android.content.ComponentName
import android.content.Context
import android.content.ContextWrapper
import android.content.pm.PackageManager
import android.os.Build
import android.util.Rational
import android.view.LayoutInflater
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.gestures.awaitEachGesture
import androidx.compose.foundation.gestures.awaitFirstDown
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.Fullscreen
import androidx.compose.material.icons.rounded.FullscreenExit
import androidx.compose.material.icons.rounded.Pause
import androidx.compose.material.icons.rounded.PictureInPictureAlt
import androidx.compose.material.icons.rounded.PlayArrow
import androidx.compose.material.icons.rounded.Replay
import androidx.compose.material.icons.rounded.Settings
import androidx.compose.material.icons.rounded.SkipNext
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableLongStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.core.content.ContextCompat
import androidx.media3.common.MediaItem
import androidx.media3.common.MediaMetadata
import androidx.media3.common.Player
import androidx.media3.common.util.UnstableApi
import androidx.media3.exoplayer.ExoPlayer
import androidx.media3.session.MediaController
import androidx.media3.session.SessionToken
import androidx.media3.ui.AspectRatioFrameLayout
import androidx.media3.ui.PlayerView
import coil.compose.AsyncImage
import kotlinx.coroutines.delay
import ru.karman.app.R
import ru.karman.app.data.Repo
import ru.karman.app.data.Session
import ru.karman.app.playback.PlaybackService

private val SPEEDS = listOf(0.75f, 1f, 1.25f, 1.5f, 2f)

/** Контроллер Media3 поверх фонового сервиса: переживает свёрнутое приложение. */
@UnstableApi
@Composable
fun rememberVideoController(
    url: String,
    title: String,
    subtitle: String?,
    startAt: Double,
    enabled: Boolean,
): Player? {
    val context = LocalContext.current
    var controller by remember { mutableStateOf<Player?>(null) }

    DisposableEffect(enabled, url) {
        if (!enabled) return@DisposableEffect onDispose { }

        val future = MediaController.Builder(
            context,
            SessionToken(context, ComponentName(context, PlaybackService::class.java)),
        ).buildAsync()

        var released = false
        future.addListener({
            if (released) return@addListener
            runCatching { future.get() }.onSuccess { player ->
                val item = MediaItem.Builder()
                    .setUri(url)
                    .setMediaMetadata(
                        MediaMetadata.Builder()
                            .setTitle(title)
                            .setArtist(subtitle ?: "Карман")
                            .build(),
                    )
                    .build()
                player.setMediaItem(item)
                player.prepare()
                if (startAt > 3) player.seekTo((startAt * 1000).toLong())
                player.playWhenReady = true
                player.setPlaybackSpeed(Session.speed)
                controller = player
            }
        }, ContextCompat.getMainExecutor(context))

        onDispose {
            released = true
            controller = null
            if (future.isDone) runCatching { future.get().stop() }
            MediaController.releaseFuture(future)
        }
    }

    return controller
}

/**
 * Плеер «Кармана»: собственные контролы, двойной тап для перемотки,
 * выбор скорости, PiP и полноэкранный режим.
 */
@UnstableApi
@Composable
fun KarmanPlayer(
    controller: Player,
    modifier: Modifier = Modifier,
    previewUrl: String? = null,
    previewStep: Int = 5,
    nextTitle: String? = null,
    fullscreen: Boolean = false,
    onToggleFullscreen: () -> Unit = {},
    onNext: (() -> Unit)? = null,
    onProgress: (position: Double, duration: Double, completed: Boolean) -> Unit = { _, _, _ -> },
    onLeave: (position: Double, duration: Double) -> Unit = { _, _ -> },
) {
    val context = LocalContext.current
    val activity = context.findActivity()
    val latestProgress by rememberUpdatedState(onProgress)
    val latestLeave by rememberUpdatedState(onLeave)

    var isPlaying by remember(controller) { mutableStateOf(controller.isPlaying) }
    var duration by remember(controller) { mutableLongStateOf(controller.duration.coerceAtLeast(0)) }
    var position by remember(controller) { mutableLongStateOf(controller.currentPosition.coerceAtLeast(0)) }
    var buffered by remember(controller) { mutableLongStateOf(controller.bufferedPosition.coerceAtLeast(0)) }
    var buffering by remember(controller) { mutableStateOf(controller.playbackState == Player.STATE_BUFFERING) }
    var ended by remember(controller) { mutableStateOf(controller.playbackState == Player.STATE_ENDED) }
    var speed by remember(controller) { mutableFloatStateOf(controller.playbackParameters.speed) }
    var visible by remember { mutableStateOf(true) }
    var wake by remember { mutableIntStateOf(0) }
    var scrubbing by remember { mutableStateOf(false) }
    var scrubPosition by remember { mutableLongStateOf(0L) }
    var speedMenu by remember { mutableStateOf(false) }
    var countdown by remember { mutableStateOf<Int?>(null) }
    var flash by remember { mutableStateOf<Int?>(null) }
    var inPip by remember { mutableStateOf(activity?.isInPictureInPictureMode == true) }

    val canPip = Build.VERSION.SDK_INT >= Build.VERSION_CODES.O &&
        context.packageManager.hasSystemFeature(PackageManager.FEATURE_PICTURE_IN_PICTURE)

    fun report(completed: Boolean) {
        val total = controller.duration
        if (total > 0) {
            latestProgress(controller.currentPosition / 1000.0, total / 1000.0, completed)
        }
    }

    fun togglePlay() {
        if (controller.isPlaying) controller.pause() else {
            if (controller.playbackState == Player.STATE_ENDED) controller.seekTo(0)
            controller.play()
        }
        ended = false
        countdown = null
        visible = true
        wake++
    }

    fun seekBy(deltaMs: Long) {
        val total = controller.duration.takeIf { it > 0 } ?: 0
        val target = (controller.currentPosition + deltaMs).coerceIn(0, if (total > 0) total else Long.MAX_VALUE)
        controller.seekTo(target)
        flash = if (deltaMs < 0) -1 else 1
        ended = false
        countdown = null
        visible = true
        wake++
    }

    fun togglePip() {
        if (activity == null) return
        val params = PictureInPictureParams.Builder()
            .setAspectRatio(Rational(16, 9))
            .build()
        if (fullscreen) {
            // Сначала закрываем полноэкранное окно, иначе в PiP попадёт пустой экран.
            onToggleFullscreen()
            android.os.Handler(android.os.Looper.getMainLooper()).postDelayed(
                { runCatching { activity.enterPictureInPictureMode(params) } },
                380,
            )
            return
        }
        activity.enterPictureInPictureMode(params)
    }

    // состояние плеера
    DisposableEffect(controller) {
        val listener = object : Player.Listener {
            override fun onEvents(player: Player, events: Player.Events) {
                isPlaying = player.isPlaying
                duration = player.duration.coerceAtLeast(0)
                buffering = player.playbackState == Player.STATE_BUFFERING
                if (player.playbackState == Player.STATE_ENDED) {
                    ended = true
                } else if (player.playbackState == Player.STATE_READY) {
                    ended = false
                }
                speed = player.playbackParameters.speed
            }

            override fun onPlaybackStateChanged(playbackState: Int) {
                if (playbackState == Player.STATE_ENDED) {
                    buffering = false
                    ended = true
                }
                if (playbackState == Player.STATE_READY) {
                    buffering = false
                    duration = controller.duration.coerceAtLeast(0)
                }
            }
        }
        controller.addListener(listener)
        onDispose { controller.removeListener(listener) }
    }

    // позиция
    LaunchedEffect(controller, isPlaying) {
        while (true) {
            position = controller.currentPosition.coerceAtLeast(0)
            buffered = controller.bufferedPosition.coerceAtLeast(0)
            if (duration <= 0) duration = controller.duration.coerceAtLeast(0)
            delay(if (isPlaying) 250 else 500)
        }
    }

    // прогресс раз в 10 секунд
    LaunchedEffect(controller, isPlaying) {
        if (!isPlaying) return@LaunchedEffect
        while (true) {
            delay(10_000)
            report(false)
        }
    }

    // пауза и конец — тоже событие прогресса
    LaunchedEffect(isPlaying) {
        if (!isPlaying) report(false)
    }

    LaunchedEffect(ended) {
        if (!ended) return@LaunchedEffect
        report(true)
        if (!nextTitle.isNullOrBlank()) {
            countdown = 5
        }
    }

    LaunchedEffect(countdown) {
        val value = countdown ?: return@LaunchedEffect
        if (value <= 0) {
            countdown = null
            onNext?.invoke()
            return@LaunchedEffect
        }
        delay(1000)
        countdown = value - 1
    }

    LaunchedEffect(wake, visible, isPlaying) {
        if (!visible || !isPlaying) return@LaunchedEffect
        delay(3200)
        visible = false
    }

    LaunchedEffect(flash) {
        if (flash == null) return@LaunchedEffect
        delay(620)
        flash = null
    }

    // авто-вход в PiP при сворачивании (Android 12+)
    LaunchedEffect(isPlaying, activity) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S && activity != null && canPip) {
            val params = PictureInPictureParams.Builder()
                .setAspectRatio(Rational(16, 9))
                .setAutoEnterEnabled(isPlaying)
                .build()
            activity.setPictureInPictureParams(params)
        }
    }

    LaunchedEffect(Unit) {
        while (true) {
            inPip = activity?.isInPictureInPictureMode == true
            delay(400)
        }
    }

    // отдаём последнюю позицию при уходе с экрана
    DisposableEffect(controller) {
        onDispose {
            val total = controller.duration
            if (total > 0) latestLeave(controller.currentPosition / 1000.0, total / 1000.0)
        }
    }

    Box(
        modifier = modifier
            .fillMaxSize()
            .background(Color.Black)
            .pointerInput(controller) {
                detectTapGestures(
                    onTap = {
                        if (visible) visible = false else {
                            visible = true
                            wake++
                        }
                    },
                    onDoubleTap = { offset ->
                        when {
                            offset.x < size.width * 0.35f -> seekBy(-10_000)
                            offset.x > size.width * 0.65f -> seekBy(10_000)
                            else -> togglePlay()
                        }
                    },
                )
            },
    ) {
        AndroidView(
            factory = { ctx ->
                (LayoutInflater.from(ctx).inflate(R.layout.karman_player_view, null) as PlayerView).apply {
                    player = controller
                }
            },
            update = { view -> view.player = controller },
            modifier = Modifier.fillMaxSize(),
        )

        if (buffering && !inPip) {
            CircularProgressIndicator(
                modifier = Modifier.align(Alignment.Center).size(30.dp),
                color = Lime,
                strokeWidth = 2.dp,
            )
        }

        if (inPip) return@Box

        // верхний правый угол: настройки воспроизведения и размер плеера
        if (visible) {
            Row(
                modifier = Modifier
                    .align(Alignment.TopEnd)
                    .padding(top = 8.dp, end = 10.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(6.dp),
            ) {
                if (onNext != null) {
                    PlayerRoundButton(
                        icon = { tint -> Icon(Icons.Rounded.SkipNext, contentDescription = "Следующее видео", tint = tint, modifier = Modifier.size(18.dp)) },
                        label = "Следующее видео",
                        onClick = onNext,
                    )
                }
                Box {
                    PlayerRoundButton(
                        icon = { tint -> Icon(Icons.Rounded.Settings, contentDescription = "Настройки воспроизведения", tint = tint, modifier = Modifier.size(18.dp)) },
                        label = "Настройки воспроизведения",
                        onClick = { speedMenu = true },
                    )
                    DropdownMenu(
                        expanded = speedMenu,
                        onDismissRequest = { speedMenu = false },
                    ) {
                        Text(
                            "Скорость",
                            color = TextDim,
                            fontSize = 10.sp,
                            letterSpacing = 1.sp,
                            modifier = Modifier.padding(horizontal = 14.dp, vertical = 6.dp),
                        )
                        SPEEDS.forEach { value ->
                            DropdownMenuItem(
                                text = {
                                    Text(
                                        if (value == 1f) "${value}× · обычная" else "${value}×",
                                        color = if (speed == value) Lime else TextMain,
                                        fontSize = 13.sp,
                                    )
                                },
                                onClick = {
                                    controller.setPlaybackSpeed(value)
                                    Session.speed = value
                                    speed = value
                                    speedMenu = false
                                },
                            )
                        }
                        if (canPip) {
                            HorizontalDivider(color = Color(0x1FFFFFFF))
                            DropdownMenuItem(
                                text = { Text("Картинка в картинке", color = TextMain, fontSize = 13.sp) },
                                leadingIcon = {
                                    Icon(
                                        Icons.Rounded.PictureInPictureAlt,
                                        contentDescription = null,
                                        tint = TextDim,
                                        modifier = Modifier.size(18.dp),
                                    )
                                },
                                onClick = {
                                    speedMenu = false
                                    togglePip()
                                },
                            )
                        }
                    }
                }
                PlayerRoundButton(
                    icon = { tint ->
                        Icon(
                            if (fullscreen) Icons.Rounded.FullscreenExit else Icons.Rounded.Fullscreen,
                            contentDescription = if (fullscreen) "Свернуть плеер" else "На весь экран",
                            tint = tint,
                            modifier = Modifier.size(18.dp),
                        )
                    },
                    label = if (fullscreen) "Свернуть плеер" else "На весь экран",
                    onClick = onToggleFullscreen,
                )
            }
        }

        if (flash != null && !inPip) {
            Box(
                modifier = Modifier
                    .align(if (flash == -1) Alignment.CenterStart else Alignment.CenterEnd)
                    .padding(30.dp)
                    .clip(RoundedCornerShape(50))
                    .background(Color(0xB3040406))
                    .padding(horizontal = 14.dp, vertical = 10.dp),
            ) {
                Text(
                    if (flash == -1) "−10 с" else "+10 с",
                    color = Color.White,
                    fontSize = 13.sp,
                    fontWeight = FontWeight.Medium,
                )
            }
        }

        // центральная кнопка
        if (visible && !isPlaying && !ended && countdown == null) {
            Box(
                modifier = Modifier
                    .align(Alignment.Center)
                    .size(64.dp)
                    .clip(RoundedCornerShape(50))
                    .background(Lime),
                contentAlignment = Alignment.Center,
            ) {
                IconButton(onClick = { togglePlay() }) {
                    Icon(Icons.Rounded.PlayArrow, contentDescription = "Смотреть", tint = Ink, modifier = Modifier.size(32.dp))
                }
            }
        }

        if (ended && countdown == null && !inPip) {
            Box(
                modifier = Modifier
                    .align(Alignment.Center)
                    .size(64.dp)
                    .clip(RoundedCornerShape(50))
                    .background(Lime),
                contentAlignment = Alignment.Center,
            ) {
                IconButton(onClick = { controller.seekTo(0); controller.play(); ended = false }) {
                    Icon(Icons.Rounded.Replay, contentDescription = "Смотреть снова", tint = Ink, modifier = Modifier.size(30.dp))
                }
            }
        }

        // следующий ролик
        if (countdown != null && nextTitle != null && !inPip) {
            Column(
                modifier = Modifier
                    .align(Alignment.Center)
                    .padding(20.dp)
                    .clip(RoundedCornerShape(12.dp))
                    .background(Color(0xE60C0C0F))
                    .padding(16.dp),
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                Text("Далее через ${countdown ?: 0}", color = Lime, fontSize = 11.sp, letterSpacing = 1.sp)
                Text(
                    nextTitle,
                    color = TextMain,
                    fontSize = 13.sp,
                    fontWeight = FontWeight.Medium,
                    maxLines = 2,
                    overflow = TextOverflow.Ellipsis,
                )
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    Text(
                        "Смотреть",
                        color = Ink,
                        fontSize = 12.sp,
                        fontWeight = FontWeight.Medium,
                        modifier = Modifier
                            .clip(RoundedCornerShape(50))
                            .background(Lime)
                            .padding(horizontal = 14.dp, vertical = 7.dp)
                            .pointerInput(Unit) {
                                detectTapGestures {
                                    countdown = null
                                    onNext?.invoke()
                                }
                            },
                    )
                    Text(
                        "Отмена",
                        color = TextDim,
                        fontSize = 12.sp,
                        modifier = Modifier
                            .clip(RoundedCornerShape(50))
                            .background(Color(0xFF1B1B20))
                            .padding(horizontal = 14.dp, vertical = 7.dp)
                            .pointerInput(Unit) {
                                detectTapGestures {
                                    countdown = null
                                    ended = true
                                }
                            },
                    )
                }
            }
        }

        // нижние контролы: тонкий таймлайн на всю ширину и компактная строка
        if (visible) {
            Column(
                modifier = Modifier
                    .align(Alignment.BottomCenter)
                    .fillMaxWidth()
                    .background(
                        Brush.verticalGradient(
                            listOf(Color.Transparent, Color(0xC9000000)),
                        ),
                    )
                    .padding(top = 20.dp),
            ) {
                if (scrubbing && previewUrl != null) {
                    val bucket = (scrubPosition / 1000 / previewStep) * previewStep
                    Box(
                        modifier = Modifier
                            .align(Alignment.CenterHorizontally)
                            .padding(bottom = 4.dp),
                    ) {
                        Column(horizontalAlignment = Alignment.CenterHorizontally) {
                            AsyncImage(
                                model = Repo.absolute(previewUrl.replace("{t}", bucket.toString())),
                                contentDescription = null,
                                contentScale = ContentScale.Crop,
                                modifier = Modifier
                                    .width(148.dp)
                                    .height(83.dp)
                                    .clip(RoundedCornerShape(5.dp))
                                    .background(Panel),
                            )
                            Text(
                                formatDuration(scrubPosition / 1000.0),
                                color = Color.White,
                                fontSize = 10.sp,
                                fontFamily = androidx.compose.ui.text.font.FontFamily.Monospace,
                            )
                        }
                    }
                }

                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(start = 10.dp, end = 14.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    IconButton(
                        onClick = { togglePlay() },
                        modifier = Modifier.size(36.dp),
                    ) {
                        Icon(
                            if (isPlaying) Icons.Rounded.Pause else Icons.Rounded.PlayArrow,
                            contentDescription = if (isPlaying) "Пауза" else "Смотреть",
                            tint = Color.White,
                            modifier = Modifier.size(20.dp),
                        )
                    }
                    Spacer(Modifier.width(6.dp))
                    Text(
                        formatDuration((if (scrubbing) scrubPosition else position) / 1000.0),
                        color = Color.White,
                        fontSize = 11.sp,
                        fontFamily = androidx.compose.ui.text.font.FontFamily.Monospace,
                    )
                    Text(
                        " / ${formatDuration(duration / 1000.0)}",
                        color = Color(0x8AFFFFFF),
                        fontSize = 11.sp,
                        fontFamily = androidx.compose.ui.text.font.FontFamily.Monospace,
                    )
                    Spacer(Modifier.weight(1f))
                    if (speed != 1f) {
                        Text(
                            "${speed}×",
                            color = Lime,
                            fontSize = 10.5.sp,
                            fontFamily = androidx.compose.ui.text.font.FontFamily.Monospace,
                        )
                    }
                }

                KarmanTimeline(
                    position = if (scrubbing) scrubPosition else position,
                    duration = duration,
                    buffered = buffered,
                    onScrubStart = {
                        scrubbing = true
                        visible = true
                    },
                    onScrub = { value ->
                        scrubbing = true
                        scrubPosition = value
                        visible = true
                    },
                    onScrubEnd = { value ->
                        scrubPosition = value
                        controller.seekTo(value)
                        scrubbing = false
                        ended = false
                        countdown = null
                        wake++
                    },
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(start = 10.dp, end = 10.dp, bottom = 4.dp),
                )
            }
        }
    }
}

/** Полупрозрачная круглая кнопка поверх видео. */
@Composable
private fun PlayerRoundButton(
    icon: @Composable (Color) -> Unit,
    label: String,
    onClick: () -> Unit,
) {
    Box(
        modifier = Modifier
            .size(34.dp)
            .clip(RoundedCornerShape(50))
            .background(Color(0x66000000))
            .pointerInput(label) { detectTapGestures { onClick() } },
        contentAlignment = Alignment.Center,
    ) {
        icon(Color.White)
    }
}

/**
 * Тонкий таймлайн: полоса на всю ширину и точка-указатель чуть толще полосы.
 * Тянется пальцем, показывает буфер и отдаёт позицию в миллисекундах.
 */
@Composable
private fun KarmanTimeline(
    position: Long,
    duration: Long,
    buffered: Long,
    onScrubStart: () -> Unit,
    onScrub: (Long) -> Unit,
    onScrubEnd: (Long) -> Unit,
    modifier: Modifier = Modifier,
) {
    val total = duration.coerceAtLeast(1L)
    Canvas(
        modifier = modifier
            .height(20.dp)
            .pointerInput(total) {
                awaitEachGesture {
                    val down = awaitFirstDown(requireUnconsumed = false)
                    val width = size.width.toFloat().coerceAtLeast(1f)
                    fun timeAt(x: Float): Long =
                        ((x / width).coerceIn(0f, 1f) * total).toLong()

                    down.consume()
                    onScrubStart()
                    onScrub(timeAt(down.position.x))
                    var released = false
                    while (!released) {
                        val change = awaitPointerEvent().changes.firstOrNull { it.id == down.id } ?: break
                        if (change.pressed) {
                            onScrub(timeAt(change.position.x))
                        } else {
                            onScrubEnd(timeAt(change.position.x))
                            released = true
                        }
                        change.consume()
                    }
                }
            },
    ) {
        val barHeight = 3.dp.toPx()
        val radius = barHeight / 2f
        val centerY = size.height / 2f
        val played = (position.toFloat() / total).coerceIn(0f, 1f)
        val bufferedRatio = (buffered.toFloat() / total).coerceIn(0f, 1f)

        drawRoundRect(
            color = Color(0x38FFFFFF),
            topLeft = Offset(0f, centerY - radius),
            size = Size(size.width, barHeight),
            cornerRadius = CornerRadius(radius),
        )
        if (bufferedRatio > 0f) {
            drawRoundRect(
                color = Color(0x66FFFFFF),
                topLeft = Offset(0f, centerY - radius),
                size = Size(size.width * bufferedRatio, barHeight),
                cornerRadius = CornerRadius(radius),
            )
        }
        if (played > 0f) {
            drawRoundRect(
                color = Lime,
                topLeft = Offset(0f, centerY - radius),
                size = Size(size.width * played, barHeight),
                cornerRadius = CornerRadius(radius),
            )
        }

        val dotRadius = 4.dp.toPx()
        val dotX = (size.width * played).coerceIn(dotRadius, size.width - dotRadius)
        drawCircle(color = Lime, radius = dotRadius, center = Offset(dotX, centerY))
    }
}

internal tailrec fun Context.findActivity(): Activity? = when (this) {
    is Activity -> this
    is ContextWrapper -> baseContext.findActivity()
    else -> null
}

/**
 * Простой плеер для файлов, скачанных на телефон: без сервера и без сессии,
 * поэтому хватает локального ExoPlayer со стандартными контролами.
 */
@OptIn(UnstableApi::class)
@Composable
fun LocalPlayer(url: String, modifier: Modifier = Modifier) {
    val context = LocalContext.current
    val player = remember { ExoPlayer.Builder(context).build() }

    LaunchedEffect(url) {
        player.setMediaItem(MediaItem.fromUri(url))
        player.prepare()
        player.playWhenReady = true
    }

    DisposableEffect(player) {
        onDispose { player.release() }
    }

    AndroidView(
        factory = { ctx ->
            PlayerView(ctx).apply {
                useController = true
                resizeMode = AspectRatioFrameLayout.RESIZE_MODE_FIT
                this.player = player
            }
        },
        update = { view -> view.player = player },
        modifier = modifier,
    )
}
