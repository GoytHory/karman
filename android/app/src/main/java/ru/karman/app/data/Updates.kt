package ru.karman.app.data

import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.provider.Settings
import androidx.core.content.FileProvider
import com.google.gson.JsonParser
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.OkHttpClient
import okhttp3.Request
import ru.karman.app.BuildConfig
import java.io.File
import java.util.concurrent.TimeUnit

data class ReleaseInfo(
    val version: String,
    val notes: String,
    val apkUrl: String,
    val apkSize: Long,
)

/**
 * Обновление «изнутри»: смотрим последний релиз на GitHub, качаем APK и
 * отдаём его системному установщику. Отдельный OkHttp без токена сервера —
 * наружу не должен уходить Bearer.
 */
object Updates {
    private const val REPO = "GoytHory/karman"

    private val client = OkHttpClient.Builder()
        .connectTimeout(20, TimeUnit.SECONDS)
        .readTimeout(60, TimeUnit.SECONDS)
        .build()

    suspend fun latest(): ReleaseInfo = withContext(Dispatchers.IO) {
        val request = Request.Builder()
            .url("https://api.github.com/repos/$REPO/releases?per_page=15")
            .header("Accept", "application/vnd.github+json")
            .build()

        client.newCall(request).execute().use { response ->
            if (!response.isSuccessful) {
                throw IllegalStateException("GitHub ответил ${response.code}")
            }
            val body = response.body?.string().orEmpty()
            val releases = JsonParser.parseString(body).asJsonArray

            // Берём самый свежий релиз, к которому приложен APK: серверные
            // релизы без файла для телефона просто пропускаем.
            for (element in releases) {
                val json = runCatching { element.asJsonObject }.getOrNull() ?: continue
                if (json.get("draft")?.asBoolean == true) continue
                val tag = json.get("tag_name")?.asString.orEmpty().removePrefix("v").trim()
                val notes = json.get("body")?.asString.orEmpty().trim()
                val assets = runCatching { json.getAsJsonArray("assets") }.getOrNull() ?: continue
                val apk = assets
                    .mapNotNull { runCatching { it.asJsonObject }.getOrNull() }
                    .firstOrNull { asset ->
                        asset.get("name")?.asString?.endsWith(".apk", ignoreCase = true) == true
                    }
                    ?: continue

                return@withContext ReleaseInfo(
                    version = tag.ifBlank { "0.0.0" },
                    notes = notes,
                    apkUrl = apk.get("browser_download_url").asString,
                    apkSize = apk.get("size")?.asLong ?: 0L,
                )
            }
            throw IllegalStateException("В релизах пока нет APK")
        }
    }

    /** `1.2.0` новее `1.1.9`. */
    fun isNewer(remote: String): Boolean = compare(remote, currentVersion()) > 0

    fun currentVersion(): String = BuildConfig.VERSION_NAME.substringBefore("-")

    fun compare(left: String, right: String): Int {
        val a = left.split('.').map { it.toIntOrNull() ?: 0 }
        val b = right.split('.').map { it.toIntOrNull() ?: 0 }
        for (index in 0 until maxOf(a.size, b.size)) {
            val x = a.getOrElse(index) { 0 }
            val y = b.getOrElse(index) { 0 }
            if (x != y) return x.compareTo(y)
        }
        return 0
    }

    suspend fun download(
        context: Context,
        release: ReleaseInfo,
        onProgress: (Int) -> Unit,
    ): File = withContext(Dispatchers.IO) {
        val dir = File(context.getExternalFilesDir(null), "updates").apply { mkdirs() }
        // Старые загрузки не нужны.
        dir.listFiles()?.forEach { if (it.name != "karman-${release.version}.apk") it.delete() }
        val target = File(dir, "karman-${release.version}.apk")

        val request = Request.Builder().url(release.apkUrl).build()
        client.newCall(request).execute().use { response ->
            if (!response.isSuccessful) {
                throw IllegalStateException("Не удалось скачать APK (${response.code})")
            }
            val body = response.body ?: throw IllegalStateException("Пустой ответ")
            val total = body.contentLength().takeIf { it > 0 } ?: release.apkSize
            var copied = 0L
            var lastPercent = -1

            body.byteStream().use { input ->
                target.outputStream().use { output ->
                    val buffer = ByteArray(64 * 1024)
                    while (true) {
                        val read = input.read(buffer)
                        if (read < 0) break
                        output.write(buffer, 0, read)
                        copied += read
                        if (total > 0) {
                            val percent = (copied * 100 / total).toInt().coerceIn(0, 100)
                            if (percent != lastPercent) {
                                lastPercent = percent
                                withContext(Dispatchers.Main) { onProgress(percent) }
                            }
                        }
                    }
                }
            }
        }

        target
    }

    fun canInstall(context: Context): Boolean =
        Build.VERSION.SDK_INT < Build.VERSION_CODES.O || context.packageManager.canRequestPackageInstalls()

    fun openInstallPermission(context: Context) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
        runCatching {
            context.startActivity(
                Intent(
                    Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES,
                    Uri.parse("package:${context.packageName}"),
                ).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK),
            )
        }
    }

    fun install(context: Context, file: File) {
        val uri = FileProvider.getUriForFile(context, "${context.packageName}.fileprovider", file)
        val intent = Intent(Intent.ACTION_VIEW).apply {
            setDataAndType(uri, "application/vnd.android.package-archive")
            addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_ACTIVITY_NEW_TASK)
        }
        context.startActivity(intent)
    }
}
