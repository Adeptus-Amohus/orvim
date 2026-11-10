import { englishLabels, translateAdditionalLabel } from "./english-labels.js";
import { rememberInterfaceLanguage } from "./ui-language.js";
import { installUpgrades } from "./upgrades.js";
import { installUsability } from "./usability.js";
import { installDatabase, validateDatabaseExtras } from "./database.js";
import { collectionSettings } from "./collection-settings.js";
import { ceramicColors, ceramicMarkup } from "./ceramic-brand.js";
import { dateFormat, numberFormat } from "./formatters.js";

import { installTraining } from "./training.js";
import { validateTrainingData } from "./training-model.js";
import { installRoundedControls } from "./rounded-controls.js";
import { homeItems, taskDay, personalProject } from "./changes.js";
import { setCompletionIcon } from "./completion-icon.js";
import { installScrollChaining } from "./scroll-chain.js";
import { installExperience } from "./experience.js";
import { wellbeingDue, nextWellbeingPeriod } from "./wellbeing.js";
import { validateExperienceData } from "./experience-model.js";
import {
  lifeTrackingDefaults,
  lifeSettings,
  personalDay,
  lifeRecordDay,
  stampLifeRecord,
  illnessOnDay,
  workoutAdherence,
  validateLifeTracking,
} from "./life-tracking-model.js";
import { installRefinements } from "./refinements.js";
import { installLifeTracking } from "./life-tracking.js";
import {
  createScreenHistory,
  isTextEntry,
  installScopedSelection,
  isBackSwipe,
  installButtonHints,
} from "./interactions.js";
export function mountWorkspace(root, initialDocument, services) {
  root.dataset.platform = services.mobile ? "mobile" : "desktop";
  let disposed = false,
    resetting = false;
  const removers = [],
    timers = new Set(),
    intervals = new Set(),
    frames = new Set();
  function listen(target, type, callback, options) {
    // A detached scrolling element may still deliver a queued scroll event.
    // Never run its callbacks after this workspace has been disposed.
    const guarded = (event) => {
      if (!disposed) callback(event);
    };
    target.addEventListener(type, guarded, options);
    // Replaced rows must not be retained for the whole application session.
    if (!(target instanceof Node) || target === root || target === document)
      removers.push(() => target.removeEventListener(type, guarded, options));
  }
  const setTimeout = (fn, delay) => {
      const id = window.setTimeout(() => {
        timers.delete(id);
        if (!disposed) fn();
      }, delay);
      timers.add(id);
      return id;
    },
    clearTimeout = (id) => {
      timers.delete(id);
      window.clearTimeout(id);
    },
    setInterval = (fn, delay) => {
      const id = window.setInterval(() => {
        if (!disposed) fn();
      }, delay);
      intervals.add(id);
      return id;
    },
    clearInterval = (id) => {
      intervals.delete(id);
      window.clearInterval(id);
    },
    requestAnimationFrame = (fn) => {
      const id = window.requestAnimationFrame((time) => {
        frames.delete(id);
        if (!disposed) fn(time);
      });
      frames.add(id);
      return id;
    },
    cancelAnimationFrame = (id) => {
      frames.delete(id);
      window.cancelAnimationFrame(id);
    };

  const $ = (selector) => root.querySelector(selector);
  const all = (selector) => [...root.querySelectorAll(selector)];
  const translations = {
    Главная: "Home",
    Проекты: "Projects",
    Жизнь: "Life",
    Победы: "Wins",
    Архив: "Archive",
    Настройки: "Settings",
    Время: "Time",
    Самочувствие: "Wellbeing",
    Расписание: "Schedule",
    Задачи: "Tasks",
    Неделя: "Week",
    Месяц: "Month",
    День: "Day",
    Список: "List",
    Проект: "Project",
    "Дела проекта": "Project tasks",
    "В работе": "In progress",
    Завершено: "Completed",
    Тренировки: "Training",
    Сон: "Sleep",
    Питание: "Food",
    Настроение: "Mood",
    Энергия: "Energy",
    Стресс: "Stress",
    Коллекции: "Collections",
    Фильмы: "Films",
    Книги: "Books",
    Аниме: "Anime",
    "+ Событие": "+ Event",
    "+ Добавить задачу": "+ Add task",
    "+ Проект": "+ Project",
    "+ Создать": "+ Create",
    "+ Запись": "+ Entry",
    "Свой цвет": "Custom color",
    "Внешний вид": "Appearance",
    Цвет: "Color",
    "Цвет системы": "System color",
    Язык: "Language",
    Шрифт: "Font",
    Системный: "System",
    Светлый: "Light",
    Тёмный: "Dark",
    Мягкий: "Soft",
    Строгий: "Strict",
    Солнце: "Sun",
    Хвоя: "Pine",
    Алый: "Scarlet",
    "Зимний синий": "Winter blue",
    "RU · система": "RU · system",
    "EN · system": "EN · system",
    "Самочувствие за месяц": "Monthly wellbeing",
    "Карта сна": "Sleep map",
    "Записать сон": "Log sleep",
    "+ Записать сон": "+ Log sleep",
    "За сегодняшнее утро": "This morning",
    "День пробуждения": "Wake-up date",
    "Примерно спал(а)": "About how long did you sleep?",
    "Качество и заметка · по желанию": "Quality and note · optional",
    "Запись за этот день уже есть — её можно изменить.":
      "An entry exists for this date and can be edited.",
    "Сон за этот день ещё не записан. Укажи примерную длительность.":
      "No sleep recorded for this date. Enter an approximate duration.",
    "Сон сохранён.": "Sleep saved.",
    "Добавить еду вручную": "Add food manually",
    "Записать через ИИ": "Log with AI",
    "Добавить еду": "Add food",
    "Дата записи": "Entry date",
    Запланировать: "Plan workout",
    "Сохранённые победы": "Saved wins",
    "Маленькая победа": "Small win",
    "Добавить контекст": "Add context",
    "Что могло повлиять на самочувствие?":
      "What may have affected how you felt?",
    "Что нужно сделать?": "What needs doing?",
    "Название задачи": "Task name",
    "Где сохранить": "Save to",
    "В проект": "To project",
    "Выберите проект": "Choose a project",
    Дата: "Date",
    "Время · по желанию": "Time · optional",
    "Проект или область": "Project or area",
    Личное: "Personal",
    Отмена: "Cancel",
    Сохранить: "Save",
    Отметить: "Check in",
    Изменить: "Edit",
    Удалить: "Delete",
    "Добавить задачу": "Add task",
    "Изменить задачу": "Edit task",
    "Добавить в расписание": "Add to schedule",
    "Изменить событие": "Edit event",
    Название: "Title",
    Начало: "Start",
    Конец: "End",
    "Цвет события": "Event color",
    Нейтральный: "Neutral",
    "Новый проект": "New project",
    "Изменить проект": "Edit project",
    Цель: "Goal",
    Создать: "Create",
    "Новая коллекция": "New collection",
    "Добавить запись": "Add entry",
    "Изменить запись": "Edit entry",
    Оценка: "Rating",
    "Без оценки": "No rating",
    "Краткая рецензия": "Short review",
    "Среднее за месяц": "Monthly average",
    "Относительно цели": "Compared with goal",
    "Цель · ккал/день": "Goal · kcal/day",
    "Что ели": "Food or meal",
    Калории: "Calories",
    "Белки, г": "Protein, g",
    "Жиры, г": "Fat, g",
    "Углеводы, г": "Carbs, g",
    Добавить: "Add",
    Часов: "Hours",
    Качество: "Quality",
    "Не указывать": "Skip",
    "Заметка · по желанию": "Note · optional",
    "Сохранить сон": "Save sleep",
    Тренировка: "Workout",
    Направление: "Focus",
    Ноги: "Legs",
    Руки: "Arms",
    Плечи: "Shoulders",
    Спина: "Back",
    Кардио: "Cardio",
    Другое: "Other",
    "Длительность · мин": "Duration · min",
    "Результат · по желанию": "Result · optional",
    "В план и расписание": "Add to plan and schedule",
    "Сохранить изменения": "Save changes",
    "На эту дату задач без времени нет.": "No unscheduled tasks for this date.",
    "Пока нет дел. Добавьте первый шаг проекта.":
      "No tasks yet. Add the first step.",
    "Пока нет сохранённых побед. Завершите задачу в проекте и отдельно отметьте её как победу.":
      "No saved wins yet. Complete a project task and mark it as a win.",
    "Завершённую задачу можно отдельно отметить как победу в проекте.":
      "You can mark a completed project task as a win.",
    "Пока нет записей. Добавьте фильм, книгу или любой другой объект коллекции.":
      "No entries yet. Add a film, book, or anything you want to keep.",
    "Запланируйте тренировку: она появится здесь и в расписании.":
      "Plan a workout to see it here and in your schedule.",
    "За этот день записей нет.": "No entries for this day.",
    "Запишите первую ночь, чтобы увидеть карту месяца.":
      "Log your first night to see the month map.",
    "Отметок самочувствия за этот день нет.":
      "No wellbeing entries for this day.",
    "Нет отметок": "No check-ins",
    "Нет записей": "No entries",
    "Цель не задана": "No goal set",
    "Нет записей за день": "No entries for this day",
    "БЖУ появятся после записи еды.": "Macros will appear after you log food.",
    Упражнения: "Exercise",
    "Питание и сон": "Food and sleep",
    "Событие удалено": "Event deleted",
    "Задача удалена": "Task deleted",
    Отменить: "Undo",
    "Другая победа": "Another win",
  };
  Object.assign(translations, englishLabels);
  Object.assign(translations, {
    сегодня: "today",
    "без времени": "unscheduled",
    "нет записи": "no entry",
    "Выполненную задачу или тренировку можно отдельно отметить как победу.":
      "You can mark a completed task or workout as a win.",
    "Пока нет сохранённых побед. Отметьте выполненную задачу или тренировку как победу.":
      "No saved wins yet. Mark a completed task or workout as a win.",
    "В победах": "In wins",
    "+ В победы": "+ Add to wins",
    "по времени": "timed",
    Результат: "Result",
    "Нет сил": "Low energy",
    Повтор: "Repeat",
    "Один раз": "Once",
    "Каждую неделю · 4 недели": "Weekly · 4 weeks",
    "Каждую неделю · 8 недель": "Weekly · 8 weeks",
    "Отменить изменение": "Cancel editing",
  });
  Object.assign(translations, {
    Этапы: "Stages",
    План: "Planned",
    Готово: "Done",
    "Нет дел": "No tasks",
    "Пока нет завершённых дел": "No completed tasks yet",
    "Последняя ночь": "Latest night",
    Сегодня: "Today",
    "План на неделю": "Weekly plan",
    Отметиться: "Check in",
    "‹ Жизнь": "‹ Life",
    Обложка: "Cover",
    "Убрать обложку": "Remove cover",
    "Добавить обложку": "Add cover",
    "Заменить обложку": "Replace cover",
    "Выбрать обложку": "Choose cover",
    "Необязательно · JPEG или PNG до 10 МБ":
      "Optional · JPEG or PNG up to 10 MB",
    "Добавить в победы": "Add to wins",
    "Убрать из побед": "Remove from wins",
    "Выберите JPEG или PNG до 10 МБ.": "Choose a JPEG or PNG up to 10 MB.",
    "Не удалось открыть изображение.": "Could not open the image.",
    "Изменить самочувствие": "Edit wellbeing",
    "Отметить самочувствие": "Log wellbeing",
  });
  const translatedNodes = new WeakMap(),
    translatedAttributes = new WeakMap();
  let reverseTranslations = null,
    translationObserver = null;
  Object.assign(translations, {
    Восстановление: "Recovery",
    "Отдых и паузы сегодня": "Rest and breaks today",
    "Время для себя": "Time for yourself",
    Занятие: "Activity",
    Отдых: "Rest",
    Прогулка: "Walk",
    Медитация: "Meditation",
    "Пауза без экрана": "Screen break",
    Минут: "Minutes",
    Заметка: "Note",
    "Что помогло восстановиться?": "What helped you recover?",
    "Запишите отдых, прогулку или паузу, чтобы сопоставить их с самочувствием.":
      "Log rest, a walk or a break to compare with your wellbeing.",
    Вода: "Water",
    "За выбранный день": "Selected day",
    "+ 250 мл": "+ 250 ml",
    "+ 500 мл": "+ 500 ml",
    "Свой объём, мл": "Custom amount, ml",
    "Личная цель, мл в день": "Personal daily goal, ml",
    "Ваша цель на день достигнута": "Your daily goal is reached",
    "Мои цели": "My goals",
    "Задайте первый ориентир: повторы, вес, расстояние или время.":
      "Set your first goal: repetitions, weight, distance or time.",
    Сейчас: "Current",
    "Хочу достичь": "Target",
    Единица: "Unit",
    "Добавить цель": "Add goal",
    "Цель должна быть больше начального результата.":
      "The target must exceed the initial result.",
    Записать: "Log",
    "История результатов": "Result history",
    "Цель достигнута": "Goal reached",
    "Результат без изменений": "Result unchanged",
    "Пересекающиеся события": "Overlapping events",
    "Перетащите за ручку": "Drag using the handle",
    Закрыть: "Close",
    раз: "reps",
    кг: "kg",
    км: "km",
    мин: "min",
  });
  function effectiveLanguage() {
    return languageMode === "system"
      ? ["en"].includes(navigator.language?.toLowerCase().split("-")[0])
        ? navigator.language.toLowerCase().split("-")[0]
        : "ru"
      : languageMode;
  }
  Object.assign(translations, {
    "Как вы сейчас?": "How are you now?",
    "Открыть статистику самочувствия": "Open wellbeing statistics",
    "Объём и цель воды": "Water amount and goal",
    "Закрыть воду": "Close water",
    "Все цели тренировок": "All training goals",
    "Цели тренировок": "Training goals",
    "Закрыть цели": "Close goals",
    "+ Добавить цель": "+ Add goal",
    "Новая цель": "New goal",
    "Изменить цель": "Edit goal",
    "Начальный результат": "Initial result",
    Подтягивания: "Pull-ups",
    "Открыть все цели": "Open all goals",
  });
  Object.assign(translations, {
    "Удалить проект": "Delete project",
    "Удалить проект?": "Delete project?",
    "Проект удалён": "Project deleted",
    "Задачи и события сохранятся в «Личное». Удаление можно отменить.":
      "Tasks and events will move to Personal. You can undo deletion.",
  });
  function displayLocale() {
    return effectiveLanguage();
  }
  function dateFormatter(options) {
    return dateFormat(displayLocale(), options);
  }
  function translateLabel(value) {
    if (translations[value]) return translations[value];
    const rules = [
      [/^Готово (\d+) из (\d+)$/, "Done $1 of $2"],
      [/^Энергия · (.+)$/, "Energy · $1"],
      [/^Стресс · (.+)$/, "Stress · $1"],
      [/^(\d+) отметок$/, "$1 check-ins"],
      [
        /^(\d+(?:\.\d+)?) ч в среднем за (\d+) ночей$/,
        "$1 h average over $2 nights",
      ],
      [/^(\d+) ккал за (\d+) записанных дней$/, "$1 kcal over $2 logged days"],
      [/^На (\d+) ккал выше цели$/, "$1 kcal above goal"],
      [/^На (\d+) ккал ниже цели$/, "$1 kcal below goal"],
      [/^выполнено из (\d+) запланированных$/, "completed of $1 planned"],
      [/^Нед\. (\d+)$/, "Wk $1"],
      [/^ккал за день$/, "kcal today"],
      [/^настроение (\d+(?:\.\d+)?) из 5$/, "mood $1 of 5"],
      [
        /^Б (\d+(?:\.\d+)?) г · Ж (\d+(?:\.\d+)?) г · У (\d+(?:\.\d+)?) г$/,
        "P $1 g · F $2 g · C $3 g",
      ],
      [
        /^Б (\d+(?:\.\d+)?) · Ж (\d+(?:\.\d+)?) · У (\d+(?:\.\d+)?) г$/,
        "P $1 · F $2 · C $3 g",
      ],
    ];
    for (const [pattern, replacement] of rules)
      if (pattern.test(value)) return value.replace(pattern, replacement);
    return translateAdditionalLabel(value, translateLabel);
  }
  function applyLanguage() {
    const language = effectiveLanguage();
    rememberInterfaceLanguage(languageMode);
    const system = $("#language-select option[value=system]");
    const systemLanguage = navigator.language?.toLowerCase().split("-")[0];
    const systemLabel =
      (["en"].includes(systemLanguage) ? systemLanguage : "ru").toUpperCase() +
      " · система";
    if (system && !translatedNodes.has(system.firstChild))
      system.textContent = systemLabel;
    // New Russian UI is already rendered in Russian. Only switching back from
    // English needs a complete reverse pass through existing nodes.
    if (language === "ru" && root.lang === "ru") return;
    const reverse =
      reverseTranslations ||
      new Map(Object.entries(translations).map(([ru, en]) => [en, ru]));
    // Installers register their labels synchronously before workspaceReady.
    if (workspaceReady) reverseTranslations = reverse;

    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    let node;
    while ((node = walker.nextNode())) {
      const parent = node.parentElement;
      if (
        !parent ||
        parent.closest(
          "script,style,[data-user-content],.task-title,.project-option-name,#project-name,#project-description,.archive-item-copy,.archive-card-title,#archive-view-title,#archive-view-review,.wins-item,.project-item-name",
        )
      )
        continue;
      const previous = translatedNodes.get(node),
        current = node.nodeValue;
      const raw =
        previous && current === previous.rendered ? previous.source : current;
      const source = reverse.get(raw.trim()) || raw;
      const translated = translateLabel(source.trim());
      const target =
        language === "ru"
          ? source
          : translated
            ? raw.replace(raw.trim(), translated)
            : source;
      if (parent.tagName === "OPTION" && !parent.hasAttribute("value"))
        parent.value = source.trim();
      if (current !== target) node.nodeValue = target;
      translatedNodes.set(node, { source, rendered: target });
    }
    for (const element of all(
      "[aria-label],[placeholder],[data-tooltip],[title]",
    )) {
      // The picker already combines a localized label with a user-owned value.
      // Translating it again makes the two observers rewrite it every frame.
      if (element.classList.contains("control-trigger")) continue;
      let originals = translatedAttributes.get(element);
      if (!originals) {
        originals = {};
        translatedAttributes.set(element, originals);
      }
      for (const attribute of [
        "aria-label",
        "placeholder",
        "data-tooltip",
        "title",
      ]) {
        if (!element.hasAttribute(attribute)) continue;
        const current = element.getAttribute(attribute),
          previous = originals[attribute];
        const raw =
          previous && current === previous.rendered ? previous.source : current;
        const source = reverse.get(raw) || raw,
          translated = translateLabel(source);
        const target = language === "ru" ? source : translated || source;
        if (current !== target) element.setAttribute(attribute, target);
        originals[attribute] = { source, rendered: target };
      }
    }
    if (root.lang !== language) root.lang = language;
    // A complete pass covered pending changes, including our own translations.
    translationObserver?.takeRecords();
  }
  function dateKey(date) {
    return [
      date.getFullYear(),
      String(date.getMonth() + 1).padStart(2, "0"),
      String(date.getDate()).padStart(2, "0"),
    ].join("-");
  }
  function parseDate(key) {
    const [year, month, day] = key.split("-").map(Number);
    return new Date(year, month - 1, day);
  }
  function shiftDate(key, days) {
    const date = parseDate(key);
    date.setDate(date.getDate() + days);
    return dateKey(date);
  }
  function startOfWeek(key) {
    const date = parseDate(key);
    date.setDate(date.getDate() - ((date.getDay() + 6) % 7));
    return dateKey(date);
  }
  function shiftMonth(key, amount) {
    const date = parseDate(key),
      day = date.getDate();
    date.setDate(1);
    date.setMonth(date.getMonth() + amount);
    date.setDate(
      Math.min(
        day,
        new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate(),
      ),
    );
    return dateKey(date);
  }
  let todayKey = dateKey(new Date());
  let selectedDate = todayKey;
  let activeDialog = null,
    dialogOpener = null,
    destination = "today",
    range = "six",
    windowStart = centeredStart(),
    calendarBaseDate = selectedDate,
    calendarDayCount = 1,
    manualWindow = false,
    eventTone = "sun",
    lastCheckin = null,
    nextId = 15,
    editingEvent = null,
    editingTask = null,
    schedulingTask = null,
    editingCheckin = false,
    editingProject = null,
    editingCollection = null,
    editingArchiveItem = null,
    editingWorkoutId = null,
    openTaskMenu = null,
    undoState = null,
    lastStateKey = "",
    activePage = "home",
    selectedProjectId = 3,
    lifeTab = "mood",
    selectedLifeDay = todayKey,
    selectedArchiveCategory = "Фильмы",
    foodTarget = 0,
    customColor = "#8c6ad8",
    languageMode = "system",
    fontMode = "system";
  let upgrades = null,
    training = null,
    usability = null,
    database = null,
    experience = null,
    lifeTracking = null,
    calendarPaintKey = "";
  const extraState = {
    thoughts: [],
    financeLogs: [],
    exercises: [],
    stepLogs: [],
    weightLogs: [],
    illnessLogs: [],
    nutrientLogs: [],
    lifePreferences: lifeTrackingDefaults(),
    calendarDeleted: [],
    projectView: "board",
    homeView: "tasks",
    financeCurrency: "KZT",
    financeCategories: [],
    uiPreferences: {
      lifeOrder: ["sleep", "food", "finances", "training"],
      lifeHidden: [],
      collapseDone: true,
    },
    notificationSettings: {
      enabled: true,
      wellbeingEnabled: true,
      wellbeingCount: 3,
      timerSound: true,
      scheduleEnabled: true,
      soundEnabled: true,
      leadMinutes: 5,
      anchor: Date.now(),
    },
    connectionSettings: {
      aiProvider: "openai",
      aiModel: "",
      notionSourceId: "",
      googleCalendarId: "primary",
      jsonEndpoint: "",
    },
  };
  const checkins = [],
    sleepLogs = [],
    foodLogs = [],
    workouts = [],
    archiveItems = [],
    recoveryLogs = [],
    waterLogs = [],
    trainingGoals = [],
    savedMeals = [],
    taskTemplates = [];
  let selectedCaptureTemplate = null,
    pendingBackup = null,
    backupUndo = null,
    editingMealTemplate = null;
  let waterTarget = 2000,
    checkinFromLife = false,
    persistTimer = 0,
    persistRevision = 0,
    editingCheckinEntry = null,
    editingGoal = null,
    checkinExpiryTimer = null;
  let lifeDetailOpen = false,
    viewingArchiveItem = null,
    archiveDraftCover = null,
    archiveUploadToken = 0;
  const screenHistory = createScreenHistory(),
    backLayers = [];
  let workspaceReady = false,
    restoringScreen = false,
    userInteracted = false;
  listen(
    root,
    "pointerdown",
    () => {
      userInteracted = true;
    },
    { passive: true },
  );
  listen(root, "keydown", () => {
    userInteracted = true;
  });
  const screenState = () => ({
    page: activePage,
    detail: activePage === "life" && lifeDetailOpen,
    tab: activePage === "life" && lifeDetailOpen ? lifeTab : "",
  });
  function recordScreen() {
    if (workspaceReady && !restoringScreen) screenHistory.visit(screenState());
  }
  function registerBackLayer(isOpen, close) {
    const layer = { isOpen, close };
    backLayers.push(layer);
    return () => {
      const index = backLayers.indexOf(layer);
      if (index >= 0) backLayers.splice(index, 1);
    };
  }
  function goBack() {
    for (const layer of [...backLayers].reverse()) {
      if (layer.isOpen()) {
        layer.close();
        return true;
      }
    }
    const opened = [...root.querySelectorAll("details[open]")]
      .reverse()
      .find(
        (node) =>
          !node.closest("[hidden],[inert]") &&
          node.contains(document.activeElement),
      );
    if (opened && !isTextEntry(document.activeElement)) {
      opened.open = false;
      opened.querySelector("summary")?.focus({ preventScroll: true });
      return true;
    }
    if (activeDialog) {
      closeDialog();
      return true;
    }
    if (openTaskMenu) {
      closeTaskMenu(true);
      return true;
    }
    let previous = screenHistory.back();
    if (!previous && activePage === "life" && lifeDetailOpen)
      previous = { page: "life", detail: false, tab: "" };
    if (!previous && activePage !== "home")
      previous = { page: "home", detail: false, tab: "" };
    if (!previous) return false;
    restoringScreen = true;
    try {
      lifeDetailOpen = Boolean(previous.detail);
      if (previous.tab) lifeTab = previous.tab;
      showPage(previous.page);
    } finally {
      restoringScreen = false;
      screenHistory.replace(screenState());
    }
    return true;
  }
  const archiveCovers = new Map();
  const archiveCategories = ["Фильмы", "Книги", "Аниме"];
  const projects = [],
    tasks = [],
    events = [];
  function centeredStart() {
    const now = new Date();
    return (
      Math.round(
        Math.max(
          0,
          Math.min(23.9, now.getHours() + now.getMinutes() / 60 - 3),
        ) * 10,
      ) / 10
    );
  }
  function restoreState(state) {
    if (
      !state ||
      ![
        4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22,
        23, 24, 25, 26, 27, 28, 29, 30, 31, 32,
      ].includes(state.version)
    )
      throw Error(
        "Неподдерживаемый формат данных. Записи не изменены. Откройте более новую версию Orvim или восстановите копию.",
      );
    for (const key of [
      "thoughts",
      "financeLogs",
      "exercises",
      "stepLogs",
      "weightLogs",
      "illnessLogs",
      "nutrientLogs",
      "calendarDeleted",
    ])
      extraState[key].splice(
        0,
        extraState[key].length,
        ...(Array.isArray(state[key]) ? state[key] : []),
      );
    extraState.lifePreferences = lifeSettings(state);
    for (const key of ["projectView", "homeView", "financeCurrency"])
      if (typeof state[key] === "string") extraState[key] = state[key];
    extraState.financeCategories = Array.isArray(state.financeCategories)
      ? state.financeCategories
          .filter(
            (item) =>
              item &&
              typeof item.name === "string" &&
              item.name.trim() &&
              /^#[\da-f]{6}$/i.test(item.color),
          )
          .slice(0, 1000)
      : [];
    for (const key of [
      "notificationSettings",
      "connectionSettings",
      "uiPreferences",
    ])
      if (
        state[key] &&
        typeof state[key] === "object" &&
        !Array.isArray(state[key])
      )
        extraState[key] = {
          ...extraState[key],
          ...structuredClone(state[key]),
        };
    for (const key of ["lifeOrder", "lifeHidden"])
      if (!Array.isArray(extraState.uiPreferences[key]))
        extraState.uiPreferences[key] = [];
    // An old backup must be migrated even when the current session already uses the new ledger.
    extraState.uiPreferences.financeLedgerVersion =
      state.uiPreferences?.financeLedgerVersion === 1 ? 1 : 0;
    for (const key of [
      "financeAccounts",
      "financeBudgets",
      "financeTemplates",
      "workoutTemplates",
    ])
      if (!Array.isArray(state.uiPreferences?.[key]))
        extraState.uiPreferences[key] = [];
    if (Array.isArray(state.tasks))
      tasks.splice(0, tasks.length, ...state.tasks);
    if (Array.isArray(state.events))
      events.splice(0, events.length, ...state.events);
    if (Array.isArray(state.checkins))
      checkins.splice(0, checkins.length, ...state.checkins);
    if (Array.isArray(state.projects))
      projects.splice(0, projects.length, ...state.projects);
    if (Array.isArray(state.sleepLogs))
      sleepLogs.splice(0, sleepLogs.length, ...state.sleepLogs);
    if (Array.isArray(state.foodLogs))
      foodLogs.splice(0, foodLogs.length, ...state.foodLogs);
    if (Array.isArray(state.workouts))
      workouts.splice(0, workouts.length, ...state.workouts);
    if (Array.isArray(state.recoveryLogs))
      recoveryLogs.splice(0, recoveryLogs.length, ...state.recoveryLogs);
    if (Array.isArray(state.waterLogs))
      waterLogs.splice(0, waterLogs.length, ...state.waterLogs);
    if (Array.isArray(state.trainingGoals))
      trainingGoals.splice(0, trainingGoals.length, ...state.trainingGoals);
    if (Array.isArray(state.savedMeals))
      savedMeals.splice(0, savedMeals.length, ...state.savedMeals);
    if (Array.isArray(state.taskTemplates))
      taskTemplates.splice(0, taskTemplates.length, ...state.taskTemplates);
    waterTarget = Number.isFinite(state.waterTarget)
      ? Math.max(1, Math.min(10000, state.waterTarget))
      : 2000;
    if (Array.isArray(state.archiveCategories))
      archiveCategories.splice(
        0,
        archiveCategories.length,
        ...state.archiveCategories,
      );
    if (Array.isArray(state.archiveItems))
      archiveItems.splice(0, archiveItems.length, ...state.archiveItems);
    tasks.forEach((task) => {
      task.createdDate ||= task.date || todayKey;
      task.date ||= "";
    });
    events.forEach((event) => {
      if (!event.date) event.date = todayKey;
      if (!event.context) event.context = "Личное";
    });
    lastCheckin = checkins.length
      ? checkins.reduce(
          (latest, entry) => Math.max(latest, Number(entry.at)),
          0,
        )
      : null;
    let highestId = 0;
    for (const collection of [
      tasks,
      events,
      projects,
      foodLogs,
      workouts,
      archiveItems,
      waterLogs,
      recoveryLogs,
      trainingGoals,
      savedMeals,
      taskTemplates,
      extraState.thoughts,
      extraState.financeLogs,
      extraState.exercises,
      extraState.weightLogs,
      extraState.illnessLogs,
      extraState.nutrientLogs,
    ])
      for (const item of collection)
        highestId = Math.max(highestId, item.id || 0);
    nextId = Math.max(
      Number.isSafeInteger(state.nextId) ? state.nextId : nextId,
      highestId + 1,
    );
    // Keep one visible, protected destination for previously hidden personal tasks.
    let personal = projects.find(
      (item) =>
        item.system === "unassigned" ||
        item.name === personalProject ||
        item.name === "Личное",
    );
    if (!personal) {
      personal = {
        id: nextId++,
        name: personalProject,
        description:
          "Задачи без проекта. Дату выполнения можно назначить позже.",
        tone: "neutral",
        system: "unassigned",
        _syncId: "project-unassigned",
      };
      projects.push(personal);
    }
    personal.name = personalProject;
    personal.system = "unassigned";
    extraState.uiPreferences.taskDatesVersion = 1;
    for (const item of [...tasks, ...events, ...taskTemplates])
      if (!item.context || item.context === "Личное")
        item.context = personalProject;
    selectedDate = /^\d{4}-\d{2}-\d{2}$/.test(state.selectedDate || "")
      ? state.selectedDate
      : todayKey;
    range = ["six", "day", "week", "month"].includes(state.range)
      ? state.range
      : "six";
    activePage = [
      "home",
      "projects",
      "life",
      "archive",
      "completed",
      "thoughts",
    ].includes(state.activePage)
      ? state.activePage
      : state.activePage === "wins" || state.activePage === "now"
        ? "home"
        : "projects";
    selectedProjectId = projects.some(
      (project) => project.id === state.selectedProjectId,
    )
      ? state.selectedProjectId
      : projects[0]?.id;
    lifeTab = ["mood", "sleep", "food", "training", "finances"].includes(
      state.lifeTab,
    )
      ? state.lifeTab
      : "mood";
    lifeDetailOpen = state.version >= 22 && Boolean(state.lifeDetailOpen);
    selectedLifeDay = /^\d{4}-\d{2}-\d{2}$/.test(state.selectedLifeDay || "")
      ? state.selectedLifeDay
      : todayKey;
    $("#mood-month").value = selectedLifeDay.slice(0, 7);
    $("#life-day-date").value = selectedLifeDay;
    selectedArchiveCategory = archiveCategories.includes(
      state.selectedArchiveCategory,
    )
      ? state.selectedArchiveCategory
      : archiveCategories[0] || "";
    foodTarget = Number.isFinite(state.foodTarget)
      ? Math.max(0, state.foodTarget)
      : 0;
    customColor = /^#[0-9a-f]{6}$/i.test(state.customColor || "")
      ? state.customColor
      : "#8c6ad8";
    languageMode = ["system", "ru", "en"].includes(state.languageMode)
      ? state.languageMode
      : "system";
    fontMode =
      ["system", "soft", "strict", "libron"].includes(state.fontMode) ||
      /^custom-[a-z0-9-]+$/.test(state.fontMode || "")
        ? state.fontMode
        : "system";
    manualWindow = false;
    windowStart = centeredStart();
    if (["sun", "pine", "scarlet", "winter", "custom"].includes(state.palette))
      root.dataset.palette = state.palette;
    applyAppearance(state.appearance || "system");
    root.style.setProperty("--lo-custom-color", customColor);
    root.dataset.font = fontMode;
    $("#custom-color").value = customColor;
    $("#font-select").value = fontMode;
    $("#language-select").value = languageMode;
    if ($(".brand svg")) drawCeramicEmblem();
    $("#calendar-date").value = selectedDate;
    all("[data-theme]").forEach((button) =>
      button.setAttribute(
        "aria-pressed",
        String(button.dataset.theme === root.dataset.palette),
      ),
    );
    all("[data-appearance]").forEach((button) =>
      button.setAttribute(
        "aria-pressed",
        String(button.dataset.appearance === (state.appearance || "system")),
      ),
    );
  }
  let calendarKnown = null;
  const calendarIdentity = (row) =>
    [row.source.provider, row.source.connection, row.source.id].join("|");
  listen(window, "life-os:before-wipe", () => {
    resetting = true;
  });
  listen(window, "life-os:wipe-failed", () => {
    resetting = false;
  });
  let persistQueued = false;
  function schedulePersist() {
    if (persistQueued || disposed) return;
    persistQueued = true;
    queueMicrotask(() => {
      persistQueued = false;
      persistState();
    });
  }
  function persistState() {
    if (disposed || resetting) return;
    for (const item of tasks)
      item.createdDate ||= item.date || dateKey(new Date());
    for (const item of [...tasks, ...events, ...taskTemplates]) {
      if (!item.context || item.context === "Личное")
        item.context = personalProject;
    }
    // Completion-based repeats create one next occurrence, not a year of backlog.
    let generated = false;
    for (const collection of [tasks, events]) {
      for (const item of [...collection]) {
        if (
          !item.done ||
          item.repeat?.mode !== "completion" ||
          item.repeatNextKey ||
          item.workoutId
        )
          continue;
        const date = shiftDate(
          dateKey(new Date()),
          item.repeat.frequency === "daily" ? 1 : 7,
        );
        if (date > item.repeat.until) continue;
        item.repeatKey ||= crypto.randomUUID();
        item.repeatIndex ||= 0;
        item.repeatInstanceKey ||= item.repeatKey + ":" + item.repeatIndex;
        const repeatInstanceKey = item.repeatKey + ":" + (item.repeatIndex + 1);
        item.repeatNextKey = repeatInstanceKey;
        if (
          collection.some((row) => row.repeatInstanceKey === repeatInstanceKey)
        )
          continue;
        const next = structuredClone(item);
        for (const field of [
          "_syncId",
          "repeatNextKey",
          "completedAt",
          "source",
          "win",
        ])
          delete next[field];
        Object.assign(next, {
          id: nextId++,
          date,
          done: false,
          status: "planned",
          repeatIndex: item.repeatIndex + 1,
          repeatInstanceKey,
        });
        collection.push(next);
        generated = true;
      }
    }
    if (generated)
      queueMicrotask(() => {
        if (!disposed) {
          renderTasks();
          renderCalendar();
          renderProjects();
        }
      });
    const current = new Map(
      [...events, ...tasks]
        .filter((row) =>
          ["google", "android-calendar"].includes(row.source?.provider),
        )
        .map((row) => [
          calendarIdentity(row),
          structuredClone({
            source: row.source,
            date: row.date,
            title: row.title,
          }),
        ]),
    );
    if (calendarKnown)
      for (const [key, row] of calendarKnown)
        if (
          !current.has(key) &&
          !row.source.multiDay &&
          !extraState.calendarDeleted.some(
            (entry) => calendarIdentity(entry) === key,
          )
        )
          extraState.calendarDeleted.push(row);
    extraState.calendarDeleted.splice(
      0,
      extraState.calendarDeleted.length,
      ...extraState.calendarDeleted.filter(
        (row) => !current.has(calendarIdentity(row)),
      ),
    );
    calendarKnown = current;
    if (!disposed)
      services.persist({ data: snapshotData(), covers: [...archiveCovers] });
  }
  const initialState = initialDocument.data;
  restoreState(initialState);
  // A saved browsing date is not the date to show when reopening the app.
  selectedDate = todayKey;
  manualWindow = false;
  windowStart = centeredStart();
  if (initialState) lastStateKey = JSON.stringify(initialState);
  for (const [id, source] of initialDocument.covers)
    archiveCovers.set(id, source);
  listen(root, "click", (event) => {
    if (
      event.target.closest(
        ".task-check,.task-menu .danger,#task-delete,#task-undo button,#event-undo button,#project-undo button,#event-delete,#day-toggle,#week-toggle,#month-toggle,#period-prev,#period-next,.week-day,.month-day,.life-day-cell,.archive-category,.win-toggle,[data-life-tab],[data-page],.project-option,[data-appearance],[data-theme]",
      )
    )
      schedulePersist();
  });
  listen(root, "submit", () => schedulePersist());
  listen(root, "change", (event) => {
    if (
      event.target.matches(
        "#window-range,#calendar-date,#mood-month,#life-day-date,#sleep-month,#food-day,#food-target,#training-month,#custom-color,#language-select,#font-select",
      )
    )
      schedulePersist();
  });
  let renderedDay = "";
  function renderDate() {
    const now = new Date(),
      dayKey = now.getFullYear() + "-" + now.getMonth() + "-" + now.getDate();
    if (renderedDay && dayKey !== renderedDay) {
      manualWindow = false;
      windowStart = centeredStart();
    }
    renderedDay = dayKey;
    $("#today-date").textContent = dateFormatter({
      weekday: "long",
      day: "numeric",
      month: "long",
    })
      .format(now)
      .replace(/^./, (letter) => letter.toUpperCase());
    const hours = String(now.getHours()).padStart(2, "0"),
      minutes = String(now.getMinutes()).padStart(2, "0");
    $("#local-time").textContent = hours + ":" + minutes;
    $("#local-time").dateTime = hours + ":" + minutes;
  }
  renderDate();
  const minutes = (value) => {
    const parts = value.split(":").map(Number);
    return parts[0] * 60 + parts[1];
  };
  function showPage(page) {
    upgrades?.flushThoughts();
    activePage = [
      "home",
      "projects",
      "life",
      "archive",
      "completed",
      "thoughts",
    ].includes(page)
      ? page
      : "home";
    const screens = {
      home: "#now-workspace",
      projects: "#projects-screen",
      life: "#life-screen",
      wins: "#wins-screen",
      archive: "#archive-screen",
      completed: "#completed-screen",
      thoughts: "#thoughts-screen",
    };
    Object.entries(screens).forEach(([name, selector]) => {
      if ($(selector)) $(selector).hidden = name !== activePage;
    });
    $("#page-title").textContent = {
      home: "Главная",
      projects: "Проекты",
      life: "Жизнь",
      wins: "Победы",
      archive: "База данных",
      completed: "Архив",
      thoughts: "Мысли",
    }[activePage];
    all("[data-page]").forEach((button) => {
      if (
        button.dataset.page === activePage ||
        (activePage === "completed" && button.dataset.page === "archive")
      )
        button.setAttribute("aria-current", "page");
      else button.removeAttribute("aria-current");
    });
    if (activePage === "home") {
      renderTasks();
      renderCalendar();
    }
    if (activePage === "projects") renderProjects();
    if (activePage === "life") renderLife();
    if (activePage === "wins") renderWins();
    if (activePage === "archive") renderArchive();
    if (activePage === "completed") upgrades?.renderCompleted();
    if (activePage === "thoughts") upgrades?.renderThoughts();
    upgrades?.renderHomeThoughts();
    usability?.pageChanged(activePage);
    applyLanguage();
    recordScreen();
  }
  all("[data-page]").forEach((button) =>
    listen(button, "click", () => {
      if (["home", "life"].includes(button.dataset.page)) refreshToday();
      if (button.dataset.page === "life") lifeDetailOpen = false;
      showPage(button.dataset.page);
    }),
  );
  const shortDate = (key) =>
    dateFormatter({
      day: "numeric",
      month: "short",
    }).format(parseDate(key));
  const builtInTemplates = [
    {
      name: "Подготовка к поездке",
      items: [
        {
          title: "Проверить документы",
          description: "Паспорт, билеты и бронирования.",
          duration: 30,
        },
        {
          title: "Собрать вещи",
          description: "Одежда, лекарства, зарядные устройства.",
          duration: 45,
        },
        {
          title: "Проверить маршрут",
          description: "Адреса, транспорт и время отправления.",
          duration: 30,
        },
      ],
    },
    {
      name: "План недели",
      items: [
        { title: "Выбрать главные дела недели", duration: 20 },
        { title: "Распределить задачи по дням", duration: 30 },
        { title: "Оставить время для отдыха", duration: 10 },
      ],
    },
  ];
  let calendarDrag = null,
    suppressCalendarClickUntil = 0;
  function snapshotData() {
    const appearance =
      all("[data-appearance]").find(
        (button) => button.getAttribute("aria-pressed") === "true",
      )?.dataset.appearance || "system";
    return {
      ...extraState,
      version: 32,
      tasks,
      events,
      checkins,
      projects,
      sleepLogs,
      foodLogs,
      workouts,
      recoveryLogs,
      waterLogs,
      waterTarget,
      trainingGoals,
      archiveCategories,
      archiveItems,
      savedMeals,
      taskTemplates,
      nextId,
      range,
      selectedDate,
      palette: root.dataset.palette,
      appearance,
      activePage,
      selectedProjectId,
      lifeTab,
      lifeDetailOpen,
      selectedLifeDay,
      selectedArchiveCategory,
      foodTarget,
      customColor,
      languageMode,
      fontMode,
    };
  }
  function fieldControl(label, id, type = "text", tag = "input") {
    const field = make("label", "field", label),
      input = make(tag);
    input.id = id;
    if (tag === "input") input.type = type;
    field.append(input);
    return { field, input };
  }
  function action(label, fn, className = "button cursor-interaction") {
    const button = make("button", className, label);
    button.type = "button";
    listen(button, "click", fn);
    return button;
  }
  function addDescription(prefix, anchor) {
    const details = make("details", "form-extra"),
      summary = make(
        "summary",
        "cursor-interaction",
        "Описание и длительность",
      );
    details.append(summary);
    const note = fieldControl(
      "Описание",
      prefix + "-description",
      "text",
      "textarea",
    );
    note.input.maxLength = 1000;
    if (prefix !== "event") {
      note.input.rows = 6;
      const duration = fieldControl(
        "Длительность в расписании · мин",
        prefix + "-duration",
        "number",
      );
      Object.assign(duration.input, {
        min: "5",
        max: "1439",
        step: "5",
        value: "30",
      });
      details.append(duration.field);
    }
    details.append(note.field);
    anchor.after(details);
  }
  function addRepeatControls(prefix, anchor) {
    const wrapper = make("div", "repeat-fields"),
      frequency = fieldControl("Повтор", prefix + "-repeat", "text", "select"),
      until = fieldControl(
        "До даты включительно",
        prefix + "-repeat-until",
        "date",
      );
    for (const [value, label] of [
      ["once", "Один раз"],
      ["daily", "Каждый день"],
      ["weekly", "Каждую неделю"],
      ["daily-after", "Каждый день после выполнения"],
      ["weekly-after", "Каждую неделю после выполнения"],
    ]) {
      const option = make("option", "", label);
      option.value = value;
      frequency.input.append(option);
    }
    until.field.hidden = true;
    wrapper.append(frequency.field, until.field);
    anchor.before(wrapper);
    listen(frequency.input, "change", () => {
      until.field.hidden = frequency.input.value === "once";
      until.input.required = !until.field.hidden;
      until.input.min = $("#" + prefix + "-date").value || todayKey;
      if (!until.input.value || until.input.value < until.input.min)
        until.input.value = shiftDate(until.input.min, 28);
      fitDialog();
    });
    listen($("#" + prefix + "-date"), "change", () => {
      until.input.min = $("#" + prefix + "-date").value;
      if (until.input.value < until.input.min)
        until.input.value = shiftDate(until.input.min, 28);
    });
  }
  function resetRepeat(prefix) {
    $("#" + prefix + "-repeat").value = "once";
    $("#" + prefix + "-repeat").closest(".repeat-fields").hidden = false;
    $("#" + prefix + "-repeat-until").value = "";
    $("#" + prefix + "-repeat-until").required = false;
    $("#" + prefix + "-repeat-until").parentElement.hidden = true;
  }
  function readRepeat(prefix, date) {
    const frequency = $("#" + prefix + "-repeat").value,
      until = $("#" + prefix + "-repeat-until").value;
    if (frequency === "once") return { dates: [date], repeat: null };
    if (!date) throw Error("Для повторов укажите дату начала.");
    if (!until || until < date || until > shiftDate(date, 365))
      throw Error("Укажите конец повтора в пределах года.");
    const dates = [];
    for (
      let day = date;
      day <= until;
      day = shiftDate(day, frequency === "daily" ? 1 : 7)
    )
      dates.push(day);
    const mode = frequency.endsWith("-after") ? "completion" : "calendar";
    return {
      dates: mode === "completion" ? [date] : dates,
      repeat: { frequency: frequency.replace("-after", ""), until, mode },
    };
  }
  function createSeries(collection, base, rule) {
    const seriesId = rule.repeat ? nextId++ : null,
      repeatKey = rule.repeat ? crypto.randomUUID() : null;
    rule.dates.forEach((date, index) =>
      collection.push({
        ...base,
        id: nextId++,
        date,
        createdDate: dateKey(new Date()),
        ...(rule.repeat
          ? {
              repeat: { ...rule.repeat },
              seriesId,
              repeatKey,
              repeatIndex: index,
              repeatInstanceKey: repeatKey + ":" + index,
            }
          : {}),
        done: false,
      }),
    );
    return rule.dates.length;
  }
  function installAdditions() {
    addDescription("capture", $("#capture-text").parentElement);
    addDescription("task", $("#task-name").parentElement);
    addDescription("event", $("#event-name").parentElement);
    addRepeatControls("capture", $("#capture-error"));
    addRepeatControls("event", $("#event-error"));
    const saveTemplate = make("label", "inline-choice"),
      check = make("input");
    check.type = "checkbox";
    check.id = "capture-save-template";
    saveTemplate.append(check, make("span", "", "Сохранить как шаблон"));
    $("#capture-error").before(saveTemplate);
    const templateButton = action(
      "Из шаблона",
      (event) => openTemplates(event.currentTarget),
      "text-button templates-trigger cursor-interaction",
    );
    templateButton.id = "templates-open";
    $("#task-add").after(templateButton);
    $("#project-task-add").after(
      action(
        "Из шаблона",
        (event) => openTemplates(event.currentTarget),
        "text-button templates-trigger cursor-interaction",
      ),
    );
    const overlay = make("div", "overlay");
    overlay.id = "templates-dialog";
    overlay.hidden = true;
    const dialog = make("div", "dialog");
    dialog.setAttribute("role", "dialog");
    dialog.setAttribute("aria-modal", "true");
    dialog.setAttribute("aria-labelledby", "templates-title");
    const head = make("div", "dialog-head"),
      heading = make("h2", "", "Шаблоны задач");
    heading.id = "templates-title";
    const close = action("×", closeDialog, "close cursor-interaction");
    close.setAttribute("aria-label", "Закрыть шаблоны");
    head.append(heading, close);
    const date = fieldControl("Добавить на дату", "template-date", "date"),
      context = fieldControl(
        "Проект или область",
        "template-context",
        "text",
        "select",
      );
    date.input.required = true;
    const list = make("div", "template-list");
    list.id = "template-list";
    dialog.append(head, date.field, context.field, list);
    overlay.append(dialog);
    root.append(overlay);
    const foodChoice = make("label", "inline-choice"),
      saveMeal = make("input");
    saveMeal.type = "checkbox";
    saveMeal.id = "food-save-meal";
    foodChoice.append(
      saveMeal,
      make("span", "", "Сохранить блюдо для повторного добавления"),
    );
    $('#food-form button[type="submit"]').before(foodChoice);
    const cancelMeal = action(
      "Отменить изменение",
      resetFoodEditor,
      "text-button cursor-interaction",
    );
    cancelMeal.id = "food-cancel-edit";
    cancelMeal.hidden = true;
    $('#food-form button[type="submit"]').after(cancelMeal);
    const foodHeading = $("#food-form").previousElementSibling,
      foodHead = make("div", "food-add-head"),
      mealOpen = action(
        "Добавить из моих блюд",
        (event) => {
          renderSavedMeals();
          openDialog("saved-meals-dialog", event.currentTarget);
        },
        "text-button cursor-interaction",
      );
    mealOpen.id = "saved-meals-open";
    foodHeading.replaceWith(foodHead);
    foodHead.append(foodHeading, mealOpen);
    const mealOverlay = make("div", "overlay");
    mealOverlay.id = "saved-meals-dialog";
    mealOverlay.hidden = true;
    const mealDialog = make("div", "dialog");
    mealDialog.setAttribute("role", "dialog");
    mealDialog.setAttribute("aria-modal", "true");
    mealDialog.setAttribute("aria-labelledby", "saved-meals-title");
    const mealHead = make("div", "dialog-head"),
      mealTitle = make("h2", "", "Мои блюда"),
      mealClose = action("×", closeDialog, "close cursor-interaction");
    mealTitle.id = "saved-meals-title";
    mealClose.setAttribute("aria-label", "Закрыть мои блюда");
    mealHead.append(mealTitle, mealClose);
    const mealHost = make("div", "saved-meals");
    mealHost.id = "saved-meals";
    mealDialog.append(mealHead, mealHost);
    mealOverlay.append(mealDialog);
    root.append(mealOverlay);
    const insight = make("details", "panel insights-panel");
    insight.id = "life-insights";
    const insightHead = make(
        "summary",
        "insight-summary cursor-interaction",
        "Сравнения",
      ),
      insightLabel = make("span", "insight-summary-label", "Сон и энергия");
    insightLabel.id = "insight-summary-label";
    insightHead.append(insightLabel);
    const controls = make("div", "insight-controls"),
      question = fieldControl(
        "Сравнение",
        "insight-question",
        "text",
        "select",
      );
    for (const [value, label] of [
      ["sleep", "Сон и энергия"],
      ["training", "Тренировки и настроение"],
      ["load", "Загрузка дня и стресс"],
    ]) {
      const option = make("option", "", label);
      option.value = value;
      question.input.append(option);
    }
    const threshold = fieldControl(
      "Сон не меньше · ч",
      "insight-threshold",
      "number",
    );
    Object.assign(threshold.input, {
      min: "0",
      max: "24",
      step: "0.5",
      value: "7",
    });
    const result = make("div");
    result.id = "insight-result";
    result.setAttribute("aria-live", "polite");
    controls.append(question.field, threshold.field);
    insight.append(insightHead, controls, result);
    insight.hidden = true;
    $("#life-mood-view").append(insight);
    listen(question.input, "change", () => {
      $("#insight-threshold").value =
        question.input.value === "load" ? "4" : "7";
      renderLifeInsights();
    });
    listen(threshold.input, "change", renderLifeInsights);
    const settings = make("section", "settings-data"),
      label = make("span", "settings-label", "Данные"),
      actions = make("div", "settings-data-actions"),
      download = action("Резервная копия", () => downloadBackup()),
      csv = action("Экспорт CSV", () => downloadStatistics());
    download.id = "backup-download";
    csv.id = "export-csv";
    actions.append(download, csv);
    const file = fieldControl("Восстановить из файла", "backup-file", "file");
    file.input.accept = ".json,application/json";
    const preview = make("div", "backup-preview");
    preview.id = "backup-preview";
    preview.hidden = true;
    const status = make("p", "aux-note");
    status.id = "backup-status";
    status.setAttribute("role", "status");
    const undo = action("Отменить восстановление", () => {
      if (!backupUndo) return;
      applyBackup(backupUndo);
      backupUndo = null;
      undo.hidden = true;
      status.textContent = "Восстановление отменено.";
    });
    undo.id = "backup-undo";
    undo.hidden = true;
    settings.append(label, actions, file.field, preview, undo, status);
    $("#font-select").closest(".settings-row").after(settings);
    listen(file.input, "change", () => readBackupFile(file.input.files?.[0]));
    const live = make("span", "drag-announcement");
    live.id = "calendar-drag-status";
    live.setAttribute("role", "status");
    root.append(live);
    Object.assign(translations, {
      "Добавить из моих блюд": "Add from my meals",
      "Закрыть мои блюда": "Close my meals",
      Сравнения: "Comparisons",
      "Пока нет сохранённых блюд. Добавьте еду и включите «Сохранить блюдо для повторного добавления».":
        "No saved meals yet. Add food and enable “Save meal for reuse”.",
      "Описание и длительность": "Description and duration",
      Описание: "Description",
      "Длительность в расписании · мин": "Calendar duration · min",
      "Каждый день": "Every day",
      "Каждую неделю": "Every week",
      "До даты включительно": "Through date",
      "Сохранить как шаблон": "Save as template",
      "Из шаблона": "From template",
      "Шаблоны задач": "Task templates",
      "Добавить на дату": "Add on date",
      "Сохранить блюдо для повторного добавления": "Save meal for reuse",
      "Мои блюда": "My meals",
      "Что связано с самочувствием?": "What relates to your wellbeing?",
      Сравнение: "Comparison",
      "Сон и энергия": "Sleep and energy",
      "Тренировки и настроение": "Workouts and mood",
      "Загрузка дня и стресс": "Daily schedule and stress",
      "Сон не меньше · ч": "Sleep at least · h",
      "Запланировано не меньше · ч": "Scheduled at least · h",
      Данные: "Data",
      "Резервная копия": "Backup",
      "Экспорт CSV": "Export CSV",
      "Восстановить из файла": "Restore from file",
      "Отменить восстановление": "Undo restore",
      Применить: "Apply",
      "Эта запись изменяется отдельно от остальных повторов.":
        "This entry is edited separately from other occurrences.",
    });
  }
  function openTemplates(opener) {
    const context = $("#template-context");
    context.replaceChildren();
    for (const value of [
      "Личное",
      ...projects.map((project) => project.name),
    ]) {
      const option = make("option", "", value);
      option.value = value;
      context.append(option);
    }
    context.value =
      activePage === "projects"
        ? projects.find((project) => project.id === selectedProjectId)?.name ||
          "Личное"
        : "Личное";
    $("#template-date").value = selectedDate;
    const host = $("#template-list");
    host.replaceChildren();
    for (const template of [...builtInTemplates, ...taskTemplates]) {
      const row = make("div", "template-option"),
        copy = make("div", "template-copy");
      copy.append(
        make("strong", "", template.name),
        make("small", "", template.items.map((item) => item.title).join(" · ")),
      );
      const use = action("Применить", () => {
        if (!$("#template-date").reportValidity()) return;
        const date = $("#template-date").value;
        template.items.forEach((item) =>
          tasks.push({
            id: nextId++,
            title: item.title,
            description: item.description || "",
            duration: item.duration || 30,
            context: context.value,
            date,
            done: false,
          }),
        );
        selectedDate = date;
        renderTasks();
        renderProjects();
        closeDialog();
        showCaptureFeedback("из шаблона · " + template.items.length + " задач");
        persistState();
      });
      row.append(copy, use);
      if (taskTemplates.includes(template)) {
        const remove = action(
          "×",
          () => {
            removeWithUndo(taskTemplates, template, () =>
              openTemplates(opener),
            );
          },
          "text-button cursor-interaction",
        );
        remove.setAttribute("aria-label", "Удалить шаблон: " + template.name);
        row.append(remove);
      }
      host.append(row);
    }
    openDialog("templates-dialog", opener);
    applyLanguage();
  }
  function saveTaskTemplate(base) {
    const existing = taskTemplates.find(
        (item) =>
          item.name.toLocaleLowerCase("ru") ===
          base.title.toLocaleLowerCase("ru"),
      ),
      value = {
        name: base.title,
        items: [
          {
            title: base.title,
            description: base.description || "",
            duration: base.duration || 30,
          },
        ],
      };
    if (existing) Object.assign(existing, value);
    else taskTemplates.push({ id: nextId++, ...value });
  }
  function saveMealTemplate(meal) {
    const existing =
      editingMealTemplate ||
      savedMeals.find(
        (item) =>
          item.name.toLocaleLowerCase("ru") ===
          meal.name.toLocaleLowerCase("ru"),
      );
    if (existing) Object.assign(existing, meal);
    else savedMeals.push({ id: nextId++, ...meal });
  }
  function resetFoodEditor() {
    editingMealTemplate = null;
    $("#food-form").reset();
    $("#food-date").value = $("#food-day").value || todayKey;
    $("#food-date").closest("label").hidden = false;
    $("#food-save-meal").disabled = false;
    $('#food-form button[type="submit"]').textContent = "Добавить";
    $("#food-cancel-edit").hidden = true;
    experience?.previewFood();
  }
  function iconAction(icon, label, fn) {
    const button = action("", fn, "meal-action cursor-interaction");
    button.setAttribute("aria-label", label);
    button.setAttribute("data-tooltip", label);
    const glyph = make("i");
    glyph.dataset.lucide = icon;
    glyph.setAttribute("aria-hidden", "true");
    button.append(glyph);
    return button;
  }
  function renderSavedMeals() {
    const host = $("#saved-meals");
    if (!host) return;
    host.replaceChildren();
    if (!savedMeals.length) {
      host.append(
        make(
          "p",
          "meal-empty",
          "Пока нет сохранённых блюд. Добавьте еду и включите «Сохранить блюдо для повторного добавления».",
        ),
      );
      return;
    }
    savedMeals.forEach((meal) => {
      const row = make("div", "saved-meal");
      row.dataset.mealId = String(meal.id);
      const copy = make("div", "meal-copy");
      copy.append(
        make("strong", "", meal.name),
        make(
          "small",
          "",
          meal.calories +
            " ккал · Б " +
            meal.protein +
            " · Ж " +
            meal.fat +
            " · У " +
            meal.carbs,
        ),
      );
      const add = iconAction("plus", "Добавить порцию: " + meal.name, () => {
          const { id, ...portion } = meal;
          foodLogs.push(
            stampLifeRecord(
              {
                id: nextId++,
                date: $("#food-date").value || $("#food-day").value || todayKey,
                ...portion,
              },
              extraState,
              "foodLogs",
            ),
          );
          $("#food-day").value =
            $("#food-date").value || $("#food-day").value || todayKey;
          closeDialog();
          renderFood();
          renderMoodDay();
          persistState();
        }),
        edit = iconAction("pencil", "Изменить блюдо: " + meal.name, () => {
          closeDialog();
          editingMealTemplate = meal;
          $("#food-name").value = meal.name;
          for (const key of ["calories", "protein", "fat", "carbs"])
            $("#food-" + key).value = String(
              meal.nutritionBase?.[key] ?? meal[key],
            );
          if (experience) {
            $("#food-basis").value = meal.nutritionBasis || "portion";
            $("#food-grams").value = meal.grams || "";
            $("#food-source").value = meal.nutritionSource || "manual";
            $("#food-meal-type").value = meal.mealType || "any";
            experience.previewFood();
          }
          $("#food-save-meal").checked = true;
          $("#food-date").closest("label").hidden = true;
          $("#food-save-meal").disabled = true;
          $('#food-form button[type="submit"]').textContent = "Сохранить блюдо";
          $("#food-cancel-edit").hidden = false;
          $("#food-name").focus();
        }),
        remove = iconAction("trash-2", "Удалить блюдо: " + meal.name, () => {
          if (editingMealTemplate === meal) resetFoodEditor();
          removeWithUndo(savedMeals, meal, () => {
            renderSavedMeals();
            fitDialog();
          });
        });
      add.dataset.mealAdd = "true";
      row.append(copy, add, edit, remove);
      host.append(row);
    });
    refreshIcons();
  }
  function occupiedMinutes(day) {
    const intervals = events
      .filter((item) => item.date === day)
      .map((item) => [minutes(item.start), minutes(item.end)])
      .sort((a, b) => a[0] - b[0]);
    let total = 0,
      start = null,
      end = 0;
    for (const interval of intervals) {
      if (start === null) {
        [start, end] = interval;
      } else if (interval[0] <= end) end = Math.max(end, interval[1]);
      else {
        total += end - start;
        [start, end] = interval;
      }
    }
    return total + (start === null ? 0 : end - start);
  }
  function renderLifeInsights() {
    const host = $("#insight-result");
    if (!host) return;
    host.replaceChildren();
    $("#insight-summary-label").textContent = {
      sleep: "Сон и энергия",
      training: "Тренировки и настроение",
      load: "Загрузка дня и стресс",
    }[$("#insight-question").value];
    const question = $("#insight-question").value,
      threshold = Number($("#insight-threshold").value),
      field = $("#insight-threshold").parentElement;
    field.hidden = question === "training";
    field.firstChild.nodeValue =
      question === "load" ? "Запланировано не меньше · ч" : "Сон не меньше · ч";
    const month = $("#mood-month").value || todayKey.slice(0, 7),
      dates = [
        ...new Set(
          checkins
            .filter((entry) =>
              personalDay(entry.at, extraState).startsWith(month),
            )
            .map((entry) => personalDay(entry.at, extraState)),
        ),
      ],
      metric =
        question === "sleep"
          ? "energy"
          : question === "training"
            ? "mood"
            : "stress",
      groups = [[], []];
    dates.forEach((date) => {
      const entries = checkins.filter(
          (entry) => personalDay(entry.at, extraState) === date,
        ),
        value = average(entries, metric);
      if (question === "sleep") {
        const sleep = sleepLogs.find(
          (log) => lifeRecordDay(log, extraState, "sleepLogs") === date,
        );
        if (!sleep) return;
        groups[sleep.hours >= threshold ? 0 : 1].push({
          date,
          value,
          context: sleep.hours + " ч сна",
        });
      } else if (question === "training") {
        const trained = workouts.some(
          (item) =>
            lifeRecordDay(item, extraState, "workouts") === date && item.done,
        );
        groups[trained ? 0 : 1].push({
          date,
          value,
          context: trained
            ? "Есть запись о тренировке"
            : "Нет записи о тренировке",
        });
      } else {
        const hours = occupiedMinutes(date) / 60;
        groups[hours >= threshold ? 0 : 1].push({
          date,
          value,
          context: hours.toFixed(1) + " ч в расписании",
        });
      }
    });
    const metricLabel = {
        mood: "Настроение",
        energy: "Энергия",
        stress: "Стресс",
      }[metric],
      labels =
        question === "sleep"
          ? ["Сон ≥ " + threshold + " ч", "Сон < " + threshold + " ч"]
          : question === "training"
            ? ["Есть запись о тренировке", "Нет записи о тренировке"]
            : [
                "Запланировано ≥ " + threshold + " ч",
                "Запланировано < " + threshold + " ч",
              ];
    const comparable = groups.every((group) => group.length >= 3),
      count = groups[0].length + groups[1].length;
    const overview = make("p", "insight-overview");
    overview.dataset.userContent = "";
    overview.textContent =
      effectiveLanguage() === "en"
        ? comparable
          ? "Recorded daily averages: " +
            average(groups[0], "value").toFixed(1) +
            " / 5 and " +
            average(groups[1], "value").toFixed(1) +
            " / 5 across " +
            count +
            " days. This is an association, not proof of a cause."
          : "Not enough records to compare yet: at least 3 days in each group are needed. Recorded: " +
            count +
            " days."
        : comparable
          ? metricLabel +
            ": «" +
            labels[0] +
            "» — " +
            average(groups[0], "value").toFixed(1) +
            "/5, «" +
            labels[1] +
            "» — " +
            average(groups[1], "value").toFixed(1) +
            "/5. Сравнение по " +
            count +
            " дням; связь не доказывает причину."
          : "Для сравнения нужно хотя бы по 3 записанных дня в каждой группе. Сейчас записано: " +
            count +
            " дней.";
    const calculation = make("details", "insight-detail");
    calculation.append(
      make(
        "summary",
        "cursor-interaction",
        effectiveLanguage() === "en"
          ? "Calculation and recorded days"
          : "Расчёт и дни сравнения",
      ),
    );
    host.append(overview, calculation);
    const comparison = make("div", "insight-comparison");
    comparison.style.setProperty(
      "--lo-insight-color",
      "var(--lo-" + metric + "-color)",
    );
    groups.forEach((days, index) => {
      const group = make("div", "insight-group"),
        avg = average(days, "value"),
        track = make("div", "insight-track"),
        fill = make("div", "insight-fill");
      fill.style.width = (avg === null ? 0 : (avg / 5) * 100) + "%";
      track.append(fill);
      group.append(
        make("strong", "", labels[index]),
        make(
          "strong",
          "insight-value",
          avg === null ? "—" : avg.toFixed(1) + " / 5",
        ),
        track,
        make("small", "aux-note", days.length + " дней"),
      );
      if (days.length) {
        const detail = make("details", "insight-dates");
        detail.append(make("summary", "cursor-interaction", "Дни сравнения"));
        days
          .sort((a, b) => a.date.localeCompare(b.date))
          .forEach((day) => {
            const button = action(
              "",
              () => {
                selectedLifeDay = day.date;
                $("#life-day-date").value = day.date;
                renderMoodDay();
              },
              "insight-date cursor-interaction",
            );
            button.append(
              make("span", "", shortDate(day.date) + " · " + day.context),
              make("span", "", day.value.toFixed(1) + " / 5"),
            );
            detail.append(button);
          });
        group.append(detail);
      }
      comparison.append(group);
    });
    calculation.append(comparison);
    calculation.append(
      make(
        "p",
        "aux-note",
        groups.some((group) => group.length < 3)
          ? "Для сравнения пока мало данных: нужно хотя бы по 3 записанных дня в каждой группе."
          : "Предварительное сравнение по " +
              count +
              " дням. Связь не доказывает причину.",
      ),
    );
    if (question === "training")
      calculation.append(
        make(
          "p",
          "aux-note",
          "Отсутствие записи не означает, что тренировки не было.",
        ),
      );
    applyLanguage();
  }
  function minuteAtPointer(event) {
    const view = $("#timeline-window"),
      viewport = view.getBoundingClientRect(),
      zoom = viewport.height / view.clientHeight || 1,
      scale =
        ($("#timeline").offsetHeight || calendarDayCount * 864) /
        (calendarDayCount * 1440);
    return ((event.clientY - viewport.top) / zoom + view.scrollTop) / scale;
  }
  function calendarMinute(item, field = "start") {
    let day = 0;
    while (
      day < calendarDayCount &&
      shiftDate(calendarBaseDate, day) !== item.date
    )
      day++;
    return day * 1440 + minutes(item[field]);
  }
  function startCalendarDrag(event, kind, item, node) {
    if (calendarDrag || projectDrag || event.button !== 0) return;
    event.preventDefault();
    calendarDrag = {
      kind,
      item,
      node,
      pointerId: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      startMinute: minuteAtPointer(event),
      started: false,
      valid: false,
    };
    try {
      node.setPointerCapture(event.pointerId);
    } catch (error) {}
  }
  function scheduleDragMove(event, drag, move) {
    if (!drag || event.pointerId !== drag.pointerId) return;
    // Start immediately, then consume the latest pointer once per display frame.
    if (!drag.started) return move(event);
    event.preventDefault();
    drag.pendingMove = event;
    if (drag.moveFrame) return;
    drag.moveFrame = requestAnimationFrame(() => {
      drag.moveFrame = 0;
      const next = drag.pendingMove;
      drag.pendingMove = null;
      if (next) move(next);
    });
  }
  function flushDragMove(drag, move, cancel) {
    if (drag.moveFrame) cancelAnimationFrame(drag.moveFrame);
    drag.moveFrame = 0;
    const last = drag.pendingMove;
    drag.pendingMove = null;
    if (last && !cancel) move(last);
  }
  function moveCalendarDrag(event) {
    const drag = calendarDrag;
    if (!drag || event.pointerId !== drag.pointerId) return;
    if (
      !drag.started &&
      Math.hypot(event.clientX - drag.x, event.clientY - drag.y) < 5
    )
      return;
    event.preventDefault();
    if (!drag.started) {
      drag.started = true;
      drag.ghost = make("div", "calendar-drag-ghost", drag.item.title);
      drag.ghost.setAttribute("aria-hidden", "true");
      root.append(drag.ghost);
      drag.preview = make("div", "calendar-drop-preview");
      drag.preview.setAttribute("aria-hidden", "true");
      $("#events").append(drag.preview);
      drag.node.dataset.calendarDragging = "true";
      root.style.userSelect = "none";
    }
    const bounds = root.getBoundingClientRect(),
      viewport = $("#timeline-window").getBoundingClientRect();
    drag.ghost.style.transform = `translate3d(${event.clientX - bounds.left + 12}px, ${event.clientY - bounds.top + 12}px, 0)`;
    drag.valid =
      activePage === "home" &&
      ["six", "day"].includes(range) &&
      event.clientX >= viewport.left &&
      event.clientX <= viewport.right &&
      event.clientY >= viewport.top &&
      event.clientY <= viewport.bottom;
    drag.preview.hidden = !drag.valid;
    if (!drag.valid) return;
    const raw = Math.round(minuteAtPointer(event) / 5) * 5,
      originalStart = drag.kind === "task" ? 0 : calendarMinute(drag.item),
      originalEnd = minutes(drag.item.end || "00:30"),
      duration =
        drag.kind === "task"
          ? Math.max(5, Math.min(1439, drag.item.duration || 30))
          : originalEnd - minutes(drag.item.start);
    if (drag.kind === "resize") {
      drag.start = minutes(drag.item.start);
      drag.date = drag.item.date;
      drag.end = Math.max(
        drag.start + Math.min(5, 1439 - drag.start),
        Math.min(
          1439,
          originalEnd +
            Math.round((minuteAtPointer(event) - drag.startMinute) / 5) * 5,
        ),
      );
    } else {
      const absoluteStart = Math.max(
        0,
        Math.min(
          calendarDayCount * 1440 - 1 - duration,
          drag.kind === "task"
            ? raw
            : originalStart +
                Math.round((minuteAtPointer(event) - drag.startMinute) / 5) * 5,
        ),
      );
      drag.date = shiftDate(calendarBaseDate, Math.floor(absoluteStart / 1440));
      drag.start = Math.min(1439 - duration, absoluteStart % 1440);
      drag.end = drag.start + duration;
    }
    const scale =
      ($("#timeline").offsetHeight || calendarDayCount * 864) /
      (calendarDayCount * 1440);
    drag.preview.style.top =
      calendarMinute({ date: drag.date, start: clockLabel(drag.start / 60) }) *
        scale +
      "px";
    drag.preview.style.height =
      Math.max(5, (drag.end - drag.start) * scale) + "px";
    const overlaps = events.filter(
      (item) =>
        item !== drag.item &&
        item.date === drag.date &&
        minutes(item.start) < drag.end &&
        minutes(item.end) > drag.start,
    );
    drag.preview.dataset.overlap = String(overlaps.length > 0);
    const label =
        clockLabel(drag.start / 60) +
        "–" +
        clockLabel(drag.end / 60) +
        (overlaps.length ? " · пересечение" : ""),
      changed = drag.preview.textContent !== label;
    drag.preview.textContent = label;
    if (changed) $("#calendar-drag-status").textContent = label;
    drag.lastEvent = event;
    if (
      range === "six" &&
      !drag.frame &&
      (event.clientY < viewport.top + 22 ||
        event.clientY > viewport.bottom - 22)
    ) {
      const direction = event.clientY < viewport.top + 22 ? -1 : 1;
      drag.frame = requestAnimationFrame((time) => {
        drag.frame = 0;
        if (calendarDrag !== drag) return;
        const elapsed = Math.min(
          32,
          time - (drag.scrollTime || time - 1000 / 60),
        );
        drag.scrollTime = time;
        const viewportNode = $("#timeline-window"),
          before = viewportNode.scrollTop;
        viewportNode.scrollTop += direction * 0.324 * elapsed;
        if (viewportNode.scrollTop !== before) {
          moveCalendarDrag(drag.lastEvent);
        }
      });
    }
  }
  function finishCalendarDrag(event, cancel = false) {
    const drag = calendarDrag;
    if (
      !drag ||
      (event &&
        event.pointerId !== undefined &&
        event.pointerId !== drag.pointerId)
    )
      return;
    flushDragMove(drag, moveCalendarDrag, cancel);
    calendarDrag = null;
    try {
      drag.node.releasePointerCapture(drag.pointerId);
    } catch (error) {}
    if (drag.frame) cancelAnimationFrame(drag.frame);
    drag.ghost?.remove();
    drag.preview?.remove();
    delete drag.node.dataset.calendarDragging;
    root.style.userSelect = "";
    if (drag.started) suppressCalendarClickUntil = Date.now() + 350;
    if (cancel || !drag.started || !drag.valid) return;
    const start = clockLabel(drag.start / 60),
      end = clockLabel(drag.end / 60);
    if (drag.kind === "task") {
      const index = tasks.indexOf(drag.item);
      if (index < 0) return;
      events.push({
        ...drag.item,
        id: nextId++,
        date: drag.date,
        start,
        end,
        duration: drag.end - drag.start,
        tone: projectTone(drag.item.context),
      });
      tasks.splice(index, 1);
    } else {
      Object.assign(drag.item, {
        date: drag.date,
        start,
        end,
        duration: drag.end - drag.start,
      });
      if (drag.item.workoutId) {
        const workout = workouts.find(
          (item) => item.id === drag.item.workoutId,
        );
        if (workout)
          Object.assign(workout, {
            date: drag.date,
            time: start,
            duration: drag.end - drag.start,
          });
      }
    }
    if (range === "six") syncCalendarScroll();
    renderTasks();
    renderCalendar();
    renderProjects();
    if (drag.item.workoutId) training?.render();
    $("#calendar-drag-status").textContent =
      "В расписании: " + drag.item.title + " · " + start + "–" + end;
    persistState();
  }
  listen(
    window,
    "pointermove",
    (event) => scheduleDragMove(event, calendarDrag, moveCalendarDrag),
    { passive: false },
  );
  listen(window, "pointerup", (event) => finishCalendarDrag(event));
  listen(window, "pointercancel", (event) => finishCalendarDrag(event, true));
  listen(root, "keydown", (event) => {
    if (event.key === "Escape" && calendarDrag) {
      finishCalendarDrag(null, true);
      event.preventDefault();
    }
  });
  function makeBackup() {
    return {
      format: "life-os-backup",
      schemaVersion: 1,
      createdAt: new Date().toISOString(),
      data: snapshotData(),
      covers: [...archiveCovers],
    };
  }
  async function downloadData(name, type, content) {
    try {
      const saved = await services.saveFile(name, type, content);
      if (!disposed)
        $("#backup-status").textContent = saved
          ? "Файл сохранён: " + name
          : "Сохранение отменено.";
    } catch (error) {
      if (!disposed)
        $("#backup-status").textContent =
          "Не удалось сохранить файл: " + error.message;
    }
  }
  function downloadBackup() {
    upgrades?.flushThoughts();
    database?.flush();
    downloadData(
      "orvim-" + dateKey(new Date()) + ".json",
      "application/json;charset=utf-8",
      JSON.stringify(makeBackup(), null, 2),
    );
  }
  function csvCell(value) {
    if (value === undefined || value === null) return '""';
    let text = String(value);
    if (typeof value === "string" && /^[\s]*[=+@-]/.test(text))
      text = "'" + text;
    return '"' + text.replaceAll('"', '""') + '"';
  }
  function statisticsCsv() {
    const rows = [
      [
        "Тип",
        "Дата",
        "Время",
        "Название",
        "Настроение",
        "Энергия",
        "Стресс",
        "Сон, ч",
        "Ккал",
        "Белки, г",
        "Жиры, г",
        "Углеводы, г",
        "Вода, мл",
        "Длительность, мин",
        "Готово",
        "Проект",
        "Заметка",
        "Шаги",
        "Результат упражнения",
        "Единица",
        "Источник",
      ],
    ];
    checkins.forEach((item) =>
      rows.push([
        "Самочувствие",
        dateKey(new Date(item.at)),
        dateFormat("ru", {
          hour: "2-digit",
          minute: "2-digit",
        }).format(new Date(item.at)),
        "",
        item.mood,
        item.energy,
        item.stress,
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        item.note,
      ]),
    );
    sleepLogs.forEach((item) =>
      rows.push([
        "Сон",
        item.date,
        "",
        "",
        "",
        "",
        "",
        item.hours,
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "Качество: " +
          (item.quality || "—") +
          (item.note ? " · " + item.note : ""),
      ]),
    );
    foodLogs.forEach((item) =>
      rows.push([
        "Питание",
        item.date,
        "",
        item.name,
        "",
        "",
        "",
        "",
        item.calories,
        item.protein,
        item.fat,
        item.carbs,
      ]),
    );
    waterLogs.forEach((item) =>
      rows.push([
        "Вода",
        item.date,
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        item.ml,
      ]),
    );
    workouts.forEach((item) =>
      rows.push([
        "Тренировка",
        item.date,
        item.time,
        item.name,
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        item.duration,
        item.done ? "Да" : "Нет",
        "Тренировки",
        item.result || "",
        item.steps ?? "",
        "",
        "",
        item.healthSource?.origin || "",
      ]),
    );
    extraState.stepLogs.forEach((item) => {
      const row = Array(21).fill("");
      Object.assign(row, {
        0: "Шаги",
        1: item.date,
        17: item.count,
        20: item.source || "manual",
      });
      rows.push(row);
    });
    workouts
      .filter((item) => item.done)
      .forEach((item) => {
        for (const entry of item.entries || []) {
          if (!Number.isFinite(entry.value)) continue;
          const row = Array(21).fill("");
          Object.assign(row, {
            0: "Упражнение",
            1: item.date,
            2: item.time,
            3: entry.name,
            14: "Да",
            16: entry.sets ? entry.sets + " подходов" : "",
            18: entry.value,
            19: entry.unit,
          });
          rows.push(row);
        }
      });
    recoveryLogs.forEach((item) =>
      rows.push([
        "Восстановление",
        item.date,
        "",
        item.kind,
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        item.duration,
        "",
        "",
        item.note,
      ]),
    );
    tasks.forEach((item) =>
      rows.push([
        "Задача",
        item.date,
        "",
        item.title,
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        item.duration || "",
        item.done ? "Да" : "Нет",
        item.context,
        item.description,
      ]),
    );
    events.forEach((item) =>
      rows.push([
        "Расписание",
        item.date,
        item.start,
        item.title,
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        minutes(item.end) - minutes(item.start),
        item.done ? "Да" : "Нет",
        item.context,
        item.description,
      ]),
    );
    return (
      "\uFEFF" +
      rows
        .map((row) =>
          Array.from({ length: 17 }, (_, index) => csvCell(row[index])).join(
            ";",
          ),
        )
        .join("\r\n")
    );
  }
  function downloadStatistics() {
    downloadData(
      "orvim-statistics-" + dateKey(new Date()) + ".csv",
      "text/csv;charset=utf-8",
      statisticsCsv(),
    );
  }
  function validateBackup(backup) {
    if (
      !backup ||
      backup.format !== "life-os-backup" ||
      backup.schemaVersion !== 1 ||
      ![27, 28, 29, 30, 31, 32].includes(backup.data?.version)
    )
      throw Error("Это не резервная копия Orvim поддерживаемого формата.");
    const data = backup.data,
      date = (value) =>
        typeof value === "string" &&
        /^\d{4}-\d{2}-\d{2}$/.test(value) &&
        dateKey(parseDate(value)) === value,
      text = (value) => typeof value === "string" && value.length <= 100000,
      optionalText = (value) => value == null || text(value),
      number = (value, min, max) =>
        typeof value === "number" &&
        Number.isFinite(value) &&
        value >= min &&
        value <= max,
      id = (value) => Number.isSafeInteger(value) && value > 0,
      time = (value) =>
        typeof value === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(value),
      tone = (value) =>
        ["sun", "pine", "scarlet", "winter", "neutral"].includes(value),
      macros = (item) =>
        number(item.calories, 0, 10000) &&
        ["protein", "fat", "carbs"].every((key) => number(item[key], 0, 1000)),
      repeat = (item) =>
        !item.repeat ||
        (["daily", "weekly"].includes(item.repeat.frequency) &&
          date(item.repeat.until)),
      task = (item) =>
        id(item.id) &&
        text(item.title) &&
        text(item.context) &&
        (item.date === undefined || item.date === "" || date(item.date)) &&
        typeof item.done === "boolean" &&
        optionalText(item.description) &&
        repeat(item) &&
        (item.duration === undefined || number(item.duration, 1, 1439));
    const rules = {
      tasks: task,
      events: (item) =>
        id(item.id) &&
        text(item.title) &&
        text(item.context) &&
        date(item.date) &&
        time(item.start) &&
        time(item.end) &&
        minutes(item.end) > minutes(item.start) &&
        tone(item.tone || "sun") &&
        optionalText(item.description) &&
        repeat(item),
      checkins: (item) =>
        number(item.at, 1, 8.64e15) &&
        ["mood", "energy", "stress"].every(
          (key) => Number.isInteger(item[key]) && number(item[key], 1, 5),
        ) &&
        optionalText(item.note),
      projects: (item) =>
        id(item.id) &&
        text(item.name) &&
        text(item.description) &&
        tone(item.tone),
      sleepLogs: (item) =>
        date(item.date) &&
        number(item.hours, 0, 24) &&
        (item.quality === null ||
          item.quality === undefined ||
          number(item.quality, 1, 5)) &&
        optionalText(item.note),
      foodLogs: (item) =>
        id(item.id) && date(item.date) && text(item.name) && macros(item),
      waterLogs: (item) =>
        id(item.id) && date(item.date) && number(item.ml, 1, 10000),
      workouts: (item) =>
        id(item.id) &&
        date(item.date) &&
        text(item.name) &&
        time(item.time) &&
        number(item.duration, 1, 1439) &&
        typeof item.done === "boolean",
      recoveryLogs: (item) =>
        id(item.id) &&
        date(item.date) &&
        text(item.kind) &&
        number(item.duration, 0, 1440) &&
        optionalText(item.note),
      trainingGoals: (item) =>
        id(item.id) &&
        text(item.name) &&
        text(item.unit) &&
        text(item.focus) &&
        number(item.baseline, 0, 100000) &&
        number(item.current, 0, item.calculation === "total" ? 1e13 : 100000) &&
        number(item.target, 0, 100000) &&
        item.target > item.baseline &&
        Array.isArray(item.history) &&
        item.history.every(
          (point) =>
            number(point.at, 1, 8.64e15) && number(point.value, 0, 100000),
        ),
      archiveItems: (item) =>
        id(item.id) &&
        text(item.name) &&
        text(item.category) &&
        date(item.date) &&
        (item.rating == null ||
          (number(item.rating, 0.5, item.ratingMax === 10 ? 10 : 5) &&
            Number.isInteger(item.rating * 2))) &&
        optionalText(item.review),
      savedMeals: (item) => id(item.id) && text(item.name) && macros(item),
      taskTemplates: (item) =>
        id(item.id) &&
        text(item.name) &&
        Array.isArray(item.items) &&
        item.items.length > 0 &&
        item.items.length <= 1000 &&
        item.items.every(
          (entry) =>
            text(entry.title) &&
            optionalText(entry.description) &&
            number(entry.duration, 1, 1439),
        ),
    };
    if (data.version >= 30)
      Object.assign(rules, {
        thoughts: (item) =>
          id(item.id) &&
          text(item.title) &&
          text(item.body) &&
          text(item.context) &&
          date(item.date),
        financeLogs: (item) =>
          id(item.id) &&
          date(item.date) &&
          ["income", "expense", "transfer"].includes(item.type) &&
          number(item.amount, 0.01, 1e12) &&
          /^[A-Z]{3}$/.test(item.currency) &&
          text(item.category) &&
          text(item.note),
        exercises: (item) =>
          id(item.id) && text(item.name) && number(item.duration, 1, 1439),
      });
    if (data.version >= 31)
      rules.stepLogs = (item) =>
        date(item.date) &&
        Number.isInteger(item.count) &&
        number(item.count, 0, 200000);
    for (const [key, rule] of Object.entries(rules)) {
      const items = data[key];
      if (
        !Array.isArray(items) ||
        items.length > 100000 ||
        items.some((item) => !item || typeof item !== "object" || !rule(item))
      )
        throw Error("Некорректные записи: " + key);
      if (
        !["checkins", "sleepLogs", "stepLogs"].includes(key) &&
        new Set(items.map((item) => item.id)).size !== items.length
      )
        throw Error("Повторяющиеся идентификаторы: " + key);
    }
    if (
      !Array.isArray(data.archiveCategories) ||
      !data.archiveCategories.every(text) ||
      new Set(data.archiveCategories).size !== data.archiveCategories.length ||
      !date(data.selectedDate) ||
      !date(data.selectedLifeDay) ||
      !number(data.waterTarget, 1, 10000) ||
      !number(data.foodTarget, 0, 10000) ||
      !/^#[0-9a-f]{6}$/i.test(data.customColor) ||
      !id(data.nextId)
    )
      throw Error("Некорректные настройки резервной копии.");
    if (
      !Array.isArray(backup.covers) ||
      backup.covers.length > 10000 ||
      backup.covers.some(
        (entry) =>
          !Array.isArray(entry) ||
          entry.length !== 2 ||
          !id(entry[0]) ||
          typeof entry[1] !== "string" ||
          !/^data:image\/(png|jpeg);base64,[A-Za-z0-9+/=]+$/.test(entry[1]),
      )
    )
      throw Error("Некорректные обложки архива.");
    validateDatabaseExtras(data);
    validateTrainingData(data);
    validateExperienceData(data);
    validateLifeTracking(data);
    return backup;
  }
  function readBackupFile(file) {
    if (!file) return;
    const status = $("#backup-status");
    pendingBackup = null;
    $("#backup-preview").hidden = true;
    if (file.size > 100 * 1024 * 1024) {
      status.textContent = "Выберите JSON до 100 МБ.";
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      try {
        pendingBackup = validateBackup(
          JSON.parse(String(reader.result), (key, value) =>
            ["__proto__", "constructor", "prototype"].includes(key)
              ? undefined
              : value,
          ),
        );
        const data = pendingBackup.data,
          preview = $("#backup-preview");
        preview.replaceChildren(
          make(
            "p",
            "",
            data.tasks.length +
              " задач · " +
              data.events.length +
              " событий · " +
              data.checkins.length +
              " отметок самочувствия · " +
              data.foodLogs.length +
              " записей питания",
          ),
          make("p", "aux-note", "Восстановление заменит текущие данные."),
        );
        preview.append(
          action("Восстановить", () => {
            if (!pendingBackup) return;
            backupUndo = JSON.parse(JSON.stringify(makeBackup()));
            applyBackup(pendingBackup);
            pendingBackup = null;
            preview.hidden = true;
            $("#backup-undo").hidden = false;
            status.textContent = "Данные восстановлены.";
          }),
        );
        preview.hidden = false;
        status.textContent = "Резервная копия готова к восстановлению.";
        fitDialog();
      } catch (error) {
        status.textContent = error.message;
        pendingBackup = null;
      }
    };
    reader.onerror = () => {
      status.textContent = "Не удалось прочитать файл.";
    };
    reader.readAsText(file);
  }
  function applyBackup(backup) {
    delete extraState.uiPreferences.databaseDrafts;
    delete extraState.uiPreferences.databaseCollections;
    restoreState(backup.data);
    database?.rehydrate();
    upgrades?.rehydrate();
    usability?.rehydrate();
    training?.rehydrate();
    experience?.rehydrate();
    archiveCovers.clear();
    backup.covers.forEach(([id, source]) => archiveCovers.set(id, source));
    $("#mood-month").value = selectedLifeDay.slice(0, 7);
    syncProjectOptions();
    renderState();
    renderTasks();
    renderCalendar();
    renderProjects();
    renderArchive();
    showPage(activePage);
    persistState();
  }
  const make = (tag, className, value) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (value !== undefined) node.textContent = value;
    return node;
  };
  installAdditions();
  Object.assign(translations, {
    "Сохранить блюдо": "Save meal",
    "Есть запись о тренировке": "Workout logged",
    "Нет записи о тренировке": "No workout logged",
    "Дни сравнения": "Comparison days",
    "Для сравнения пока мало данных: нужно хотя бы по 3 записанных дня в каждой группе.":
      "Not enough data yet: log at least 3 days in each group.",
    "Отсутствие записи не означает, что тренировки не было.":
      "No record does not mean no workout happened.",
    "Восстановление заменит текущие данные.":
      "Restoring replaces current data.",
    Восстановить: "Restore",
    "Данные восстановлены.": "Data restored.",
    "Восстановление отменено.": "Restore undone.",
    "Резервная копия готова к восстановлению.": "Backup is ready to restore.",
  });
  function refreshIcons() {
    all(".task-check").forEach((button) => {
      setCompletionIcon(button, button.getAttribute("aria-pressed") === "true");
    });
    services.refreshIcons(root);
  }
  const average = (items, key) =>
    items.length
      ? items.reduce((sum, item) => sum + Number(item[key] || 0), 0) /
        items.length
      : null;
  function monthGrid(host, month, levelForDay, onDay) {
    host.replaceChildren();
    const first = parseDate(month + "-01"),
      offset = (first.getDay() + 6) % 7,
      days = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
    for (let index = 0; index < offset; index++) {
      const blank = make("button", "life-day-cell");
      blank.disabled = true;
      blank.type = "button";
      host.append(blank);
    }
    for (let day = 1; day <= days; day++) {
      const key = month + "-" + String(day).padStart(2, "0"),
        result = levelForDay(key),
        button = make(
          "button",
          "life-day-cell cursor-interaction",
          String(day),
        );
      button.type = "button";
      button.dataset.level = String(result.level || 0);
      button.setAttribute("aria-pressed", String(key === selectedLifeDay));
      button.setAttribute("aria-label", result.label || shortDate(key));
      listen(button, "click", () => onDay(key));
      host.append(button);
    }
  }
  function renderLifeOverview() {
    const today = personalDay(Date.now(), extraState),
      latest = checkins[checkins.length - 1],
      sleep = sleepLogs.find(
        (item) => lifeRecordDay(item, extraState, "sleepLogs") === today,
      ),
      food = foodLogs.filter(
        (item) => lifeRecordDay(item, extraState, "foodLogs") === today,
      ),
      monthEntries = checkins.filter((item) =>
        lifeRecordDay(item, extraState, "checkins").startsWith(
          today.slice(0, 7),
        ),
      ),
      mood = average(monthEntries, "mood"),
      weekStart = startOfWeek(today),
      weekItems = workouts.filter(
        (item) =>
          lifeRecordDay(item, extraState, "workouts") >= weekStart &&
          lifeRecordDay(item, extraState, "workouts") < shiftDate(weekStart, 7),
      );
    $("#life-sleep-summary").textContent = sleep
      ? sleep.hours + " ч"
      : "Записать сон";
    $("#life-food-summary").textContent = food.length
      ? food.reduce((sum, item) => sum + item.calories, 0) + " ккал"
      : "—";
    upgrades?.renderFinanceSummary();
    const adherence = workoutAdherence(weekItems, {
      ...extraState,
      illnessLogs: extraState.illnessLogs,
    });
    $("#life-training-summary").textContent = weekItems.length
      ? adherence.done +
        " / " +
        adherence.eligible +
        (adherence.excused ? " · болезнь: " + adherence.excused : "")
      : "—";
    const due = checkinDue();
    renderCheckinIndicators();
    $("#life-core-caption").textContent = due ? "Отметиться" : "Самочувствие";
    $("#life-checkin-open").setAttribute(
      "aria-label",
      due ? "Отметить самочувствие" : "Открыть статистику самочувствия",
    );
    all("#life-checkin-open .counterweight span").forEach((bar, index) => {
      const score = latest?.[["mood", "energy", "stress"][index]] || 3;
      bar.style.height = 16 + score * 4 + "px";
      bar.style.removeProperty("background");
    });
  }
  function renderLife() {
    if (activePage !== "life") return;
    $("#life-overview").hidden = lifeDetailOpen;
    $("#life-detail-header").hidden = !lifeDetailOpen;
    all("[data-life-tab]").forEach((button) =>
      button.setAttribute(
        "aria-pressed",
        String(lifeDetailOpen && button.dataset.lifeTab === lifeTab),
      ),
    );
    for (const name of ["mood", "sleep", "food", "training", "finances"])
      $("#life-" + name + "-view").hidden = !lifeDetailOpen || name !== lifeTab;
    $("#hydration-view").hidden =
      !lifeDetailOpen ||
      lifeTab !== "food" ||
      !lifeSettings(extraState).nutrition.water;
    $("#training-goals-view").hidden =
      !lifeDetailOpen || lifeTab !== "training";
    renderLifeOverview();
    lifeTracking?.render();
    if (lifeDetailOpen)
      ({
        mood: renderMood,
        sleep: renderSleep,
        food: renderFood,
        training: renderTraining,
        finances: () => upgrades?.renderFinances(),
      })[lifeTab]();
    applyLanguage();
    usability?.pageChanged(activePage);
    recordScreen();
  }
  all("[data-life-tab]").forEach((button) =>
    listen(button, "click", () => {
      resetLifeDates();
      lifeTab = button.dataset.lifeTab;
      if (lifeTab === "sleep") fillSleepForm($("#sleep-date").value);
      lifeDetailOpen = true;
      renderLife();
    }),
  );
  listen($("#life-overview-back"), "click", () => {
    goBack();
    persistState();
  });
  function renderMood() {
    const month = $("#mood-month").value || todayKey.slice(0, 7);
    $("#mood-month").value = month;
    if (!selectedLifeDay.startsWith(month)) selectedLifeDay = month + "-01";
    $("#life-day-date").value = selectedLifeDay;
    const entries = checkins.filter((item) =>
      personalDay(item.at, extraState).startsWith(month),
    );
    const mood = average(entries, "mood"),
      energy = average(entries, "energy"),
      stress = average(entries, "stress");
    $("#mood-average").textContent = mood === null ? "—" : mood.toFixed(1);
    $("#mood-ring").style.setProperty(
      "--ring-percent",
      mood === null ? "0%" : Math.round(((mood - 1) / 4) * 100) + "%",
    );
    $("#energy-average").textContent =
      "Энергия · " + (energy === null ? "—" : energy.toFixed(1));
    $("#stress-average").textContent =
      "Стресс · " + (stress === null ? "—" : stress.toFixed(1));
    $("#mood-count").textContent = entries.length
      ? entries.length + " отметок"
      : "Нет отметок";
    monthGrid(
      $("#mood-month-grid"),
      month,
      (key) => {
        const daily = entries.filter(
            (item) => personalDay(item.at, extraState) === key,
          ),
          value = average(daily, "mood");
        return {
          level: value === null ? 0 : Math.round(value),
          label:
            shortDate(key) +
            ": " +
            (value === null
              ? "нет отметок"
              : "настроение " + value.toFixed(1) + " из 5"),
        };
      },
      (key) => {
        selectedLifeDay = key;
        $("#life-day-date").value = key;
        renderMoodDay();
        renderMood();
      },
    );
    renderMoodDay();
    renderLifeInsights();
    usability?.renderMonthlySummary();
  }
  function renderMoodDay() {
    const key = selectedLifeDay,
      host = $("#life-day-detail");
    host.replaceChildren();
    const daily = checkins
        .filter((item) => personalDay(item.at, extraState) === key)
        .sort((a, b) => a.at - b.at),
      sleep = sleepLogs.find(
        (item) => lifeRecordDay(item, extraState, "sleepLogs") === key,
      ),
      foods = foodLogs.filter(
        (item) => lifeRecordDay(item, extraState, "foodLogs") === key,
      ),
      training = workouts.filter(
        (item) =>
          lifeRecordDay(item, extraState, "workouts") === key && item.done,
      );
    const recovery = recoveryLogs
        .filter((item) => item.date === key)
        .reduce((sum, item) => sum + item.duration, 0),
      water = waterLogs
        .filter((item) => lifeRecordDay(item, extraState, "waterLogs") === key)
        .reduce((sum, item) => sum + item.ml, 0);
    for (const [label, value] of lifeSettings(extraState).nutrition.water
      ? [["Вода", water ? water + " мл" : "нет записи"]]
      : []) {
      const row = make("div", "life-data-line");
      row.append(make("span", "", label), make("span", "", value));
      host.append(row);
    }
    for (const [label, value] of [
      ["Сон", sleep ? sleep.hours + " ч" : "нет записи"],
      [
        "Питание",
        foods.length
          ? lifeSettings(extraState).nutrition.calories
            ? foods.reduce((sum, item) => sum + item.calories, 0) + " ккал"
            : foods.length + " записей"
          : "нет записи",
      ],
      [
        "Тренировка",
        training.length ? training.length + " выполнено" : "нет записи",
      ],
    ]) {
      const row = action(
        "",
        () =>
          openLifeCategory(
            label === "Сон"
              ? "sleep"
              : label === "Питание"
                ? "food"
                : "training",
            key,
          ),
        "life-data-line life-day-category",
      );
      row.append(make("span", "", label), make("span", "", value + " ›"));
      host.append(row);
    }
    if (!daily.length) {
      host.append(
        make(
          "p",
          "aux-note aux-empty",
          "Отметок самочувствия за этот день нет.",
        ),
      );
      experience?.renderDay(key);
      return;
    }
    if (!experience)
      daily.forEach((item) => {
        const row = make(
          "button",
          "life-detail-row life-checkin-entry cursor-interaction",
        );
        row.type = "button";
        row.dataset.checkinAt = String(item.at);
        const time = dateFormatter({
            hour: "2-digit",
            minute: "2-digit",
          }).format(new Date(item.at)),
          top = make("span", "life-entry-heading");
        top.append(
          make("time", "", time),
          make("span", "life-entry-edit", "Изменить"),
        );
        row.append(top);
        for (const [name, label] of [
          ["mood", "Настроение"],
          ["energy", "Энергия"],
          ["stress", "Стресс"],
        ]) {
          const line = make("span", "life-entry-score");
          line.append(
            make("span", "", label),
            make("strong", "", item[name] + " / 5"),
          );
          row.append(line);
        }
        if (item.note) row.append(make("small", "", item.note));
        row.setAttribute(
          "aria-label",
          "Изменить самочувствие: " + shortDate(key) + ", " + time,
        );
        listen(row, "click", () => {
          checkinFromLife = true;
          showStateDialog(row, item);
        });
        host.append(row);
      });
    experience?.renderDay(key);
  }
  function openLifeCategory(tab, day) {
    lifeTab = tab;
    lifeDetailOpen = true;
    selectedLifeDay = day;
    if (tab === "sleep") {
      $("#sleep-month").value = day.slice(0, 7);
      $("#sleep-date").value = day;
      fillSleepForm(day);
    } else if (tab === "food") $("#food-day").value = day;
    else if (tab === "training") $("#training-month").value = day.slice(0, 7);
    showPage("life");
    renderLife();
  }
  listen($("#mood-month"), "change", renderMood);
  listen($("#life-day-date"), "change", (event) => {
    if (!event.target.value) return;
    selectedLifeDay = event.target.value;
    $("#mood-month").value = selectedLifeDay.slice(0, 7);
    renderMood();
  });
  function renderSleep() {
    const month = $("#sleep-month").value || todayKey.slice(0, 7);
    $("#sleep-month").value = month;
    const entries = sleepLogs.filter((item) =>
        lifeRecordDay(item, extraState, "sleepLogs").startsWith(month),
      ),
      avg = average(entries, "hours");
    $("#sleep-average").textContent =
      avg === null
        ? "Нет записей"
        : avg.toFixed(1) + " ч в среднем за " + entries.length + " ночей";
    monthGrid(
      $("#sleep-month-grid"),
      month,
      (key) => {
        const item = sleepLogs.find(
          (entry) => lifeRecordDay(entry, extraState, "sleepLogs") === key,
        );
        return {
          level: item
            ? Math.max(1, Math.min(5, Math.round(item.hours / 2)))
            : 0,
          label:
            shortDate(key) +
            ": " +
            (item ? item.hours + " ч сна" : "нет записи") +
            (illnessOnDay(
              extraState.illnessLogs,
              key,
              personalDay(Date.now(), extraState),
            )
              ? " · болезнь / восстановление, можно пропустить"
              : ""),
        };
      },
      (key) => {
        $("#sleep-date").value = key;
        fillSleepForm(key, true);
        selectedLifeDay = key;
        renderSleep();
      },
    );
    const host = $("#sleep-log");
    host.replaceChildren();
    $("#sleep-history-count").textContent = entries.length
      ? "· " + entries.length
      : "";
    if (!entries.length)
      host.append(
        make(
          "p",
          "aux-note",
          "Запишите первую ночь, чтобы увидеть карту месяца.",
        ),
      );
    entries
      .slice()
      .sort((a, b) =>
        lifeRecordDay(b, extraState, "sleepLogs").localeCompare(
          lifeRecordDay(a, extraState, "sleepLogs"),
        ),
      )
      .forEach((item) => {
        const recordDay = lifeRecordDay(item, extraState, "sleepLogs");
        const row = make(
          "div",
          "life-log-item",
          shortDate(recordDay) +
            " · " +
            item.hours +
            (effectiveLanguage() === "en" ? " h" : " ч") +
            (item.quality
              ? (effectiveLanguage() === "en"
                  ? " · quality "
                  : " · качество ") +
                item.quality +
                "/5"
              : ""),
        );
        if (item.note) {
          const note = make("small", "", item.note);
          note.dataset.userContent = "";
          row.append(note);
        }
        const edit = make("button", "cursor-interaction", "Изменить");
        edit.type = "button";
        listen(edit, "click", () => {
          $("#sleep-date").value = recordDay;
          fillSleepForm(recordDay, true);
          $("#sleep-hours").focus();
        });
        const title = action(
          row.firstChild.textContent,
          () => edit.click(),
          "sleep-record-title",
        );
        row.firstChild.replaceWith(title);
        const remove = action(
          "Удалить",
          () =>
            removeWithUndo(sleepLogs, item, () => {
              renderSleep();
              renderMoodDay();
            }),
          "text-button",
        );
        row.append(remove);
        host.append(row);
      });
    let notice = $("#sleep-illness-notice");
    if (!notice) {
      notice = make("p", "illness-section-notice");
      notice.id = "sleep-illness-notice";
      $("#sleep-entry-disclosure").before(notice);
    }
    const sleepDay =
      $("#sleep-date").value || personalDay(Date.now(), extraState);
    notice.hidden = !illnessOnDay(
      extraState.illnessLogs,
      sleepDay,
      personalDay(Date.now(), extraState),
    );
    notice.textContent =
      "Болезнь / восстановление · сон можно записать или пропустить этот день. Пропуск не считается невыполнением цели.";
  }
  listen($("#sleep-month"), "change", renderSleep);
  function fillSleepForm(date, editing = false) {
    const entry = sleepLogs.find(
      (item) => lifeRecordDay(item, extraState, "sleepLogs") === date,
    );
    const sickDay = illnessOnDay(
      extraState.illnessLogs,
      date,
      personalDay(Date.now(), extraState),
    );
    $("#sleep-hours").value = entry ? String(entry.hours) : "";
    $("#sleep-quality").value = String(entry?.quality || "");
    $("#sleep-quality").dispatchEvent(new Event("change"));
    $("#sleep-note").value = entry?.note || "";
    $("#sleep-extra").open = Boolean(entry?.quality || entry?.note);
    $("#sleep-entry-status").textContent = entry
      ? "Запись за этот день уже есть — её можно изменить."
      : sickDay
        ? "День болезни: можно не записывать сон."
        : "Сон за этот день ещё не записан. Укажи примерную длительность.";
    $("#sleep-entry-summary").textContent = entry
      ? shortDate(date) + " · " + entry.hours + " ч · изменить"
      : sickDay
        ? "День болезни · записать по желанию"
        : "Записать сон";
    $("#sleep-entry-disclosure").open = editing || (!entry && !sickDay);
  }
  listen($("#sleep-date"), "change", () => {
    fillSleepForm($("#sleep-date").value, true);
    renderSleep();
  });
  all("[data-sleep-hours]").forEach((button) =>
    listen(button, "click", () => {
      $("#sleep-hours").value = button.dataset.sleepHours;
    }),
  );
  listen($("#sleep-form"), "submit", (event) => {
    event.preventDefault();
    const date = $("#sleep-date").value,
      hours = Number($("#sleep-hours").value),
      quality = Number($("#sleep-quality").value) || null,
      note = $("#sleep-note").value.trim();
    if (!date || !Number.isFinite(hours) || hours < 0 || hours > 24) return;
    const existing = sleepLogs.find(
      (item) => lifeRecordDay(item, extraState, "sleepLogs") === date,
    );
    if (existing)
      Object.assign(existing, {
        date,
        hours,
        quality,
        note,
        manualOverride: true,
        personalDate: true,
      });
    else sleepLogs.push({ date, hours, quality, note, manualOverride: true });
    renderState(false);
    fillSleepForm(date);
    $("#sleep-entry-status").textContent = "Сон сохранён.";
    $("#sleep-month").value = date.slice(0, 7);
    selectedLifeDay = date;
    renderSleep();
    renderMoodDay();
  });
  function renderFood() {
    renderHydration();
    renderSavedMeals();
    const day = $("#food-day").value || personalDay(Date.now(), extraState);
    $("#food-day").value = day;
    if (!$("#food-date").value) $("#food-date").value = day;
    const items = foodLogs.filter(
        (item) => lifeRecordDay(item, extraState, "foodLogs") === day,
      ),
      sum = (key) =>
        items.reduce((total, item) => total + Number(item[key] || 0), 0),
      total = sum("calories");
    $("#food-day-total").innerHTML = total + " <small>ккал за день</small>";
    $("#food-day-macros").textContent = items.length
      ? "Б " +
        sum("protein").toFixed(1) +
        " г · Ж " +
        sum("fat").toFixed(1) +
        " г · У " +
        sum("carbs").toFixed(1) +
        " г"
      : "БЖУ появятся после записи еды.";
    const host = $("#food-log");
    host.replaceChildren();
    if (!items.length)
      host.append(make("p", "aux-note", "За этот день записей нет."));
    items.forEach((item) => {
      const row = make("div", "life-log-item");
      const copy = action(
        item.name +
          " · " +
          item.calories +
          (effectiveLanguage() === "en" ? " kcal" : " ккал") +
          (item.nutritionSource === "estimate"
            ? effectiveLanguage() === "en"
              ? " · estimated"
              : " · оценка"
            : ""),
        () => usability?.editFood(item, copy),
        "food-log-copy",
      );
      copy.dataset.userContent = "";
      const macros = make("details", "food-record-macros");
      macros.append(make("summary", "cursor-interaction", "БЖУ"));
      macros.append(
        make(
          "small",
          "",
          "Б " +
            item.protein +
            " · Ж " +
            item.fat +
            " · У " +
            item.carbs +
            " г",
        ),
      );
      const more = action(
        "⋯",
        () => usability?.itemMenu("food", item, more),
        "text-button entity-more",
      );
      more.setAttribute("aria-label", "Действия с записью: " + item.name);
      const body = make("div", "food-log-body");
      body.append(copy, macros);
      row.append(body, more);
      host.append(row);
    });
    const monthItems = foodLogs.filter((item) =>
        lifeRecordDay(item, extraState, "foodLogs").startsWith(day.slice(0, 7)),
      ),
      days = [
        ...new Set(
          monthItems.map((item) => lifeRecordDay(item, extraState, "foodLogs")),
        ),
      ],
      monthTotal = monthItems.reduce((sum, item) => sum + item.calories, 0);
    $("#food-month-average").textContent = days.length
      ? Math.round(monthTotal / days.length) +
        " ккал за " +
        days.length +
        " записанных дней"
      : "—";
    $("#food-target").value = foodTarget || "";
    $("#food-balance").textContent = !foodTarget
      ? "Цель не задана"
      : items.length
        ? total >= foodTarget
          ? "На " + (total - foodTarget) + " ккал выше цели"
          : "На " + (foodTarget - total) + " ккал ниже цели"
        : "Нет записей за день";
    experience?.renderFood();
    lifeTracking?.render();
  }
  listen($("#food-day"), "change", () => {
    if (!editingMealTemplate) $("#food-date").value = $("#food-day").value;
    renderFood();
  });
  listen($("#food-ai-open"), "click", () => {
    const button = root.querySelector(".ai-open");
    if (!button) return;
    button.click();
    const prompt = $("#ai-prompt");
    if (prompt && !prompt.value.trim()) {
      prompt.value =
        "Запиши питание за " + ($("#food-day").value || todayKey) + ": ";
      prompt.dispatchEvent(new Event("input", { bubbles: true }));
    }
    prompt?.focus();
  });
  listen($("#food-target"), "change", (event) => {
    foodTarget = Math.max(0, Number(event.target.value) || 0);
    renderFood();
  });
  listen($("#food-form"), "submit", (event) => {
    event.preventDefault();
    const name = $("#food-name").value.trim(),
      calories = Number($("#food-calories").value),
      date = $("#food-date").value || $("#food-day").value || todayKey;
    if (!name || !Number.isFinite(calories) || calories < 0) return;
    const portion = experience?.readFoodRecord();
    if (experience && !portion) return;
    const meal = {
      name,
      calories,
      protein: Number($("#food-protein").value) || 0,
      fat: Number($("#food-fat").value) || 0,
      carbs: Number($("#food-carbs").value) || 0,
      ...portion,
    };
    if (!editingMealTemplate) {
      foodLogs.push(
        stampLifeRecord(
          { id: nextId++, date, ...meal },
          extraState,
          "foodLogs",
        ),
      );
      $("#food-day").value = date;
    }
    if ($("#food-save-meal").checked) saveMealTemplate(meal);
    resetFoodEditor();
    renderFood();
    renderMoodDay();
  });
  function renderTraining() {
    if (training) {
      training.render();
      return;
    }
    renderTrainingGoals();
    const month = $("#training-month").value || todayKey.slice(0, 7);
    $("#training-month").value = month;
    const items = workouts
        .filter((item) => item.date.startsWith(month))
        .sort(
          (a, b) =>
            a.date.localeCompare(b.date) || a.time.localeCompare(b.time),
        ),
      done = items.filter((item) => item.done).length;
    $("#training-count").innerHTML =
      done +
      " <small>выполнено из " +
      items.length +
      " запланированных</small>";
    let weeks = $("#training-weeks");
    if (!weeks) {
      weeks = make("div", "training-weeks");
      weeks.id = "training-weeks";
      $("#training-count").after(weeks);
    }
    weeks.replaceChildren();
    const monthEnd = dateKey(
        new Date(Number(month.slice(0, 4)), Number(month.slice(5)), 0),
      ),
      weekStarts = [];
    for (
      let day = startOfWeek(month + "-01");
      day <= monthEnd;
      day = shiftDate(day, 7)
    )
      weekStarts.push(day);
    const weekTotals = weekStarts.map(
        (start) =>
          items.filter(
            (item) =>
              item.done &&
              item.date >= start &&
              item.date < shiftDate(start, 7),
          ).length,
      ),
      peak = Math.max(1, ...weekTotals);
    weekTotals.forEach((total, index) => {
      const cell = make("div", "training-week");
      const track = make("span", "training-week-track"),
        fill = make("span", "training-week-fill");
      fill.style.height = Math.round((total / peak) * 100) + "%";
      track.append(fill);
      cell.append(
        make("span", "", String(total)),
        track,
        make("span", "", "Нед. " + (index + 1)),
      );
      weeks.append(cell);
    });
    const host = $("#training-log");
    host.replaceChildren();
    if (!items.length)
      host.append(
        make(
          "p",
          "aux-note",
          "Запланируйте тренировку: она появится здесь и в расписании.",
        ),
      );
    items.forEach((item) => {
      const row = make("div", "workout-row");
      const check = make("button", "task-check cursor-interaction");
      check.type = "button";
      check.setAttribute("aria-pressed", String(item.done));
      check.setAttribute(
        "aria-label",
        (item.done ? "Вернуть в план: " : "Отметить выполненной: ") + item.name,
      );
      listen(check, "click", () => {
        item.done = !item.done;
        if (!item.done) item.win = false;
        renderTraining();
        renderMoodDay();
        renderWins();
        persistState();
      });
      const copy = make("div", "project-action-copy");
      const name = make(
        "button",
        "project-item-name cursor-interaction",
        item.name,
      );
      name.type = "button";
      listen(name, "click", () => {
        editingWorkoutId = item.id;
        $("#training-repeat").value = "1";
        $("#training-repeat").disabled = true;
        $("#training-cancel").hidden = false;
        $("#training-name").value = item.name;
        $("#training-focus").value = item.focus || item.name;
        $("#training-date").value = item.date;
        $("#training-time").value = item.time;
        $("#training-duration").value = String(item.duration);
        $("#training-result").value = item.result || "";
        $('#training-form button[type="submit"]').textContent =
          "Сохранить изменения";
        $("#training-name").focus();
      });
      copy.append(
        name,
        make(
          "small",
          "project-action-meta",
          shortDate(item.date) +
            " · " +
            item.time +
            " · " +
            (item.focus && item.focus !== item.name ? item.focus + " · " : "") +
            (item.result ? " · " + item.result : ""),
        ),
      );
      row.append(check, copy);
      if (item.done) {
        const win = make(
          "button",
          "win-toggle cursor-interaction",
          item.win ? "В победах" : "+ В победы",
        );
        win.type = "button";
        win.setAttribute("aria-pressed", String(Boolean(item.win)));
        listen(win, "click", () => {
          item.win = !item.win;
          renderTraining();
          renderWins();
          persistState();
        });
        row.append(win);
      }
      const remove = make("button", "text-button cursor-interaction", "×");
      remove.type = "button";
      remove.setAttribute("aria-label", "Удалить тренировку: " + item.name);
      listen(remove, "click", () => {
        const linked = events.filter((event) => event.workoutId === item.id);
        removeWithUndo(workouts, item, () => {
          for (const event of linked) {
            const index = events.indexOf(event);
            if (workouts.includes(item) && index < 0) events.push(event);
            else if (!workouts.includes(item) && index >= 0)
              events.splice(index, 1);
          }
          renderTraining();
          renderCalendar();
          renderMoodDay();
          renderWins();
        });
      });
      row.append(remove);
      host.append(row);
    });
    refreshIcons();
  }
  listen($("#training-month"), "change", renderTraining);
  listen($("#training-form"), "submit", (event) => {
    event.preventDefault();
    const name = $("#training-name").value.trim(),
      focus = name,
      date = $("#training-date").value,
      time = $("#training-time").value,
      duration = Number($("#training-duration").value),
      result = $("#training-result").value.trim(),
      repeat = Number($("#training-repeat").value) || 1;
    if (!name || !date || !time || duration < 10 || duration > 240) return;
    const endMinutes = minutes(time) + duration;
    if (endMinutes > 1439) return;
    const end = clockLabel(endMinutes / 60);
    upgrades?.rememberExercise(name, duration);
    let workout = workouts.find((item) => item.id === editingWorkoutId);
    if (workout) {
      Object.assign(workout, { name, focus, date, time, duration, result });
      const linked = events.find((item) => item.workoutId === workout.id);
      if (linked)
        Object.assign(linked, { title: name, date, start: time, end });
    } else
      for (let index = 0; index < repeat; index++) {
        const workoutDate = shiftDate(date, index * 7),
          planned = {
            id: nextId++,
            name,
            focus,
            date: workoutDate,
            time,
            duration,
            result: index === 0 ? result : "",
            done: false,
          };
        workouts.push(planned);
        events.push({
          id: nextId++,
          workoutId: planned.id,
          title: name,
          date: workoutDate,
          start: time,
          end,
          context: "Личное",
          tone: "pine",
        });
      }
    editingWorkoutId = null;
    $("#training-form").reset();
    $("#training-repeat").disabled = false;
    $("#training-cancel").hidden = true;
    $('#training-form button[type="submit"]').textContent =
      "В план и расписание";
    $("#training-date").value = todayKey;
    $("#training-month").value = date.slice(0, 7);
    renderTraining();
    renderCalendar();
    renderMoodDay();
  });
  listen($("#training-cancel"), "click", () => {
    editingWorkoutId = null;
    $("#training-form").reset();
    $("#training-repeat").disabled = false;
    $("#training-cancel").hidden = true;
    $('#training-form button[type="submit"]').textContent =
      "В план и расписание";
    $("#training-date").value = todayKey;
    $("#training-time").value = "09:00";
  });
  function renderHydration() {
    const date = $("#food-day").value || todayKey,
      items = waterLogs.filter(
        (item) => lifeRecordDay(item, extraState, "waterLogs") === date,
      ),
      total = items.reduce((sum, item) => sum + item.ml, 0),
      remaining = Math.max(0, waterTarget - total);
    $("#water-total").replaceChildren(
      document.createTextNode(String(total) + " "),
      make("small", "", "/ " + waterTarget + " мл"),
    );
    $("#water-bottle").style.setProperty(
      "--water-fill",
      Math.min(100, (total / waterTarget) * 100) + "%",
    );
    $("#water-bottle").setAttribute(
      "aria-label",
      "Вода " + total + " из " + waterTarget + " мл. Добавить 250 мл",
    );
    $("#water-status").textContent = remaining
      ? "До вашей цели ещё " + remaining + " мл"
      : "Ваша цель на день достигнута";
    $("#water-target").value = String(waterTarget);
    $("#water-undo").disabled = !items.length;
    $("#water-day-copy").textContent =
      shortDate(date) + " · " + total + " / " + waterTarget + " мл";
  }
  function addWater(ml) {
    if (!Number.isFinite(ml) || ml < 1 || ml > 5000) return;
    waterLogs.push(
      stampLifeRecord(
        {
          id: nextId++,
          date: $("#food-day").value || todayKey,
          ml,
          at: Date.now(),
        },
        extraState,
        "waterLogs",
      ),
    );
    renderHydration();
    persistState();
  }
  listen($("#water-bottle"), "click", () => addWater(250));
  listen($("#water-add-250"), "click", () => addWater(250));
  listen($("#water-add-500"), "click", () => addWater(500));
  listen($("#water-form"), "submit", (event) => {
    event.preventDefault();
    addWater(Number($("#water-amount").value));
    $("#water-form").reset();
  });
  listen($("#water-target"), "change", (event) => {
    if (!event.target.checkValidity()) {
      event.target.reportValidity();
      return;
    }
    waterTarget = Number(event.target.value);
    renderHydration();
    persistState();
  });
  listen($("#water-undo"), "click", () => {
    const last = waterLogs
      .filter(
        (item) =>
          lifeRecordDay(item, extraState, "waterLogs") ===
          ($("#food-day").value || personalDay(Date.now(), extraState)),
      )
      .at(-1);
    if (last) removeWithUndo(waterLogs, last, renderHydration);
  });
  function renderTrainingGoals() {
    const chips = $("#goal-chips");
    chips.replaceChildren();
    if (!trainingGoals.length) {
      const add = make(
        "button",
        "goal-chip cursor-interaction",
        "Добавить цель",
      );
      add.type = "button";
      listen(add, "click", () => openGoals(null, add));
      chips.append(add);
    }
    trainingGoals.slice(0, 3).forEach((goal) => {
      const progress = goalPercent(goal),
        button = make("button", "goal-chip cursor-interaction");
      button.type = "button";
      button.dataset.goalId = String(goal.id);
      const wheel = make("span", "goal-wheel");
      wheel.style.setProperty("--goal-progress", progress + "%");
      wheel.append(make("span", "", progress + "%"));
      button.append(wheel, make("span", "goal-chip-name", goal.name));
      button.setAttribute(
        "aria-label",
        goal.name + ": " + progress + "%. Открыть цель",
      );
      button.setAttribute(
        "data-tooltip",
        (goal.focus || "Тренировки") +
          " · " +
          goal.name +
          " · " +
          goal.current +
          " / " +
          goal.target +
          " " +
          goal.unit,
      );
      listen(button, "click", () => openGoals(goal, button));
      chips.append(button);
    });
    if (trainingGoals.length > 3) {
      const more = make(
        "button",
        "goal-chip goal-chip-more cursor-interaction",
        "+" + (trainingGoals.length - 3),
      );
      more.type = "button";
      more.setAttribute("aria-label", "Открыть все цели");
      listen(more, "click", () => openGoals(null, more));
      chips.append(more);
    }
    if (activeDialog?.id !== "goals-dialog") {
      refreshIcons();
      return;
    }
    const host = $("#goals-list");
    host.replaceChildren();
    if (!trainingGoals.length)
      host.append(
        make(
          "p",
          "aux-note",
          "Задайте первый ориентир: повторы, вес, расстояние или время.",
        ),
      );
    trainingGoals.forEach((goal) => {
      const row = make("article", "goal-item");
      row.dataset.goalId = String(goal.id);
      const top = make("div", "goal-top"),
        name = make("button", "goal-name-button cursor-interaction", goal.name),
        remove = make("button", "text-button cursor-interaction", "×");
      name.type = "button";
      listen(name, "click", () => fillGoalForm(goal));
      remove.type = "button";
      remove.setAttribute("aria-label", "Удалить цель: " + goal.name);
      listen(remove, "click", () => {
        if (editingGoal === goal) fillGoalForm(null);
        removeWithUndo(trainingGoals, goal, renderTrainingGoals);
      });
      top.append(name, remove);
      const track = make("div", "goal-progress"),
        fill = make("div", "goal-fill"),
        progress = goalPercent(goal);
      fill.style.width = progress + "%";
      track.append(fill);
      track.setAttribute("role", "progressbar");
      track.setAttribute("aria-valuemin", "0");
      track.setAttribute("aria-valuemax", "100");
      track.setAttribute("aria-valuenow", String(progress));
      track.setAttribute("aria-label", goal.name);
      const meta = make("div", "goal-meta");
      meta.append(
        make("span", "", goal.current + " / " + goal.target + " " + goal.unit),
        make("span", "", progress + "%"),
      );
      const last = goal.history.at(-1),
        previous = goal.history.at(-2),
        delta =
          last && previous
            ? Math.round((last.value - previous.value) * 100) / 100
            : null,
        trend = make(
          "p",
          "aux-note",
          goal.current >= goal.target
            ? "Цель достигнута"
            : delta === null
              ? "Начало · " + goal.baseline + " " + goal.unit
              : delta > 0
                ? "К цели: +" + delta + " " + goal.unit
                : delta < 0
                  ? "Ниже прошлого результата: " + delta + " " + goal.unit
                  : "Результат без изменений",
        ),
        measure = make("div", "goal-measure"),
        input = make("input");
      input.type = "number";
      input.min = "0";
      input.max = "100000";
      input.step = "0.1";
      input.inputMode = "decimal";
      input.required = true;
      input.value = String(goal.current);
      input.setAttribute("aria-label", "Новый результат: " + goal.name);
      const save = make("button", "button cursor-interaction", "Записать");
      save.type = "button";
      listen(save, "click", () => {
        if (!input.checkValidity()) {
          input.reportValidity();
          return;
        }
        goal.current = Number(input.value);
        goal.history.push({ at: Date.now(), value: goal.current });
        renderTrainingGoals();
        persistState();
      });
      measure.append(input, save);
      row.append(
        top,
        make("small", "aux-note", goal.focus || "Тренировки"),
        track,
        meta,
        trend,
        measure,
      );
      const history = make("details", "goal-history"),
        summary = make("summary", "cursor-interaction", "История результатов");
      history.append(summary);
      goal.history
        .slice()
        .reverse()
        .slice(0, 30)
        .forEach((point) =>
          history.append(
            make(
              "div",
              "life-data-line",
              shortDate(dateKey(new Date(point.at))) +
                " · " +
                point.value +
                " " +
                goal.unit,
            ),
          ),
        );
      row.append(history);
      host.append(row);
    });
    refreshIcons();
    fitDialog();
    applyLanguage();
  }
  function goalPercent(goal) {
    return Math.round(
      Math.max(
        0,
        Math.min(
          100,
          ((goal.current - goal.baseline) / (goal.target - goal.baseline)) *
            100,
        ),
      ),
    );
  }
  function fillGoalForm(goal) {
    editingGoal = goal;
    $("#goal-form").reset();
    $("#goal-name").value = goal?.name || "";
    $("#goal-baseline").value = String(goal?.baseline || 0);
    $("#goal-target").value = goal ? String(goal.target) : "";
    $("#goal-unit").value = goal?.unit || "раз";
    $("#goal-focus").value = goal?.focus || "Подтягивания";
    $("#goal-error").hidden = true;
    $("#goal-editor-title").textContent = goal ? "Изменить цель" : "Новая цель";
    $('#goal-form button[type="submit"]').textContent = goal
      ? "Сохранить"
      : "Добавить цель";
    applyLanguage();
  }
  function openGoals(goal, opener) {
    fillGoalForm(goal);
    openDialog("goals-dialog", opener);
    renderTrainingGoals();
  }
  listen($("#goals-manage"), "click", (event) =>
    openGoals(null, event.currentTarget),
  );
  listen($("#goal-new"), "click", () => fillGoalForm(null));
  listen($("#goal-form"), "submit", (event) => {
    event.preventDefault();
    if (activeDialog?.id !== "goals-dialog") return;
    const baseline = Number($("#goal-baseline").value),
      target = Number($("#goal-target").value),
      name = $("#goal-name").value.trim(),
      unit = $("#goal-unit").value,
      focus = $("#goal-focus").value;
    if (!name || target <= baseline) {
      $("#goal-error").hidden = false;
      return;
    }
    if (editingGoal)
      Object.assign(editingGoal, { name, unit, focus, baseline, target });
    else
      trainingGoals.push({
        id: nextId++,
        name,
        unit,
        focus,
        baseline,
        current: baseline,
        target,
        history: [{ at: Date.now(), value: baseline }],
      });
    $("#goal-error").hidden = true;
    closeDialog();
    renderTrainingGoals();
    editingGoal = null;
  });
  function syncProjectOptions() {
    for (const id of ["capture-project", "task-context", "event-context"]) {
      const select = $("#" + id),
        previous = select.value;
      select.replaceChildren();
      if (id === "capture-project") {
        const placeholder = document.createElement("option");
        placeholder.value = "";
        placeholder.textContent = "Выберите проект";
        select.append(placeholder);
      } else {
        const personal = document.createElement("option");
        personal.textContent = personalProject;
        personal.value = personalProject;
        select.append(personal);
      }
      projects
        .filter(
          (project) =>
            id === "capture-project" || project.system !== "unassigned",
        )
        .forEach((project) => {
          const option = document.createElement("option");
          option.textContent = project.name;
          select.append(option);
        });
      if ([...select.options].some((option) => option.value === previous))
        select.value = previous;
    }
  }
  function projectTone(name) {
    return projects.find((project) => project.name === name)?.tone || "sun";
  }
  function collapseProjectList() {
    $("#project-list").hidden = true;
    $("#project-list-toggle").setAttribute("aria-expanded", "false");
  }
  listen($("#project-list-toggle"), "click", () => {
    const list = $("#project-list");
    list.hidden = !list.hidden;
    $("#project-list-toggle").setAttribute(
      "aria-expanded",
      String(!list.hidden),
    );
  });
  listen(root, "click", (event) => {
    if (!event.target.closest(".project-list-panel")) collapseProjectList();
  });
  listen($(".project-list-panel"), "keydown", (event) => {
    if (event.key !== "Escape" || $("#project-list").hidden) return;
    event.preventDefault();
    collapseProjectList();
    $("#project-list-toggle").focus();
  });
  function renderProjects() {
    if (activePage !== "projects") return;
    const list = $("#project-list");
    list.replaceChildren();
    if (!projects.some((project) => project.id === selectedProjectId))
      selectedProjectId = projects[0]?.id;
    const pendingByProject = new Map();
    for (const collection of [tasks, events])
      for (const item of collection)
        if (!item.done)
          pendingByProject.set(
            item.context,
            (pendingByProject.get(item.context) || 0) + 1,
          );
    projects.forEach((project) => {
      const count = pendingByProject.get(project.name) || 0;
      const button = make("button", "project-option cursor-interaction");
      button.type = "button";
      button.dataset.projectId = String(project.id);
      button.setAttribute(
        "aria-current",
        String(project.id === selectedProjectId),
      );
      const dot = make("span", "project-dot");
      dot.dataset.tone = project.tone;
      dot.setAttribute("aria-hidden", "true");
      button.append(
        dot,
        make("span", "project-option-name", project.name),
        make("span", "project-option-count", String(count)),
      );
      listen(button, "click", () => {
        selectedProjectId = project.id;
        collapseProjectList();
        renderProjects();
        applyLanguage();
      });
      list.append(button);
    });
    const project = projects.find((item) => item.id === selectedProjectId);
    $("#project-selected-name").textContent =
      project?.name || "Выберите проект";
    $("#project-list-toggle").disabled = !projects.length;
    $("#project-name").textContent = project?.name || "Выберите проект";
    $("#project-description").textContent =
      project?.description ||
      (effectiveLanguage() === "en"
        ? "Add a short project goal."
        : "Добавьте короткую цель проекта.");
    database?.renderProject(project);
    $("#project-hero").dataset.tone = project?.tone || "sun";
    const items = [
      ...tasks
        .filter((item) => item.context === project?.name)
        .map((item) => ({ kind: "task", item })),
      ...events
        .filter((item) => item.context === project?.name && !item.workoutId)
        .map((item) => ({ kind: "event", item })),
    ].sort((a, b) =>
      (a.item.date || todayKey).localeCompare(b.item.date || todayKey),
    );
    const done = items.filter(({ item }) => item.done).length;
    $(".project-progress").hidden = !items.length;
    $("#project-progress-fill").style.width =
      (items.length ? Math.round((done / items.length) * 100) : 0) + "%";
    $("#project-progress-label").textContent =
      "Готово " + done + " из " + items.length;
    $("#project-task-add").disabled = !project;
    $("#project-edit").disabled = !project || project.system === "unassigned";
    $("#project-remove").hidden = project?.system === "unassigned";
    $("#project-remove").disabled = !project || project.system === "unassigned";
    $(".project-section-head h3").textContent = "Этапы";
    const host = $("#project-task-list");
    host.replaceChildren();
    host.className = "project-board";
    const stages = [
        ["planned", "План"],
        ["active", "В работе"],
        ["done", "Готово"],
      ],
      stageOf = (item) =>
        item.done ? "done" : item.status === "active" ? "active" : "planned";
    stages.forEach(([stage, label]) => {
      const column = make("section", "project-column"),
        group = items
          .filter(({ item }) => stageOf(item) === stage)
          .sort(
            (a, b) => (a.item.order ?? Infinity) - (b.item.order ?? Infinity),
          ),
        heading = make("h4", "project-column-head", label);
      column.dataset.stage = stage;
      heading.append(make("span", "", String(group.length)));
      column.append(heading);
      const body = make("div", "project-column-body");
      if (stage === "done") {
        const collapsed = extraState.uiPreferences.collapseDone !== false;
        column.dataset.collapsed = String(collapsed);
        body.hidden = collapsed;
        heading.tabIndex = 0;
        heading.setAttribute("role", "button");
        heading.setAttribute("aria-expanded", String(!collapsed));
        const toggle = () => {
          extraState.uiPreferences.collapseDone = !collapsed;
          renderProjects();
          persistState();
        };
        listen(heading, "click", toggle);
        listen(heading, "keydown", (event) => {
          if (["Enter", " "].includes(event.key)) {
            event.preventDefault();
            toggle();
          }
        });
      }
      if (!group.length)
        body.append(
          make(
            "p",
            "project-column-empty",
            stage === "done" ? "Пока нет завершённых дел" : "Нет дел",
          ),
        );
      group.forEach(({ kind, item }) => {
        const card = make("article", "project-board-card");
        card.dataset.done = String(Boolean(item.done));
        const titleRow = make("div", "project-card-title"),
          check = make("button", "task-check cursor-interaction");
        check.type = "button";
        check.setAttribute("aria-pressed", String(Boolean(item.done)));
        check.setAttribute(
          "aria-label",
          (item.done ? "Вернуть задачу: " : "Завершить задачу: ") + item.title,
        );
        listen(check, "click", () => {
          item.done = !item.done;
          if (!item.done) item.win = false;
          renderTasks();
          renderProjects();
          renderWins();
          persistState();
        });
        const title = make(
          "button",
          "project-item-name cursor-interaction",
          item.title,
        );
        title.type = "button";
        listen(title, "click", () =>
          kind === "task"
            ? openTask(item, title)
            : openEvent(item, null, title),
        );
        titleRow.append(check, title);
        card.append(
          titleRow,
          make(
            "small",
            "project-card-meta",
            (item.date ? shortDate(item.date) : "Без даты") +
              (item.start ? " · " + item.start : ""),
          ),
        );
        const footer = make("div", "project-card-footer"),
          select = make("select", "project-stage-select");
        select.setAttribute("aria-label", "Этап задачи: " + item.title);
        stages.forEach(([value, text]) => {
          const option = make("option", "", text);
          option.value = value;
          select.append(option);
        });
        select.value = stageOf(item);
        listen(select, "change", () => {
          item.status = select.value;
          item.done = select.value === "done";
          item.order = undefined;
          if (!item.done) item.win = false;
          renderTasks();
          renderProjects();
          renderWins();
          persistState();
        });
        footer.append(select);
        const more = action(
          "⋯",
          () => usability?.itemMenu(kind, item, more),
          "text-button entity-more",
        );
        more.setAttribute("aria-label", "Действия с задачей: " + item.title);
        footer.append(more);
        if (item.done) {
          const win = make("button", "task-win cursor-interaction");
          win.type = "button";
          win.setAttribute("aria-pressed", String(Boolean(item.win)));
          win.setAttribute(
            "aria-label",
            item.win ? "Убрать из побед" : "Добавить в победы",
          );
          win.setAttribute(
            "data-tooltip",
            item.win ? "В победах" : "Добавить в победы",
          );
          const icon = make("i");
          icon.dataset.lucide = "award";
          icon.setAttribute("aria-hidden", "true");
          win.append(icon);
          listen(win, "click", () => {
            item.win = !item.win;
            renderProjects();
            renderWins();
            persistState();
          });
          footer.append(win);
        }
        card.append(footer);
        attachProjectDrag(card, kind, item);
        body.append(card);
      });
      column.append(body);
      host.append(column);
    });
    upgrades?.renderProjectViews(project);
    experience?.renderProject(project);
    refreshIcons();
  }
  function openProjectDialog(project, opener) {
    if (project?.system === "unassigned") return;
    editingProject = project;
    $("#project-dialog-title").textContent = project
      ? "Изменить проект"
      : "Новый проект";
    $("#project-save").textContent = project ? "Сохранить" : "Создать";
    $("#project-new-name").value = project?.name || "";
    $("#project-new-description").value = project?.description || "";
    $("#project-new-tone").value = project?.tone || "pine";
    $("#project-error").hidden = true;
    $("#project-delete").hidden = !project;
    openDialog("project-dialog", opener);
  }
  function requestProjectDelete(project, opener) {
    if (
      !project ||
      project.system === "unassigned" ||
      !projects.includes(project)
    )
      return;
    editingProject = project;
    $("#project-delete-name").textContent = project.name;
    openDialog("project-delete-dialog", opener);
    applyLanguage();
  }
  listen($("#project-remove"), "click", (event) =>
    requestProjectDelete(
      projects.find((project) => project.id === selectedProjectId),
      event.currentTarget,
    ),
  );
  listen($("#project-delete"), "click", (event) =>
    requestProjectDelete(editingProject, event.currentTarget),
  );
  listen($("#project-delete-confirm"), "click", () => {
    const project = editingProject;
    const index = projects.indexOf(project);
    if (index < 0 || project.system === "unassigned") return;
    const links = [...tasks, ...events].filter(
      (item) => item.context === project.name,
    );
    for (const item of links) item.context = personalProject;
    projects.splice(index, 1);
    editingProject = null;
    closeDialog();
    syncProjectOptions();
    renderTasks();
    renderCalendar();
    renderProjects();
    showUndo("project", project, index);
    undoState.links = links;
    persistState();
    applyLanguage();
  });
  let projectDrag = null;
  function projectStage(item) {
    return item.done ? "done" : item.status === "active" ? "active" : "planned";
  }
  function attachProjectDrag(card, kind, item) {
    card.dataset.kind = kind;
    card.dataset.itemId = String(item.id);
    const handle = make("button", "project-drag-handle cursor-interaction");
    handle.type = "button";
    handle.setAttribute("aria-label", "Перенести задачу: " + item.title);
    handle.setAttribute("data-tooltip", "Перетащите за ручку");
    const icon = make("i");
    icon.dataset.lucide = "grip-vertical";
    icon.setAttribute("aria-hidden", "true");
    handle.append(icon);
    card.append(handle);
    listen(card, "pointerdown", (event) => {
      if (
        projectDrag ||
        event.button !== 0 ||
        (event.target.closest("button,input,select,textarea") &&
          !event.target.closest(".project-drag-handle"))
      )
        return;
      event.preventDefault();
      projectDrag = {
        card,
        kind,
        item,
        pointerId: event.pointerId,
        x: event.clientX,
        y: event.clientY,
        started: false,
        handle,
      };
      try {
        card.setPointerCapture(event.pointerId);
      } catch (error) {}
    });
  }
  function placeProjectDrag(event) {
    const drag = projectDrag;
    if (!drag || event.pointerId !== drag.pointerId) return;
    if (
      !drag.started &&
      Math.hypot(event.clientX - drag.x, event.clientY - drag.y) < 6
    )
      return;
    if (!drag.started) {
      drag.started = true;
      all('.project-column[data-stage="done"]').forEach((column) => {
        column.querySelector(".project-column-body").hidden = false;
        column.dataset.collapsed = "false";
      });
      const rect = drag.card.getBoundingClientRect();
      drag.width = rect.width;
      drag.offsetX = Math.min(rect.width, event.clientX - rect.left);
      drag.offsetY = Math.min(rect.height, event.clientY - rect.top);
      drag.ghost = drag.card.cloneNode(true);
      drag.ghost.classList.add("project-drag-ghost");
      drag.ghost.setAttribute("aria-hidden", "true");
      drag.ghost.style.width = rect.width + "px";
      root.append(drag.ghost);
      drag.card.dataset.dragging = "true";
      drag.slot = make("div", "project-drop-slot");
      drag.slot.style.height = rect.height + "px";
      drag.slot.setAttribute("aria-hidden", "true");
      root.style.userSelect = "none";
    }
    event.preventDefault();
    const rootRect = root.getBoundingClientRect();
    drag.ghost.style.transform = `translate3d(${event.clientX - rootRect.left - drag.offsetX}px, ${event.clientY - rootRect.top - drag.offsetY}px, 0) rotate(-2deg)`;
    const hit = document.elementFromPoint(event.clientX, event.clientY),
      column = hit?.closest(".project-column");
    if (drag.target && drag.target !== column) delete drag.target.dataset.drop;
    if (!column || !root.contains(column)) {
      drag.target = null;
      drag.slot.remove();
      return;
    }
    drag.target = column;
    if (column.dataset.drop !== "true") column.dataset.drop = "true";
    const body = column.querySelector(".project-column-body"),
      cards = [...body.querySelectorAll(".project-board-card")].filter(
        (node) => node !== drag.card,
      );
    let before = cards.find(
      (node) =>
        event.clientY <
        node.getBoundingClientRect().top +
          node.getBoundingClientRect().height / 2,
    );
    if (before) {
      const row = cards.filter(
        (node) =>
          Math.abs(
            node.getBoundingClientRect().top -
              before.getBoundingClientRect().top,
          ) < 4,
      );
      if (row.length > 1)
        before =
          row.find(
            (node) =>
              event.clientX <
              node.getBoundingClientRect().left +
                node.getBoundingClientRect().width / 2,
          ) || cards[cards.indexOf(row.at(-1)) + 1];
    }
    if (
      drag.slot.parentNode !== body ||
      drag.slot.nextSibling !== (before || null)
    )
      body.insertBefore(drag.slot, before || null);
    drag.before = before;
    drag.lastEvent = event;
    const rect = body.getBoundingClientRect(),
      direction =
        event.clientY < rect.top + 36
          ? -1
          : event.clientY > rect.bottom - 36
            ? 1
            : 0;
    if (direction && !drag.frame)
      drag.frame = requestAnimationFrame((time) => {
        drag.frame = 0;
        if (projectDrag !== drag) return;
        const elapsed = Math.min(
          32,
          time - (drag.scrollTime || time - 1000 / 60),
        );
        drag.scrollTime = time;
        const previous = body.scrollTop;
        body.scrollTop += direction * 0.72 * elapsed;
        if (body.scrollTop !== previous) placeProjectDrag(drag.lastEvent);
      });
  }
  function finishProjectDrag(event, cancel = false) {
    const drag = projectDrag;
    if (
      !drag ||
      (event &&
        event.pointerId !== undefined &&
        event.pointerId !== drag.pointerId)
    )
      return;
    flushDragMove(drag, placeProjectDrag, cancel);
    projectDrag = null;
    try {
      drag.card.releasePointerCapture(drag.pointerId);
    } catch (error) {}
    if (drag.frame) cancelAnimationFrame(drag.frame);
    drag.ghost?.remove();
    drag.slot?.remove();
    delete drag.card.dataset.dragging;
    all(".project-column").forEach((node) => delete node.dataset.drop);
    root.style.userSelect = "";
    if (cancel || !drag.started || !drag.target) {
      if (drag.started && !disposed) renderProjects();
      return;
    }
    const stage = drag.target.dataset.stage,
      body = drag.target.querySelector(".project-column-body"),
      cards = [...body.querySelectorAll(".project-board-card")].filter(
        (node) => node !== drag.card,
      ),
      entries = cards
        .map((node) => ({
          kind: node.dataset.kind,
          item: (node.dataset.kind === "task" ? tasks : events).find(
            (item) => String(item.id) === node.dataset.itemId,
          ),
        }))
        .filter((entry) => entry.item),
      before = drag.before,
      index = before ? cards.indexOf(before) : entries.length;
    entries.splice(index < 0 ? entries.length : index, 0, {
      kind: drag.kind,
      item: drag.item,
    });
    drag.item.status = stage;
    drag.item.done = stage === "done";
    if (!drag.item.done) drag.item.win = false;
    entries.forEach(({ item }, index) => (item.order = index));
    renderProjects();
    renderTasks();
    renderCalendar();
    renderWins();
    persistState();
    const moved = $(
      '[data-kind="' +
        drag.kind +
        '"][data-item-id="' +
        drag.item.id +
        '"] .project-drag-handle',
    );
    moved?.focus({ preventScroll: true });
  }
  listen(
    window,
    "pointermove",
    (event) => scheduleDragMove(event, projectDrag, placeProjectDrag),
    { passive: false },
  );
  listen(window, "pointerup", (event) => finishProjectDrag(event));
  listen(window, "pointercancel", (event) => finishProjectDrag(event, true));
  listen(root, "keydown", (event) => {
    if (event.key === "Escape" && projectDrag) {
      finishProjectDrag(null, true);
      event.preventDefault();
    }
  });
  listen($("#project-add"), "click", (event) =>
    openProjectDialog(null, event.currentTarget),
  );
  listen($("#project-edit"), "click", (event) =>
    openProjectDialog(
      projects.find((project) => project.id === selectedProjectId),
      event.currentTarget,
    ),
  );
  listen($("#project-task-add"), "click", (event) =>
    openCapture(
      "project",
      event.currentTarget,
      projects.find((project) => project.id === selectedProjectId)?.name,
    ),
  );
  listen($("#project-form"), "submit", (event) => {
    event.preventDefault();
    const name = $("#project-new-name").value.trim(),
      description = $("#project-new-description").value.trim(),
      tone = $("#project-new-tone").value;
    if (
      !name ||
      projects.some(
        (project) =>
          project !== editingProject &&
          project.name.toLocaleLowerCase("ru") === name.toLocaleLowerCase("ru"),
      )
    ) {
      $("#project-error").textContent = name
        ? "Проект с таким названием уже есть."
        : "Введите название проекта.";
      $("#project-error").hidden = false;
      return;
    }
    if (editingProject) {
      const oldName = editingProject.name;
      Object.assign(editingProject, { name, description, tone });
      if (oldName !== name) {
        tasks
          .filter((task) => task.context === oldName)
          .forEach((task) => (task.context = name));
        events
          .filter((item) => item.context === oldName)
          .forEach((item) => (item.context = name));
      }
    } else {
      const project = { id: nextId++, name, description, tone };
      projects.push(project);
      selectedProjectId = project.id;
    }
    syncProjectOptions();
    renderTasks();
    renderCalendar();
    renderProjects();
    closeDialog();
  });
  function renderWins() {
    const host = $("#wins-list");
    host.replaceChildren();
    const items = [
      ...[...tasks, ...events]
        .filter((item) => item.done && item.win && !item.workoutId)
        .map((item) => ({
          title: item.title,
          source:
            projects.find((project) => project.name === item.context)?.name ||
            "Личное",
        })),
      ...workouts
        .filter((item) => item.done && item.win)
        .map((item) => ({ title: item.name, source: "Тренировки" })),
    ];
    if (!items.length) {
      host.append(
        make(
          "p",
          "aux-note aux-empty",
          "Пока нет сохранённых побед. Отметьте выполненную задачу или тренировку как победу.",
        ),
      );
      return;
    }
    items.forEach((item) => {
      const row = make("div", "wins-item", item.title);
      row.append(make("small", "", item.source));
      host.append(row);
    });
  }
  function renderArchive() {
    if (database) {
      database.render();
      usability?.pageChanged(activePage);
      return;
    }
    if (!archiveCategories.includes(selectedArchiveCategory))
      selectedArchiveCategory = archiveCategories[0] || "";
    const categories = $("#archive-categories");
    categories.replaceChildren();
    archiveCategories.forEach((name) => {
      const button = make(
        "button",
        "archive-category cursor-interaction",
        name,
      );
      button.type = "button";
      button.setAttribute(
        "aria-current",
        String(name === selectedArchiveCategory),
      );
      listen(button, "click", () => {
        selectedArchiveCategory = name;
        renderArchive();
      });
      categories.append(button);
    });
    $("#archive-category-title").textContent =
      selectedArchiveCategory || "Архив";
    $("#archive-item-add").disabled = !selectedArchiveCategory;
    usability?.pageChanged(activePage);
    const host = $("#archive-items");
    host.replaceChildren();
    const items = archiveItems
      .filter((item) => item.category === selectedArchiveCategory)
      .sort((a, b) => b.date.localeCompare(a.date));
    if (!items.length)
      host.append(
        make(
          "p",
          "aux-note aux-empty",
          "Пока нет записей. Добавьте фильм, книгу или любой другой объект коллекции.",
        ),
      );
    items.forEach((item) => {
      const card = make("article", "archive-card"),
        cover = make("button", "archive-cover cursor-interaction");
      cover.type = "button";
      cover.setAttribute("aria-label", "Открыть запись: " + item.name);
      const source = archiveCovers.get(item.id);
      if (source) {
        const img = make("img");
        img.src = source;
        img.alt = item.name;
        cover.append(img);
      } else {
        const icon = make("i");
        icon.dataset.lucide = "image";
        icon.setAttribute("aria-hidden", "true");
        cover.append(icon);
      }
      if (item.rating) {
        const rating = make("span", "archive-rating"),
          star = make("i");
        star.dataset.lucide = "star";
        star.setAttribute("aria-hidden", "true");
        rating.append(upgrades ? upgrades.stars(item.rating) : star);
        cover.append(rating);
      }
      listen(cover, "click", () => openArchiveView(item, cover));
      const title = make(
        "button",
        "archive-card-title cursor-interaction",
        item.name,
      );
      title.type = "button";
      listen(title, "click", () => openArchiveItem(item, title));
      const more = action(
        "⋯",
        () => usability?.itemMenu("database", item, more),
        "text-button entity-more",
      );
      more.setAttribute("aria-label", "Действия с записью: " + item.name);
      card.append(cover, title, make("small", "", shortDate(item.date)), more);
      host.append(card);
    });
    refreshIcons();
  }
  listen($("#archive-category-add"), "click", (event) => {
    editingCollection = null;
    $("#archive-category-dialog-title").textContent = "Новая коллекция";
    $("#archive-category-form").reset();
    $('#archive-category-form button[type="submit"]').textContent = "Создать";
    $("#archive-category-error").hidden = true;
    database?.collectionOpened(null);
    openDialog("archive-category-dialog", event.currentTarget);
  });
  listen($("#archive-category-form"), "submit", (event) => {
    event.preventDefault();
    const name = $("#archive-category-name").value.trim();
    if (
      !name ||
      archiveCategories.some(
        (item) =>
          item !== editingCollection &&
          item.toLocaleLowerCase("ru") === name.toLocaleLowerCase("ru"),
      )
    ) {
      $("#archive-category-error").textContent = name
        ? "Такая коллекция уже есть."
        : "Введите название коллекции.";
      $("#archive-category-error").hidden = false;
      return;
    }
    if (database && !database.beforeCollectionSave(name, editingCollection))
      return;
    if (editingCollection) {
      const index = archiveCategories.indexOf(editingCollection);
      if (index < 0) return;
      archiveCategories[index] = name;
      for (const item of archiveItems)
        if (item.category === editingCollection) item.category = name;
    } else archiveCategories.push(name);
    selectedArchiveCategory = name;
    renderArchive();
    closeDialog();
  });
  function refreshCoverPreview() {
    const preview = $("#archive-cover-preview");
    preview.hidden = !archiveDraftCover;
    $("#archive-cover-remove").hidden = !archiveDraftCover;
    const material =
      $("#archive-item-form").dataset.projectMaterialContent === "true";
    const coverLabel = material
      ? archiveDraftCover
        ? "Заменить изображение"
        : "Добавить скриншот"
      : archiveDraftCover
        ? "Заменить обложку"
        : "Добавить обложку";
    $("#archive-cover-choose-label").textContent =
      effectiveLanguage() === "en"
        ? translateLabel(coverLabel) || coverLabel
        : coverLabel;
    if (archiveDraftCover) preview.src = archiveDraftCover;
    else preview.removeAttribute("src");
    if (activeDialog?.id === "archive-item-dialog") fitDialog();
  }
  function openArchiveItem(item, opener) {
    if (activeDialog) closeDialog();
    editingArchiveItem = item;
    archiveUploadToken++;
    archiveDraftCover = item ? archiveCovers.get(item.id) || null : null;
    $("#archive-cover-file").value = "";
    $("#archive-cover-error").hidden = true;
    $('#archive-item-form button[type="submit"]').disabled = false;
    refreshCoverPreview();
    $("#archive-item-dialog-title").textContent = item
      ? "Изменить запись"
      : "Добавить запись";
    $("#archive-item-name").value = item?.name || "";
    $("#archive-item-date").value = item?.date || todayKey;
    $("#archive-item-rating").value = item?.rating || "";
    upgrades?.renderRating();
    $("#archive-item-review").value = item?.review || "";
    $("#archive-item-delete").hidden = !item;
    const collection = $("#archive-item-collection");
    if (collection) {
      collection.replaceChildren();
      for (const name of archiveCategories) {
        const option = make("option", "", name);
        option.value = name;
        option.dataset.userContent = "";
        collection.append(option);
      }
      collection.value = item?.category || selectedArchiveCategory;
    }
    openDialog("archive-item-dialog", opener);
    database?.opened(item);
  }
  function openArchiveView(item, opener) {
    viewingArchiveItem = item;
    $("#archive-view-title").textContent = item.name;
    $("#archive-view-meta").textContent =
      shortDate(item.date) + (item.rating ? " · " + item.rating + " / 5" : "");
    $("#archive-view-review").textContent = item.review || "";
    const source = archiveCovers.get(item.id),
      img = $("#archive-view-image");
    img.hidden = !source;
    img.alt = item.name;
    if (source) img.src = source;
    else img.removeAttribute("src");
    openDialog("archive-view-dialog", opener);
    database?.viewed(item);
  }
  listen($("#archive-view-edit"), "click", () => {
    const item = viewingArchiveItem,
      opener = dialogOpener;
    closeDialog();
    openArchiveItem(item, opener);
  });
  listen($("#archive-cover-choose"), "click", () =>
    $("#archive-cover-file").click(),
  );
  listen($("#archive-cover-remove"), "click", () => {
    archiveUploadToken++;
    archiveDraftCover = null;
    $("#archive-cover-file").value = "";
    $("#archive-cover-error").hidden = true;
    $('#archive-item-form button[type="submit"]').disabled = false;
    refreshCoverPreview();
    database?.coverChanged();
  });
  listen($("#archive-cover-file"), "change", (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const error = $("#archive-cover-error");
    error.hidden = true;
    if (
      !["image/jpeg", "image/png"].includes(file.type) ||
      file.size > 10 * 1024 * 1024
    ) {
      error.textContent = "Выберите JPEG или PNG до 10 МБ.";
      error.hidden = false;
      event.target.value = "";
      return;
    }
    const draftTarget = database?.coverTarget();
    const token = ++archiveUploadToken,
      save = $('#archive-item-form button[type="submit"]'),
      reader = new FileReader();
    save.disabled = true;
    reader.onload = async () => {
      if (token !== archiveUploadToken || disposed) return;
      try {
        const image = new Image();
        image.src = String(reader.result);
        await image.decode();
        if (token !== archiveUploadToken || disposed) return;
        const scale = Math.min(
          1,
          1024 / Math.max(image.naturalWidth, image.naturalHeight),
        );
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
        canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
        canvas
          .getContext("2d")
          .drawImage(image, 0, 0, canvas.width, canvas.height);
        archiveDraftCover = canvas.toDataURL(
          file.type === "image/png" ? "image/png" : "image/jpeg",
          0.88,
        );
        save.disabled = false;
        refreshCoverPreview();
        database?.coverChanged(archiveDraftCover, draftTarget);
      } catch {
        if (token !== archiveUploadToken || disposed) return;
        save.disabled = false;
        error.textContent = "Не удалось открыть изображение.";
        error.hidden = false;
      }
    };
    reader.onerror = () => {
      if (token !== archiveUploadToken) return;
      save.disabled = false;
      error.textContent = "Не удалось открыть изображение.";
      error.hidden = false;
    };
    reader.readAsDataURL(file);
  });
  listen($("#archive-item-add"), "click", (event) =>
    openArchiveItem(null, event.currentTarget),
  );
  listen($("#archive-item-form"), "submit", (event) => {
    event.preventDefault();
    if ($('#archive-item-form button[type="submit"]').disabled) return;
    if (database && !database.beforeSave()) return;
    const name = $("#archive-item-name").value.trim(),
      date = $("#archive-item-date").value || todayKey,
      rating = Number($("#archive-item-rating").value) || null,
      review = $("#archive-item-review").value.trim();
    if (!name || !date) return;
    const category =
      $("#archive-item-collection")?.value || selectedArchiveCategory;
    let item = editingArchiveItem;
    if (item) Object.assign(item, { name, date, rating, review, category });
    else {
      item = {
        id: nextId++,
        category,
        name,
        date,
        rating,
        review,
      };
      archiveItems.push(item);
    }
    if (archiveDraftCover) archiveCovers.set(item.id, archiveDraftCover);
    else archiveCovers.delete(item.id);
    if (database) Object.assign(item, database.readFields());
    database?.saved(item);
    selectedArchiveCategory = category;
    renderArchive();
    closeDialog();
  });
  listen($("#archive-item-delete"), "click", () => {
    if (!editingArchiveItem) return;
    closeDialog();
    deleteDatabaseItem(editingArchiveItem);
  });
  function fitDialog() {
    if (activeDialog)
      activeDialog
        .querySelector(".dialog")
        ?.style.setProperty(
          "max-height",
          "calc(var(--dialog-viewport-height, 100dvh) - 64px)",
        );
  }
  function openDialog(id, opener) {
    const overlay = $("#" + id);
    if (!overlay?.querySelector(".dialog") || disposed) return false;
    if (activeDialog && activeDialog.id !== id) closeDialog();
    closeTaskMenu();
    activeDialog = overlay;
    dialogOpener = opener || document.activeElement;
    activeDialog.hidden = false;
    try {
      // Establish viewport and content before focus can open a keyboard.
      usability?.dialogOpened(id);
      fitDialog();
      $(".app").inert = true;
      $(".mobile-nav").inert = true;
      const first =
        id === "state-dialog"
          ? activeDialog.querySelector('input[name="mood"]:checked')
          : activeDialog.querySelector(
              'textarea,input:not([type="hidden"]):not([type="checkbox"]),select,button',
            );
      first?.focus({ preventScroll: true });
      return true;
    } catch (error) {
      // A failed initial layout must never leave the main screen inert.
      closeDialog();
      usability?.notify(
        translateLabel("Не удалось открыть окно. Попробуйте ещё раз."),
      );
      console.error("Dialog initialization failed", error);
      return false;
    }
  }
  function closeDialog() {
    if (!activeDialog) return;
    try {
      database?.closing(activeDialog.id);
    } finally {
      activeDialog.hidden = true;
      $(".app").inert = false;
      $(".mobile-nav").inert = false;
      activeDialog = null;
      root.style.minHeight = "";
      if (dialogOpener?.isConnected)
        dialogOpener.focus({ preventScroll: true });
    }
  }
  listen(window, "resize", () => {
    if (root.isConnected && activeDialog) fitDialog();
  });
  all("[data-open]").forEach((button) =>
    listen(button, "click", () => openDialog(button.dataset.open, button)),
  );
  all("[data-close]").forEach((button) => listen(button, "click", closeDialog));
  all(".overlay").forEach((overlay) =>
    listen(overlay, "click", (event) => {
      if (event.target !== overlay) return;
      closeDialog();
    }),
  );
  listen(window, "keydown", (event) => {
    if (
      event.defaultPrevented ||
      event.isComposing ||
      (event.target instanceof Node &&
        !root.contains(event.target) &&
        event.target !== document.body &&
        event.target !== document.documentElement)
    )
      return;
    if (event.key === "Escape") {
      if (isTextEntry(event.target)) return;
      if (goBack()) {
        event.preventDefault();
        persistState();
      }
      return;
    }
    if (!activeDialog) {
      if (
        openTaskMenu &&
        ["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)
      ) {
        event.preventDefault();
        const items = [...openTaskMenu.menu.querySelectorAll("button")],
          current = items.indexOf(document.activeElement),
          index =
            event.key === "Home"
              ? 0
              : event.key === "End"
                ? items.length - 1
                : (current +
                    (event.key === "ArrowDown" ? 1 : -1) +
                    items.length) %
                  items.length;
        items[index].focus();
      } else if (event.key === "Tab") closeTaskMenu(true);
      return;
    }
    if (event.key === "Tab") {
      const focusable = [
        ...activeDialog.querySelectorAll("button,input,textarea,select"),
      ].filter((el) => !el.disabled && el.getClientRects().length);
      const first = focusable[0],
        last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
  });
  listen(root, "click", (event) => {
    if (!event.target.closest(".task-more,.task-menu")) closeTaskMenu();
  });
  function closeTaskMenu(restoreFocus = false) {
    if (!openTaskMenu) return;
    const { button, menu } = openTaskMenu;
    openTaskMenu = null;
    menu.remove();
    button.setAttribute("aria-expanded", "false");
    if (restoreFocus && button.isConnected) button.focus();
  }
  function positionTaskMenu() {
    if (!openTaskMenu) return;
    const { button, menu } = openTaskMenu,
      bounds = root.getBoundingClientRect(),
      anchor = button.getBoundingClientRect(),
      scaleX =
        bounds.width && root.clientWidth ? bounds.width / root.clientWidth : 1,
      scaleY =
        bounds.height && root.clientHeight
          ? bounds.height / root.clientHeight
          : 1,
      availableWidth = root.clientWidth || bounds.width || 320,
      availableHeight = root.clientHeight || bounds.height || 600;
    menu.style.width = Math.min(168, availableWidth - 16) + "px";
    const width = menu.offsetWidth || 168,
      height = menu.offsetHeight || 88;
    let left = (anchor.right - bounds.left) / scaleX - width,
      top = (anchor.bottom - bounds.top) / scaleY + 5;
    if (top + height > availableHeight - 8)
      top = (anchor.top - bounds.top) / scaleY - height - 5;
    menu.style.left =
      Math.max(8, Math.min(availableWidth - width - 8, left)) + "px";
    menu.style.top =
      Math.max(8, Math.min(availableHeight - height - 8, top)) + "px";
  }
  listen($("#task-list"), "scroll", () => closeTaskMenu(), { passive: true });
  listen(window, "resize", () => closeTaskMenu());
  function renderTasks() {
    if (activePage !== "home") return;
    closeTaskMenu();
    const list = $("#task-list"),
      scrollPosition = list.scrollTop;
    list.replaceChildren();
    $("#tasks-date").textContent =
      selectedDate === dateKey(new Date())
        ? "сегодня"
        : dateFormatter({
            day: "numeric",
            month: "short",
          }).format(parseDate(selectedDate));
    upgrades?.renderHomeThoughts();
    const shown = homeItems({ tasks, events }, selectedDate).map(
      ({ item }) => item,
    );
    const completedCount = shown.filter((task) => task.done).length;
    let completedHeading = false;
    if (!shown.length) {
      const empty = document.createElement("div");
      empty.className = "empty-tasks";
      empty.textContent = "На эту дату задач нет.";
      list.append(empty);
    }
    shown.forEach((task) => {
      if (task.done && !completedHeading) {
        const heading = make(
          "div",
          "task-completed-heading",
          ({ ru: "Выполнено", en: "Completed" }[effectiveLanguage()] ||
            "Выполнено") +
            " · " +
            completedCount,
        );
        heading.setAttribute("role", "heading");
        heading.setAttribute("aria-level", "3");
        heading.dataset.userContent = "";
        list.append(heading);
        completedHeading = true;
      }
      const kind = events.includes(task) ? "event" : "task";
      const editTask = (opener) =>
        kind === "event"
          ? openEvent(task, null, opener)
          : openTask(task, opener);
      const row = document.createElement("div");
      row.className = "task";
      row.dataset.kind = kind;
      row.dataset.done = String(Boolean(task.done));
      row.dataset.taskId = String(task.id);
      const check = document.createElement("button");
      check.type = "button";
      check.className = "task-check cursor-interaction";
      check.setAttribute("aria-pressed", String(task.done));
      check.setAttribute(
        "aria-label",
        (task.done ? "Вернуть задачу: " : "Завершить задачу: ") + task.title,
      );
      listen(check, "click", () => {
        // Keep the remaining work visible when the checked row moves down.
        const nextTask =
          shown.slice(shown.indexOf(task) + 1).find((item) => !item.done) ||
          shown.find((item) => item !== task && !item.done);
        const restoreTaskFocus = () => {
          const target = task.done && nextTask ? nextTask : task;
          list
            .querySelector('[data-task-id="' + target.id + '"] .task-check')
            ?.focus({ preventScroll: true });
        };
        if (task.workoutId && training) {
          const workout = workouts.find((item) => item.id === task.workoutId);
          if (workout) {
            training.toggleCompletion(workout);
            restoreTaskFocus();
            return;
          }
        }
        task.done = !task.done;
        if (!task.done) task.win = false;
        renderTasks();
        renderCalendar();
        renderProjects();
        renderWins();
        restoreTaskFocus();
      });
      const name = document.createElement("div");
      name.className = "task-name";
      const title = document.createElement("span");
      title.className = "task-title";
      title.textContent = task.title;
      title.dataset.userContent = "";
      title.tabIndex = 0;
      title.setAttribute("role", "button");
      title.setAttribute("aria-label", "Изменить задачу: " + task.title);
      listen(title, "click", () => editTask(title));
      listen(title, "keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          editTask(title);
        }
      });
      name.append(title);
      if (task.description)
        name.append(make("small", "task-description", task.description));
      const context = document.createElement("span");
      context.className = "task-context";
      context.textContent = task.context;
      name.append(context);
      let quickResults = null;
      if (task.workoutId && training) {
        const workout = workouts.find((item) => item.id === task.workoutId);
        if (workout?.entries?.length && !task.done) {
          row.classList.add("training-task");
          const results = make("div", "training-inline-results");
          training.mountCompactResults(results, workout);
          quickResults = results;
        }
      }
      const schedule = document.createElement("button");
      schedule.type = "button";
      schedule.className = "schedule-task cursor-interaction";
      const icon = document.createElement("span");
      icon.className = "calendar-glyph";
      icon.setAttribute("aria-hidden", "true");
      const plus = document.createElement("b");
      plus.textContent = "+";
      icon.append(plus);
      schedule.append(icon);
      schedule.setAttribute(
        "aria-label",
        "Назначить дату и время: " + task.title,
      );
      schedule.setAttribute("data-tooltip", "Поставить в расписание");
      listen(schedule, "click", () =>
        kind === "event"
          ? openEvent(task, null, schedule)
          : openEvent(null, task, schedule),
      );
      const more = document.createElement("button");
      more.type = "button";
      more.className = "task-more cursor-interaction";
      more.textContent = "⋯";
      more.setAttribute("aria-label", "Действия с задачей: " + task.title);
      more.setAttribute("aria-haspopup", "menu");
      more.setAttribute("aria-expanded", "false");
      const menu = document.createElement("div");
      menu.className = "task-menu";
      menu.setAttribute("role", "menu");
      menu.hidden = true;
      const edit = document.createElement("button");
      edit.type = "button";
      edit.setAttribute("role", "menuitem");
      edit.textContent = "Изменить";
      listen(edit, "click", () => {
        closeTaskMenu();
        editTask(more);
      });
      const remove = document.createElement("button");
      remove.type = "button";
      remove.className = "danger";
      remove.setAttribute("role", "menuitem");
      remove.textContent = "Удалить";
      listen(remove, "click", () => {
        closeTaskMenu();
        if (kind === "event") deleteEntity("event", task);
        else deleteTask(task);
      });
      menu.append(edit, remove);
      listen(more, "click", () => {
        if (usability) {
          usability.itemMenu(kind, task, more);
          return;
        }
        const wasOpen = openTaskMenu && openTaskMenu.button === more;
        closeTaskMenu();
        if (!wasOpen) {
          menu.hidden = false;
          root.append(menu);
          more.setAttribute("aria-expanded", "true");
          openTaskMenu = { button: more, menu };
          positionTaskMenu();
          edit.focus();
        }
      });
      const handle = make("button", "task-drag cursor-interaction");
      handle.type = "button";
      handle.setAttribute(
        "aria-label",
        "Перетащить в расписание: " + task.title,
      );
      handle.setAttribute("data-tooltip", "Перетащить в расписание");
      const grip = make("i");
      grip.dataset.lucide = "grip-vertical";
      grip.setAttribute("aria-hidden", "true");
      handle.append(grip);
      listen(handle, "pointerdown", (event) =>
        startCalendarDrag(event, kind, task, row),
      );
      row.append(check, handle, name, schedule, more);
      if (quickResults) row.append(quickResults);
      list.append(row);
    });
    list.scrollTop = scrollPosition;
    renderWins();
    refreshIcons();
  }
  function showUndo(kind, item, index) {
    undoState = { kind, item, index };
    if (usability) {
      for (const selector of [
        "#task-undo",
        "#event-undo",
        "#project-undo",
        "#completed-undo",
      ])
        if ($(selector)) $(selector).hidden = true;
      usability.notify(
        effectiveLanguage() === "en" ? "Deleted" : "Удалено",
        undoDeletion,
      );
      return;
    }
    $("#task-undo").hidden = activePage !== "home" || kind !== "task";
    $("#event-undo").hidden = activePage !== "home" || kind !== "event";
    $("#project-undo").hidden = activePage !== "projects";
    $("#completed-undo").hidden = activePage !== "completed";
    $("#project-undo-text").textContent =
      kind === "project"
        ? "Проект удалён"
        : kind === "task"
          ? "Задача удалена"
          : "Событие удалено";
    const note =
      activePage === "completed"
        ? $("#completed-undo")
        : activePage === "projects"
          ? $("#project-undo")
          : kind === "task"
            ? $("#task-undo")
            : $("#event-undo");
    if (["home", "projects", "completed"].includes(activePage))
      note.querySelector("button").focus();
  }
  function deleteTask(task) {
    const index = tasks.indexOf(task);
    if (index < 0) return;
    tasks.splice(index, 1);
    renderTasks();
    renderCalendar();
    renderProjects();
    renderWins();
    if (activePage === "completed") upgrades?.renderCompleted();
    showUndo("task", task, index);
  }
  function openTask(task, opener) {
    editingTask = task;
    experience?.openSeries("task", task);
    syncProjectOptions();
    $("#task-name").value = task.title;
    $("#task-description").value = task.description || "";
    $("#task-duration").value = String(task.duration || 30);
    $("#task-description").closest("details").open = Boolean(task.description);
    $("#task-context").value = task.context;
    $("#task-date").value = task.date || "";
    $("#task-time").value = "";
    $("#task-error").hidden = true;
    openDialog("task-dialog", opener);
    $("#task-name").focus();
  }
  listen($("#task-form"), "submit", (event) => {
    event.preventDefault();
    const title = $("#task-name").value.trim(),
      date = $("#task-date").value,
      time = $("#task-time").value,
      context = $("#task-context").value;
    if (!title || (time && (!date || minutes(time) >= 1439))) {
      $("#task-error").textContent =
        "Укажите название, дату и время раньше 23:59.";
      $("#task-error").hidden = false;
      return;
    }
    const description = $("#task-description").value.trim(),
      duration = Number($("#task-duration").value) || 30;
    const related = experience?.seriesTargets("task", editingTask) || [
      editingTask,
    ];
    const dateDelta = Math.round(
      date && editingTask.date
        ? (parseDate(date) - parseDate(editingTask.date)) / 86400000
        : 0,
    );
    for (const item of related) {
      const itemDate = date
        ? item.date
          ? shiftDate(item.date, dateDelta)
          : date
        : "";
      if (time) {
        const start = minutes(time),
          end = clockLabel(Math.min(1439, start + duration) / 60);
        events.push({
          ...item,
          id: nextId++,
          title,
          description,
          duration,
          date: itemDate,
          start: time,
          end,
          context,
          tone: projectTone(context),
        });
        const replacement = events[events.length - 1];
        for (const thought of extraState.thoughts)
          for (const link of thought.links || [])
            if (link.kind === "task" && link.id === item.id)
              Object.assign(link, { kind: "event", id: replacement.id });
        tasks.splice(tasks.indexOf(item), 1);
      } else
        Object.assign(item, {
          title,
          date: itemDate,
          context,
          description,
          duration,
        });
    }
    if (date) selectedDate = date;
    manualWindow = false;
    renderTasks();
    renderCalendar();
    renderProjects();
    if (activePage === "completed") upgrades?.renderCompleted();
    closeDialog();
    if (activePage === "home") ($("#home-add") || $("#task-add")).focus();
  });
  listen($("#task-delete"), "click", () => {
    const task = editingTask;
    closeDialog();
    deleteTask(task);
  });
  for (const kind of ["task", "event"])
    listen($("#" + kind + "-undo button"), "click", () => {
      if (!undoState || undoState.kind !== kind) return;
      const collection = kind === "task" ? tasks : events;
      collection.splice(
        Math.min(undoState.index, collection.length),
        0,
        undoState.item,
      );
      $("#" + kind + "-undo").hidden = true;
      undoState = null;
      renderTasks();
      renderCalendar();
      renderProjects();
    });
  function undoDeletion() {
    if (!undoState) return;
    const collection =
      undoState.kind === "project"
        ? projects
        : undoState.kind === "task"
          ? tasks
          : events;
    if (undoState.kind === "project") {
      const project = undoState.item;
      if (
        projects.some(
          (item) =>
            item.name.toLocaleLowerCase("ru") ===
            project.name.toLocaleLowerCase("ru"),
        )
      ) {
        const original = project.name;
        let suffix = 1;
        do {
          project.name =
            original.slice(0, 55) + " (восстановлен " + suffix++ + ")";
        } while (
          projects.some(
            (item) =>
              item.name.toLocaleLowerCase("ru") ===
              project.name.toLocaleLowerCase("ru"),
          )
        );
      }
      for (const item of undoState.links || [])
        if (
          (tasks.includes(item) || events.includes(item)) &&
          item.context === "Личное"
        )
          item.context = project.name;
      selectedProjectId = project.id;
    }
    collection.splice(
      Math.min(undoState.index, collection.length),
      0,
      undoState.item,
    );
    syncProjectOptions();
    $("#project-undo").hidden = true;
    $("#completed-undo").hidden = true;
    undoState = null;
    renderTasks();
    renderCalendar();
    renderProjects();
    if (activePage === "completed") upgrades?.renderCompleted();
    persistState();
  }
  listen($("#project-undo button"), "click", undoDeletion);
  function clockLabel(value) {
    const total = Math.round(value * 60);
    return (
      String(Math.floor(total / 60)).padStart(2, "0") +
      ":" +
      String(total % 60).padStart(2, "0")
    );
  }
  function hoursLabel(total) {
    return (
      numberFormat("ru", { maximumFractionDigits: 1 }).format(total / 60) + " ч"
    );
  }
  function updateViewport() {
    if (range === "six" && !manualWindow) {
      const first = events
        .filter((item) => item.date === selectedDate)
        .reduce(
          (earliest, item) => Math.min(earliest, minutes(item.start)),
          Infinity,
        );
      windowStart =
        selectedDate === dateKey(new Date())
          ? centeredStart()
          : Number.isFinite(first)
            ? Math.max(0, Math.min(23.9, Math.floor(first / 60) - 1))
            : 8;
    }
    const timelineView = range === "six" || range === "day";
    $("#calendar-date").value = selectedDate;
    $("#range-caption").textContent =
      range === "six"
        ? calendarWindowLabel()
        : range === "day"
          ? "00:00–24:00"
          : "Загрузка";
    $("#day-toggle").setAttribute("aria-pressed", String(range === "day"));
    $("#week-toggle").setAttribute("aria-pressed", String(range === "week"));
    $("#month-toggle").setAttribute("aria-pressed", String(range === "month"));
    $("#calendar-body").hidden = !timelineView;
    $("#period-view").hidden = timelineView;
    $("#calendar-body").dataset.range = range;
    $("#time-scrubber").hidden = range !== "six";
    $("#window-range").value = String(windowStart);
    $("#window-range").max = "24";
    $("#window-range").setAttribute("aria-valuetext", calendarWindowLabel());
    $("#timeline-window").scrollTop =
      range === "day" ? 0 : (24 + windowStart) * 36;
    if (!timelineView) renderPeriod();
  }
  function calendarWindowLabel() {
    const start = ((windowStart % 24) + 24) % 24,
      end = (start + 6) % 24;
    return (
      clockLabel(start) +
      "–" +
      clockLabel(end) +
      (start + 6 >= 24 ? " · " + shortDate(shiftDate(selectedDate, 1)) : "")
    );
  }
  function renderProjectLoads(items) {
    const panel = $("#period-projects");
    panel.replaceChildren();
    const heading = document.createElement("h3");
    heading.textContent = "Проекты и области";
    panel.append(heading);
    const groups = new Map();
    items.forEach((item) => {
      const name = item.context || "Личное";
      groups.set(
        name,
        (groups.get(name) || 0) +
          Math.max(0, minutes(item.end) - minutes(item.start)),
      );
    });
    if (!groups.size) {
      const note = document.createElement("p");
      note.className = "period-caption";
      note.textContent = "Событий пока нет.";
      panel.append(note);
      return;
    }
    const sorted = [...groups].sort((a, b) => b[1] - a[1]),
      max = sorted[0][1];
    sorted.forEach(([name, duration]) => {
      const row = document.createElement("div");
      row.className = "project-load";
      const left = document.createElement("div");
      left.className = "project-load-name";
      const label = document.createElement("span");
      label.textContent = name;
      const track = document.createElement("span");
      track.className = "project-track";
      const fill = document.createElement("span");
      fill.className = "project-fill";
      fill.style.width = Math.max(4, Math.round((duration / max) * 100)) + "%";
      track.append(fill);
      left.append(label, track);
      const value = document.createElement("strong");
      value.textContent = hoursLabel(duration);
      row.append(left, value);
      panel.append(row);
    });
  }
  function renderPeriod() {
    const chart = $("#period-chart");
    chart.replaceChildren();
    const anchor = parseDate(selectedDate),
      week = range === "week";
    const start = week
      ? startOfWeek(selectedDate)
      : dateKey(new Date(anchor.getFullYear(), anchor.getMonth(), 1));
    const end = week
      ? shiftDate(start, 7)
      : dateKey(new Date(anchor.getFullYear(), anchor.getMonth() + 1, 1));
    const items = events.filter(
      (item) => item.date >= start && item.date < end,
    );
    const total = items.reduce(
      (sum, item) => sum + Math.max(0, minutes(item.end) - minutes(item.start)),
      0,
    );
    const taskCount = tasks.filter(
      (item) => !item.done && taskDay(item) >= start && taskDay(item) < end,
    ).length;
    $("#period-title").textContent = week
      ? dateFormatter({
          day: "numeric",
          month: "short",
        }).format(parseDate(start)) +
        " — " +
        dateFormatter({
          day: "numeric",
          month: "short",
        }).format(parseDate(shiftDate(end, -1)))
      : dateFormatter({
          month: "long",
          year: "numeric",
        }).format(anchor);
    $("#period-caption").textContent =
      hoursLabel(total) +
      " запланировано · " +
      items.length +
      " событий · " +
      taskCount +
      " задач без времени";
    if (week) {
      const bars = document.createElement("div");
      bars.className = "week-bars";
      for (let index = 0; index < 7; index++) {
        const key = shiftDate(start, index),
          dayItems = items.filter((item) => item.date === key),
          duration = dayItems.reduce(
            (sum, item) =>
              sum + Math.max(0, minutes(item.end) - minutes(item.start)),
            0,
          );
        const button = document.createElement("button");
        button.type = "button";
        button.className = "week-day cursor-interaction";
        button.dataset.today = String(key === dateKey(new Date()));
        button.setAttribute(
          "aria-label",
          dateFormatter({
            weekday: "long",
            day: "numeric",
            month: "long",
          }).format(parseDate(key)) +
            ": " +
            hoursLabel(duration) +
            " запланировано",
        );
        button.setAttribute(
          "data-tooltip",
          hoursLabel(duration) + " · " + dayItems.length + " событий",
        );
        const weekday = document.createElement("span");
        weekday.className = "week-day-label";
        weekday.textContent = dateFormatter({
          weekday: "short",
        }).format(parseDate(key));
        const track = document.createElement("span");
        track.className = "week-track";
        const fill = document.createElement("span");
        fill.className = "week-fill";
        fill.style.height =
          Math.min(100, Math.round((duration / 480) * 100)) + "%";
        fill.hidden = duration === 0;
        track.append(fill);
        const date = document.createElement("span");
        date.className = "week-day-date";
        date.textContent = String(parseDate(key).getDate());
        button.append(weekday, track, date);
        listen(button, "click", () => {
          selectedDate = key;
          range = "six";
          manualWindow = false;
          renderTasks();
          renderCalendar();
        });
        bars.append(button);
      }
      chart.append(bars);
    } else {
      const weekdays = document.createElement("div");
      weekdays.className = "month-weekdays";
      ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"].forEach((label) => {
        const cell = document.createElement("span");
        cell.textContent = label;
        weekdays.append(cell);
      });
      chart.append(weekdays);
      const grid = document.createElement("div");
      grid.className = "month-grid";
      const gridStart = startOfWeek(start),
        endDate = parseDate(end);
      let day = gridStart;
      while (parseDate(day) < endDate || parseDate(day).getDay() !== 1) {
        const date = parseDate(day),
          inside = day >= start && day < end,
          dayItems = inside ? items.filter((item) => item.date === day) : [],
          duration = dayItems.reduce(
            (sum, item) =>
              sum + Math.max(0, minutes(item.end) - minutes(item.start)),
            0,
          );
        const cell = document.createElement("button");
        cell.type = "button";
        cell.className = "month-day cursor-interaction";
        cell.textContent = String(date.getDate());
        cell.dataset.outside = String(!inside);
        cell.dataset.selected = String(day === selectedDate);
        cell.dataset.level = String(
          duration === 0
            ? 0
            : duration < 60
              ? 1
              : duration < 120
                ? 2
                : duration < 240
                  ? 3
                  : 4,
        );
        cell.setAttribute(
          "aria-label",
          dateFormatter({
            day: "numeric",
            month: "long",
          }).format(date) +
            ": " +
            hoursLabel(duration) +
            " запланировано",
        );
        cell.setAttribute(
          "data-tooltip",
          hoursLabel(duration) + " · " + dayItems.length + " событий",
        );
        const key = day;
        listen(cell, "click", () => {
          selectedDate = key;
          range = "six";
          manualWindow = false;
          renderTasks();
          renderCalendar();
        });
        grid.append(cell);
        day = shiftDate(day, 1);
      }
      chart.append(grid);
    }
    renderProjectLoads(items);
  }
  function renderCalendar() {
    if (activePage !== "home") return;
    if (calendarDrag?.started) return;
    const paintKey = JSON.stringify([
      selectedDate,
      range,
      dateKey(new Date()),
      events,
      range === "week" || range === "month" ? tasks : null,
    ]);
    if (paintKey === calendarPaintKey) {
      const marker = $(".now-line"),
        now = new Date();
      if (marker)
        marker.style.top =
          Math.round(
            calendarMinute({
              date: dateKey(now),
              start: clockLabel(now.getHours() + now.getMinutes() / 60),
            }) * 0.6,
          ) + "px";
      if (range === "six" || range === "day") updateViewport();
      return;
    }
    calendarPaintKey = paintKey;
    calendarDayCount = range === "six" ? 3 : 1;
    calendarBaseDate =
      range === "six" ? shiftDate(selectedDate, -1) : selectedDate;
    $("#timeline").style.height = calendarDayCount * 864 + "px";
    $("#hours").replaceChildren();
    $("#events").replaceChildren();
    for (let h = 0; h < calendarDayCount * 24; h++) {
      const row = document.createElement("div");
      row.className = "hour";
      row.textContent = String(h % 24).padStart(2, "0") + ":00";
      if (h % 24 === 0) {
        row.dataset.midnight = "true";
        const label = make(
          "small",
          "calendar-day-label",
          dateFormatter({ day: "numeric", month: "numeric" }).format(
            parseDate(shiftDate(calendarBaseDate, Math.floor(h / 24))),
          ),
        );
        row.append(label);
      }
      $("#hours").append(row);
    }
    const visible = events
      .filter(
        (event) =>
          event.date >= calendarBaseDate &&
          event.date < shiftDate(calendarBaseDate, calendarDayCount) &&
          minutes(event.end) > 0 &&
          minutes(event.start) < 1440,
      )
      .sort((a, b) => calendarMinute(a) - calendarMinute(b));
    const groups = [];
    visible.forEach((event) => {
      let group = groups[groups.length - 1];
      if (!group || calendarMinute(event) >= group.end) {
        group = { events: [], end: 0 };
        groups.push(group);
      }
      group.events.push(event);
      group.end = Math.max(group.end, calendarMinute(event, "end"));
    });
    groups.forEach((group) => {
      const laneEnds = [];
      const placements = group.events.map((event) => {
          let lane = laneEnds.findIndex((end) => end <= calendarMinute(event));
          if (lane < 0) lane = laneEnds.length;
          laneEnds[lane] = calendarMinute(event, "end");
          return { event, lane };
        }),
        laneCount = Math.min(3, laneEnds.length),
        crowded = laneEnds.length > 3;
      placements
        .filter(({ lane }) => !crowded || lane < 2)
        .forEach(({ event, lane }) => {
          const block = document.createElement("div");
          block.className = "event";
          block.dataset.tone = event.tone || "sun";
          block.dataset.eventId = String(event.id);
          block.dataset.done = String(Boolean(event.done));
          block.setAttribute("role", "group");
          block.tabIndex = 0;
          const top = Math.round(calendarMinute(event) * 0.6);
          const height = Math.round(
            (minutes(event.end) - minutes(event.start)) * 0.6,
          );
          block.style.top = top + 1 + "px";
          block.style.height = Math.max(5, height - 2) + "px";
          block.style.left =
            "calc(" +
            (lane / laneCount) * 100 +
            "% + " +
            (lane ? 3 : 0) +
            "px)";
          block.style.width =
            "calc(" +
            100 / laneCount +
            "% - " +
            (laneCount > 1 ? 3 : 0) +
            "px)";
          block.setAttribute(
            "aria-label",
            "Изменить событие: " +
              event.title +
              ", " +
              event.start +
              "–" +
              event.end,
          );
          block.setAttribute(
            "data-tooltip",
            event.title + " · " + event.start + "–" + event.end,
          );
          const title = action(
            event.title,
            () => {
              if (Date.now() >= suppressCalendarClickUntil)
                openEvent(event, null, title);
            },
            "event-open cursor-interaction",
          );
          const completion = make("span", "event-completion");
          setCompletionIcon(completion, event.done);
          completion.setAttribute("aria-hidden", "true");
          title.prepend(completion);
          title.setAttribute(
            "title",
            (event.done ? "Выполнено: " : "Запланировано: ") + event.title,
          );
          title.setAttribute(
            "aria-label",
            "Изменить событие: " +
              event.title +
              ", " +
              event.start +
              "–" +
              event.end,
          );
          title.setAttribute(
            "data-tooltip",
            event.title +
              " · " +
              event.start +
              "–" +
              event.end +
              (event.description ? " · " + event.description : ""),
          );
          const grip = action(
              "",
              () => {
                if (Date.now() >= suppressCalendarClickUntil)
                  openEvent(event, null, grip);
              },
              "event-grip cursor-interaction",
            ),
            resize = action(
              "",
              () => {
                if (Date.now() >= suppressCalendarClickUntil)
                  openEvent(event, null, resize);
              },
              "event-resize cursor-interaction",
            ),
            icon = make("i");
          icon.dataset.lucide = "grip-vertical";
          icon.setAttribute("aria-hidden", "true");
          grip.append(icon);
          grip.setAttribute("aria-label", "Перенести время: " + event.title);
          resize.setAttribute(
            "aria-label",
            "Изменить длительность: " + event.title,
          );
          listen(grip, "pointerdown", (pointer) =>
            startCalendarDrag(pointer, "event", event, block),
          );
          listen(resize, "pointerdown", (pointer) =>
            startCalendarDrag(pointer, "resize", event, block),
          );
          listen(resize, "keydown", (key) => {
            if (!["ArrowUp", "ArrowDown"].includes(key.key)) return;
            key.preventDefault();
            event.end = clockLabel(
              Math.max(
                minutes(event.start) + Math.min(5, 1439 - minutes(event.start)),
                Math.min(
                  1439,
                  minutes(event.end) + (key.key === "ArrowUp" ? -5 : 5),
                ),
              ) / 60,
            );
            renderCalendar();
            persistState();
          });
          block.append(title, grip, resize);
          listen(block, "click", (pointer) => {
            if (
              pointer.target.closest(".event-open,.event-grip,.event-resize") ||
              Date.now() < suppressCalendarClickUntil
            )
              return;
            openEvent(event, null, block);
          });
          listen(block, "keydown", (key) => {
            if (key.target !== block || !["Enter", " "].includes(key.key))
              return;
            key.preventDefault();
            openEvent(event, null, block);
          });
          $("#events").append(block);
        });
      if (crowded) {
        const hidden = placements
            .filter(({ lane }) => lane >= 2)
            .map(({ event }) => event),
          cluster = make(
            "button",
            "event event-cluster cursor-interaction",
            "+" + hidden.length,
          );
        cluster.type = "button";
        cluster.dataset.clusterCount = String(hidden.length);
        cluster.style.top =
          Math.min(...hidden.map((event) => calendarMinute(event))) * 0.6 +
          1 +
          "px";
        cluster.style.height =
          Math.max(
            24,
            (Math.max(...hidden.map((event) => minutes(event.end))) -
              Math.min(...hidden.map((event) => minutes(event.start)))) *
              0.6 -
              2,
          ) + "px";
        cluster.style.left = "calc(66.6667% + 3px)";
        cluster.style.width = "calc(33.3333% - 3px)";
        cluster.setAttribute(
          "aria-label",
          "Открыть " + hidden.length + " пересекающихся событий",
        );
        cluster.setAttribute(
          "data-tooltip",
          hidden.length + " событий · открыть список",
        );
        listen(cluster, "click", () => openOverlaps(hidden, cluster));
        $("#events").append(cluster);
      }
    });
    if (
      dateKey(new Date()) >= calendarBaseDate &&
      dateKey(new Date()) < shiftDate(calendarBaseDate, calendarDayCount)
    ) {
      const now = new Date(),
        nowMinutes = now.getHours() * 60 + now.getMinutes();
      const marker = document.createElement("div");
      marker.className = "now-line";
      marker.setAttribute("aria-hidden", "true");
      marker.style.top =
        Math.round(
          calendarMinute({
            date: dateKey(now),
            start: clockLabel(nowMinutes / 60),
          }) * 0.6,
        ) + "px";
      $("#events").append(marker);
    }
    updateViewport();
    refreshIcons();
  }
  listen($("#day-toggle"), "click", () => {
    range = range === "day" ? "six" : "day";
    renderCalendar();
  });
  function openOverlaps(items, opener) {
    const host = $("#overlap-list");
    host.replaceChildren();
    items.forEach((item) => {
      const button = make("button", "overlap-item cursor-interaction");
      button.type = "button";
      button.append(
        make("strong", "", item.title),
        make("small", "", item.start + "–" + item.end + " · " + item.context),
      );
      listen(button, "click", () => {
        closeDialog();
        openEvent(item, null, opener);
      });
      host.append(button);
    });
    openDialog("overlap-dialog", opener);
  }
  listen($("#week-toggle"), "click", () => {
    range = "week";
    renderCalendar();
  });
  listen($("#month-toggle"), "click", () => {
    range = "month";
    renderCalendar();
  });
  listen($("#calendar-date"), "change", (event) => {
    if (!event.currentTarget.value) return;
    selectedDate = event.currentTarget.value;
    manualWindow = false;
    renderTasks();
    renderCalendar();
  });
  listen($("#period-prev"), "click", () => {
    selectedDate =
      range === "week"
        ? shiftDate(selectedDate, -7)
        : shiftMonth(selectedDate, -1);
    renderTasks();
    renderCalendar();
  });
  listen($("#period-next"), "click", () => {
    selectedDate =
      range === "week"
        ? shiftDate(selectedDate, 7)
        : shiftMonth(selectedDate, 1);
    renderTasks();
    renderCalendar();
  });
  const scrubber = $("#window-range");
  function setCalendarPosition(position) {
    if (range !== "six" || calendarDrag) return;
    const offset = Math.floor(position / 24),
      before = selectedDate;
    selectedDate = shiftDate(selectedDate, offset);
    manualWindow = true;
    windowStart = position - offset * 24;
    if (selectedDate !== before) {
      renderTasks();
      renderCalendar();
      persistState();
    } else updateViewport();
  }
  let scrubbingCalendar = false;
  listen(scrubber, "pointerdown", () => {
    scrubbingCalendar = true;
    $("#calendar-body").dataset.dragging = "true";
  });
  listen(window, "pointerup", () => {
    delete $("#calendar-body").dataset.dragging;
    if (scrubbingCalendar) {
      scrubbingCalendar = false;
      setCalendarPosition(windowStart);
    }
  });
  listen(window, "pointercancel", () => {
    delete $("#calendar-body").dataset.dragging;
    if (scrubbingCalendar) {
      scrubbingCalendar = false;
      setCalendarPosition(windowStart);
    }
  });
  listen(scrubber, "keydown", (event) => {
    const delta = {
      ArrowDown: 0.1,
      ArrowRight: 0.1,
      ArrowUp: -0.1,
      ArrowLeft: -0.1,
      PageDown: 6,
      PageUp: -6,
    }[event.key];
    if (delta === undefined && !["Home", "End"].includes(event.key)) return;
    event.preventDefault();
    setCalendarPosition(
      event.key === "Home"
        ? 0
        : event.key === "End"
          ? 23.9
          : Number(scrubber.value) + delta,
    );
  });
  listen(scrubber, "input", (event) => {
    const position = Number(event.currentTarget.value);
    if (scrubbingCalendar) {
      manualWindow = true;
      windowStart = position;
      updateViewport();
    } else setCalendarPosition(position);
  });
  listen(
    $("#calendar-body"),
    "wheel",
    (event) => {
      if (
        range !== "six" ||
        event.ctrlKey ||
        event.metaKey ||
        Math.abs(event.deltaX) > Math.abs(event.deltaY) ||
        calendarDrag
      )
        return;
      const delta =
          event.deltaY *
          (event.deltaMode === 1
            ? 16
            : event.deltaMode === 2
              ? window.innerHeight
              : 1),
        next = windowStart + delta / 36;
      if (!delta) return;
      event.preventDefault();
      setCalendarPosition(next);
    },
    { passive: false },
  );
  let timelineScrollFrame = 0;
  function syncCalendarScroll() {
    if (range !== "six" || calendarDrag || scrubbingCalendar) return;
    const next = $("#timeline-window").scrollTop / 36 - 24;
    if (Math.abs(next - windowStart) < 0.02) return;
    setCalendarPosition(next);
  }
  installScrollChaining(root, listen);
  listen(
    $("#timeline-window"),
    "scroll",
    () => {
      if (
        range !== "six" ||
        timelineScrollFrame ||
        calendarDrag ||
        scrubbingCalendar
      )
        return;
      timelineScrollFrame = requestAnimationFrame(() => {
        timelineScrollFrame = 0;
        syncCalendarScroll();
      });
    },
    { passive: true },
  );
  function chooseTone(tone) {
    eventTone = tone;
    all("[data-event-tone]").forEach((button) =>
      button.setAttribute(
        "aria-pressed",
        String(button.dataset.eventTone === tone),
      ),
    );
  }
  all("[data-event-tone]").forEach((button) =>
    listen(button, "click", () => chooseTone(button.dataset.eventTone)),
  );
  function openEvent(event, task, opener) {
    if (event?.workoutId && training) {
      const workout = workouts.find((item) => item.id === event.workoutId);
      if (workout) {
        training.openResults(workout);
        return;
      }
    }
    editingEvent = event;
    experience?.openSeries("event", event);
    schedulingTask = task;
    syncProjectOptions();
    $("#event-title").textContent = event
      ? "Изменить событие"
      : "Добавить в расписание";
    $("#event-name").value = event ? event.title : task ? task.title : "";
    $("#event-description").value =
      event?.description || task?.description || "";
    $("#event-description").closest("details").open = Boolean(
      $("#event-description").value,
    );
    resetRepeat("event");
    $("#event-repeat").closest(".repeat-fields").hidden = Boolean(event);
    let repeatNote = $("#event-repeat-note");
    if (!repeatNote) {
      repeatNote = make(
        "p",
        "repeat-note",
        "Выберите, какие записи серии нужно изменить.",
      );
      repeatNote.id = "event-repeat-note";
      $("#event-error").before(repeatNote);
    }
    repeatNote.hidden = !event?.repeat;
    $("#event-date").value = event?.date || task?.date || selectedDate;
    $("#event-context").value = event?.context || task?.context || "Личное";
    const now = new Date(),
      isToday = $("#event-date").value === dateKey(now),
      nextHalf = isToday
        ? Math.min(
            23 * 60,
            Math.ceil((now.getHours() * 60 + now.getMinutes()) / 30) * 30,
          )
        : 9 * 60;
    const formatTime = (value) =>
      String(Math.floor(value / 60)).padStart(2, "0") +
      ":" +
      String(value % 60).padStart(2, "0");
    $("#event-start").value = event ? event.start : formatTime(nextHalf);
    $("#event-end").value = event
      ? event.end
      : formatTime(Math.min(1439, nextHalf + (task?.duration || 30)));
    chooseTone(event?.tone || "sun");
    $("#event-delete").hidden = !event;
    $("#event-error").hidden = true;
    openDialog("event-dialog", opener);
    $("#event-name").focus();
  }
  listen($("#event-open"), "click", (event) =>
    openEvent(null, null, event.currentTarget),
  );
  listen($("#event-form"), "submit", (event) => {
    event.preventDefault();
    const title = $("#event-name").value.trim(),
      date = $("#event-date").value,
      start = $("#event-start").value,
      end = $("#event-end").value,
      context = $("#event-context").value,
      description = $("#event-description").value.trim();
    if (!title || !date || !start || !end || minutes(end) <= minutes(start)) {
      $("#event-error").textContent = "Проверьте название, дату и время.";
      $("#event-error").hidden = false;
      return;
    }
    try {
      if (editingEvent) {
        const related = experience?.seriesTargets("event", editingEvent) || [
          editingEvent,
        ];
        const dateDelta = Math.round(
          (parseDate(date) - parseDate(editingEvent.date)) / 86400000,
        );
        for (const item of related)
          Object.assign(item, {
            title,
            date: shiftDate(item.date, dateDelta),
            start,
            end,
            duration: minutes(end) - minutes(start),
            context,
            description,
            tone: eventTone,
          });
      } else
        createSeries(
          events,
          {
            ...(schedulingTask || {}),
            title,
            start,
            end,
            context,
            description,
            tone: eventTone,
          },
          readRepeat("event", date),
        );
    } catch (error) {
      $("#event-error").textContent = error.message;
      $("#event-error").hidden = false;
      fitDialog();
      return;
    }
    if (schedulingTask) {
      const index = tasks.indexOf(schedulingTask);
      if (index >= 0) tasks.splice(index, 1);
    }
    if (editingEvent?.workoutId) {
      const workout = workouts.find(
        (item) => item.id === editingEvent.workoutId,
      );
      if (workout)
        Object.assign(workout, {
          name: title,
          date,
          time: start,
          duration: minutes(end) - minutes(start),
        });
      training?.render();
    }
    selectedDate = date;
    manualWindow = false;
    renderTasks();
    renderCalendar();
    renderProjects();
    closeDialog();
    if (activePage === "home") $("#event-open").focus();
    if (activePage === "completed") upgrades?.renderCompleted();
  });
  listen($("#event-delete"), "click", () => {
    if (!editingEvent) return;
    const item = editingEvent,
      index = events.indexOf(item);
    if (index < 0) return;
    if (item.workoutId && training) {
      closeDialog();
      training.unschedule(item);
      return;
    }
    closeDialog();
    events.splice(index, 1);
    renderTasks();
    renderCalendar();
    renderProjects();
    if (activePage === "completed") upgrades?.renderCompleted();
    showUndo("event", item, index);
  });
  function setDestination(value) {
    destination = value;
    all("[data-dest]").forEach((button) =>
      button.setAttribute(
        "aria-pressed",
        String(button.dataset.dest === value),
      ),
    );
    $("#project-field").hidden = value !== "project";
    $("#capture-project").required = value === "project";
    const scheduled = value === "project" || value === "today";
    $("#capture-when").hidden = !scheduled;
    $("#capture-date").required = false;
    $("#capture-error").hidden = true;
    if (activeDialog?.id === "capture-dialog") fitDialog();
  }
  all("[data-dest]").forEach((button) =>
    listen(button, "click", () => setDestination(button.dataset.dest)),
  );
  function openCapture(dest, opener, projectName) {
    syncProjectOptions();
    setDestination(dest);
    $("#capture-title").textContent = "Добавить задачу";
    $("#capture-text").value = "";
    $("#capture-description").value = "";
    $("#capture-duration").value = "30";
    $("#capture-description").closest("details").open = false;
    $("#capture-save-template").checked = false;
    resetRepeat("capture");
    $("#capture-date").value = dest === "project" ? "" : selectedDate;
    $("#capture-time").value = "";
    $("#capture-project").value =
      projectName ||
      projects.find((project) => project.id === selectedProjectId)?.name ||
      "";
    openDialog("capture-dialog", opener);
    $("#capture-text").focus();
  }
  listen($("#task-add"), "click", (event) =>
    openCapture("today", $("#home-add") || event.currentTarget),
  );
  let captureFeedbackTimer = 0;
  async function showCaptureFeedback(place) {
    if (usability) {
      usability.notify("Сохранено " + place);
      return;
    }
    const feedback = $("#capture-feedback");
    persistState();
    try {
      await services.flush();
    } catch {
      return;
    }
    if (disposed) return;
    feedback.textContent = "Сохранено " + place;
    feedback.hidden = false;
    clearTimeout(captureFeedbackTimer);
    captureFeedbackTimer = setTimeout(() => {
      if (root.isConnected) feedback.hidden = true;
    }, 4000);
  }
  listen($("#capture-form"), "submit", (event) => {
    event.preventDefault();
    const text = $("#capture-text").value.trim(),
      project = $("#capture-project").value,
      date = $("#capture-date").value,
      time = $("#capture-time").value;
    if (
      !text ||
      (destination === "project" && !project) ||
      (time && (!date || minutes(time) >= 1439))
    ) {
      $("#capture-error").textContent = !text
        ? "Напишите название задачи."
        : destination === "project" && !project
          ? "Выберите проект."
          : !date
            ? "Выберите дату."
            : "Укажите время раньше 23:59.";
      $("#capture-error").hidden = false;
      fitDialog();
      return;
    }
    const context = destination === "project" ? project : personalProject,
      description = $("#capture-description").value.trim(),
      duration = Number($("#capture-duration").value) || 30,
      base = { title: text, context, description, duration };
    try {
      const rule = readRepeat("capture", date);
      if (time) {
        const start = minutes(time),
          end = clockLabel(Math.min(1439, start + duration) / 60);
        createSeries(
          events,
          { ...base, start: time, end, tone: projectTone(context) },
          rule,
        );
      } else createSeries(tasks, base, rule);
      if ($("#capture-save-template").checked) saveTaskTemplate(base);
    } catch (error) {
      $("#capture-error").textContent = error.message;
      $("#capture-error").hidden = false;
      fitDialog();
      return;
    }
    if (date) selectedDate = date;
    manualWindow = false;
    renderTasks();
    renderCalendar();
    renderProjects();
    const place = time
      ? "в расписании на " + shortDate(date)
      : destination === "project"
        ? "в проекте «" + project + "»"
        : date
          ? "в задачах на " + shortDate(date)
          : "в задачах без даты";
    showCaptureFeedback(place);
    $("#capture-text").value = "";
    closeDialog();
  });
  function scoreValue(key) {
    return Number($('input[name="' + key + '"]:checked').value);
  }
  function updateScore(key) {
    const value = scoreValue(key),
      field = $('.score-field[data-score-kind="' + key + '"]');
    $("#" + key + "-output").textContent = value + " / 5";
    field.querySelectorAll(".score-choice").forEach((choice, index) => {
      choice.dataset.filled = String(index < value);
      choice.dataset.selected = String(index + 1 === value);
    });
  }
  function setScore(key, value) {
    const input = $('input[name="' + key + '"][value="' + value + '"]');
    if (input) {
      input.checked = true;
      updateScore(key);
    }
  }
  for (const key of ["mood", "energy", "stress"]) {
    updateScore(key);
    all('input[name="' + key + '"]').forEach((input) =>
      listen(input, "change", () => updateScore(key)),
    );
  }
  function scoreAtPointer(group, event) {
    const rect = group.getBoundingClientRect(),
      value = Math.max(
        1,
        Math.min(5, Math.ceil(((event.clientX - rect.left) / rect.width) * 5)),
      );
    setScore(group.closest(".score-field").dataset.scoreKind, value);
  }
  all(".score-strip .score-choices").forEach((group) => {
    listen(group, "pointerdown", (event) => {
      if (event.pointerType === "mouse" && event.button !== 0) return;
      group.setPointerCapture(event.pointerId);
      scoreAtPointer(group, event);
    });
    listen(group, "pointermove", (event) => {
      if (group.hasPointerCapture(event.pointerId))
        scoreAtPointer(group, event);
    });
    listen(group, "pointerup", (event) => {
      scoreAtPointer(group, event);
      const key = group.closest(".score-field").dataset.scoreKind;
      $('input[name="' + key + '"]:checked').focus({ preventScroll: true });
    });
  });
  function checkinDue() {
    return wellbeingDue(
      lastCheckin,
      Date.now(),
      extraState.notificationSettings?.wellbeingCount,
    );
  }
  function renderCheckinIndicators() {
    const state = checkinDue() ? "due" : "recorded";
    all(".counterweight").forEach(
      (figure) => (figure.dataset.checkinState = state),
    );
  }
  function scheduleCheckinExpiry() {
    clearTimeout(checkinExpiryTimer);
    checkinExpiryTimer = null;
    if (checkinDue()) return;
    const remaining =
      nextWellbeingPeriod(
        Date.now(),
        extraState.notificationSettings?.wellbeingCount,
      ) - Date.now();
    checkinExpiryTimer = setTimeout(
      () => {
        checkinExpiryTimer = null;
        if (root.isConnected) renderState(false);
      },
      Math.max(1, remaining),
    );
  }
  function openWellbeingStats(day) {
    lifeTab = "mood";
    lifeDetailOpen = true;
    selectedLifeDay = day || personalDay(Date.now(), extraState);
    $("#mood-month").value = selectedLifeDay.slice(0, 7);
    showPage("life");
    persistState();
  }
  function showStateDialog(opener, entry = null) {
    if (!entry && !checkinDue()) {
      openWellbeingStats();
      return;
    }
    editingCheckinEntry = entry;
    editingCheckin = Boolean(entry);
    const values = entry || checkins.at(-1);
    for (const key of ["mood", "energy", "stress"])
      setScore(key, values?.[key] || 3);
    $("#state-title").textContent = entry
      ? "Самочувствие · " +
        shortDate(dateKey(new Date(entry.at))) +
        " · " +
        dateFormatter({
          hour: "2-digit",
          minute: "2-digit",
        }).format(new Date(entry.at))
      : "Как вы сейчас?";
    $("#checkin-note").value = entry?.note || "";
    experience?.openCheckin(entry);
    $(".checkin-note").open = Boolean(entry?.note);
    $('#state-form button[type="submit"]').textContent = "Сохранить";
    openDialog("state-dialog", opener);
  }
  function beginCheckin(opener) {
    checkinFromLife = opener?.id === "life-checkin-open";
    editingCheckinEntry = null;
    if (!checkinDue()) {
      openWellbeingStats();
      return;
    }
    if (checkinFromLife) openWellbeingStats();
    showStateDialog(opener);
  }
  listen($("#state-open"), "click", (event) =>
    beginCheckin(event.currentTarget),
  );
  listen($("#life-checkin-open"), "click", (event) =>
    beginCheckin(event.currentTarget),
  );
  function renderState(renderDetails = true) {
    const sleepDay = personalDay(Date.now(), extraState);
    $("#home-sleep-prompt").hidden =
      new Date().getHours() < 6 ||
      illnessOnDay(extraState.illnessLogs, sleepDay, sleepDay) ||
      sleepLogs.some(
        (item) => lifeRecordDay(item, extraState, "sleepLogs") === sleepDay,
      );
    lifeTracking?.renderHome();
    const entry = checkins[checkins.length - 1],
      hasEntry = Boolean(entry);
    const due = checkinDue();
    renderCheckinIndicators();
    scheduleCheckinExpiry();
    $("#state-card").dataset.hasEntry = String(hasEntry);
    $("#state-card").dataset.due = String(due);
    $("#state-card").setAttribute(
      "aria-label",
      due
        ? "Самочувствие: пора отметиться"
        : `Самочувствие: настроение ${entry.mood} из 5, энергия ${entry.energy} из 5, стресс ${entry.stress} из 5`,
    );
    $("#state-open").setAttribute(
      "aria-label",
      due ? "Отметить самочувствие" : "Открыть статистику самочувствия",
    );
    if (renderDetails) renderLife();
    else {
      const caption = due ? "Отметиться" : "Самочувствие",
        label = due
          ? "Отметить самочувствие"
          : "Открыть статистику самочувствия";
      $("#life-core-caption").textContent =
        effectiveLanguage() === "ru" ? caption : translateLabel(caption);
      $("#life-checkin-open").setAttribute(
        "aria-label",
        effectiveLanguage() === "ru" ? label : translateLabel(label),
      );
    }
  }
  listen($("#home-sleep-prompt"), "click", () =>
    openLifeCategory("sleep", personalDay(Date.now(), extraState)),
  );
  listen($("#state-form"), "submit", (event) => {
    event.preventDefault();
    if (activeDialog?.id !== "state-dialog") return;
    const scores = {
        mood: scoreValue("mood"),
        energy: scoreValue("energy"),
        stress: scoreValue("stress"),
        note: $("#checkin-note").value.trim(),
        ...(experience ? { tags: experience.checkinTags() } : {}),
      },
      entry = editingCheckinEntry;
    if (entry && checkins.includes(entry)) Object.assign(entry, scores);
    else {
      if (!checkinDue()) {
        closeDialog();
        openWellbeingStats();
        return;
      }
      lastCheckin = Date.now();
      checkins.push({ at: lastCheckin, ...scores });
    }
    const day = personalDay(entry?.at || lastCheckin, extraState);
    renderState();
    closeDialog();
    if (entry || checkinFromLife) openWellbeingStats(day);
    editingCheckinEntry = null;
    checkinFromLife = false;
  });
  let lastLifeDate = personalDay(Date.now(), extraState);
  const reminderTimer = setInterval(() => {
    if (!root.isConnected) {
      clearInterval(reminderTimer);
      return;
    }
    if (document.hidden) return;
    if (todayKey !== dateKey(new Date())) {
      refreshToday();
      return;
    }
    const lifeDate = personalDay(Date.now(), extraState);
    if (
      lifeDate !== lastLifeDate &&
      !activeDialog &&
      !document.activeElement?.matches("input,textarea,[contenteditable=true]")
    ) {
      lastLifeDate = lifeDate;
      resetLifeDates();
      if (activePage === "life") renderLife();
    }
    renderDate();
    renderState(false);
    renderCalendar();
  }, 60000);
  function resetLifeDates() {
    const day = personalDay(Date.now(), extraState);
    selectedLifeDay = day;
    for (const id of ["mood-month", "sleep-month", "training-month"])
      if ($("#" + id)) $("#" + id).value = day.slice(0, 7);
    for (const id of [
      "life-day-date",
      "sleep-date",
      "food-day",
      "food-date",
      "training-date",
    ])
      if ($("#" + id)) $("#" + id).value = day;
    training?.resetToday();
    upgrades?.resetToday();
  }
  function refreshToday() {
    if (!root.isConnected || disposed) return;
    // Returning from the keyboard, a file picker or another app must not
    // change the date of an entry the user is still editing.
    if (
      activeDialog ||
      (root.contains(document.activeElement) &&
        document.activeElement?.matches(
          "input,textarea,[contenteditable=true]",
        ))
    )
      return;
    todayKey = dateKey(new Date());
    selectedDate = todayKey;
    manualWindow = false;
    windowStart = centeredStart();
    calendarPaintKey = "";
    renderDate();
    renderCalendar();
    renderState();
    renderTasks();
    resetLifeDates();
    if (activePage === "life") renderLife();
    if (workspaceReady) {
      screenHistory.replace(screenState());
      persistState();
    }
  }
  listen(document, "visibilitychange", () => {
    if (!document.hidden && root.isConnected) {
      refreshToday();
    }
  });
  listen(window, "life-os:resume", refreshToday);
  function applyAppearance(mode) {
    root.dataset.appearance = ["light", "dark"].includes(mode)
      ? mode
      : "system";
    const rendered =
      root.dataset.appearance === "system"
        ? window.matchMedia("(prefers-color-scheme:dark)").matches
          ? "dark"
          : "light"
        : root.dataset.appearance;
    root.dataset.renderedAppearance = rendered;
    root.style.colorScheme = rendered;
    document.documentElement.style.colorScheme = rendered;
    if ($(".brand svg")) drawCeramicEmblem();
  }
  all("[data-appearance]").forEach((button) =>
    listen(button, "click", () => {
      applyAppearance(button.dataset.appearance);
      all("[data-appearance]").forEach((item) =>
        item.setAttribute("aria-pressed", String(item === button)),
      );
      drawCeramicEmblem();
    }),
  );
  all("[data-theme]").forEach((button) =>
    listen(button, "click", () => {
      root.dataset.palette = button.dataset.theme;
      all("[data-theme]").forEach((item) =>
        item.setAttribute("aria-pressed", String(item === button)),
      );
      drawCeramicEmblem();
    }),
  );
  listen($("#custom-color"), "input", (event) => {
    customColor = event.target.value;
    root.style.setProperty("--lo-custom-color", customColor);
    root.dataset.palette = "custom";
    all("[data-theme]").forEach((item) =>
      item.setAttribute("aria-pressed", "false"),
    );
    drawCeramicEmblem();
  });
  listen($("#language-select"), "change", (event) => {
    languageMode = event.target.value;
    renderDate();
    renderTasks();
    renderCalendar();
    renderProjects();
    renderLife();
    renderArchive();
    showPage(activePage);
  });
  listen($("#font-select"), "change", (event) => {
    if (event.target.value === "add-custom-font") return;
    fontMode = event.target.value;
    root.dataset.font = fontMode;
  });
  function drawCeramicEmblem() {
    const palette = root.dataset.palette || "sun";
    const appearance = services.mobile
      ? "light"
      : root.dataset.renderedAppearance || "light";
    const colors = ceramicColors(palette, appearance, customColor);
    all(".brand,.mobile-brand").forEach((container, index) => {
      container.setAttribute("aria-label", "Orvim");
      let svg = container.querySelector(".ceramic-emblem");
      if (!svg) {
        svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        svg.setAttribute("viewBox", "0 0 272 272");
        svg.setAttribute("class", "ceramic-emblem");
        svg.setAttribute("aria-hidden", "true");
        svg.setAttribute("focusable", "false");
        svg.setAttribute("fill", "none");
        container.replaceChildren(svg);
      }
      svg.innerHTML =
        '<g transform="translate(2 5)">' +
        ceramicMarkup(colors, "life-ceramic-" + index) +
        "</g>";
      svg.dataset.palette = palette;
      svg.dataset.appearance = appearance;
    });
  }
  function removeWithUndo(collection, item, redraw) {
    const index = collection.indexOf(item);
    if (index < 0) return;
    collection.splice(index, 1);
    redraw();
    persistState();
    usability?.notify(
      effectiveLanguage() === "en" ? "Entry deleted" : "Запись удалена",
      () => {
        if (
          collection === extraState.financeLogs &&
          experience &&
          !experience.canRestoreFinance(item)
        )
          return;
        if (!collection.includes(item))
          collection.splice(Math.min(index, collection.length), 0, item);
        redraw();
      },
    );
  }
  function deleteDatabaseItem(item) {
    const cover = archiveCovers.get(item.id);
    removeWithUndo(archiveItems, item, () => {
      if (archiveItems.includes(item) && cover)
        archiveCovers.set(item.id, cover);
      else archiveCovers.delete(item.id);
      renderArchive();
      workspaceContext.refreshMaterialOwners();
    });
  }
  function editCollection(opener) {
    if (!archiveCategories.includes(selectedArchiveCategory)) return;
    editingCollection = selectedArchiveCategory;
    $("#archive-category-dialog-title").textContent = "Изменить коллекцию";
    $('#archive-category-form button[type="submit"]').textContent = "Сохранить";
    $("#archive-category-name").value = editingCollection;
    $("#archive-category-error").hidden = true;
    database?.collectionOpened(editingCollection);
    openDialog("archive-category-dialog", opener);
    $("#archive-category-name").focus();
  }
  function deleteCollection(opener) {
    const name = selectedArchiveCategory,
      index = archiveCategories.indexOf(name);
    if (index < 0) return;
    const items = archiveItems.filter((item) => item.category === name);
    usability.confirmCollection(name, items.length, opener, () => {
      const saved = items.map((item) => ({
        item,
        index: archiveItems.indexOf(item),
        cover: archiveCovers.get(item.id),
      }));
      const config = database?.removeCollection(name);
      archiveCategories.splice(index, 1);
      for (const item of items) {
        archiveItems.splice(archiveItems.indexOf(item), 1);
        archiveCovers.delete(item.id);
      }
      renderArchive();
      persistState();
      usability.notify(
        effectiveLanguage() === "en"
          ? "Collection deleted"
          : "Коллекция удалена",
        () => {
          let restoredName = name;
          for (
            let number = 1;
            archiveCategories.includes(restoredName);
            number++
          )
            restoredName = name + " (" + number + ")";
          archiveCategories.splice(
            Math.min(index, archiveCategories.length),
            0,
            restoredName,
          );
          database?.restoreCollection(restoredName, config);
          for (const entry of saved) {
            entry.item.category = restoredName;
            archiveItems.splice(
              Math.min(entry.index, archiveItems.length),
              0,
              entry.item,
            );
            if (entry.cover) archiveCovers.set(entry.item.id, entry.cover);
          }
          selectedArchiveCategory = restoredName;
          renderArchive();
        },
      );
    });
  }
  function editEntity(kind, item, opener) {
    if (["task", "event"].includes(kind)) {
      selectedDate = item.date || item.createdDate || dateKey(new Date());
      if (!["home", "projects", "completed"].includes(activePage))
        showPage("home");
      if (kind === "task") openTask(item, opener);
      else openEvent(item, null, opener);
    }
    if (kind === "project") {
      selectedProjectId = item.id;
      showPage("projects");
      openProjectDialog(item, opener);
    }
    if (kind === "thought") {
      showPage("thoughts");
      upgrades.openThought(item, opener, true);
    }
    if (kind === "finance") {
      lifeTab = "finances";
      lifeDetailOpen = true;
      showPage("life");
      upgrades.openFinance(item, opener);
    }
    if (kind === "database") {
      selectedArchiveCategory = item.category;
      showPage("archive");
      openArchiveItem(item, opener);
    }
    if (kind === "food") usability.editFood(item, opener);
  }
  function deleteEntity(kind, item) {
    if (kind === "task") deleteTask(item);
    else if (kind === "event" && item.workoutId && training)
      training.unschedule(item);
    else if (kind === "event")
      removeWithUndo(events, item, () => {
        renderTasks();
        renderCalendar();
        renderProjects();
        upgrades?.renderCompleted();
      });
    else if (kind === "thought")
      removeWithUndo(extraState.thoughts, item, () => {
        upgrades.renderThoughts();
        upgrades.renderHomeThoughts();
      });
    else if (kind === "finance") {
      if (experience && !experience.canRemoveFinance(item)) return;
      removeWithUndo(extraState.financeLogs, item, () => {
        upgrades.renderFinances();
        upgrades.renderFinanceSummary();
      });
    } else if (kind === "database") deleteDatabaseItem(item);
    else if (kind === "food")
      removeWithUndo(foodLogs, item, () => {
        renderFood();
        renderMoodDay();
      });
  }
  function duplicateEntity(kind, item, opener) {
    if (kind === "finance") {
      upgrades.openFinance(item, opener, true);
      return;
    }
    if (kind === "database" && database && !database.canDuplicate(item)) return;
    const collection = {
      task: tasks,
      event: events,
      thought: extraState.thoughts,
      finance: extraState.financeLogs,
      database: archiveItems,
      food: foodLogs,
    }[kind];
    if (!collection) return;
    const clone = { ...structuredClone(item), id: nextId++ };
    delete clone._syncId;
    delete clone.source;
    delete clone.seriesId;
    delete clone.repeatKey;
    delete clone.repeatIndex;
    delete clone.repeatInstanceKey;
    delete clone.repeatNextKey;
    delete clone.repeat;
    delete clone.workoutId;
    if (["task", "event"].includes(kind)) {
      clone.createdDate = dateKey(new Date());
      clone.done = false;
      clone.status = "planned";
      clone.win = false;
      delete clone.order;
    }
    collection.push(clone);
    if (kind === "database" && archiveCovers.has(item.id))
      archiveCovers.set(clone.id, archiveCovers.get(item.id));
    persistState();
    editEntity(kind, clone, opener);
    usability.notify(
      effectiveLanguage() === "en" ? "Copy created" : "Копия создана",
    );
  }
  const workspaceContext = {
    root,
    $,
    all,
    make,
    listen,
    action,
    fieldControl,
    openDialog,
    openInitialDialog: (id) => {
      // A late optional setup response must not replace a form or steal navigation.
      if (!workspaceReady || userInteracted || activeDialog || disposed)
        return false;
      return openDialog(id);
    },
    closeDialog,
    registerBackLayer,
    fitDialog,
    persistState,
    services,
    snapshotData,
    documentSnapshot: () => ({
      data: snapshotData(),
      covers: [...archiveCovers],
    }),
    applyDocument: (snapshot) => {
      restoreState(snapshot.data);
      archiveCovers.clear();
      snapshot.covers.forEach(([id, source]) => archiveCovers.set(id, source));
      database?.rehydrate();
      upgrades?.rehydrate();
      usability?.rehydrate();
      training?.rehydrate();
      experience?.rehydrate();
      refinements.rehydrate();
      syncProjectOptions();
      renderDate();
      renderState();
      renderTasks();
      renderCalendar();
      renderProjects();
      renderArchive();
      renderLife();
    },
    restoreState,
    validateBackup,
    personalDay: () => personalDay(Date.now(), extraState),
    refreshPersonalDay: () => training?.refreshDayBoundary(),
    resetLifeToday: () => {
      resetLifeDates();
      training?.resetToday();
      renderLife();
    },
    lifeDay: (row, kind) => lifeRecordDay(row, extraState, kind),
    isIllDay: (day) =>
      illnessOnDay(
        extraState.illnessLogs,
        day,
        personalDay(Date.now(), extraState),
      ),
    applyBackup,
    tasks,
    events,
    projects,
    checkins,
    workouts,
    trainingGoals,
    sleepLogs,
    savedMeals,
    archiveItems,
    archiveCategories,
    extraState,
    createId: () => nextId++,
    page: () => activePage,
    showPage,
    renderTasks,
    renderCalendar,
    renderProjects,
    refreshDestinations: syncProjectOptions,
    renderLife,
    refreshHomeStatus: () => renderState(false),
    renderWins,
    openTask,
    openEvent,
    openProjectDialog,
    undoDeletion,
    removeWithUndo,
    notify: (...args) => usability?.notify(...args),
    itemMenu: (...args) => usability?.itemMenu(...args),
    editEntity,
    deleteEntity,
    duplicateEntity,
    editCollection,
    deleteCollection,
    selectedCollection: () => selectedArchiveCategory,
    selectCollection: (name) => {
      selectedArchiveCategory = name;
    },
    databaseCover: (id) => archiveCovers.get(id),
    setDatabaseCover: (id, cover) => {
      if (cover) archiveCovers.set(id, cover);
      else archiveCovers.delete(id);
    },
    databaseDraftCover: () => archiveDraftCover,
    restoreDatabaseDraftCover: (cover) => {
      archiveDraftCover = cover;
      refreshCoverPreview();
    },
    openDatabaseItem: openArchiveItem,
    openDatabaseView: openArchiveView,
    databaseStars: (value, max = 5) => upgrades.stars(value, max),
    archiveRatingMax: () =>
      collectionSettings(
        extraState,
        $("#archive-item-collection")?.value || selectedArchiveCategory,
      ).ratingMax,
    renderDatabaseRating: () => upgrades.renderRating(),
    renderMaterialLinks: (host, item, kind) =>
      database?.renderLinks(host, item, kind),
    refreshMaterialOwners: () => {
      upgrades?.renderThoughts();
      renderProjects();
    },
    flushThoughts: () => upgrades?.flushThoughts(),
    openMaterialOwner: (kind, item) => {
      if (kind === "thought") {
        showPage("thoughts");
        upgrades.openThought(item, null, false);
      } else {
        selectedProjectId = item.id;
        showPage("projects");
      }
    },
    hasDialog: () => Boolean(activeDialog),
    setTimeout,
    clearTimeout,
    foodLogs,
    renderFood,
    resetFoodEditor,
    shiftDate,
    shiftMonth,
    selectedProjectId: () => selectedProjectId,
    selectedDate: () => selectedDate,
    openLifeCategory,
    openThought: (item, edit = false, query = "") =>
      upgrades?.openThought(item, null, edit, query),
    openWorkoutResults: (item) => training?.openResults(item),
    openSleepLog: (item) => {
      lifeTab = "sleep";
      lifeDetailOpen = true;
      showPage("life");
      $("#sleep-month").value = item.date.slice(0, 7);
      renderLife();
      $("#sleep-date").value = item.date;
      $("#sleep-hours").value = String(item.hours);
      $("#sleep-quality").value = item.quality || "";
      $("#sleep-quality").dispatchEvent(new Event("change"));
      $("#sleep-note").value = item.note || "";
      $("#sleep-hours").focus();
    },
    openFinance: (item, opener, copy = false) =>
      upgrades?.openFinance(item, opener, copy),
    renderFinances: () => upgrades?.renderFinances(),
    financePeriod: () => upgrades?.financePeriod(),
    financeCategoryNames: () => upgrades?.categoryNames() || [],
    experience: () => experience,
    moveEntityDay: (kind, item, date) => {
      const before = item.date;
      item.date = date;
      if (item.workoutId) {
        const workout = workouts.find((row) => row.id === item.workoutId);
        if (workout) workout.date = date;
      }
      renderTasks();
      renderCalendar();
      renderProjects();
      renderLife();
      persistState();
      usability?.notify(
        effectiveLanguage() === "en" ? "Date changed" : "Дата изменена",
        () => {
          item.date = before;
          if (item.workoutId) {
            const workout = workouts.find((row) => row.id === item.workoutId);
            if (workout) workout.date = before;
          }
          renderTasks();
          renderCalendar();
          renderProjects();
          renderLife();
          persistState();
        },
      );
    },
    focusEntityDestination: (kind) => {
      if (kind === "thought") {
        upgrades?.thoughtMetadata();
        return;
      }
      const control = $(
        "#" +
          {
            task: "task-context",
            event: "event-context",
            thought: "thought-date",
            finance: "finance-category",
            database: "archive-item-collection",
            food: "food-edit-date",
          }[kind],
      );
      if (!control) return;
      const details = control.closest("details");
      if (details) details.open = true;
      control.focus();
    },
    goToNow: () => {
      selectedDate = dateKey(new Date());
      range = "six";
      manualWindow = false;
      windowStart = centeredStart();
      renderTasks();
      renderCalendar();
      persistState();
    },
    effectiveLanguage,
    displayLocale,
    translate: (ru, en) => (effectiveLanguage() === "en" ? en : ru),
    dateKey,
    get todayKey() {
      return todayKey;
    },
    parseDate,
    shortDate,
    showStateDialog,
    checkinDue,
    translations,
    applyLanguage,
  };
  upgrades = installUpgrades(workspaceContext);
  installScopedSelection(root, listen);
  usability = installUsability(workspaceContext);
  database = installDatabase(workspaceContext);
  training = installTraining(workspaceContext);
  experience = installExperience(workspaceContext);
  lifeTracking = installLifeTracking(workspaceContext);
  const refinements = installRefinements(workspaceContext);
  const roundedControls = installRoundedControls(workspaceContext);
  listen(root, "keydown", (event) => {
    if (
      (event.ctrlKey || event.metaKey) &&
      event.shiftKey &&
      event.code === "KeyN" &&
      !activeDialog
    ) {
      event.preventDefault();
      upgrades.openThought(null, null, false);
    }
  });
  root.dataset.motion = "playing";
  listen(
    root,
    "submit",
    (event) => {
      const form = event.target;
      if (
        !form.checkValidity() ||
        form.querySelector('button[type="submit"]')?.disabled
      ) {
        event.preventDefault();
        event.stopImmediatePropagation();
        form.reportValidity();
      }
    },
    true,
  );
  const numericPattern = /^\d*(?:[.,]\d*)?$/;
  const matchesNumeric = (input, value) =>
    (Number(input.min) < 0 ? /^-?\d*(?:[.,]\d*)?$/ : numericPattern).test(
      value,
    );
  listen(
    root,
    "input",
    (event) => {
      if (
        event.target.matches('input[type="number"]') &&
        event.target.value &&
        !matchesNumeric(event.target, event.target.value)
      )
        event.target.value = "";
    },
    true,
  );
  listen(
    root,
    "change",
    (event) => {
      if (!event.target.matches('input[type="number"]')) return;
      if (
        event.target.value &&
        !matchesNumeric(event.target, event.target.value)
      )
        event.target.value = "";
      if (!event.target.checkValidity()) {
        event.stopImmediatePropagation();
        event.target.reportValidity();
      }
    },
    true,
  );
  listen(root, "keydown", (event) => {
    if (
      event.target.matches('input[type="number"]') &&
      !event.ctrlKey &&
      !event.metaKey &&
      event.key.length === 1 &&
      !/[0-9.,]/.test(event.key) &&
      !(event.key === "-" && Number(event.target.min) < 0)
    )
      event.preventDefault();
  });
  listen(root, "beforeinput", (event) => {
    if (
      event.target.matches('input[type="number"]') &&
      event.data &&
      !matchesNumeric(event.target, event.data)
    )
      event.preventDefault();
  });
  listen(root, "paste", (event) => {
    if (!event.target.matches('input[type="number"]')) return;
    const value = event.clipboardData?.getData("text") || "";
    event.preventDefault();
    if (
      !(
        Number(event.target.min) < 0
          ? /^-?\d+(?:[.,]\d+)?$/
          : /^\d+(?:[.,]\d+)?$/
      ).test(value.trim())
    )
      return;
    event.target.value = value.trim().replace(",", ".");
    event.target.dispatchEvent(new Event("input", { bubbles: true }));
  });
  all('input[type="number"]').forEach((input) => {
    input.inputMode = Number(input.step) % 1 ? "decimal" : "numeric";
  });
  all("form").forEach((form) => {
    const submit = form.querySelector('button[type="submit"]');
    if (!submit) return;
    const submitValid = () => {
      if (submit.disabled || !form.reportValidity()) return;
      form.dispatchEvent(
        new Event("submit", { bubbles: true, cancelable: true }),
      );
    };
    listen(submit, "click", (event) => {
      event.preventDefault();
      submitValid();
    });
    listen(form, "keydown", (event) => {
      if (
        event.key === "Enter" &&
        event.target.tagName === "INPUT" &&
        event.target.type !== "radio"
      ) {
        event.preventDefault();
        submitValid();
      }
    });
  });
  selectedLifeDay = personalDay(Date.now(), extraState);
  $("#mood-month").value = selectedLifeDay.slice(0, 7);
  $("#life-day-date").value = selectedLifeDay;
  $("#sleep-month").value = selectedLifeDay.slice(0, 7);
  $("#sleep-date").value = selectedLifeDay;
  fillSleepForm(selectedLifeDay);
  $("#food-day").value = personalDay(Date.now(), extraState);
  $("#training-month").value = todayKey.slice(0, 7);
  $("#training-date").value = todayKey;
  $("#training-time").value = "09:00";

  drawCeramicEmblem();
  const appearanceMedia = window.matchMedia("(prefers-color-scheme:dark)");
  listen(appearanceMedia, "change", () => {
    if (root.isConnected) {
      if (root.dataset.appearance === "system") applyAppearance("system");
      drawCeramicEmblem();
    }
  });
  syncProjectOptions();
  renderState(false);
  // showPage renders the active screen. Hidden lists are built when opened.
  showPage(activePage);
  workspaceReady = true;
  listen(window, "orvim:widget-action", (event) => {
    const request = event.detail || {};
    if (
      !["home", "task", "thought", "food", "item", "complete"].includes(
        request.action,
      )
    )
      return;
    selectedDate = dateKey(new Date());
    range = "six";
    manualWindow = false;
    windowStart = centeredStart();
    extraState.homeView = "tasks";
    if (activeDialog) closeDialog();
    showPage("home");
    renderTasks();
    renderCalendar();
    if (request.action === "task") openCapture("today", $("#home-add"));
    if (request.action === "thought") {
      showPage("thoughts");
      $("#thought-feed-capture")?.focus();
    }
    if (request.action === "food") {
      selectedLifeDay = personalDay(Date.now(), snapshotData());
      $("#food-day").value = selectedLifeDay;
      $("#food-date").value = selectedLifeDay;
      lifeTab = "food";
      lifeDetailOpen = true;
      showPage("life");
      $("#food-entry-disclosure").open = true;
      $("#food-name").focus();
    }
    if (["item", "complete"].includes(request.action)) {
      const collection = request.kind === "event" ? events : tasks;
      const item = collection.find((row) => row.id === request.id);
      if (!item) return;
      if (request.action === "item")
        editEntity(
          request.kind === "event" ? "event" : "task",
          item,
          $("#home-add"),
        );
      else if (item.date === selectedDate || taskDay(item) === selectedDate) {
        // Use the existing completion path, including linked workout results.
        if (Boolean(item.done) !== Boolean(request.done)) {
          root
            .querySelector(
              `[data-task-id="${Number(item.id)}"][data-kind="${request.kind === "event" ? "event" : "task"}"] .task-check`,
            )
            ?.click();
          persistState();
        }
      }
    }
  });
  screenHistory.reset(screenState());
  const buttonHints = installButtonHints(workspaceContext);
  let backTouch = null;
  listen(
    root,
    "touchstart",
    (event) => {
      backTouch = null;
      if (
        !services.mobile ||
        event.touches.length !== 1 ||
        activeDialog ||
        event.target.closest(
          'input,textarea,select,button,a,[contenteditable],.project-board,.score-choices,.timeline-window,[role="slider"]',
        )
      )
        return;
      for (
        let node = event.target;
        node && node !== root;
        node = node.parentElement
      )
        if (
          node.scrollWidth > node.clientWidth + 1 &&
          ["auto", "scroll"].includes(getComputedStyle(node).overflowX)
        )
          return;
      const touch = event.touches[0];
      if (touch.clientX <= 24)
        backTouch = { x: touch.clientX, y: touch.clientY, at: Date.now() };
    },
    { passive: true },
  );
  listen(
    root,
    "touchcancel",
    () => {
      backTouch = null;
    },
    { passive: true },
  );
  listen(
    root,
    "touchend",
    (event) => {
      const touch = event.changedTouches[0],
        start = backTouch;
      backTouch = null;
      if (event.touches.length || !touch) return;
      if (
        isBackSwipe(start, {
          x: touch.clientX,
          y: touch.clientY,
          at: Date.now(),
        }) &&
        goBack()
      )
        persistState();
    },
    { passive: true },
  );
  let translationQueued = false;
  translationObserver = new MutationObserver(() => {
    if (translationQueued || effectiveLanguage() === "ru") return;
    translationQueued = true;
    requestAnimationFrame(() => {
      translationQueued = false;
      if (root.isConnected) applyLanguage();
      else translationObserver.disconnect();
    });
  });
  translationObserver.observe(root, {
    subtree: true,
    childList: true,
    characterData: true,
    attributes: true,
    attributeFilter: ["aria-label", "placeholder", "data-tooltip", "title"],
  });
  for (const [id, kind] of [
    ["backup-file", "backup"],
    ["archive-cover-file", "image"],
  ]) {
    const input = $("#" + id);
    listen(input, "click", async (event) => {
      event.preventDefault();
      try {
        const file = await services.openFile(kind);
        if (!file || disposed) return;
        const transfer = new DataTransfer();
        transfer.items.add(file);
        input.files = transfer.files;
        input.dispatchEvent(new Event("change", { bubbles: true }));
      } catch (error) {
        const status =
          kind === "backup" ? $("#backup-status") : $("#archive-cover-error");
        status.textContent = error.message;
        status.hidden = false;
      }
    });
  }
  listen(root, "click", () => schedulePersist());
  listen(root, "change", () => schedulePersist());
  listen(window, "life-os:back", (event) => {
    if (!event.defaultPrevented && goBack()) {
      event.preventDefault();
      persistState();
    }
  });
  listen(window, "life-os:pause", () => {
    persistState();
    services.flush().catch(() => {});
  });
  listen(window, "pagehide", () => {
    persistState();
    services.flush().catch(() => {});
  });
  return {
    snapshot: () => ({ data: snapshotData(), covers: [...archiveCovers] }),
    importWidgetCommands: (commands) => {
      const receipts = (extraState.uiPreferences.widgetReceipts ||= []);
      const accepted = [];
      for (const command of commands.slice(0, 500)) {
        if (
          !command ||
          typeof command.key !== "string" ||
          command.key.length > 80
        )
          continue;
        if (receipts.some((row) => row.key === command.key)) {
          accepted.push(command.key);
          continue;
        }
        const date = /^\d{4}-\d{2}-\d{2}$/.test(command.date || "")
          ? command.date
          : dateKey(new Date());
        const at = Number.isFinite(command.at) ? command.at : Date.now();
        let id = null;
        if (
          command.action === "thought" &&
          typeof command.text === "string" &&
          command.text.trim()
        ) {
          const body = command.text.trim().slice(0, 10000);
          id = nextId++;
          extraState.thoughts.push({
            id,
            title: body.split("\n")[0].slice(0, 120),
            body,
            date,
            context: personalProject,
            pinned: false,
            topic: "",
          });
        } else if (
          command.action === "task" &&
          typeof command.text === "string" &&
          command.text.trim()
        ) {
          id = nextId++;
          const time = /^([01]\d|2[0-3]):[0-5]\d$/.test(command.time || "")
            ? command.time
            : "";
          tasks.push({
            id,
            title: command.text.trim().slice(0, 180),
            description: "",
            date,
            createdDate: date,
            time,
            duration: 30,
            context: personalProject,
            done: false,
          });
        } else if (
          command.action === "food" &&
          typeof command.text === "string" &&
          command.text.trim() &&
          Number.isFinite(command.calories) &&
          command.calories >= 0 &&
          command.calories <= 10000 &&
          ["protein", "fat", "carbs"].every(
            (field) =>
              command[field] == null ||
              (Number.isFinite(command[field]) &&
                command[field] >= 0 &&
                command[field] <= 2000),
          )
        ) {
          id = nextId++;
          foodLogs.push({
            id,
            name: command.text.trim().slice(0, 180),
            date,
            occurredAt: at,
            personalDate: true,
            calories: command.calories,
            protein: command.protein ?? 0,
            fat: command.fat ?? 0,
            carbs: command.carbs ?? 0,
            nutritionSource: command.estimated ? "estimate" : "manual",
          });
        } else if (command.action === "edit") {
          if (
            !["task", "event"].includes(command.kind) ||
            typeof command.text !== "string" ||
            !command.text.trim() ||
            command.text.length > 180 ||
            !/^([01]\d|2[0-3]):[0-5]\d$/.test(command.time || "") ||
            !/^\d{4}-\d{2}-\d{2}$/.test(command.date || "") ||
            !Number.isInteger(command.duration) ||
            command.duration < 1 ||
            command.duration > 1440
          )
            continue;
          const target = command.targetOperation
            ? receipts.find((row) => row.key === command.targetOperation)?.id
            : command.id;
          const item = (command.kind === "event" ? events : tasks).find(
            (row) => row.id === target,
          );
          if (!item) continue;
          item.title = command.text.trim();
          item.date = command.date;
          item.duration = command.duration;
          if (command.kind === "event") {
            item.start = command.time;
            const minutes =
              (Number(command.time.slice(0, 2)) * 60 +
                Number(command.time.slice(3)) +
                command.duration) %
              1440;
            item.end = `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
          } else item.time = command.time;
          if (item.workoutId) {
            const workout = workouts.find((row) => row.id === item.workoutId);
            if (workout) {
              workout.date = command.date;
              workout.time = command.time;
              workout.duration = command.duration;
            }
          }
          id = item.id;
        } else if (command.action === "complete") {
          const target = command.targetOperation
            ? receipts.find((row) => row.key === command.targetOperation)?.id
            : command.id;
          const list = command.kind === "event" ? events : tasks;
          const item = list.find((row) => row.id === target);
          if (item && Boolean(item.done) !== Boolean(command.done)) {
            const workout =
              item.workoutId &&
              workouts.find((row) => row.id === item.workoutId);
            if (workout && training) training.toggleCompletion(workout);
            else {
              item.done = Boolean(command.done);
              if (!item.done) item.win = false;
            }
          }
          id = item?.id || null;
        } else continue;
        receipts.push({ key: command.key, id });
        accepted.push(command.key);
      }
      // All unacknowledged commands fit in the retained receipt window.
      if (receipts.length > 5000) receipts.splice(0, receipts.length - 5000);
      if (accepted.length) {
        renderTasks();
        renderCalendar();
        renderProjects();
        renderLife();
        upgrades?.renderThoughts?.();
        persistState();
      }
      return accepted;
    },
    refreshLayout: () => {
      if (disposed) return;
      if (activePage === "home") updateViewport();
      else if (activePage === "life") renderLife();
    },
    canSync: () => {
      const focused = document.activeElement;
      return (
        !disposed &&
        !calendarDrag &&
        !projectDrag &&
        (!activeDialog || activeDialog.id === "settings-dialog") &&
        !(
          focused &&
          root.contains(focused) &&
          focused.matches("input,textarea,select,[contenteditable=true]")
        )
      );
    },
    applyRemote: (snapshot) => {
      const selectedName = projects.find(
        (project) => project.id === selectedProjectId,
      )?.name;
      restoreState(snapshot.data);
      archiveCovers.clear();
      snapshot.covers.forEach(([id, source]) => archiveCovers.set(id, source));
      if (selectedName)
        selectedProjectId =
          projects.find((project) => project.name === selectedName)?.id ?? null;
      database?.rehydrate();
      upgrades?.rehydrate();
      usability?.rehydrate();
      training?.rehydrate();
      experience?.rehydrate();
      syncProjectOptions();
      renderState();
      renderTasks();
      renderCalendar();
      renderProjects();
      renderArchive();
      renderLife();
      renderDate();
    },
    dispose: () => {
      if (disposed) return;
      upgrades?.flushThoughts();
      database?.flush();
      persistState();
      disposed = true;
      finishCalendarDrag(null, true);
      finishProjectDrag(null, true);
      translationObserver.disconnect();
      upgrades?.dispose();
      usability?.dispose();
      training?.dispose();
      roundedControls.dispose();
      experience?.dispose?.();
      lifeTracking?.dispose();
      refinements.dispose();
      buttonHints.hide();
      for (const remove of removers) remove();
      for (const id of timers) window.clearTimeout(id);
      for (const id of intervals) window.clearInterval(id);
      for (const id of frames) window.cancelAnimationFrame(id);
      root.replaceChildren();
    },
  };
}
