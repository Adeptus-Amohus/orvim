export function installTrainingTranslations(ctx) {
  const labels = {
    "Обновить запланированные занятия": ["Update scheduled sessions"],
    "Обновить запланированные занятия…": ["Update scheduled sessions…"],
    "После сохранения обновить упражнения в запланированных занятиях": [
      "After saving, update exercises in scheduled sessions",
    ],
    "Какие занятия обновить": ["Which sessions to update"],
    "Эта серия": ["This series"],
    "С таким же названием": ["With the same name"],
    "Выбрать из всех занятий": ["Choose from all sessions"],
    "Обновить упражнения": ["Update exercises"],
    "Добавьте хотя бы одно упражнение в исходное занятие.": [
      "Add at least one exercise to the source session.",
    ],
    "Подходящих запланированных занятий нет. Измените период или выберите другой список.":
      [
        "No matching scheduled sessions. Change the period or choose another list.",
      ],
    "Заменятся все упражнения, их порядок, число подходов и плановые значения. Даты, время и длительность останутся прежними. Выполненные занятия, записи часов и занятия с введёнными результатами пропускаются.":
      [
        "All exercises, their order, sets and planned values will be replaced. Dates, times and duration stay the same. Completed sessions, watch imports and sessions with entered results are skipped.",
      ],
    "Статистика шагов": ["Step statistics"],
    "Статистика шагов за месяц и год": ["Monthly and yearly step statistics"],
    "Всего шагов": ["Total steps"],
    "Среднее за день с записью": ["Average per recorded day"],
    "Лучший день": ["Best day"],
    "Среднее считается по дням с записью. Дни без данных не считаются нулевыми.":
      ["Averages use recorded days. Missing days are not zero."],
    "Выберите корректный период.": ["Choose a valid period."],
    "Удалить несколько занятий": ["Delete multiple sessions"],
    "Удалить несколько занятий…": ["Delete multiple sessions…"],
    "Удалить занятия из расписания": ["Delete scheduled sessions"],
    "Какие занятия": ["Which sessions"],
    "Все занятия": ["All sessions"],
    "С даты": ["From date"],
    "По дату": ["Through date"],
    "Включить выполненные занятия": ["Include completed sessions"],
    "Выбрать все": ["Select all"],
    "Снять выделение": ["Clear selection"],
    "Удалить выбранные": ["Delete selected"],
    "В этом периоде подходящих занятий нет.": [
      "No matching sessions in this period.",
    ],
    "Шаги по дням": ["Steps by day"],
    "Нет записи": ["No entry"],
    "Отдых между подходами": ["Rest between sets"],
    "Таймер занятия": ["Session timer"],
    "План · мин за подход": ["Plan · min per set"],
    "Факт · мин за подход": ["Actual · min per set"],
    "мин/подход": ["min/set"],
    "Мои занятия": ["My sessions"],
    "+ Занятие": ["+ Session"],
    Занятие: ["Session"],
    Результаты: ["Results"],
    "Сохранить занятие": ["Save session"],
    "Изменить занятие": ["Edit session"],
    "Удалить занятие": ["Delete session"],
    "Занятие сохранено": ["Session saved"],
    "Сохранить в «Мои занятия»": ["Save to My sessions"],
    "Состав занятия сохраняется целиком: упражнения, план и подходы. Результаты в новое занятие не переносятся.":
      [
        "Save the full session: exercises, planned values and sets. Past results are not copied into new sessions.",
      ],
    "Сохраните своё занятие, чтобы повторно выбирать весь набор упражнений.": [
      "Save a session to reuse its full exercise list.",
    ],
    "Цели · общий прогресс": ["Goals · overall progress"],
    "Среднее по целям: ": ["Average across goals: "],
    "Достигнуто: ": ["Achieved: "],
    "Добавьте свою первую цель": ["Add your first goal"],
    "Занятие без упражнений": ["Session without exercises"],
    "Каждые N дней": ["Every N days"],
    "Раз в · дней": ["Every · days"],
    "До даты включительно": ["Until date, inclusive"],
    "Занятий в расписании: ": ["Sessions in schedule: "],
    "Выберите дату тренировки.": ["Choose a workout date."],
    "Выберите повтор тренировки.": ["Choose a workout repeat."],
    "Укажите интервал в днях и конечную дату.": [
      "Enter an interval in days and an end date.",
    ],
    "Повторы можно запланировать на год вперёд.": [
      "Repeats can be scheduled up to a year ahead.",
    ],
    "Можно сохранить до 100 занятий. Удалите лишнее занятие.": [
      "You can save up to 100 sessions. Remove an unused session.",
    ],
    "Занятие с таким названием уже есть. Измените его в «Мои занятия».": [
      "A session with this name already exists. Edit it in My sessions.",
    ],
    "В занятие можно добавить до 200 упражнений.": [
      "A session can contain up to 200 exercises.",
    ],
    "Слишком много записей. Уменьшите период повторов.": [
      "Too many records. Shorten the repeat period.",
    ],
    "Дата тренировок": ["Workout date"],
    "Дни тренировок": ["Workout days"],
    "Предыдущий день": ["Previous day"],
    "Следующий день": ["Next day"],
    тренировок: ["workouts"],
    "Этот подход": ["This set"],
    "Это занятие": ["This session"],
    "Уже выполнено · по желанию": ["Already completed · optional"],
    "Как считать прогресс": ["How to track progress"],
    "За один подход": ["Per set"],
    "За одно занятие": ["Per session"],
    "Всего за период": ["Total for the period"],
    "План · раз за подход": ["Plan · reps per set"],
    "Факт · раз за подход": ["Actual · reps per set"],
    "раз/подход": ["reps/set"],
    "Разные подходы? Укажите сумму повторов и 1 подход.": [
      "Different sets? Enter the total reps and 1 set.",
    ],
    "Складываем выполненные повторы за период: факт × подходы. Начальное значение добавляется один раз.":
      [
        "Completed repetitions are added for the period: actual reps × sets. The starting value is added once.",
      ],
    "Складываем записанные рабочие веса за период. Количество подходов не умножает килограммы.":
      [
        "Recorded working weights are added for the period. The number of sets does not multiply kilograms.",
      ],
    "Складываем результаты выполненных занятий за период. Начальное значение добавляется один раз.":
      [
        "Completed session results are added for the period. The starting value is added once.",
      ],
    "Цель упражнения": ["Exercise goal"],
    "Сейчас · по желанию": ["Current result · optional"],
    "Хочу достичь · раз": ["Target · reps"],
    "Хочу достичь · кг": ["Target · kg"],
    "Хочу достичь · км": ["Target · km"],
    "Хочу достичь · мин": ["Target · min"],
    "Хочу достичь · тренировок": ["Target · workouts"],
    "Например, 20": ["For example, 20"],
    "Введите число": ["Enter a number"],
    "В расписание": ["Schedule workout"],
    "План · раз": ["Plan · reps"],
    "План · кг": ["Plan · kg"],
    "План · км": ["Plan · km"],
    "План · мин": ["Plan · min"],
    "Факт · раз": ["Actual · reps"],
    "Факт · кг": ["Actual · kg"],
    "Факт · км": ["Actual · km"],
    "Факт · мин": ["Actual · min"],
    Факт: ["Actual"],
    "Сколько выполнить": ["How much to do"],
    "Добавьте упражнение и укажите свой план. Фактический результат записывается после выполнения.":
      [
        "Add an exercise and set your plan. Record the actual result after completion.",
      ],
    "Галочка отмечает выполнение по плану. Факт можно изменить; всё сохраняется автоматически.":
      [
        "Checking it off records the planned result. You can change the actual result; everything saves automatically.",
      ],
    Результат: ["Result"],
    "Обновляются автоматически по результатам упражнений": [
      "Update automatically from exercise results",
    ],
    "Все выполненные тренировки этого периода учитываются автоматически.": [
      "All completed workouts in this period are counted automatically.",
    ],
    "Результаты выбранного упражнения учитываются автоматически. Процент — последний результат относительно цели.":
      [
        "The selected exercise is tracked automatically. The percentage is the latest result relative to the target.",
      ],
    "Все выполненные тренировки выбранного периода.": [
      "All completed workouts in the selected period.",
    ],
    "Последний результат упражнения. Галочки и результаты в тренировках обновляют цель автоматически.":
      [
        "Latest exercise result. Workout checkmarks and results update the goal automatically.",
      ],
    "Результаты тренировки": ["Workout results"],
    "Вводи результат и ставь галочку. Всё сохраняется автоматически.": [
      "Enter a result and check it off. Everything saves automatically.",
    ],
    "Изменить план": ["Edit plan"],
    "Цель достигнута": ["Goal reached"],
    "План, упражнения и ваш прогресс": ["Plan, exercises and your progress"],
    Шаги: ["Steps"],
    "Данные часов": ["Watch data"],
    Упражнения: ["Exercises"],
    "+ Запланировать": ["+ Plan workout"],
    Цели: ["Goals"],
    "+ Цель": ["+ Goal"],
    "План и результаты": ["Plan and results"],
    Запланировано: ["Planned"],
    Выполнено: ["Completed"],
    "Мои упражнения": ["My exercises"],
    "+ Своё упражнение": ["+ Custom exercise"],
    "Найти упражнение": ["Find an exercise"],
    "Добавьте своё упражнение или выберите пример.": [
      "Add your exercise or choose an example.",
    ],
    Упражнение: ["Exercise"],
    "Что измеряем": ["What to measure"],
    "Повторы · раз": ["Repetitions · reps"],
    "Вес · кг": ["Weight · kg"],
    "Расстояние · км": ["Distance · km"],
    "Время · мин": ["Time · min"],
    "Описание · по желанию": ["Description · optional"],
    "Сохранить упражнение": ["Save exercise"],
    "Название тренировки": ["Workout name"],
    "Выберите упражнение": ["Choose an exercise"],
    Подходы: ["Sets"],
    "После тренировки": ["After the workout"],
    "Убрать упражнение": ["Remove exercise"],
    "Связанные цели": ["Linked goals"],
    "Один раз": ["Once"],
    "Еженедельно · месяц": ["Weekly · one month"],
    "Еженедельно · 3 месяца": ["Weekly · 3 months"],
    "Еженедельно · 6 месяцев": ["Weekly · 6 months"],
    "Еженедельно · год": ["Weekly · one year"],
    "Заметка · по желанию": ["Note · optional"],
    "Тренировка выполнена": ["Workout completed"],
    "В план и расписание": ["Add to plan and schedule"],
    "Сохранить результат": ["Save result"],
    "Выберите упражнения. Результаты можно вписать после тренировки.": [
      "Choose exercises. Record results after the workout.",
    ],
    "Создайте цель для этого упражнения или цель по количеству тренировок.": [
      "Create a goal for this exercise or a workout count goal.",
    ],
    "Цель тренировки": ["Workout goal"],
    "Название цели": ["Goal name"],
    "Тип цели": ["Goal type"],
    "Результат упражнения": ["Exercise result"],
    "Количество тренировок": ["Workout count"],
    "Начальный результат": ["Starting result"],
    "Хочу достичь": ["Target"],
    "С даты": ["From date"],
    "До даты · по желанию": ["Until date · optional"],
    "Связать с подходящими тренировками этого периода": [
      "Link matching workouts in this period",
    ],
    "Сохранить цель": ["Save goal"],
    "Каждая выполненная связанная тренировка добавляет 1. Связь выбирается при планировании.":
      ["Each completed linked workout adds 1. Choose the link when planning."],
    "Учитывается лучший записанный результат связанного упражнения. Выполненная тренировка без результата процент не меняет.":
      [
        "Uses the best recorded result of the linked exercise. A workout without a result does not change the percentage.",
      ],
    "Прогресс цели": ["Goal progress"],
    "Изменить цель": ["Edit goal"],
    История: ["History"],
    "Ручная запись": ["Manual entry"],
    "Выполненные тренировки, связанные с этой целью.": [
      "Completed workouts linked to this goal.",
    ],
    "Лучший результат из связанных тренировок и ручных записей.": [
      "Best result from linked workouts and manual entries.",
    ],
    "Результаты пока записываются вручную. Выберите упражнение в настройках цели.":
      [
        "Results are entered manually. Choose an exercise in the goal settings.",
      ],
    "Выберите цель: улучшить результат упражнения или заниматься регулярно.": [
      "Choose a goal: improve an exercise result or train regularly.",
    ],
    "Действия с тренировкой": ["Workout actions"],
    Повторить: ["Repeat"],
    "Связать с планом": ["Link to plan"],
    "Здесь появятся запланированные и выполненные тренировки.": [
      "Planned and completed workouts appear here.",
    ],
    "Связать запись часов с планом": ["Link watch session to plan"],
    "Запланированная тренировка в этот день": ["Planned workout on this day"],
    "Выберите тренировку": ["Choose a workout"],
    Связать: ["Link"],
    "Запись часов объединится с выбранной тренировкой. Упражнения и цели плана сохранятся.":
      [
        "The watch session will merge with the selected workout. Planned exercises and goals are kept.",
      ],
    "Шаги за день": ["Daily steps"],
    "Количество шагов": ["Step count"],
    "Ручная запись имеет приоритет над импортом за этот день.": [
      "Manual entry takes priority over import for this day.",
    ],
    "Вернуть автоматические данные": ["Restore automatic data"],
    "Добавить или подключить": ["Add or connect"],
    "шагов · изменить": ["steps · edit"],
    "Из Health Connect · телефон и часы учитываются без сложения дублей": [
      "From Health Connect · phone and watch totals are deduplicated",
    ],
    "Шаги появятся после подключения Health Connect или ручной записи.": [
      "Connect Health Connect or enter steps manually.",
    ],
    "Данные телефона и часов": ["Phone and watch data"],
    "Шаги → Тренировки": ["Steps → Training"],
    "Длительность сна → Сон": ["Sleep duration → Sleep"],
    "Тренировки → Тренировки": ["Workouts → Training"],
    Подключить: ["Connect"],
    Обновить: ["Refresh"],
    "Разрешения Android": ["Android permissions"],
    "Отключить импорт": ["Disable import"],
    "Телефон и часы": ["Phone and watch"],
    "Health Connect: шаги, сон и тренировки · Android": [
      "Health Connect: steps, sleep and workouts · Android",
    ],
    "Получаем данные…": ["Reading data…"],
    "Установить Health Connect": ["Install Health Connect"],
    "Разрешить выбранные данные": ["Allow selected data"],
    "Автоматический импорт включён": ["Automatic import is on"],
    "Автоматический импорт выключен": ["Automatic import is off"],
    "Orvim читает выбранные данные из Health Connect. Подключите к нему приложение часов. Импорт обновляется при открытии Orvim и раз в 5 минут, пока приложение открыто.":
      [
        "Orvim reads selected data from Health Connect. Connect your watch app to it. Import refreshes on opening Orvim and every 5 minutes while the app is open.",
      ],
    "Только чтение шагов, сна и тренировок. Без доступа к пульсу, геолокации и маршрутам. Отключение импорта сохраняет уже полученную историю.":
      [
        "Read-only steps, sleep and workouts. No heart rate, location or route access. Disabling import preserves existing history.",
      ],
  };
  for (const [ru, [en]] of Object.entries(labels)) {
    ctx.translations[ru] = en;
  }
}
