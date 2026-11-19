package ru.karman.app.ui

import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.slideInHorizontally
import androidx.compose.animation.slideOutHorizontally
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.ArrowBack
import androidx.compose.material.icons.rounded.Download
import androidx.compose.material.icons.rounded.History
import androidx.compose.material.icons.rounded.PlaylistPlay
import androidx.compose.material.icons.rounded.Settings
import androidx.compose.material.icons.rounded.VideoLibrary
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.NavigationBarItemDefaults
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.sp
import androidx.navigation.NavGraph.Companion.findStartDestination
import androidx.navigation.NavType
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.currentBackStackEntryAsState
import androidx.navigation.compose.rememberNavController
import androidx.navigation.navArgument
import kotlinx.coroutines.delay
import ru.karman.app.data.Session

private data class Tab(val route: String, val label: String, val icon: ImageVector)

private val tabs = listOf(
    Tab("library", "Видео", Icons.Rounded.VideoLibrary),
    Tab("playlists", "Плейлисты", Icons.Rounded.PlaylistPlay),
    Tab("history", "История", Icons.Rounded.History),
    Tab("downloads", "На диске", Icons.Rounded.Download),
)

@Composable
fun KarmanRoot() {
    var logged by remember { mutableStateOf(Session.isLoggedIn) }

    if (!logged) {
        LoginScreen(onLogged = { logged = true })
        return
    }

    MainShell(onLoggedOut = { logged = false })
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun MainShell(onLoggedOut: () -> Unit) {
    val nav = rememberNavController()
    val backStack by nav.currentBackStackEntryAsState()
    val route = backStack?.destination?.route ?: "library"
    val topLevel = tabs.any { it.route == route }

    val title = when {
        route.startsWith("video/") -> "Видео"
        route.startsWith("playlist/") -> "Плейлист"
        route == "settings" -> "Настройки"
        else -> tabs.firstOrNull { it.route == route }?.label ?: "Карман"
    }

    // Полноэкранный плеер рисуется в этом же окне, а не в отдельном Dialog:
    // окно диалога оказывается меньше экрана, и по краям просвечивал инлайн-плеер.
    var videoFullscreen by remember { mutableStateOf(false) }

    // «Картинка в картинке»: системное окно показывает содержимое активности,
    // поэтому прячем весь каркас приложения — в PiP остаётся только плеер.
    val context = LocalContext.current
    var inPip by remember { mutableStateOf(context.findActivity()?.isInPictureInPictureMode == true) }
    LaunchedEffect(Unit) {
        val activity = context.findActivity() ?: return@LaunchedEffect
        while (true) {
            inPip = activity.isInPictureInPictureMode
            delay(150)
        }
    }
    val chromeHidden = videoFullscreen || inPip

    LaunchedEffect(route) {
        if (!route.startsWith("video/")) videoFullscreen = false
    }

    Scaffold(
        modifier = Modifier.fillMaxSize(),
        containerColor = if (chromeHidden) Color.Black else Ink,
        topBar = {
            if (!chromeHidden) {
                TopAppBar(
                    title = { Text(title, fontSize = 16.sp, fontWeight = FontWeight.Medium) },
                    navigationIcon = {
                        if (!topLevel) {
                            IconButton(onClick = { nav.popBackStack() }) {
                                Icon(Icons.Rounded.ArrowBack, contentDescription = "Назад")
                            }
                        }
                    },
                    actions = {
                        if (route != "settings") {
                            IconButton(onClick = { nav.navigate("settings") }) {
                                Icon(Icons.Rounded.Settings, contentDescription = "Настройки")
                            }
                        }
                    },
                    colors = TopAppBarDefaults.topAppBarColors(
                        containerColor = Ink,
                        titleContentColor = TextMain,
                        navigationIconContentColor = TextDim,
                        actionIconContentColor = TextDim,
                    ),
                )
            }
        },
        bottomBar = {
            if (topLevel && !chromeHidden) {
                NavigationBar(containerColor = Panel, contentColor = TextDim) {
                    tabs.forEach { tab ->
                        NavigationBarItem(
                            selected = route == tab.route,
                            onClick = {
                                if (route != tab.route) {
                                    nav.navigate(tab.route) {
                                        popUpTo(nav.graph.findStartDestination().id) { saveState = true }
                                        launchSingleTop = true
                                        restoreState = true
                                    }
                                }
                            },
                            icon = { Icon(tab.icon, contentDescription = null) },
                            label = { Text(tab.label, fontSize = 10.sp) },
                            colors = NavigationBarItemDefaults.colors(
                                selectedIconColor = Lime,
                                selectedTextColor = Lime,
                                indicatorColor = Line,
                                unselectedIconColor = TextDim,
                                unselectedTextColor = TextDim,
                            ),
                        )
                    }
                }
            }
        },
    ) { padding ->
        NavHost(
            navController = nav,
            startDestination = "library",
            modifier = if (chromeHidden) Modifier.fillMaxSize() else Modifier.padding(padding),
            // Быстрые переходы: раньше анимация занимала почти секунду и ощущалась вязкой.
            enterTransition = {
                fadeIn(tween(170)) + slideInHorizontally(tween(200)) { it / 14 }
            },
            exitTransition = { fadeOut(tween(120)) },
            popEnterTransition = { fadeIn(tween(170)) },
            popExitTransition = {
                fadeOut(tween(120)) + slideOutHorizontally(tween(200)) { it / 14 }
            },
        ) {
            composable(
                "library",
                enterTransition = { fadeIn(tween(150)) },
                exitTransition = { fadeOut(tween(110)) },
                popEnterTransition = { fadeIn(tween(150)) },
                popExitTransition = { fadeOut(tween(110)) },
            ) {
                LibraryScreen(onOpen = { id -> nav.navigate("video/$id") })
            }
            composable(
                "playlists",
                enterTransition = { fadeIn(tween(150)) },
                exitTransition = { fadeOut(tween(110)) },
                popEnterTransition = { fadeIn(tween(150)) },
                popExitTransition = { fadeOut(tween(110)) },
            ) {
                PlaylistsScreen(onOpen = { id -> nav.navigate("playlist/$id") })
            }
            composable(
                "history",
                enterTransition = { fadeIn(tween(150)) },
                exitTransition = { fadeOut(tween(110)) },
                popEnterTransition = { fadeIn(tween(150)) },
                popExitTransition = { fadeOut(tween(110)) },
            ) {
                HistoryScreen(onOpen = { id -> nav.navigate("video/$id") })
            }
            composable(
                "downloads",
                enterTransition = { fadeIn(tween(150)) },
                exitTransition = { fadeOut(tween(110)) },
                popEnterTransition = { fadeIn(tween(150)) },
                popExitTransition = { fadeOut(tween(110)) },
            ) {
                DownloadsScreen()
            }
            composable("settings") {
                SettingsScreen(onLogout = onLoggedOut)
            }
            composable(
                route = "video/{id}",
                arguments = listOf(navArgument("id") { type = NavType.IntType }),
            ) { entry ->
                val id = entry.arguments?.getInt("id") ?: 0
                VideoScreen(
                    videoId = id,
                    fullscreen = videoFullscreen,
                    inPip = inPip,
                    onFullscreenChange = { videoFullscreen = it },
                    onOpen = { next ->
                        nav.navigate("video/$next") {
                            popUpTo(entry.destination.id) { inclusive = true }
                        }
                    },
                )
            }
            composable(
                route = "playlist/{id}",
                arguments = listOf(navArgument("id") { type = NavType.IntType }),
            ) { entry ->
                PlaylistVideosScreen(
                    playlistId = entry.arguments?.getInt("id") ?: 0,
                    onOpen = { id -> nav.navigate("video/$id") },
                )
            }
        }
    }
}
