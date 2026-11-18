package ru.karman.app.ui

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
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.sp
import androidx.navigation.NavGraph.Companion.findStartDestination
import androidx.navigation.NavType
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.currentBackStackEntryAsState
import androidx.navigation.compose.rememberNavController
import androidx.navigation.navArgument
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

    Scaffold(
        modifier = Modifier.fillMaxSize(),
        containerColor = Ink,
        topBar = {
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
        },
        bottomBar = {
            if (topLevel) {
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
            modifier = Modifier.padding(padding),
        ) {
            composable("library") {
                LibraryScreen(onOpen = { id -> nav.navigate("video/$id") })
            }
            composable("playlists") {
                PlaylistsScreen(onOpen = { id -> nav.navigate("playlist/$id") })
            }
            composable("history") {
                HistoryScreen(onOpen = { id -> nav.navigate("video/$id") })
            }
            composable("downloads") {
                DownloadsScreen()
            }
            composable("settings") {
                SettingsScreen(onLogout = onLoggedOut)
            }
            composable(
                route = "video/{id}",
                arguments = listOf(navArgument("id") { type = NavType.IntType }),
            ) { entry ->
                VideoScreen(entry.arguments?.getInt("id") ?: 0)
            }
            composable(
                route = "playlist/{id}",
                arguments = listOf(navArgument("id") { type = NavType.IntType }),
            ) { entry ->
                PlaylistVideosScreen(entry.arguments?.getInt("id") ?: 0)
            }
        }
    }
}
