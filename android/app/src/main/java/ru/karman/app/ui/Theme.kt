package ru.karman.app.ui

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.compose.ui.graphics.Color
import ru.karman.app.data.Session

/**
 * Пять тёмных схем. Цвета читаются из [Palettes.current] прямо в композиции,
 * поэтому смена темы мгновенно перекрашивает весь интерфейс.
 */
data class Palette(
    val id: String,
    val name: String,
    val note: String,
    val bg: Color,
    val panel: Color,
    val raised: Color,
    val line: Color,
    val text: Color,
    val dim: Color,
    val accent: Color,
    val onAccent: Color,
    val danger: Color,
    val warn: Color,
)

object Palettes {
    val all: List<Palette> = listOf(
        Palette(
            id = "graphite",
            name = "Графит",
            note = "Строгий чёрный, лаймовый акцент",
            bg = Color(0xFF0A0A0B),
            panel = Color(0xFF131316),
            raised = Color(0xFF1B1B20),
            line = Color(0xFF26262C),
            text = Color(0xFFE9E9EE),
            dim = Color(0xFF9A9AA6),
            accent = Color(0xFFC9F24D),
            onAccent = Color(0xFF0A0A0B),
            danger = Color(0xFFEF6B64),
            warn = Color(0xFFD7AC5C),
        ),
        Palette(
            id = "phosphor",
            name = "Фосфор",
            note = "Терминал: зелёный монохром",
            bg = Color(0xFF040604),
            panel = Color(0xFF0A0E0A),
            raised = Color(0xFF101610),
            line = Color(0xFF1D2A1D),
            text = Color(0xFFD9F6D0),
            dim = Color(0xFF93BD88),
            accent = Color(0xFF7DFF6A),
            onAccent = Color(0xFF041004),
            danger = Color(0xFFFF6B5C),
            warn = Color(0xFFD8C46A),
        ),
        Palette(
            id = "olive",
            name = "Олива",
            note = "Тихий зелёный, мягкие тона",
            bg = Color(0xFF1B201A),
            panel = Color(0xFF252C23),
            raised = Color(0xFF303A2D),
            line = Color(0xFF3A4537),
            text = Color(0xFFE9EFE2),
            dim = Color(0xFFB4BFA9),
            accent = Color(0xFFC6D9A9),
            onAccent = Color(0xFF1B201A),
            danger = Color(0xFFE38F7D),
            warn = Color(0xFFDCC681),
        ),
        Palette(
            id = "glass",
            name = "Стекло",
            note = "Холодный свет, синий акцент",
            bg = Color(0xFF07080C),
            panel = Color(0xFF12141B),
            raised = Color(0xFF1E212C),
            line = Color(0xFF2A2F3C),
            text = Color(0xFFEEF2F8),
            dim = Color(0xFFA9B3C4),
            accent = Color(0xFFA8C6FF),
            onAccent = Color(0xFF07080C),
            danger = Color(0xFFFF7A86),
            warn = Color(0xFFE3C07A),
        ),
        Palette(
            id = "amber",
            name = "Янтарь",
            note = "Тёплый уголь, оранжевый сигнал",
            bg = Color(0xFF0C0B09),
            panel = Color(0xFF16140F),
            raised = Color(0xFF241F17),
            line = Color(0xFF2E2A21),
            text = Color(0xFFF1EAD9),
            dim = Color(0xFFBBBA97),
            accent = Color(0xFFFF6B35),
            onAccent = Color(0xFF120A05),
            danger = Color(0xFFFF5F56),
            warn = Color(0xFFE2C37C),
        ),
    )

    var current: Palette by mutableStateOf(all.first())
        private set

    fun select(id: String?) {
        current = all.firstOrNull { it.id == id } ?: all.first()
    }

    fun selectedId(): String = current.id
}

val Lime: Color get() = Palettes.current.accent
val Ink: Color get() = Palettes.current.bg
val Panel: Color get() = Palettes.current.panel
val Raised: Color get() = Palettes.current.raised
val Line: Color get() = Palettes.current.line
val TextMain: Color get() = Palettes.current.text
val TextDim: Color get() = Palettes.current.dim
val Danger: Color get() = Palettes.current.danger
val Warn: Color get() = Palettes.current.warn

@Composable
fun KarmanTheme(content: @Composable () -> Unit) {
    val palette = Palettes.current
    val scheme = darkColorScheme(
        primary = palette.accent,
        onPrimary = palette.onAccent,
        secondary = palette.text,
        onSecondary = palette.onAccent,
        background = palette.bg,
        onBackground = palette.text,
        surface = palette.bg,
        onSurface = palette.text,
        surfaceVariant = palette.panel,
        onSurfaceVariant = palette.dim,
        outline = palette.line,
        error = palette.danger,
    )
    MaterialTheme(colorScheme = scheme, content = content)
}

/** Применяет сохранённую тему. Вызывается до первого кадра. */
fun applySavedPalette() = Palettes.select(Session.theme)
