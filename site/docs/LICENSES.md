# Лицензии и соответствующие исходники

В публичном [выпуске Orvim 0.4.47](https://github.com/Adeptus-Amohus/orvim/releases/tag/v0.4.47) приложены полный комплект лицензий и инвентаризация зависимостей в `Orvim-0.4.47-Documentation.zip`. Лицензии также встроены в приложение: **Настройки → Данные → О приложении → Лицензии и уведомления**.

Собственный код Orvim распространяется под Apache-2.0; сторонние компоненты и шрифты сохраняют свои лицензии и уведомления. Полные LICENSE, NOTICE, THIRD_PARTY_LICENSES.txt и inventory.json находятся в документационном архиве. Сохранены уведомления Nunito, IBM Plex Sans, Libron, Android-компонентов, Jackson/FastDoubleParser/bigint и нативных библиотек.

Android использует неизменённый `com.android.tools:desugar_jdk_libs:2.1.5` под GPLv2 с Classpath Exception. [third-party-sources.zip](https://github.com/Adeptus-Amohus/orvim/releases/download/v0.4.47/third-party-sources.zip) содержит полный upstream source archive и build scripts для версии 2.1.5 на commit `ec1741f99ecc2c6595cd91e8f2c0f8298af03eed`, исходные LICENSE/уведомления, POM и контрольные суммы. Ссылка на исходный архив: https://codeload.github.com/google/desugar_jdk_libs/zip/ec1741f99ecc2c6595cd91e8f2c0f8298af03eed. Включённая версия подтверждена VERSION_JDK11.txt/CHANGELOG.md и точными Maven-артефактами; хеши приведены в комплекте.

Неизменённые MPL-компоненты Rust сохраняют точные имена, версии и ссылки crates.io в inventory.json. Их исходники доступны по `https://crates.io/api/v1/crates/NAME/VERSION/download` с именем и версией из инвентаризации. Эти ссылки не требуют доступа к приватному репозиторию Orvim.

Пользовательские записи, фотографии, вложения и импортированные обложки не получают лицензию приложения автоматически. WebView2 устанавливается как отдельный системный runtime Microsoft.
