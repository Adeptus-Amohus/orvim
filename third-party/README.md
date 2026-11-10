# Сторонние лицензии

LICENSE проекта не заменяет лицензии зависимостей. Полные тексты собраны в [THIRD_PARTY_LICENSES.txt](../THIRD_PARTY_LICENSES.txt); [inventory.json](inventory.json) содержит имена, версии, объявленные лицензии, источники и входные notice-файлы. Описание условий: [docs/LICENSES.md](../docs/LICENSES.md).

## Генерация

После установки Node/Rust и получения зависимостей из закреплённых lockfiles:

```powershell
npm ci
cargo fetch --locked --manifest-path src-tauri/Cargo.toml
npm run licenses:generate
npm run licenses:check
```

Для полностью заполненного Cargo-кеша можно задать CARGO_NET_OFFLINE=true только в текущем терминале. Генератор не читает ключи/API и не использует .artifacts. Он проверяет версии установленных npm-пакетов по lockfile и останавливается при отсутствии лицензии, fallback notice или прямого Android-компонента.

Обновляются THIRD_PARTY_LICENSES.txt, inventory.json и публичные копии LICENSE.txt, NOTICE.txt, third-party-licenses.txt. Режим --check сравнивает результат в памяти, ничего не переписывая. Копии public входят в Vite build и доступны из интерфейса.

## Android

Для сборщика notices нужен Python 3.10+ с модулями стандартной библиотеки. Если Windows-команда python указывает только на неработающий Store alias, используйте путь к реально установленному интерпретатору; устанавливать его глобально скрипт не пытается.

После изменения Gradle-зависимостей получите их штатной Android-сборкой с JDK 21, затем соберите notices из публичного Maven-кеша:

```powershell
$gradleCache = Join-Path $env:USERPROFILE '.gradle\caches\modules-2\files-2.1'
python scripts/collect-android-notices.py $gradleCache
npm run licenses:generate
npm run licenses:check
```

Если задан GRADLE_USER_HOME, используйте его caches/modules-2/files-2.1. Сборщик включает AndroidX, Kotlin, Material, desugaring и семейства runtime-зависимостей, включая Guava, JSpecify, protobuf и аннотации. Он сохраняет POM licenses/developers/scm и встроенные LICENSE/NOTICE/COPYING из JAR/AAR.

Кеш может содержать несколько старых версий. Перед распространением сверяйте его покрытие с фактическим releaseRuntimeClasspath:

```powershell
Push-Location src-tauri/gen/android
try { .\gradlew.bat :app:dependencies --configuration releaseRuntimeClasspath --console=plain }
finally { Pop-Location }
```

Это не обещание, что любая новая Maven-группа автоматически покрыта фильтром: добавление новой группы требует проверки и обновления сборщика. npm run licenses:check проверяет прямые координаты из build.gradle.kts, а не весь транзитивный Gradle-граф.

## Область покрытия

Для desugar_jdk_libs дополнительно включён полный GPLv2 + Classpath Exception в notices/desugar_jdk_libs-2.1.5.txt. При смене версии генератор потребует соответствующий новый файл. Предоставление соответствующих исходников перед распространением проверяется отдельно: [лицензии](../docs/LICENSES.md#android-desugar_jdk_libs).

- npm: установленные пакеты из lockfile, включая dev tools и доступные этому хосту optional-пакеты. Linux/Windows optional bindings могут различаться; выпускающий хост заново генерирует и проверяет свой комплект.
- Cargo: объединение зависимостей Windows MSVC x64 и Android ARM64 по cargo metadata, включая build-зависимости. Это может быть шире содержимого конечного бинарника.
- Android: сохранённые notices Maven-кеша и проверка прямых runtime/desugaring-координат. Точный runtime-граф требует отдельной сверки выше.
- Libron: дополнительно включены оригинальные copyright и OFL; шрифты Fontsource входят через npm.

Это удобная инвентаризация, не SPDX-SBOM и не автоматическое юридическое заключение. Внешние обложки и пользовательские файлы не входят в лицензии приложения.

## Отсутствующие тексты

В notices хранятся версии текстов, которых нет в распакованном пакете. scripts/fetch-license-notices.mjs получает их из точного upstream commit/версии через публичную сеть; запускайте его только при обновлении зависимостей и проверяйте происхождение нового текста. Не заменяйте отсутствующую лицензию предположением MIT. Сохраняйте upstream copyright и whitespace оригинальных юридических текстов.
