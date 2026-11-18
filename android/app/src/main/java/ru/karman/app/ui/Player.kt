package ru.karman.app.ui

import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.viewinterop.AndroidView
import androidx.media3.common.MediaItem
import androidx.media3.common.util.UnstableApi
import androidx.media3.datasource.okhttp.OkHttpDataSource
import androidx.media3.exoplayer.ExoPlayer
import androidx.media3.exoplayer.source.DefaultMediaSourceFactory
import androidx.media3.ui.PlayerView
import kotlinx.coroutines.delay
import ru.karman.app.data.Repo
import ru.karman.app.data.Session

/** Плеер Media3. Для серверных ссылок добавляет Bearer-токен. */
@UnstableApi
@Composable
fun PlayerSurface(
    url: String,
    withAuth: Boolean,
    modifier: Modifier = Modifier,
    onProgress: ((position: Double, duration: Double) -> Unit)? = null,
) {
    val context = LocalContext.current
    val latestProgress by rememberUpdatedState(onProgress)
    val player = remember(url, withAuth) {
        val headers = if (withAuth) {
            Session.token?.let { mapOf("Authorization" to "Bearer $it") } ?: emptyMap()
        } else {
            emptyMap()
        }
        val factory = OkHttpDataSource.Factory(Repo.client)
            .setDefaultRequestProperties(headers)
        ExoPlayer.Builder(context)
            .setMediaSourceFactory(DefaultMediaSourceFactory(factory))
            .build()
            .apply {
                setMediaItem(MediaItem.fromUri(url))
                prepare()
                playWhenReady = true
            }
    }

    LaunchedEffect(player) {
        while (true) {
            delay(10_000)
            val duration = player.duration
            if (player.isPlaying && duration > 0) {
                latestProgress?.invoke(player.currentTime / 1000.0, duration / 1000.0)
            }
        }
    }

    DisposableEffect(player) {
        onDispose {
            val duration = player.duration
            if (duration > 0) latestProgress?.invoke(player.currentTime / 1000.0, duration / 1000.0)
            player.release()
        }
    }

    AndroidView(
        factory = { ctx ->
            PlayerView(ctx).apply {
                this.player = player
                useController = true
            }
        },
        modifier = modifier,
    )
}
