package ru.karman.app.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlinx.coroutines.launch
import ru.karman.app.data.Repo
import ru.karman.app.data.Session

@Composable
fun LoginScreen(onLogged: () -> Unit) {
    var server by rememberSaveable { mutableStateOf(Session.server.ifBlank { "192.168.1.108:8096" }) }
    var username by rememberSaveable { mutableStateOf(Session.username ?: "") }
    var password by rememberSaveable { mutableStateOf("") }
    var register by rememberSaveable { mutableStateOf(false) }
    var busy by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf("") }
    val scope = rememberCoroutineScope()

    fun submit() {
        if (busy) return
        when {
            server.isBlank() -> { error = "Укажите адрес сервера"; return }
            username.isBlank() -> { error = "Введите логин"; return }
            password.length < 6 -> { error = "Пароль не короче 6 символов"; return }
        }
        busy = true
        error = ""
        scope.launch {
            try {
                if (register) Repo.register(server, username, password) else Repo.login(server, username, password)
                onLogged()
            } catch (exc: Exception) {
                error = Repo.humanMessage(exc)
            } finally {
                busy = false
            }
        }
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(horizontal = 24.dp, vertical = 48.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Spacer(Modifier.height(40.dp))
        Text(
            text = "К",
            color = Ink,
            fontSize = 22.sp,
            fontWeight = FontWeight.Bold,
            modifier = Modifier
                .background(Color(0xFFEDEDF0))
                .padding(horizontal = 12.dp, vertical = 6.dp),
        )
        Spacer(Modifier.height(18.dp))
        Text("Карман", color = TextMain, fontSize = 24.sp, fontWeight = FontWeight.SemiBold)
        Spacer(Modifier.height(6.dp))
        Text(
            if (register) "Новый аккаунт в домашнем архиве" else "Вход в домашний видеоархив",
            color = TextDim,
            fontSize = 12.5.sp,
        )
        Spacer(Modifier.height(28.dp))

        Column(
            modifier = Modifier.widthIn(max = 420.dp).fillMaxWidth(),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            OutlinedTextField(
                value = server,
                onValueChange = { server = it },
                label = { Text("Адрес сервера") },
                placeholder = { Text("192.168.1.108:8096") },
                singleLine = true,
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Uri),
                modifier = Modifier.fillMaxWidth(),
            )
            OutlinedTextField(
                value = username,
                onValueChange = { username = it },
                label = { Text("Логин") },
                singleLine = true,
                modifier = Modifier.fillMaxWidth(),
            )
            OutlinedTextField(
                value = password,
                onValueChange = { password = it },
                label = { Text("Пароль") },
                singleLine = true,
                visualTransformation = PasswordVisualTransformation(),
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Password),
                modifier = Modifier.fillMaxWidth(),
            )

            if (error.isNotBlank()) {
                Text(error, color = Danger, fontSize = 12.sp, lineHeight = 17.sp)
            }

            Button(
                onClick = { submit() },
                enabled = !busy,
                colors = ButtonDefaults.buttonColors(
                    containerColor = Color(0xFFEDEDF0),
                    contentColor = Ink,
                ),
                modifier = Modifier.fillMaxWidth().height(46.dp),
            ) {
                if (busy) {
                    CircularProgressIndicator(
                        modifier = Modifier.size(18.dp),
                        strokeWidth = 2.dp,
                        color = Ink,
                    )
                } else {
                    Text(if (register) "Создать аккаунт" else "Войти", fontWeight = FontWeight.Medium)
                }
            }

            TextButton(
                onClick = { register = !register; error = "" },
                modifier = Modifier.align(Alignment.CenterHorizontally),
            ) {
                Text(
                    if (register) "У меня уже есть аккаунт" else "Создать новый аккаунт",
                    color = TextDim,
                    fontSize = 12.sp,
                )
            }
        }

        Spacer(Modifier.height(28.dp))
        Text(
            "Первый созданный аккаунт становится администратором. Сервер и телефон должны быть в одной сети.",
            color = TextDim,
            fontSize = 11.sp,
            lineHeight = 16.sp,
            modifier = Modifier.widthIn(max = 420.dp),
        )
        Spacer(Modifier.height(40.dp))
    }
}
