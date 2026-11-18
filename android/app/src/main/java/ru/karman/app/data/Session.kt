package ru.karman.app.data

import android.content.Context
import android.content.SharedPreferences

/** Адрес сервера, токен и имя пользователя. Хранятся в приватных настройках приложения. */
object Session {
    private lateinit var prefs: SharedPreferences

    fun init(context: Context) {
        if (!::prefs.isInitialized) {
            prefs = context.applicationContext.getSharedPreferences("karman", Context.MODE_PRIVATE)
        }
    }

    var server: String
        get() = prefs.getString("server", "") ?: ""
        set(value) {
            prefs.edit().putString("server", normalize(value)).apply()
        }

    var token: String?
        get() = prefs.getString("token", null)
        set(value) {
            prefs.edit().putString("token", value).apply()
        }

    var username: String?
        get() = prefs.getString("username", null)
        set(value) {
            prefs.edit().putString("username", value).apply()
        }

    val isLoggedIn: Boolean
        get() = !token.isNullOrBlank() && server.isNotBlank()

    /** `192.168.1.108:8096` → `http://192.168.1.108:8096` */
    fun normalize(value: String): String {
        var text = value.trim()
        if (text.isEmpty()) return text
        if (!text.startsWith("http://") && !text.startsWith("https://")) text = "http://$text"
        return text.trimEnd('/')
    }

    fun baseUrl(): String = server.trimEnd('/') + "/"

    fun clear() {
        token = null
        username = null
    }
}
