package ru.karman.app.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil.compose.AsyncImage
import ru.karman.app.data.Repo
import ru.karman.app.data.Video
import java.time.Instant
import java.time.ZoneId
import java.time.format.DateTimeFormatter

fun formatDuration(seconds: Double?): String {
    val total = (seconds ?: 0.0).toInt().coerceAtLeast(0)
    val hours = total / 3600
    val minutes = (total % 3600) / 60
    val secs = total % 60
    return if (hours > 0) {
        "%d:%02d:%02d".format(hours, minutes, secs)
    } else {
        "%d:%02d".format(minutes, secs)
    }
}

fun formatSize(bytes: Long?): String {
    val value = bytes ?: return "—"
    return when {
        value >= 1024L * 1024 * 1024 -> "%.1f ГБ".format(value / 1024.0 / 1024 / 1024)
        value >= 1024L * 1024 -> "%.0f МБ".format(value / 1024.0 / 1024)
        else -> "${value / 1024} КБ"
    }
}

private val dateFormat = DateTimeFormatter.ofPattern("dd.MM.yyyy HH:mm").withZone(ZoneId.systemDefault())

fun formatDate(value: String?): String {
    if (value.isNullOrBlank()) return "—"
    return runCatching { dateFormat.format(Instant.parse(value)) }.getOrDefault(value)
}

fun statusOf(video: Video): Pair<String, Color> = when {
    video.reaction == "like" -> "Сохранено" to Lime
    video.reaction == "dislike" -> "Дизлайк" to Danger
    video.status == "downloading" -> "Скачивается ${video.progress.toInt()}%" to Warn
    video.status == "pending" -> "В очереди" to TextDim
    video.status == "failed" -> "Ошибка" to Danger
    video.status == "deleted" -> "Удалено" to TextDim
    video.status == "ignored" -> "Пропущено" to TextDim
    !video.watched_at.isNullOrBlank() -> "Просмотрено" to TextDim
    else -> "Готово" to TextDim
}

@Composable
fun VideoCard(video: Video, onClick: () -> Unit) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(8.dp))
            .clickable(onClick = onClick)
            .padding(vertical = 8.dp),
        verticalAlignment = Alignment.Top,
    ) {
        Box(
            modifier = Modifier
                .width(132.dp)
                .height(74.dp)
                .clip(RoundedCornerShape(6.dp))
                .background(Panel),
        ) {
            AsyncImage(
                model = Repo.thumbUrl(video),
                contentDescription = null,
                contentScale = ContentScale.Crop,
                modifier = Modifier.matchParentSize(),
            )
            Box(
                modifier = Modifier
                    .align(Alignment.BottomEnd)
                    .padding(5.dp)
                    .clip(RoundedCornerShape(3.dp))
                    .background(Color(0xCC040406))
                    .padding(horizontal = 4.dp, vertical = 1.dp),
            ) {
                Text(
                    text = formatDuration(video.duration_s),
                    color = Color(0xFFDDDDE2),
                    fontSize = 9.sp,
                )
            }
        }

        Spacer(Modifier.width(12.dp))

        Column(modifier = Modifier.weight(1f)) {
            Text(
                text = video.title,
                color = TextMain,
                fontSize = 13.5.sp,
                fontWeight = FontWeight.Medium,
                maxLines = 2,
                overflow = TextOverflow.Ellipsis,
                lineHeight = 18.sp,
            )
            Spacer(Modifier.height(3.dp))
            Text(
                text = listOfNotNull(video.channel, video.owner).joinToString(" · "),
                color = TextDim,
                fontSize = 11.sp,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
            )
            Spacer(Modifier.height(5.dp))
            val (label, color) = statusOf(video)
            Text(text = label, color = color, fontSize = 11.sp, maxLines = 1)
        }
    }
}

@Composable
fun EmptyState(title: String, text: String? = null, action: (@Composable () -> Unit)? = null) {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = 56.dp, horizontal = 20.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        Text(title, color = TextMain, fontSize = 15.sp, fontWeight = FontWeight.Medium)
        if (text != null) {
            Text(text, color = TextDim, fontSize = 12.5.sp, lineHeight = 18.sp)
        }
        action?.invoke()
    }
}

@Composable
fun ErrorState(text: String, onRetry: (() -> Unit)? = null) {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = 40.dp, horizontal = 20.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        Text(text, color = Danger, fontSize = 12.5.sp)
        if (onRetry != null) {
            Button(onClick = onRetry) { Text("Повторить") }
        }
    }
}

@Composable
fun LoadingBox() {
    Box(
        modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = 48.dp),
        contentAlignment = Alignment.Center,
    ) {
        CircularProgressIndicator(
            modifier = Modifier.size(22.dp),
            strokeWidth = 2.dp,
            color = Lime,
        )
    }
}

@Composable
fun SectionLabel(text: String) {
    Text(
        text = text.uppercase(),
        color = TextDim,
        fontSize = 9.5.sp,
        letterSpacing = 1.2.sp,
        fontWeight = FontWeight.Medium,
        modifier = Modifier.padding(vertical = 6.dp),
    )
}
