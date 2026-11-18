package ru.karman.app.data

import android.content.Context
import android.os.Environment
import com.google.gson.Gson
import com.google.gson.reflect.TypeToken
import java.io.File

data class LocalDownload(
    val videoId: Int,
    val title: String,
    val path: String,
    val size: Long,
    val savedAt: Long,
)

/** Список видео, скачанных на телефон. Удаляются только вручную. */
object Downloads {
    private const val PREFS = "karman_downloads"
    private const val KEY = "items"
    private val gson = Gson()
    private val type = object : TypeToken<List<LocalDownload>>() {}.type

    fun dir(context: Context): File =
        File(context.getExternalFilesDir(Environment.DIRECTORY_MOVIES) ?: context.filesDir, "Karman")

    fun ensureDir(context: Context): File = dir(context).apply { mkdirs() }

    fun all(context: Context): List<LocalDownload> {
        val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        val raw = prefs.getString(KEY, null) ?: return emptyList()
        return runCatching { gson.fromJson<List<LocalDownload>>(raw, type) }
            .getOrNull()
            ?.filter { File(it.path).isFile }
            ?.sortedByDescending { it.savedAt }
            ?: emptyList()
    }

    private fun save(context: Context, items: List<LocalDownload>) {
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            .edit()
            .putString(KEY, gson.toJson(items))
            .apply()
    }

    fun add(context: Context, item: LocalDownload) {
        val rest = all(context).filterNot { it.videoId == item.videoId }
        save(context, rest + item)
    }

    fun remove(context: Context, item: LocalDownload): Boolean {
        runCatching { File(item.path).delete() }
        save(context, all(context).filterNot { it.videoId == item.videoId })
        return true
    }

    fun fileName(title: String, videoId: Int): String {
        val clean = title
            .replace(Regex("[\\\\/:*?\"<>|\\p{Cntrl}]"), " ")
            .replace(Regex("\\s+"), " ")
            .trim()
            .take(110)
            .ifBlank { "video" }
        return "$clean [$videoId].mp4"
    }
}
