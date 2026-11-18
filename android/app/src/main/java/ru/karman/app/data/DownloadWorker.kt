package ru.karman.app.data

import android.content.Context
import android.content.pm.ServiceInfo
import android.os.Build
import androidx.work.CoroutineWorker
import androidx.work.ForegroundInfo
import androidx.work.WorkManager
import androidx.work.WorkerParameters
import androidx.work.Constraints
import androidx.work.ExistingWorkPolicy
import androidx.work.NetworkType
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.workDataOf
import okhttp3.Request
import java.io.File
import java.io.IOException

class DownloadWorker(
    appContext: Context,
    params: WorkerParameters,
) : CoroutineWorker(appContext, params) {

    override suspend fun doWork(): Result {
        val videoId = inputData.getInt("videoId", -1)
        val title = inputData.getString("title") ?: "Видео"
        val token = Session.token
        if (videoId <= 0 || token.isNullOrBlank() || Session.server.isBlank()) {
            return Result.failure()
        }

        Notifications.init(applicationContext)
        setForeground(foreground(0, title))

        var part: File? = null
        return try {
            val dir = Downloads.ensureDir(applicationContext)
            val target = File(dir, Downloads.fileName(title, videoId))
            part = File(dir, target.name + ".part")
            val request = Request.Builder()
                .url(Repo.downloadUrl(videoId))
                .header("Authorization", "Bearer $token")
                .build()

            Repo.client.newCall(request).execute().use { response ->
                if (!response.isSuccessful) throw IOException("Сервер ответил ${response.code}")
                val body = response.body ?: throw IOException("Пустой ответ сервера")
                val total = body.contentLength()
                var done = 0L
                var shown = -1

                body.byteStream().use { input ->
                    part.outputStream().use { output ->
                        val buffer = ByteArray(256 * 1024)
                        while (true) {
                            val read = input.read(buffer)
                            if (read < 0) break
                            output.write(buffer, 0, read)
                            done += read
                            if (total > 0) {
                                val percent = ((done * 100) / total).toInt().coerceIn(0, 100)
                                if (percent / 2 != shown / 2) {
                                    shown = percent
                                    setForeground(foreground(percent, title))
                                }
                            }
                        }
                    }
                }
            }

            part?.let { if (it.isFile) it.renameTo(target) }
            if (!target.isFile || target.length() == 0L) throw IOException("Файл не сохранился")

            Downloads.add(
                applicationContext,
                LocalDownload(videoId, title, target.absolutePath, target.length(), System.currentTimeMillis()),
            )
            Notifications.done(
                applicationContext,
                title,
                ok = true,
                message = "Можно смотреть без интернета",
            )
            Result.success()
        } catch (exc: Exception) {
            part?.delete()
            return if (runAttemptCount < 2 && exc is IOException) {
                Result.retry()
            } else {
                Notifications.done(
                    applicationContext,
                    title,
                    ok = false,
                    message = Repo.humanMessage(exc),
                )
                Result.failure()
            }
        }
    }

    private fun foreground(percent: Int, title: String): ForegroundInfo {
        val notification = Notifications.progress(applicationContext, title, percent)
        return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            ForegroundInfo(Notifications.PROGRESS_ID, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_DATA_SYNC)
        } else {
            ForegroundInfo(Notifications.PROGRESS_ID, notification)
        }
    }

    companion object {
        fun start(context: Context, video: Video) {
            val request = OneTimeWorkRequestBuilder<DownloadWorker>()
                .setInputData(workDataOf("videoId" to video.id, "title" to video.title))
                .setConstraints(Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build())
                .addTag("karman-download")
                .build()
            WorkManager.getInstance(context)
                .enqueueUniqueWork("karman-download-${video.id}", ExistingWorkPolicy.KEEP, request)
        }
    }
}
