package ru.karman.app.data

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Build
import androidx.core.app.NotificationCompat
import ru.karman.app.MainActivity
import ru.karman.app.R

object Notifications {
    const val CHANNEL = "karman_downloads"
    const val PROGRESS_ID = 7301
    const val DONE_ID = 7302

    fun init(context: Context) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL,
                "Загрузки",
                NotificationManager.IMPORTANCE_LOW,
            ).apply {
                description = "Скачивание видео на телефон"
                setShowBadge(false)
            }
            context.getSystemService(NotificationManager::class.java)
                .createNotificationChannel(channel)
        }
    }

    private fun openApp(context: Context): PendingIntent {
        val intent = Intent(context, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_CLEAR_TOP
        }
        return PendingIntent.getActivity(
            context,
            0,
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )
    }

    fun progress(context: Context, title: String, percent: Int): Notification =
        NotificationCompat.Builder(context, CHANNEL)
            .setSmallIcon(R.drawable.ic_stat_karman)
            .setContentTitle(title)
            .setContentText("Скачивается на телефон · $percent%")
            .setContentIntent(openApp(context))
            .setOnlyAlertOnce(true)
            .setOngoing(true)
            .setProgress(100, percent.coerceIn(0, 100), percent <= 0)
            .build()

    fun done(context: Context, title: String, ok: Boolean, message: String) {
        val notification = NotificationCompat.Builder(context, CHANNEL)
            .setSmallIcon(R.drawable.ic_stat_karman)
            .setContentTitle(if (ok) "Скачано: $title" else "Не удалось скачать")
            .setContentText(message)
            .setContentIntent(openApp(context))
            .setAutoCancel(true)
            .setOnlyAlertOnce(true)
            .build()
        runCatching {
            context.getSystemService(NotificationManager::class.java).notify(DONE_ID, notification)
        }
    }
}
