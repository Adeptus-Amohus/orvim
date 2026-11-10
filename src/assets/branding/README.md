# Керамический значок Orvim

## Лицензия и происхождение

Оригинальные SVG и генераторы входят в Apache-2.0 проекта; чужие референсы и пользовательские вложения не перелицензируются. Растровый исходник подготовлен с помощью imagegen; описание процесса и исходный запрос сохранены ниже. Это не заявление исключительных прав на внешний референс. Условия шрифтов и остальных ресурсов: [docs/LICENSES.md](../../../docs/LICENSES.md).

Текущее имя ресурса установщика — `orvim-launcher.ico`; Windows использует прозрачный фон. Описания старых плиток и имён с номером версии ниже фиксируют историю вариантов. Сам генератор: `scripts/export-windows-icon.mjs`.

## Файлы

- `ceramic-native.png` — прозрачный растровый исходник для значка приложения.
- `ceramic-windows.png` — объёмная керамика с латунными деталями на прозрачном фоне для ресурсов Windows (ICO и PNG). Использует тот же исходник, что и значок запуска Android.
- `ceramic-windows.svg` — прежний упрощённый вариант для сравнения; больше не используется генератором значков Windows.
- `icon-manifest.json` — конфигурация генерации объёмной керамики для Android; генерация ресурсов Windows выполняется отдельно.
- `android-foreground.svg` — неизменённый растровый исходник размещён внутри прозрачного холста с масштабом 75%; вместе с исходными отступами объект занимает около 57% ширины адаптивного слоя Android.
- `android-background.svg` — белый фон значка запуска Android.
- `ceramic-emblem.svg` — упрощённая векторная версия для просмотра и экспорта.
- `ceramic-{sun,pine,scarlet,winter}-{light,dark}.svg` — снимки векторного значка в восьми сочетаниях темы и режима.

В приложении SVG строится функцией `drawCeramicEmblem()` в `src/features/workspace/runtime.js` из общего модуля `ceramic-brand.js`. Это выбранный упрощённый вариант B: мягкие грани, тёмные отверстия с небольшой глубиной, тонкие блики без точек на вершинах. Лёгкие SVG-градиенты передают глазурь; растровые текстуры и фильтры не используются. Геометрия не меняется при выборе палитры, пользовательского цвета, светлого/тёмного режима и при смене системного режима. На ПК значок находится в боковой панели; на телефоне — в шапке. Значки запуска Android и Windows используют исходную объёмную керамику с латунными деталями. Знак внутри приложения остаётся упрощённым.

С версии 0.3.4 внутри приложения знак находится на белой плитке во всех режимах; палитра меняет оттенок поверхности. Windows ICO и PNG экспортируются командой `node scripts/export-windows-icon.mjs` из `ceramic-native.png`. Генератор не изменяет знак внутри приложения и favicon. Установщик обновляет значок существующих ярлыков, используя файл с номером версии. Уже установленный ярлык обновится после установки новой сборки.

В версии 0.3.5 фон Android-значка также белый: обновлены обычные и адаптивные значки, фоновые PNG и значение `ic_launcher_background`.

Отдельные векторные варианты экспортируются из той же геометрии:

```powershell
node scripts/export-ceramic-brand.mjs
```

Растровый эскиз B с восьмью сочетаниями находится в `.artifacts/ceramic-b-palettes-v3/palette-preview.png`. Реальные SVG реализации представлены в `Icon-preview.png` выпуска 0.3.2.

Перегенерация нативных значков из корня проекта:

```powershell
npm run tauri -- icon src/assets/branding/icon-manifest.json
```

Отступы адаптивного слоя заданы в `android-foreground.svg`: в [реализации генератора Tauri](https://github.com/tauri-apps/tauri/blob/dev/crates/tauri-cli/src/icon.rs) параметр `android_fg_scale` применяется к обычным значкам, а слой `ic_launcher_foreground.png` создаётся из самого файла переднего плана.

## Создание исходника

Растровый исходник создан встроенным инструментом imagegen по выбранному пользователем варианту B. Векторная версия реализована средствами SVG.

Запрос к imagegen:

Use case: precise-object-edit / background-extraction. Asset type: final transparent foreground artwork for the Life OS native app launcher icon. Input image: a board with concepts A B C D. Primary request: isolate and faithfully reproduce ONLY the ivory CERAMIC Roman dodecahedron from the TOP RIGHT tile B, as one single centered object on a genuinely transparent background. Keep its recognizable precise pentagonal face geometry, circular face holes, slight three-quarter camera angle, ivory ceramic material, subtle bevels, small champagne-metal vertex knobs, stable straight surfaces, balanced lighting and warm gentle reflection. Simplify any microscopic texture into smooth clean ceramic. No other concepts. No letters, text, rounded-square tile, background, floor, pedestal, external cast shadow, glow or wireframe. Soft contact shading only inside the object and circular holes. Square composition, object bounding width and height about 58 percent of the whole canvas, perfectly centered, generous transparent margin so Android launcher masks cannot clip it. The object should remain readable as an app icon. Preserve original B design and angle, do not redesign as a cube or an irregular polyhedron. Actual alpha transparency.

В версии 0.3.6 белая подложка убрана у Windows ресурсов и эмблемы в боковой панели. Векторная эмблема ПК учитывает светлый/тёмный режим. Android ресурсы и плитка в мобильной шапке остаются белыми.
