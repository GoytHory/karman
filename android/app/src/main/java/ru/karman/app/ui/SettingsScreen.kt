package ru.karman.app.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlinx.coroutines.launch
import ru.karman.app.data.ReleaseInfo
import ru.karman.app.data.Repo
import ru.karman.app.data.Session
import ru.karman.app.data.StatusResponse
import ru.karman.app.data.Updates
import java.io.File

@OptIn(ExperimentalLayoutApi::class)
@Composable
fun SettingsScreen(onLogout: () -> Unit) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()

    var status by remember { mutableStateOf<StatusResponse?>(null) }
    var error by remember { mutableStateOf("") }

    var release by remember { mutableStateOf<ReleaseInfo?>(null) }
    var checking by remember { mutableStateOf(false) }
    var downloading by remember { mutableStateOf(false) }
    var progress by remember { mutableIntStateOf(0) }
    var apk by remember { mutableStateOf<File?>(null) }
    var upToDate by remember { mutableStateOf(false) }
    var updateError by remember { mutableStateOf("") }

    LaunchedEffect(Unit) {
        try {
            status = Repo.api().status()
            error = ""
        } catch (exc: Exception) {
            error = Repo.humanMessage(exc)
        }
    }

    fun checkUpdates() {
        scope.launch {
            checking = true
            updateError = ""
            upToDate = false
            release = null
            try {
                val info = Updates.latest()
                if (Updates.isNewer(info.version)) {
                    release = info
                } else {
                    upToDate = true
                }
            } catch (exc: Exception) {
                updateError = exc.message ?: "Не удалось проверить обновления"
            } finally {
                checking = false
            }
        }
    }

    fun downloadRelease() {
        val info = release ?: return
        scope.launch {
            downloading = true
            progress = 0
            updateError = ""
            try {
                apk = Updates.download(context, info) { progress = it }
            } catch (exc: Exception) {
                updateError = exc.message ?: "Не удалось скачать обновление"
            } finally {
                downloading = false
            }
        }
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(horizontal = 16.dp, vertical = 8.dp),
    ) {
        SectionLabel("Сервер")
        InfoRow("Адрес", Session.server)
        InfoRow("Пользователь", Session.username ?: "—")
        InfoRow("Версия", Updates.currentVersion())

        if (error.isNotBlank()) {
            Text(error, color = Danger, fontSize = 12.sp, modifier = Modifier.padding(vertical = 8.dp))
        }

        status?.let { server ->
            HorizontalDivider(color = Line, modifier = Modifier.padding(vertical = 10.dp))
            SectionLabel("Хранилище")
            InfoRow("Готово", "${server.counts.ready}")
            InfoRow("В очереди", "${server.counts.pending + server.counts.downloading}")
            InfoRow("С ошибкой", "${server.counts.failed}")
            if (server.disk_free != null && server.disk_total != null) {
                InfoRow("Свободно", "${formatSize(server.disk_free)} из ${formatSize(server.disk_total)}")
            }
        }

        HorizontalDivider(color = Line, modifier = Modifier.padding(vertical = 10.dp))
        SectionLabel("Оформление")

        FlowRow(
            horizontalArrangement = Arrangement.spacedBy(8.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp),
            modifier = Modifier.fillMaxWidth().padding(bottom = 4.dp),
        ) {
            Palettes.all.forEach { palette ->
                val selected = palette.id == Palettes.current.id
                Column(
                    modifier = Modifier
                        .width(104.dp)
                        .clip(RoundedCornerShape(8.dp))
                        .background(if (selected) palette.raised else palette.panel)
                        .border(
                            1.dp,
                            if (selected) palette.accent else palette.line,
                            RoundedCornerShape(8.dp),
                        )
                        .clickable {
                            Session.theme = palette.id
                            Palettes.select(palette.id)
                        }
                        .padding(horizontal = 9.dp, vertical = 8.dp),
                ) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Box(
                            modifier = Modifier
                                .size(9.dp)
                                .clip(CircleShape)
                                .background(palette.accent),
                        )
                        Spacer(Modifier.width(6.dp))
                        Text(
                            palette.name,
                            color = palette.text,
                            fontSize = 12.sp,
                            fontWeight = FontWeight.Medium,
                        )
                    }
                    Text(
                        palette.note,
                        color = palette.dim,
                        fontSize = 9.5.sp,
                        lineHeight = 13.sp,
                        modifier = Modifier.padding(top = 5.dp),
                    )
                }
            }
        }

        HorizontalDivider(color = Line, modifier = Modifier.padding(vertical = 10.dp))
        SectionLabel("Обновление")

        if (apk == null) {
            Text(
                if (release == null) {
                    "Проверяет последний релиз на GitHub и скачивает APK."
                } else {
                    "Доступна версия ${release?.version}."
                },
                color = TextDim,
                fontSize = 11.5.sp,
                lineHeight = 16.sp,
                modifier = Modifier.padding(bottom = 8.dp),
            )
        }

        if (upToDate) {
            Text("Установлена последняя версия.", color = Lime, fontSize = 12.sp)
        }

        release?.notes?.takeIf { it.isNotBlank() && apk == null }?.let { notes ->
            Text(
                notes.lineSequence().take(6).joinToString("\n"),
                color = TextDim,
                fontSize = 11.sp,
                lineHeight = 15.sp,
                modifier = Modifier.padding(bottom = 8.dp),
            )
        }

        if (downloading) {
            LinearProgressIndicator(
                progress = { progress / 100f },
                modifier = Modifier.fillMaxWidth().height(3.dp),
                color = Lime,
                trackColor = Line,
            )
            Text(
                "Скачиваю APK · $progress%",
                color = TextDim,
                fontSize = 11.sp,
                modifier = Modifier.padding(top = 6.dp),
            )
        } else {
            val readyApk = apk
            Button(
                onClick = {
                    when {
                        readyApk != null -> {
                            if (Updates.canInstall(context)) {
                                Updates.install(context, readyApk)
                            } else {
                                Updates.openInstallPermission(context)
                            }
                        }
                        release != null -> downloadRelease()
                        else -> checkUpdates()
                    }
                },
                enabled = !checking,
                colors = ButtonDefaults.buttonColors(
                    containerColor = if (readyApk != null) Lime else Raised,
                    contentColor = if (readyApk != null) Palettes.current.onAccent else TextMain,
                ),
            ) {
                Text(
                    when {
                        readyApk != null -> if (Updates.canInstall(context)) {
                            "Установить ${release?.version.orEmpty()}"
                        } else {
                            "Разрешить установку"
                        }
                        checking -> "Проверяю…"
                        release != null -> "Скачать ${release?.version.orEmpty()}"
                        else -> "Проверить обновления"
                    },
                )
            }
        }

        if (apk != null && !Updates.canInstall(context)) {
            Text(
                "Разрешите установку из этого источника и вернитесь сюда.",
                color = Warn,
                fontSize = 11.sp,
                lineHeight = 15.sp,
                modifier = Modifier.padding(top = 6.dp),
            )
        }

        if (updateError.isNotBlank()) {
            Text(
                updateError,
                color = Danger,
                fontSize = 11.5.sp,
                modifier = Modifier.padding(top = 8.dp),
            )
        }

        HorizontalDivider(color = Line, modifier = Modifier.padding(vertical = 10.dp))
        SectionLabel("Аккаунт")

        Text(
            "Выход удалит токен на телефоне. Скачанные файлы останутся.",
            color = TextDim,
            fontSize = 11.5.sp,
            lineHeight = 16.sp,
            modifier = Modifier.padding(bottom = 10.dp),
        )

        Button(
            onClick = {
                Session.clear()
                onLogout()
            },
            colors = ButtonDefaults.buttonColors(
                containerColor = Raised,
                contentColor = TextMain,
            ),
        ) {
            Text("Выйти из аккаунта")
        }

        Spacer(Modifier.height(28.dp))
        TextButton(
            onClick = {
                Session.clear()
                onLogout()
            },
            modifier = Modifier.fillMaxWidth(),
        ) {
            Text("Сменить сервер", color = TextDim, fontSize = 12.sp)
        }

        Spacer(Modifier.height(32.dp))
        Text(
            "Карман · домашний видеоархив. Видео хранятся на вашем компьютере, телефон только смотрит и скачивает.",
            color = TextDim,
            fontSize = 11.sp,
            lineHeight = 16.sp,
        )
        Spacer(Modifier.height(24.dp))
    }
}

@Composable
private fun InfoRow(label: String, value: String) {
    Row(
        modifier = Modifier.fillMaxWidth().padding(vertical = 6.dp),
        horizontalArrangement = Arrangement.SpaceBetween,
    ) {
        Text(label, color = TextDim, fontSize = 12.sp)
        Text(value, color = TextMain, fontSize = 12.sp, fontWeight = FontWeight.Medium)
    }
}
