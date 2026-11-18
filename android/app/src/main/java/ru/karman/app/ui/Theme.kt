package ru.karman.app.ui

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color

val Lime = Color(0xFFC9F24D)
val Ink = Color(0xFF0A0A0B)
val Panel = Color(0xFF131316)
val Line = Color(0xFF26262C)
val TextMain = Color(0xFFE9E9EE)
val TextDim = Color(0xFF9A9AA6)
val Danger = Color(0xFFEF6B64)
val Warn = Color(0xFFD7AC5C)

private val scheme = darkColorScheme(
    primary = Lime,
    onPrimary = Color(0xFF0A0A0B),
    secondary = Color(0xFFEDEDF0),
    onSecondary = Color(0xFF0A0A0B),
    background = Ink,
    onBackground = TextMain,
    surface = Ink,
    onSurface = TextMain,
    surfaceVariant = Panel,
    onSurfaceVariant = TextDim,
    outline = Line,
    error = Danger,
)

@Composable
fun KarmanTheme(content: @Composable () -> Unit) {
    MaterialTheme(colorScheme = scheme, content = content)
}
