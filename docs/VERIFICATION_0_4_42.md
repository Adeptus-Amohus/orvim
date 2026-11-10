# Проверка Orvim 0.4.42

7 ноября 2026. Локальный Android ARM64 APK.

- TypeScript и production build прошли; Gradle release и release lint завершились успешно.
- `node --test tests/widgets.test.mjs`: 5 тестов успешно, включая передачу темы, личный день и ограничения данных проекции.
- `compactFoodAndThoughtFitTwoRows`: успешно, 4,581 с. Эмулятор Android 16 API 36, read-only AVD, отдельный пользователь 10. Проверены `targetCellHeight == 1` у питания и мысли, запрет растягивания питания, отсутствие обрезания названия, калорий, цели, прогресса и кнопки добавления. Оба виджета размещены друг под другом в контейнере 156 × 144 dp: по 72 dp на строку.
- Проверены метаданные уже упакованного release APK: `xml/widget_food` содержит targetCellWidth=2, targetCellHeight=1, resizeMode=0, minHeight=56 dp. Путь XML внутри APK сокращён Android resource optimizer; исходное имя сохраняется в таблице ресурсов.
- Проверены подпись, прежний сертификат, ARM64, версия 0.4.42 / 4042, 16 KB ZIP alignment, совпадение native library и встроенного frontend с текущей сборкой.

Материалы: `.artifacts/widgets-qa/native-0442.txt`, `compact-0442-build.log`, `compact-final-0442/food-and-thought-one-row-each.png`, `food-provider-0442.txt`, `release-0442-final.txt`; `.artifacts/build-0442-final.log` и `releases/0.4.42/build-info.json`.

Снимок сделан в тестовом AppWidgetHost внутри плавающего окна, поэтому белая подложка окна вокруг двух виджетов не является областью питания. При проверке границ использовались отдельные виджеты и их дочерние элементы.

Физический телефон и его лаунчер не проверены. Размер существующих экземпляров хранится в лаунчере: после обновления нужно удалить старый виджет питания и добавить его заново. Windows в этой итерации не пересобирался. Изменение не затрагивает данные пользователя и работу редакторов.

Итоговый подписанный APK установлен в эмулятор и прошёл все 6 проверок загрузки трёх виджетов в framework и AppCompat host: OK: 6 packaged widget hosts.
