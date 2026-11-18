package ru.karman.app.ui

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import ru.karman.app.BuildConfig
import ru.karman.app.data.Repo
import ru.karman.app.data.Session
import ru.karman.app.data.StatusResponse

@Composable
fun SettingsScreen(onLogout: () -> Unit) {
    var status by remember { mutableStateOf<StatusResponse?>(null) }
    var error by remember { mutableStateOf("") }

    LaunchedEffect(Unit) {
        try {
            status = Repo.api().status()
            error = ""
        } catch (exc: Exception) {
            error = Repo.humanMessage(exc)
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
        InfoRow("Версия", BuildConfig.VERSION_NAME)

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
                containerColor = Color(0xFF1B1B20),
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
