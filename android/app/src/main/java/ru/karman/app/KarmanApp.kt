package ru.karman.app

import android.app.Application
import coil.ImageLoader
import coil.ImageLoaderFactory
import ru.karman.app.data.Downloads
import ru.karman.app.data.Notifications
import ru.karman.app.data.Repo
import ru.karman.app.data.Session

class KarmanApp : Application(), ImageLoaderFactory {
    override fun onCreate() {
        super.onCreate()
        Session.init(this)
        Downloads.ensureDir(this)
        Notifications.init(this)
    }

    override fun newImageLoader(): ImageLoader = ImageLoader.Builder(this)
        .okHttpClient(Repo.client)
        .crossfade(true)
        .build()
}
