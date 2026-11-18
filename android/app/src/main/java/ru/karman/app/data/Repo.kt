package ru.karman.app.data

import com.google.gson.Gson
import com.google.gson.JsonParser
import okhttp3.OkHttpClient
import retrofit2.HttpException
import retrofit2.Retrofit
import retrofit2.converter.gson.GsonConverterFactory
import java.io.IOException
import java.util.concurrent.TimeUnit

/** Сеть: один OkHttp-клиент с токеном, Retrofit под текущий адрес сервера. */
object Repo {
    private val gson = Gson()

    val client: OkHttpClient = OkHttpClient.Builder()
        .connectTimeout(15, TimeUnit.SECONDS)
        .readTimeout(90, TimeUnit.SECONDS)
        .writeTimeout(30, TimeUnit.SECONDS)
        .addInterceptor { chain ->
            val builder = chain.request().newBuilder()
                .header("Accept", "application/json")
            Session.token?.takeIf { it.isNotBlank() }?.let {
                builder.header("Authorization", "Bearer $it")
            }
            chain.proceed(builder.build())
        }
        .build()

    private var cachedServer = ""
    private var cachedApi: Api? = null

    private fun build(server: String): Api = Retrofit.Builder()
        .baseUrl(server.trimEnd('/') + "/")
        .client(client)
        .addConverterFactory(GsonConverterFactory.create(gson))
        .build()
        .create(Api::class.java)

    fun api(): Api {
        val server = Session.server
        if (cachedApi == null || cachedServer != server) {
            cachedServer = server
            cachedApi = build(server)
        }
        return cachedApi!!
    }

    suspend fun login(server: String, username: String, password: String): AuthResponse {
        val response = build(Session.normalize(server)).login(LoginBody(username.trim(), password))
        apply(response, server, username)
        return response
    }

    suspend fun register(server: String, username: String, password: String): AuthResponse {
        val response = build(Session.normalize(server)).register(LoginBody(username.trim(), password))
        apply(response, server, username)
        return response
    }

    private fun apply(response: AuthResponse, server: String, username: String) {
        Session.server = server
        Session.token = response.token
        Session.username = response.user.username.ifBlank { username.trim() }
        cachedApi = null
    }

    fun absolute(path: String?): String? {
        if (path.isNullOrBlank()) return null
        return if (path.startsWith("http://") || path.startsWith("https://")) path else Session.server + path
    }

    fun streamUrl(videoId: Int): String = "${Session.server}/api/videos/$videoId/stream"

    fun downloadUrl(videoId: Int): String = "${Session.server}/api/videos/$videoId/download"

    fun thumbUrl(video: Video): String? =
        absolute(video.thumbnail_local) ?: video.thumbnail_url

    fun humanMessage(exc: Throwable): String = when (exc) {
        is HttpException -> {
            val raw = runCatching { exc.response()?.errorBody()?.string() }.getOrNull()
            val detail = runCatching {
                JsonParser.parseString(raw).asJsonObject.get("detail")?.asString
            }.getOrNull()
            detail ?: when (exc.code()) {
                401 -> "Нужно войти заново"
                403 -> "Нет доступа"
                404 -> "Не найдено"
                else -> "Ошибка сервера (${exc.code()})"
            }
        }
        is IOException -> "Нет связи с сервером. Проверьте адрес и Wi-Fi."
        else -> exc.message ?: "Неизвестная ошибка"
    }
}
