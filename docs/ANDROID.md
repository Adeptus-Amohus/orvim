# Android: разработка и сборка

Общий интерфейс и Rust/SQLite работают из одного проекта. Android уже инициализирован в src-tauri/gen/android; повторный init не нужен. Идентификатор установленного приложения — local.lifeos.client, бренд — Orvim.

## Требования

- Windows-инструменты из [DEVELOPMENT.md](DEVELOPMENT.md); полный **JDK 21**, содержащий java и javac.
- Android SDK Platform 36, Build Tools **35.0.0 и 36.0.0**, Platform Tools и Command-line Tools.
- NDK; CI использует **30.0.16248370**.
- Для эмулятора: Android Emulator, совместимый образ x86_64 и настроенная аппаратная виртуализация.

Версию Java задаёт не название Android Studio, а фактический JDK в JAVA_HOME. Проектная проверка отклоняет другие major-версии, включая 25. Gradle wrapper и плагины закреплены в Android-исходниках. Используйте [prerequisites Tauri](https://v2.tauri.app/start/prerequisites/) и штатные SDK Manager/Device Manager.

Пример путей, которые нужно заменить своими; присваивания действуют только в текущем терминале:

```powershell
$env:JAVA_HOME = 'C:\DevTools\jdk-21'
$env:ANDROID_HOME = 'C:\Android\Sdk'
$env:NDK_HOME = Join-Path $env:ANDROID_HOME 'ndk\30.0.16248370'
rustup target add aarch64-linux-android x86_64-linux-android
npm ci
npm run android:check
```

JAVA_HOME — корень JDK, ANDROID_HOME — SDK, NDK_HOME — каталог версии NDK, не папка bin. scripts/android-check.mjs проверяет версии/файлы без установки инструментов и изменения глобальных настроек. npm выполняет его перед android:dev и android:build; низкоуровневый npm run tauri эти pre-hooks обходит.

## Эмулятор

В Device Manager можно использовать существующий телефонный AVD или создать Pixel-подобный с Android 16/API 36 Google APIs x86_64. В прежних проверках использовалось имя LifeOS_API_36; оно не является обязательным для приложения.

```powershell
& "$env:ANDROID_HOME\emulator\emulator.exe" -list-avds
& "$env:ANDROID_HOME\emulator\emulator.exe" -avd LifeOS_API_36
```

При воспроизводимой графической ошибке на этом хосте использовались -gpu swiftshader -feature -Vulkan. Не включайте -no-boot-anim: текущий runner Tauri ожидает остановку службы bootanim; отключённая анимация раньше приводила к ожиданию после сборки. Не запускайте две копии одного AVD.

## Запуск dev

После загрузки эмулятора:

```powershell
& "$env:ANDROID_HOME\platform-tools\adb.exe" devices
& "$env:ANDROID_HOME\platform-tools\adb.exe" -s emulator-5554 reverse tcp:1420 tcp:1420
& "$env:ANDROID_HOME\platform-tools\adb.exe" -s emulator-5554 reverse tcp:1421 tcp:1421
npm run android:dev -- --host 127.0.0.1 LifeOS_API_36
```

Для телефона включите USB debugging и подтвердите доступ на устройстве. Подставьте его serial из adb devices вместо emulator-5554 и опустите имя AVD в npm-команде для выбора подключённого устройства. Повторите reverse после переподключения. Dev-режиму нужен запущенный Vite; не занимайте тот же порт вторым Windows dev-процессом.

### Прежний флаг --no-default-features

Флаг раньше считался обходом зависания после сборки. Проверка показала, что причиной было ожидание bootanim при отключённой анимации. После обычного запуска AVD dev работал без флага. Собственных Cargo default features проект не задаёт; обязательной зависимости от этого флага сейчас нет. Это историческая диагностика, а не отключение проверок.

## APK

```powershell
# Самостоятельный debug APK эмулятора, без зависимости от Vite:
npm run android:build -- --debug --apk --target x86_64

# Release ARM64 для телефона:
npm run android:build -- --apk --target aarch64 --ci
```

Результаты: src-tauri/gen/android/app/build/outputs/apk. Debug использует локальную debug-подпись. Release для установки нужно подписать; отсутствие ключей в CI даёт артефакт с именем unsigned. Для обновления существующего приложения сохраняйте сертификат, applicationId и совместимость хранилища. [Порядок выпуска](RELEASING.md).

Для Windows release-сборки с SQLCipher/OpenSSL используйте `scripts/build-android-release.ps1 -PerlBin 'C:/Program Files/Git/usr/bin'`: он настраивает NDK Make, нормализованные пути clang/ar/ranlib и целевую API 24. Дополнительные Perl-модули передаются необязательным `-PerlLibrary`; они не являются обязательной папкой проекта.

На Linux задайте LLVM-инструменты явно, чтобы OpenSSL не искал удалённый из новых NDK `aarch64-linux-android-ranlib`:

```sh
export NDK_HOME="$ANDROID_HOME/ndk/30.0.16248370"
toolchain="$NDK_HOME/toolchains/llvm/prebuilt/linux-x86_64/bin"
export CC_aarch64_linux_android="$toolchain/clang"
export CFLAGS_aarch64_linux_android="--target=aarch64-linux-android24"
export AR_aarch64_linux_android="$toolchain/llvm-ar"
export RANLIB_aarch64_linux_android="$toolchain/llvm-ranlib"
npm run android:build -- --apk --target aarch64 --ci
```

Глобальные пути SDK/JDK, keystore, пароли, кеши и APK не входят в исходники. .artifacts может отсутствовать полностью. Kotlin/Gradle/resources/wrapper в gen/android являются частью сборки и сохраняются в Git; их нельзя удалять как обычный кеш.

## Данные и адаптеры

SQLite находится в приватном app_local_data_dir, не в shared storage или кеше. Используется существующая life-os.sqlite3 либо новая orvim.sqlite3; WAL/SHM рядом. Миграции транзакционны, foreign keys включаются при открытии. Подтверждённые записи сохраняются между запусками; принудительная остановка до завершения записи не подтверждает сохранение.

OrvimPlugin, OrvimDictation, OrvimHealthConnect и OrvimBackups — Kotlin-адаптеры, основная модель и repository общие с Windows. MainActivity передаёт insets, клавиатуру, Back, pause/resume. Приватные копии удаляются с приложением; для независимого хранения выберите SAF-папку. [Копии](BACKUPS.md), [Health Connect](HEALTH_CONNECT.md).

## Проверки и ограничения

Историческая основа: [ANDROID_VERIFICATION.md](ANDROID_VERIFICATION.md). Последние проверки эмулятора: [EMULATOR_QA_2026_10_22.md](EMULATOR_QA_2026_10_22.md), ограничения собранного выпуска: [VERSION_0_4_23.md](VERSION_0_4_23.md). Записи о старых успешных тестах не подтверждают новое изменение исходников.

Физический ARM64-телефон, OEM-клавиатуры, микрофон, реальные аккаунты/Health Connect, уведомления после выгрузки и установка обновлений требуют отдельных проверок. Таймер отдыха рассчитан на открытое приложение. Store-публикация и доверенная release-подпись не настраиваются автоматически.
