# Разработка Orvim

Команды ниже выполняются из корня репозитория. Источник версий зависимостей — package-lock.json и src-tauri/Cargo.lock. Перед изменениями проверьте рабочую ветку и незакоммиченные файлы.

## Windows

Требуются Node.js 22.12+ и npm (CI использует Node 24), Rust stable с MSVC, Microsoft C++ Build Tools с Windows SDK, WebView2. Для Rust нужны rustfmt и Clippy. Системные инструменты устанавливайте по [официальным prerequisites Tauri](https://v2.tauri.app/start/prerequisites/); не помещайте SDK/JDK в временные файлы проекта.

```powershell
npm ci
npm run desktop:dev
```

Vite использует 1420, HMR — 1421. Перед переключением между Windows и Android остановите прежний dev-процесс. Для отдельного браузерного просмотра используйте npm run dev: данные IndexedDB принадлежат этому origin и не совпадают с SQLite установленного приложения.

## Android

[ANDROID.md](ANDROID.md) содержит полный порядок. Обязательны JDK 21, SDK 36, Build Tools 35.0.0/36.0.0, NDK и соответствующая Rust-цель. Проверка npm run android:check ничего не устанавливает и не меняет настройки машины. Android-проект уже инициализирован; повторный android init не нужен.

## Проверки

```powershell
npm run format:check
npm run typecheck
npm run build
npm run test:ui
npm run rust:fmt
npm run rust:check
npm run rust:lint
npm run rust:test
npm run licenses:check
```

build уже включает typecheck; отдельная команда удобна при работе над типами. tsconfig.logic.json проверяет выбранные JS-модули логики дополнительно к React/TypeScript.

Rust-тесты создают временные базы и синтетические секреты. Проверка Windows DPAPI требует обычного доступа пользователя к платформенной защите: ограниченная песочница может дать ошибку, которой нет при обычном запуске из терминала. Не заменяйте тест настоящим API-ключом. Два внешних smoke-теста обложек отмечены ignored и не выполняются обычным набором.

DOM-набор не запускает реальный Android. Дополнительные браузерные сценарии требуют отдельно установленного Playwright и Chromium. Playwright не входит в package.json; установите его в отдельном инструментальном окружении и задайте PLAYWRIGHT_PATH абсолютным путём к модулю либо сделайте модуль playwright доступным Node.js. Для экспорта графики аналогично используются SHARP_PATH или модуль sharp. Личные пути автора не нужны. Для npm run test:interaction-browser предварительно запустите Vite на 5180 и задайте UI_TEST_URL=http://127.0.0.1:5180. Отчёты пишутся в игнорируемую .artifacts.

Исторический checkpoint 0.4.23 останавливался в tests/mobile-ux.cjs при возврате расписания к текущей дате после resume. В снимке 0.4.46 полный UI-набор повторно прошёл; этот старый checkpoint не описывает текущий результат. Общий UI-набор завершается на первом сбое, оставшиеся сценарии при ошибке не считаются пройденными.

## Сборки

```powershell
npm run desktop:build
npm run tauri -- build --bundles nsis
npm run android:build -- --apk --target aarch64 --ci
```

Windows EXE находится в src-tauri/target/release/orvim.exe, NSIS — в подкаталоге bundle/nsis. APK — в src-tauri/gen/android/app/build/outputs/apk. CI загружает артефакты; это не публикация GitHub Release.

## Исходники и временные файлы

Рабочий UI: src/app/FullApp.tsx и src/features/workspace. Rust IPC: commands.rs; хранилище: storage/; Android: gen/android. Прежние MVP-модули сохранены для истории и совместимости. [Архитектура](ARCHITECTURE.md).

В Git входят исходные значки, звуки, лицензии и Android Kotlin/Gradle/resources. Игнорируются кеши, сборки, базы, ключи и .artifacts. Файлы внутри игнорируемых папок не должны быть обязательной зависимостью dev/build. Глобальные настройки Git/Java/SDK для обычной сборки менять не требуется.
