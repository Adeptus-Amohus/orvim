import { dateFormat, numberFormat } from "./formatters.js";
import { ledgerError, migrateFinance } from "./finance-ledger.js";
import { revealInDialog } from "./interactions.js";
import { inFinancePeriod } from "./finance-period.js";
import { stampLifeRecord, lifeSettings } from "./life-tracking-model.js";
import {
  foodNumbers,
  foodPortion,
  accountBalances,
} from "./experience-model.js";

export function installExperience(ctx) {
  const { $, make, action, listen, extraState: state } = ctx;
  const labels = {
    Порция: ["Portion"],
    "На 100 г": ["Per 100 g"],
    "Вес порции, г": ["Portion weight, g"],
    Недавнее: ["Recent"],
    "Повторить вчера": ["Copy from yesterday"],
    "Добавить выбранное": ["Add selected"],
    "Источник данных": ["Data source"],
    "Моя запись": ["My entry"],
    "С этикетки": ["From a label"],
    "Примерная оценка": ["Estimate"],
    "Приём пищи": ["Meal"],
    "Без разделения": ["Unspecified"],
    Завтрак: ["Breakfast"],
    Обед: ["Lunch"],
    Ужин: ["Dinner"],
    Перекус: ["Snack"],
    "Следующая задача": ["Next task"],
    Список: ["List"],
    "Найти в проекте": ["Search this project"],
    "Найти задачу": ["Find a task"],
    "Очистить поиск": ["Clear search"],
    "Связанные мысли": ["Related thoughts"],
    "Что происходило · по желанию": ["Context · optional"],
    Работа: ["Work"],
    Общение: ["Social time"],
    Боль: ["Pain"],
    Отдых: ["Rest"],
    "Свои метки через запятую": ["Custom tags, separated by commas"],
    "История дня": ["Day history"],
    "Записей за этот день пока нет.": ["No records for this day yet."],
    "Перенести на завтра": ["Move to tomorrow"],
    "Перенести на сегодня": ["Move to today"],
    Счета: ["Accounts"],
    "Управлять счетами": ["Manage accounts"],
    "Операции по счёту": ["Transactions in account"],
    "Настроить категории": ["Manage categories"],
    Счёт: ["Account"],
    "Сумма и счёт": ["Amount and account"],
    "Списать со счёта": ["Pay from account"],
    "Зачислить на счёт": ["Credit to account"],
    "Валюта счёта": ["Account currency"],
    "Категория расхода": ["Expense category"],
    "Категория дохода": ["Income category"],
    "Счёт показывает, где находятся деньги. Категория — на что они потрачены или откуда поступили.":
      [
        "The account holds your money. The category describes what you spent it on or where it came from.",
      ],
    "Без счёта": ["Unassigned"],
    "На счёт": ["To account"],
    Перевод: ["Transfer"],
    "Начальный остаток": ["Opening balance"],
    "Учёт с даты": ["Track from date"],
    "Добавить счёт": ["Add account"],
    "Сохранить как шаблон": ["Save as template"],
    "Частые операции": ["Frequent transactions"],
    "Бюджет категории": ["Category budget"],
    "Лимит на месяц": ["Monthly limit"],
    "Убрать лимит": ["Remove limit"],
    "Каждый день после выполнения": ["Daily after completion"],
    "Каждую неделю после выполнения": ["Weekly after completion"],
    "Применить изменения": ["Apply changes to"],
    "Эта запись": ["This occurrence"],
    "Невыполненные записи серии": ["Unfinished occurrences"],
    "Введите 0, чтобы убрать лимит.": ["Enter 0 to remove the limit."],
    Значения: ["Values"],
    "Выберите, какие записи серии нужно изменить.": [
      "Choose which occurrences to update.",
    ],
    "Черновик сохранён": ["Draft saved"],
    "Не сохранено. Текст остаётся здесь.": ["Not saved. Your text stays here."],
    "На сегодня": ["Today"],
    "На завтра": ["Tomorrow"],
    "После планирования можно записать и отметить каждый подход отдельно.": [
      "After scheduling, you can record and complete each set separately.",
    ],
    "Складываем фактические веса завершённых подходов. Если подходы не разделены, учитывается один записанный вес.":
      [
        "Adds the actual weights of completed sets. Without individual sets, one recorded weight is counted.",
      ],
    "Результаты выбранного упражнения учитываются автоматически. Процент — лучший завершённый подход последней тренировки относительно цели.":
      [
        "Exercise results are counted automatically. The percentage compares the best completed set in the latest workout with your goal.",
      ],
    "Лучший подход. Отдельные значения — в подходах ниже.": [
      "Best set. Edit individual values in the sets below.",
    ],
    "Лучший подход": ["Best set"],
    "Складываем фактические повторы завершённых подходов. Без отдельных подходов: факт × подходы. Начальное значение добавляется один раз.":
      [
        "Adds actual repetitions of completed sets. Without individual sets: actual reps × sets. The starting value is added once.",
      ],
  };
  for (const [ru, [en]] of Object.entries(labels)) {
    ctx.translations[ru] = en;
  }
  const t = (ru) =>
    ctx.translate(ru, labels[ru]?.[0] || ctx.translations[ru] || ru);
  const today = () => ctx.dateKey(new Date());
  const prefs = () => state.uiPreferences;
  const money = (value, currency = state.financeCurrency) =>
    numberFormat(ctx.displayLocale(), {
      style: "currency",
      currency,
      maximumFractionDigits: 2,
    }).format(value);
  const user = (node) => {
    node.dataset.userContent = "";
    return node;
  };
  function field(host, label, id, type = "text", value = "") {
    const { field: wrapper, input } = ctx.fieldControl(
      label,
      id,
      type === "select" ? "" : type,
      type === "select" ? "select" : "input",
    );
    input.value = value;
    host.append(wrapper);
    return input;
  }
  function option(select, value, label) {
    const item = make("option", "", label);
    item.value = value;
    select.append(item);
  }
  function dialog(id, title) {
    const overlay = make("div", "overlay");
    overlay.id = id;
    overlay.hidden = true;
    const form = make("form", "dialog experience-dialog");
    form.setAttribute("role", "dialog");
    form.setAttribute("aria-modal", "true");
    form.setAttribute("aria-labelledby", id + "-title");
    const head = make("div", "dialog-head"),
      heading = make("h2", "", title);
    heading.id = id + "-title";
    const close = action("×", ctx.closeDialog, "close");
    close.setAttribute("aria-label", "Закрыть");
    head.append(heading, close);
    form.append(head);
    overlay.append(form);
    ctx.root.append(overlay);
    listen(overlay, "click", (event) => {
      if (event.target === overlay) ctx.closeDialog();
    });
    return form;
  }
  function saveButton(form, label = "Сохранить") {
    const row = make("div", "dialog-actions"),
      save = make("button", "button button-primary", label);
    save.type = "submit";
    row.append(action("Отмена", ctx.closeDialog), save);
    form.append(row);
  }

  // Nutrition keeps absolute consumed amounts; the source values remain editable.
  const foodForm = $("#food-form"),
    portionRow = make("div", "field-row");
  const basis = field(portionRow, "Значения", "food-basis", "select"),
    grams = field(portionRow, "Вес порции, г", "food-grams", "number");
  option(basis, "portion", "Порция");
  option(basis, "100g", "На 100 г");
  basis.value = "portion";
  for (const key of foodNumbers) $("#food-" + key).step = "0.01";
  Object.assign(grams, {
    min: "0.1",
    max: "10000",
    step: "0.1",
    inputMode: "decimal",
  });
  $("#food-calories").closest("label").before(portionRow);
  const foodDetails = make("details", "experience-details"),
    foodDetailsBody = make("div", "field-row");
  foodDetails.append(make("summary", "", "Подробнее"));
  const mealType = field(
      foodDetailsBody,
      "Приём пищи",
      "food-meal-type",
      "select",
    ),
    foodSource = field(
      foodDetailsBody,
      "Источник данных",
      "food-source",
      "select",
    );
  for (const [value, name] of [
    ["any", "Без разделения"],
    ["breakfast", "Завтрак"],
    ["lunch", "Обед"],
    ["dinner", "Ужин"],
    ["snack", "Перекус"],
  ])
    option(mealType, value, name);
  for (const [value, name] of [
    ["manual", "Моя запись"],
    ["label", "С этикетки"],
    ["estimate", "Примерная оценка"],
  ])
    option(foodSource, value, name);
  foodDetails.append(foodDetailsBody);
  foodForm.querySelector('button[type="submit"]').before(foodDetails);
  const portionPreview = make("p", "aux-note portion-preview");
  portionPreview.setAttribute("role", "status");
  portionRow.after(portionPreview);
  const recent = make("details", "experience-details food-recent");
  recent.open = true;
  recent.append(make("summary", "", "Недавнее"));
  const recentList = make("div", "experience-chips");
  recent.append(recentList);
  foodForm.prepend(recent);
  function readFoodRecord() {
    const tracking = lifeSettings(ctx.extraState).nutrition;
    const base = Object.fromEntries(
      foodNumbers.map((key) => [
        key,
        (key === "calories" ? tracking.calories : tracking.macros)
          ? Number($("#food-" + key).value) || 0
          : 0,
      ]),
    );
    const weight = grams.value === "" ? null : Number(grams.value),
      consumed = foodPortion(base, weight || 100, basis.value);
    if (
      (basis.value === "100g" && !weight) ||
      (weight !== null &&
        (!Number.isFinite(weight) || weight <= 0 || weight > 10000)) ||
      foodNumbers.some(
        (key) =>
          !Number.isFinite(consumed[key]) ||
          consumed[key] < 0 ||
          consumed[key] > (key === "calories" ? 10000 : 1000),
      )
    ) {
      portionPreview.textContent = ctx.translate(
        "Проверьте вес порции и пищевые значения.",
        "Check the portion weight and nutrition values.",
      );
      grams.focus();
      return null;
    }
    return {
      ...consumed,
      ...(weight ? { grams: weight } : {}),
      nutritionBasis: basis.value,
      nutritionBase: base,
      nutritionSource: foodSource.value,
      mealType: mealType.value,
      loggedAt: Date.now(),
    };
  }
  function previewFood() {
    grams.required = basis.value === "100g";
    if (basis.value !== "100g" || !grams.value) {
      portionPreview.textContent = "";
      return;
    }
    const result = foodPortion(
      Object.fromEntries(
        foodNumbers.map((key) => [key, $("#food-" + key).value]),
      ),
      Number(grams.value),
      basis.value,
    );
    portionPreview.textContent =
      Number(grams.value) +
      " г · " +
      result.calories +
      " ккал · Б " +
      result.protein +
      " · Ж " +
      result.fat +
      " · У " +
      result.carbs;
    user(portionPreview);
  }
  listen(foodForm, "input", previewFood);
  listen(foodForm, "change", previewFood);
  function populateFood(item) {
    ctx.resetFoodEditor();
    $("#food-name").value = item.name;
    for (const key of foodNumbers)
      $("#food-" + key).value = String(item.nutritionBase?.[key] ?? item[key]);
    basis.value = item.nutritionBasis || "portion";
    grams.value = item.grams || "";
    foodSource.value = item.nutritionSource || "manual";
    mealType.value = item.mealType || "any";
    previewFood();
    $("#food-calories").focus();
  }
  const yesterdayForm = dialog("food-repeat-dialog", "Повторить вчера"),
    yesterdayList = make("div", "experience-choice-list");
  yesterdayForm.append(yesterdayList);
  saveButton(yesterdayForm, "Добавить выбранное");
  let yesterdayItems = [];
  const repeatFood = action(
    "Повторить вчера",
    () => {
      yesterdayList.replaceChildren();
      yesterdayItems = ctx.foodLogs.filter(
        (item) =>
          ctx.lifeDay(item, "foodLogs") ===
          ctx.shiftDate($("#food-day").value || ctx.personalDay(), -1),
      );
      for (const item of yesterdayItems) {
        const row = make("label", "experience-choice"),
          check = make("input");
        check.type = "checkbox";
        check.value = String(item.id);
        row.append(
          check,
          user(make("span", "", item.name + " · " + item.calories + " ккал")),
        );
        yesterdayList.append(row);
      }
      if (!yesterdayItems.length)
        yesterdayList.append(
          make("p", "aux-note", "Записей за этот день пока нет."),
        );
      ctx.openDialog("food-repeat-dialog", repeatFood);
    },
    "text-button",
  );
  $("#saved-meals-open").before(repeatFood);
  listen(yesterdayForm, "submit", (event) => {
    event.preventDefault();
    const selected = new Set(
      [...yesterdayList.querySelectorAll("input:checked")].map((input) =>
        Number(input.value),
      ),
    );
    const added = yesterdayItems
      .filter((item) => selected.has(item.id))
      .map((item) => ({
        ...structuredClone(item),
        id: ctx.createId(),
        date: $("#food-day").value || ctx.personalDay(),
        loggedAt: Date.now(),
      }));
    for (const item of added) {
      delete item._syncId;
      delete item.source;
      delete item.occurredAt;
      stampLifeRecord(item, ctx.extraState, "foodLogs");
    }
    if (!added.length) return;
    ctx.foodLogs.push(...added);
    ctx.closeDialog();
    ctx.renderFood();
    ctx.renderLife();
    ctx.persistState();
    ctx.notify(ctx.translate("Еда добавлена", "Food added"), () => {
      const ids = new Set(added.map((item) => item.id));
      for (let index = ctx.foodLogs.length - 1; index >= 0; index--)
        if (ids.has(ctx.foodLogs[index].id)) ctx.foodLogs.splice(index, 1);
      ctx.renderFood();
      ctx.renderLife();
    });
  });
  function renderFood() {
    recentList.replaceChildren();
    const seen = new Set();
    for (const item of [...ctx.foodLogs].sort(
      (a, b) => b.date.localeCompare(a.date) || b.id - a.id,
    )) {
      if (seen.has(item.name)) continue;
      seen.add(item.name);
      recentList.append(
        user(action(item.name, () => populateFood(item), "experience-chip")),
      );
      if (seen.size >= 6) break;
    }
    recent.hidden = !seen.size;
    for (const [index, node] of [...$("#food-log").children].entries()) {
      const item = ctx.foodLogs.filter(
        (row) => ctx.lifeDay(row, "foodLogs") === $("#food-day").value,
      )[index];
      if (!item) continue;
      const source = make(
        "small",
        "aux-note food-source-label",
        [
          item.grams && item.grams + " г",
          t(
            {
              label: "С этикетки",
              estimate: "Примерная оценка",
              manual: "Моя запись",
            }[item.nutritionSource] || "Моя запись",
          ),
        ]
          .filter(Boolean)
          .join(" · "),
      );
      node.querySelector(".food-log-body")?.append(source);
    }
  }

  // Context is optional and saved with the actual check-in, not as a separate diary.
  const tagsDetails = make("details", "experience-details checkin-context"),
    tagsHost = make("div", "experience-chips");
  tagsDetails.append(
    make("summary", "", "Что происходило · по желанию"),
    tagsHost,
  );
  let selectedTags = new Set();
  for (const name of ["Работа", "Общение", "Боль", "Отдых"]) {
    const chip = action(
      name,
      () => {
        selectedTags.has(name)
          ? selectedTags.delete(name)
          : selectedTags.add(name);
        chip.setAttribute("aria-pressed", String(selectedTags.has(name)));
      },
      "experience-chip",
    );
    chip.dataset.contextTag = name;
    chip.setAttribute("aria-pressed", "false");
    tagsHost.append(chip);
  }
  const customTags = field(
    tagsDetails,
    "Свои метки через запятую",
    "checkin-tags",
  );
  customTags.maxLength = 350;
  $("#state-form .dialog-actions").before(tagsDetails);
  function openCheckin(item) {
    selectedTags = new Set(
      (item?.tags || []).filter((tag) =>
        ["Работа", "Общение", "Боль", "Отдых"].includes(tag),
      ),
    );
    customTags.value = (item?.tags || [])
      .filter((tag) => !selectedTags.has(tag))
      .join(", ");
    tagsDetails.open = Boolean(item?.tags?.length);
    for (const chip of tagsHost.children)
      chip.setAttribute(
        "aria-pressed",
        String(selectedTags.has(chip.dataset.contextTag)),
      );
  }
  function checkinTags() {
    return [
      ...new Set([
        ...selectedTags,
        ...customTags.value
          .split(",")
          .map((tag) => tag.trim())
          .filter(Boolean),
      ]),
    ]
      .slice(0, 12)
      .map((tag) => tag.slice(0, 40));
  }
  const scopes = {};
  for (const kind of ["task", "event"]) {
    const scope = field(
      $("#" + kind + "-form"),
      "Применить изменения",
      kind + "-series-scope",
      "select",
    );
    option(scope, "one", "Эта запись");
    option(scope, "pending", "Невыполненные записи серии");
    $("#" + kind + "-error").before(scope.closest("label"));
    scopes[kind] = scope;
  }
  function openSeries(kind, item) {
    scopes[kind].value = "one";
    scopes[kind].closest("label").hidden = !item?.repeat;
  }
  function seriesTargets(kind, item) {
    if (
      !item?.repeat ||
      scopes[kind].value !== "pending" ||
      (!item.repeatKey && item.seriesId == null)
    )
      return [item];
    return (kind === "task" ? ctx.tasks : ctx.events).filter(
      (row) =>
        row === item ||
        (!row.done &&
          (item.repeatKey
            ? row.repeatKey === item.repeatKey
            : row.seriesId === item.seriesId)),
    );
  }
  function renderDay(day) {
    const host = $("#life-day-detail");
    host.querySelector(".experience-day")?.remove();
    const data = ctx.snapshotData(),
      history = make("details", "experience-details experience-day");
    history.open = true;
    history.append(make("summary", "", "История дня"));
    const rows = [];
    const add = (time, name, note, run, label = false, checkinAt = null) =>
      rows.push({ time, name, note, run, label, checkinAt });
    const clock = (at) =>
      ctx.dateKey(new Date(at)) === day
        ? dateFormat(ctx.displayLocale(), {
            hour: "2-digit",
            minute: "2-digit",
            hourCycle: "h23",
          }).format(new Date(at))
        : "—";
    for (const sleep of data.sleepLogs.filter(
      (item) => ctx.lifeDay(item, "sleepLogs") === day,
    ))
      add(
        "—",
        "Сон",
        sleep.hours + " ч" + (sleep.note ? " · " + sleep.note : ""),
        () => ctx.openSleepLog(sleep),
        true,
      );
    for (const item of data.foodLogs.filter(
      (item) => ctx.lifeDay(item, "foodLogs") === day,
    ))
      add(
        clock(item.occurredAt || item.loggedAt),
        item.name,
        lifeSettings(data).nutrition.calories
          ? item.calories + " ккал"
          : "Питание",
        () => ctx.editEntity("food", item),
      );
    for (const item of data.checkins.filter(
      (row) => ctx.lifeDay(row, "checkins") === day,
    ))
      add(
        clock(item.at),
        "Самочувствие",
        [
          t("Настроение") + " " + item.mood + "/5",
          t("Энергия") + " " + item.energy + "/5",
          t("Стресс") + " " + item.stress + "/5",
          ...(item.tags || []).map((tag) =>
            ["Работа", "Общение", "Боль", "Отдых"].includes(tag) ? t(tag) : tag,
          ),
          item.note,
        ]
          .filter(Boolean)
          .join(" · "),
        () => ctx.showStateDialog(null, item),
        true,
        item.at,
      );
    for (const item of data.workouts.filter(
      (row) => ctx.lifeDay(row, "workouts") === day,
    ))
      add(
        item.time,
        item.name,
        item.duration +
          " мин · " +
          (item.done
            ? ctx.translate("Выполнено", "Completed")
            : ctx.translate("Запланировано", "Planned")),
        () => ctx.openWorkoutResults(item),
      );
    for (const item of data.events.filter(
      (row) => row.date === day && !row.workoutId,
    ))
      add(
        item.start,
        item.title,
        item.end +
          (item.done ? " · " + ctx.translate("Выполнено", "Completed") : ""),
        () => ctx.openEvent(item),
      );
    for (const item of rows.sort((a, b) =>
      a.time === "—"
        ? b.time === "—"
          ? 0
          : -1
        : b.time === "—"
          ? 1
          : a.time.localeCompare(b.time),
    )) {
      const row = item.run
        ? action("", item.run, "experience-day-row")
        : make("div", "experience-day-row");
      if (item.checkinAt !== null) {
        row.dataset.checkinAt = String(item.checkinAt);
        row.classList.add("life-checkin-entry");
      }
      row.append(
        make("time", "", item.time),
        user(make("strong", "", item.label ? t(item.name) : item.name)),
        user(make("small", "aux-note", item.note)),
      );
      history.append(row);
    }
    if (!rows.length)
      history.append(make("p", "aux-note", "Записей за этот день пока нет."));
    host.append(history);
  }

  // Project views reuse the same draggable cards and records.
  const projectTools = make("div", "experience-project-tools"),
    projectSearch = make("input");
  const searchField = make("div", "project-search-field"),
    searchIcon = make("i");
  searchIcon.dataset.lucide = "search";
  searchIcon.setAttribute("aria-hidden", "true");
  searchField.setAttribute("role", "search");
  projectSearch.type = "search";
  projectSearch.id = "project-task-search";
  projectSearch.placeholder = t("Найти задачу");
  projectSearch.setAttribute("aria-label", "Найти в проекте");
  const clearSearch = action(
    "",
    () => {
      projectSearch.value = "";
      renderProject();
      projectSearch.focus();
    },
    "project-search-clear",
  );
  clearSearch.setAttribute("aria-label", t("Очистить поиск"));
  const clearIcon = make("i");
  clearIcon.dataset.lucide = "x";
  clearIcon.setAttribute("aria-hidden", "true");
  clearSearch.append(clearIcon);
  clearSearch.hidden = true;
  searchField.append(searchIcon, projectSearch, clearSearch);
  const viewButtons = make("div", "experience-chips");
  for (const [view, label] of [
    ["board", "Доска"],
    ["list", "Список"],
  ]) {
    const button = action(
      label,
      () => {
        state.projectView = view;
        renderProject();
        ctx.persistState();
      },
      "experience-chip",
    );
    button.dataset.projectView = view;
    viewButtons.append(button);
  }
  projectTools.append(searchField, viewButtons);
  $("#project-task-list").before(projectTools);
  const nextTask = make("div", "project-next-task"),
    relatedThoughts = make("div", "project-related-thoughts");
  $("#project-hero").append(nextTask, relatedThoughts);
  listen(projectSearch, "input", () => renderProject());
  listen(projectSearch, "keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      projectSearch.blur();
    } else if (event.key === "Escape" && projectSearch.value) {
      event.preventDefault();
      event.stopPropagation();
      projectSearch.value = "";
      renderProject();
    }
  });
  let lastProject = null;
  function renderProject(
    project = ctx.projects.find((item) => item.id === ctx.selectedProjectId()),
  ) {
    if (lastProject !== project?.id) {
      projectSearch.value = "";
      lastProject = project?.id;
    }
    const host = $("#project-task-list");
    host.dataset.view = state.projectView === "list" ? "list" : "board";
    for (const button of viewButtons.children)
      button.setAttribute(
        "aria-pressed",
        String(button.dataset.projectView === host.dataset.view),
      );
    const query = projectSearch.value.trim().toLocaleLowerCase();
    clearSearch.hidden = !projectSearch.value;
    for (const card of host.querySelectorAll(".project-board-card")) {
      const kind = card.dataset.kind,
        id = Number(card.dataset.itemId),
        item = (kind === "event" ? ctx.events : ctx.tasks).find(
          (item) => item.id === id,
        );
      card.hidden = Boolean(
        query &&
        !(item ? item.title + " " + (item.description || "") : card.textContent)
          .toLocaleLowerCase()
          .includes(query),
      );
    }
    nextTask.replaceChildren();
    relatedThoughts.replaceChildren();
    if (!project) return;
    const items = [
      ...ctx.tasks.map((item) => ({ item, kind: "task" })),
      ...ctx.events.map((item) => ({ item, kind: "event" })),
    ]
      .filter(({ item }) => item.context === project.name && !item.done)
      .sort(
        (a, b) =>
          Number(b.item.status === "active") -
            Number(a.item.status === "active") ||
          (a.item.date || "9999").localeCompare(b.item.date || "9999") ||
          (a.item.order || 0) - (b.item.order || 0),
      );
    if (items[0]) {
      const { item, kind } = items[0];
      nextTask.append(
        make("small", "aux-note", "Следующая задача"),
        user(
          action(
            item.title,
            () => ctx.editEntity(kind, item),
            "project-next-title",
          ),
        ),
      );
    }
    const linked = state.thoughts.filter((thought) =>
      thought.links?.some(
        (link) => link.kind === "project" && link.id === project.id,
      ),
    );
    if (linked.length) {
      relatedThoughts.append(make("small", "aux-note", "Связанные мысли"));
      for (const item of linked.slice(0, 4))
        relatedThoughts.append(
          user(
            action(
              item.title,
              () => ctx.openThought(item, false),
              "text-button",
            ),
          ),
        );
    }
  }

  // Accounts, reusable transactions and optional category budgets.
  const accountForm = dialog("finance-accounts-dialog", "Счета"),
    accountList = make("div", "experience-choice-list");
  accountForm.append(accountList);
  const accountName = field(accountForm, "Название", "account-name"),
    accountCurrency = field(accountForm, "Валюта", "account-currency", "text"),
    accountFrom = field(
      accountForm,
      "Учёт с даты",
      "account-from",
      "date",
      today(),
    );
  accountName.required = true;
  accountName.maxLength = 80;
  accountFrom.required = true;
  Object.assign(accountCurrency, {
    pattern: "[A-Z]{3}",
    maxLength: 3,
    required: true,
    placeholder: "KZT",
  });
  listen(accountCurrency, "input", () => {
    accountCurrency.value = accountCurrency.value
      .toUpperCase()
      .replace(/[^A-Z]/g, "");
  });
  accountCurrency.setAttribute("list", "account-currencies");
  const currencySuggestions = make("datalist");
  currencySuggestions.id = "account-currencies";
  for (const code of ["KZT", "RUB", "USD", "EUR", "GBP", "UAH", "CNY"])
    option(currencySuggestions, code, code);
  accountForm.append(
    currencySuggestions,
    make(
      "p",
      "aux-note",
      "Новый счёт начинается с нуля. Деньги добавляются операцией «Доход».",
    ),
  );
  saveButton(accountForm, "Добавить счёт");
  let editingAccount = null;
  const accountSubmit = accountForm.querySelector('button[type="submit"]');
  function fillAccount(item = null) {
    editingAccount = item?.key || null;
    accountName.value = item?.name || "";
    accountFrom.value = item?.from || today();
    accountCurrency.value = item?.currency || state.financeCurrency;
    accountCurrency.disabled = Boolean(
      item &&
      state.financeLogs.some(
        (row) => row.accountKey === item.key || row.toAccountKey === item.key,
      ),
    );
    accountSubmit.textContent = item ? t("Сохранить") : t("Добавить счёт");
  }
  const accountButton = action(
    "Управлять счетами",
    () => {
      renderAccountManager();
      fillAccount();
      ctx.openDialog("finance-accounts-dialog", accountButton);
    },
    "text-button",
  );
  const accountTools = make("div", "finance-account-tools");
  const addAccount = action(
    "+ Добавить счёт",
    (event) => {
      renderAccountManager();
      fillAccount();
      ctx.openDialog("finance-accounts-dialog", event.currentTarget);
    },
    "button",
  );
  addAccount.id = "finance-account-add";
  accountTools.append(accountButton, addAccount);
  $("#finance-totals").before(accountTools);
  const accountStrip = make("div", "finance-account-strip");
  $("#finance-totals").after(accountStrip);
  const accountTotals = make("div", "finance-all-balances"),
    accountFilter = make("select");
  accountFilter.setAttribute("aria-label", "Операции по счёту");
  $("#finance-totals").before(accountTotals);
  const accountFilterLabel = make(
    "label",
    "finance-account-filter",
    "Операции по счёту",
  );
  accountFilterLabel.append(accountFilter);
  accountTools.append(accountFilterLabel);
  let selectedAccount = "";
  listen(accountFilter, "change", () => selectAccount(accountFilter.value));
  function selectAccount(key) {
    selectedAccount = key;
    const account = accounts().find((item) => item.key === key);
    if (account) state.financeCurrency = account.currency;
    prefs().lastFinanceAccount = key;
    ctx.renderFinances();
  }
  const financeForm = $("#finance-dialog-form"),
    financeAccount = field(financeForm, "Счёт", "finance-account", "select"),
    financeTo = field(financeForm, "На счёт", "finance-to-account", "select");
  $(".finance-category-field").before(
    financeAccount.closest("label"),
    financeTo.closest("label"),
  );
  const moneyGroup = make("fieldset", "finance-money-group");
  moneyGroup.append(make("legend", "", "Сумма и счёт"));
  const amountField = $("#finance-amount").closest("label");
  amountField.before(moneyGroup);
  moneyGroup.append(
    financeAccount.closest("label"),
    financeTo.closest("label"),
    $("#finance-entry-currency").closest("label"),
    amountField,
  );
  $("#finance-entry-currency").closest("label").firstChild.textContent =
    "Валюта счёта";
  const financeHelp = make(
    "p",
    "finance-form-help",
    "Счёт показывает, где находятся деньги. Категория — на что они потрачены или откуда поступили.",
  );
  $(".finance-category-field").before(financeHelp);
  option($("#finance-type"), "transfer", "Перевод");
  const templateWrap = make("label", "experience-choice"),
    templateCheck = make("input");
  templateCheck.type = "checkbox";
  templateWrap.append(templateCheck, make("span", "", "Сохранить как шаблон"));
  $("#finance-note").closest("label").after(templateWrap);
  const templateDetails = make("details", "experience-details"),
    templateList = make("div", "experience-chips");
  templateDetails.append(make("summary", "", "Частые операции"), templateList);
  $("#finance-add").closest(".section-toolbar").after(templateDetails);
  const financeError = make("p", "experience-error");
  financeError.id = "finance-form-error";
  financeError.setAttribute("role", "alert");
  financeError.setAttribute("aria-live", "polite");
  financeError.hidden = true;
  amountField.after(financeError);
  $("#finance-amount").setAttribute("aria-describedby", financeError.id);
  function showFinanceError(message, reveal = true) {
    financeError.textContent = message;
    financeError.hidden = !message;
    $("#finance-amount").setAttribute("aria-invalid", String(Boolean(message)));
    if (message && reveal)
      window.requestAnimationFrame(() => revealInDialog(financeError));
  }
  listen($("#finance-amount"), "input", () => showFinanceError(""));
  if (window.visualViewport)
    listen(window.visualViewport, "resize", () => {
      if (!financeError.hidden)
        window.requestAnimationFrame(() => revealInDialog(financeError));
    });
  const accounts = () => prefs().financeAccounts || [];
  function renderAccountManager() {
    accountList.replaceChildren();
    for (const account of accounts()) {
      const row = make("div", "experience-choice");
      row.append(
        user(make("span", "", account.name + " · " + account.currency)),
        action(
          "Изменить",
          () => {
            fillAccount(account);
            accountName.focus();
          },
          "text-button",
        ),
      );
      const remove = action(
        "Удалить",
        () => {
          if (
            state.financeLogs.some(
              (item) =>
                item.accountKey === account.key ||
                item.toAccountKey === account.key,
            )
          ) {
            ctx.notify(
              ctx.translate(
                "На счёте есть операции. Сначала перенесите их на другой счёт.",
                "This account has transactions. Move them to another account first.",
              ),
            );
            return;
          }
          prefs().financeAccounts = accounts().filter(
            (item) => item.key !== account.key,
          );
          if (editingAccount === account.key) fillAccount();
          renderAccountManager();
          renderFinance();
          ctx.persistState();
          ctx.notify(ctx.translate("Счёт удалён", "Account removed"), () => {
            prefs().financeAccounts = [...accounts(), account];
            renderFinance();
          });
        },
        "text-button",
      );
      row.append(remove);
      accountList.append(row);
    }
  }
  listen(accountForm, "submit", (event) => {
    event.preventDefault();
    if (!accountForm.reportValidity() || !accountName.value.trim()) return;
    if (!editingAccount && accounts().length >= 100) {
      ctx.notify(
        ctx.translate(
          "Можно добавить до 100 счетов.",
          "You can add up to 100 accounts.",
        ),
      );
      return;
    }
    if (
      accounts().some(
        (item) =>
          item.key !== editingAccount &&
          item.currency === accountCurrency.value &&
          item.name.toLocaleLowerCase() ===
            accountName.value.trim().toLocaleLowerCase(),
      )
    ) {
      ctx.notify(
        ctx.translate(
          "Счёт с таким названием уже есть.",
          "An account with this name already exists.",
        ),
      );
      return;
    }
    const record = {
      key: editingAccount || crypto.randomUUID(),
      name: accountName.value.trim(),
      currency: accountCurrency.value,
      opening: 0,
      from: accountFrom.value,
    };
    const next = editingAccount
      ? accounts().map((item) => (item.key === editingAccount ? record : item))
      : [...accounts(), record];
    const error = ledgerError(next, state.financeLogs);
    if (error) {
      ctx.notify(error);
      return;
    }
    prefs().financeAccounts = next;
    ctx.renderFinances();
    ctx.persistState();
    ctx.closeDialog();
  });
  function refreshAccountOptions() {
    const source = accounts().find(
      (account) => account.key === financeAccount.value,
    );
    const entryCurrency = $("#finance-entry-currency");
    if (source) entryCurrency.value = source.currency;
    entryCurrency.disabled = Boolean(source);
    for (const select of [financeAccount, financeTo]) {
      const before = select.value;
      select.replaceChildren();
      option(select, "", "Выберите счёт");
      for (const account of accounts().filter(
        (item) =>
          select === financeAccount ||
          (item.currency === entryCurrency.value &&
            item.key !== financeAccount.value),
      ))
        option(select, account.key, account.name + " · " + account.currency);
      select.value = [...select.options].some((item) => item.value === before)
        ? before
        : "";
    }
    financeTo.closest("label").hidden = $("#finance-type").value !== "transfer";
    $(".finance-category-field").hidden =
      $("#finance-type").value === "transfer";
    financeHelp.hidden = $("#finance-type").value === "transfer";
    financeAccount.closest("label").firstChild.textContent = t(
      $("#finance-type").value === "income"
        ? "Зачислить на счёт"
        : "Списать со счёта",
    );
    $(".finance-category-field > span").textContent = t(
      $("#finance-type").value === "income"
        ? "Категория дохода"
        : "Категория расхода",
    );
  }
  listen(financeAccount, "change", () => {
    showFinanceError("");
    refreshAccountOptions();
  });
  listen($("#finance-entry-currency"), "change", refreshAccountOptions);
  listen($("#finance-currency"), "change", () => {
    if (
      accounts().find((item) => item.key === selectedAccount)?.currency !==
      state.financeCurrency
    )
      selectedAccount = "";
    ctx.renderFinances();
  });
  listen($("#finance-type"), "change", refreshAccountOptions);
  function openFinance(item) {
    showFinanceError("");
    templateCheck.checked = false;
    financeAccount.value = "";
    refreshAccountOptions();
    financeAccount.value =
      item?.accountKey || selectedAccount || prefs().lastFinanceAccount || "";
    financeTo.value = item?.toAccountKey || "";
    if (!item) {
      const recent = [...state.financeLogs]
        .filter((row) => row.type === $("#finance-type").value)
        .sort((a, b) => b.id - a.id)[0];
      if (recent) $("#finance-category").value = recent.category;
    }
    refreshAccountOptions();
    if (!accounts().length)
      showFinanceError(
        "Сначала добавьте счёт в разделе «Счета», затем внесите доход.",
        false,
      );
    if (item?.legacyFinance)
      showFinanceError(
        "Старая запись сохранена в истории. Выберите счёт, чтобы включить её в учёт.",
        false,
      );
  }
  function readFinanceRecord(record, editing = null) {
    if (
      record.type === "transfer" &&
      (!financeAccount.value ||
        !financeTo.value ||
        financeAccount.value === financeTo.value)
    ) {
      showFinanceError(
        ctx.translate(
          "Выберите два разных счёта одной валюты.",
          "Choose two different accounts in the same currency.",
        ),
      );
      return null;
    }
    const result = {
      ...record,
      accountKey: financeAccount.value,
      toAccountKey: record.type === "transfer" ? financeTo.value : "",
      category: record.type === "transfer" ? "Перевод" : record.category,
      legacyFinance: false,
      postedAt:
        editing && !editing.legacyFinance
          ? editing.postedAt || editing.id
          : Date.now(),
    };
    const candidate = {
      ...editing,
      ...result,
      id: editing?.id || ctx.createId(),
    };
    const rows = state.financeLogs.filter((item) => item !== editing);
    rows.push(candidate);
    const error = ledgerError(accounts(), rows);
    if (error) {
      showFinanceError(error);
      return null;
    }
    prefs().lastFinanceAccount = financeAccount.value;
    if (templateCheck.checked) {
      const { date, postedAt, ...template } = result;
      const templates = prefs().financeTemplates || [];
      if (
        templates.length >= 30 &&
        !templates.some(
          (item) => JSON.stringify(item) === JSON.stringify(template),
        )
      ) {
        showFinanceError(
          ctx.translate(
            "Уже есть 30 шаблонов. Удалите лишний или снимите отметку сохранения шаблона.",
            "There are already 30 templates. Remove one or uncheck Save as template.",
          ),
        );
        return null;
      }
      if (
        templates.length < 30 &&
        !templates.some(
          (item) => JSON.stringify(item) === JSON.stringify(template),
        )
      )
        prefs().financeTemplates = [...templates, template];
    }
    return result;
  }
  const budgetForm = dialog("finance-budget-dialog", "Бюджет категории"),
    budgetCategory = field(
      budgetForm,
      "Категория",
      "budget-category",
      "select",
    ),
    budgetLimit = field(budgetForm, "Лимит на месяц", "budget-limit", "number");
  Object.assign(budgetLimit, {
    min: "0",
    max: "1000000000000",
    step: "0.01",
    required: true,
    inputMode: "decimal",
  });
  saveButton(budgetForm);
  budgetLimit
    .closest("label")
    .after(make("small", "aux-note", "Введите 0, чтобы убрать лимит."));
  const budgetButton = action(
    "Бюджет категории",
    () => {
      budgetCategory.replaceChildren();
      for (const name of [
        ...new Set([
          ...ctx.financeCategoryNames(),
          ...state.financeLogs
            .filter((item) => item.type === "expense")
            .map((item) => item.category),
        ]),
      ])
        option(budgetCategory, name, name);
      updateBudgetInput();
      ctx.openDialog("finance-budget-dialog", budgetButton);
    },
    "text-button",
  );
  $("#finance-categories").before(budgetButton);
  function updateBudgetInput() {
    budgetLimit.value =
      (prefs().financeBudgets || []).find(
        (item) =>
          item.category === budgetCategory.value &&
          item.currency === state.financeCurrency,
      )?.limit ?? "";
  }
  listen(budgetCategory, "change", updateBudgetInput);
  listen(budgetForm, "submit", (event) => {
    event.preventDefault();
    if (!budgetForm.reportValidity() || !budgetCategory.value) return;
    const limit = Number(budgetLimit.value);
    prefs().financeBudgets = (prefs().financeBudgets || []).filter(
      (item) =>
        item.category !== budgetCategory.value ||
        item.currency !== state.financeCurrency,
    );
    if (limit > 0)
      prefs().financeBudgets.push({
        category: budgetCategory.value,
        currency: state.financeCurrency,
        limit,
      });
    ctx.closeDialog();
    ctx.renderFinances();
    ctx.persistState();
  });
  function renderFinance() {
    if (
      selectedAccount &&
      !accounts().some((item) => item.key === selectedAccount)
    )
      selectedAccount = "";
    refreshAccountOptions();
    accountStrip.replaceChildren();
    const month = $("#finance-month").value,
      through = today();
    const monthlyBudget = $("#finance-period-mode").value === "month";
    const balances = accountBalances(
      accounts(),
      state.financeLogs,
      null,
      through,
    );
    accountTotals.replaceChildren(
      make("small", "aux-note", "Общий остаток по валютам"),
    );
    const byCurrency = new Map();
    for (const account of balances)
      byCurrency.set(
        account.currency,
        (byCurrency.get(account.currency) || 0) +
          Math.round(account.balance * 100),
      );
    for (const [code, cents] of byCurrency)
      accountTotals.append(user(make("strong", "", money(cents / 100, code))));
    if (!balances.length)
      accountTotals.append(
        make("span", "aux-note", "Добавьте счёт, чтобы начать учёт"),
      );
    accountFilter.replaceChildren();
    option(accountFilter, "", "Все счета");
    for (const account of accounts())
      option(
        accountFilter,
        account.key,
        account.name + " · " + account.currency,
      );
    accountFilter.value = selectedAccount;
    for (const id of ["finance-currency", "finance-entry-currency"]) {
      const select = $("#" + id);
      for (const account of accounts())
        if (
          ![...select.options].some((item) => item.value === account.currency)
        )
          option(select, account.currency, account.currency);
    }
    $("#finance-currency").value = state.financeCurrency;
    const balanceTotal =
      balances
        .filter(
          (account) =>
            account.currency === state.financeCurrency &&
            (!selectedAccount || account.key === selectedAccount),
        )
        .reduce((sum, account) => sum + Math.round(account.balance * 100), 0) /
      100;
    const total = $("#finance-totals .finance-total");
    if (total) {
      total.querySelector("small").textContent = "Доступно сейчас";
      total.querySelector("strong").textContent = balances.some(
        (account) => account.currency === state.financeCurrency,
      )
        ? money(balanceTotal)
        : "—";
    }
    if (balances.length)
      accountStrip.append(
        user(
          make(
            "small",
            "aux-note finance-account-date",
            ctx.translate("Остатки на ", "Balances as of ") +
              ctx.shortDate(through),
          ),
        ),
      );
    for (const account of balances) {
      const card = action(
        "",
        () => selectAccount(account.key),
        "finance-account-card",
      );
      card.setAttribute(
        "aria-pressed",
        String(selectedAccount === account.key),
      );
      card.append(
        user(make("small", "", account.name)),
        user(make("strong", "", money(account.balance, account.currency))),
      );
      accountStrip.append(card);
    }
    const legacy = state.financeLogs.filter(
      (item) => item.legacyFinance,
    ).length;
    if (legacy)
      accountStrip.append(
        make(
          "small",
          "aux-note finance-account-date",
          "Старые записи вне остатков: " +
            legacy +
            ". Их можно открыть и привязать к счёту, если хватает средств.",
        ),
      );
    templateList.replaceChildren();
    templateDetails.hidden = !(prefs().financeTemplates || []).length;
    for (const template of prefs().financeTemplates || []) {
      const wrap = make("div", "finance-template-chip");
      const button = user(
        action(
          template.category + " · " + money(template.amount, template.currency),
          () => {
            ctx.openFinance({ ...template, date: today() }, null, true);
            templateCheck.checked = false;
          },
          "experience-chip",
        ),
      );
      const remove = action(
        "×",
        () => {
          const before = structuredClone(template);
          prefs().financeTemplates = prefs().financeTemplates.filter(
            (item) => item !== template,
          );
          renderFinance();
          ctx.persistState();
          ctx.notify(ctx.translate("Шаблон удалён", "Template removed"), () => {
            prefs().financeTemplates = [
              ...(prefs().financeTemplates || []),
              before,
            ];
            renderFinance();
          });
        },
        "text-button",
      );
      remove.setAttribute("aria-label", "Удалить шаблон");
      wrap.append(button, remove);
      templateList.append(wrap);
    }
    const categoryHost = $("#finance-categories");
    if (!monthlyBudget) {
      categoryHost.append(
        make(
          "small",
          "aux-note",
          "Месячные бюджеты доступны в режиме «Месяц».",
        ),
      );
      return;
    }
    categoryHost
      .querySelectorAll(".finance-budget-only")
      .forEach((node) => node.remove());
    for (const budget of (prefs().financeBudgets || []).filter(
      (item) => item.currency === state.financeCurrency,
    )) {
      if (
        [...categoryHost.children].some(
          (row) => row.dataset.category === budget.category,
        )
      )
        continue;
      const row = make("div", "finance-category-row finance-budget-only");
      row.dataset.category = budget.category;
      row.append(
        user(make("span", "finance-category-label", budget.category)),
        user(make("strong", "finance-category-amount", money(0))),
      );
      categoryHost.append(row);
    }
    for (const row of categoryHost.children) {
      row
        .querySelectorAll(".finance-budget-progress, .finance-budget-caption")
        .forEach((node) => node.remove());
      const category = row.dataset.category;
      if (!category) continue;
      const budget = (prefs().financeBudgets || []).find(
        (item) =>
          item.category === category && item.currency === state.financeCurrency,
      );
      if (!budget) continue;
      const spent = state.financeLogs
        .filter(
          (item) =>
            item.type === "expense" &&
            !item.legacyFinance &&
            (!selectedAccount || item.accountKey === selectedAccount) &&
            item.currency === budget.currency &&
            item.category === category &&
            item.date.startsWith(month),
        )
        .reduce((sum, item) => sum + item.amount, 0);
      const progress = make("progress", "finance-budget-progress");
      progress.max = budget.limit;
      progress.value = Math.min(spent, budget.limit);
      progress.setAttribute(
        "aria-label",
        category + " · " + money(spent) + " / " + money(budget.limit),
      );
      row.append(
        progress,
        user(
          make(
            "small",
            "finance-budget-caption",
            ctx.translate("Осталось: ", "Remaining: ") +
              money(budget.limit - spent),
          ),
        ),
      );
    }
  }
  function rehydrateFinance() {
    if (prefs().financeLedgerVersion !== 1) {
      migrateFinance(accounts(), state.financeLogs, ctx.createId);
      prefs().financeLedgerVersion = 1;
    }
  }
  function canRemoveFinance(item) {
    const error = ledgerError(
      accounts(),
      state.financeLogs.filter((row) => row !== item),
    );
    if (error) {
      ctx.notify(error);
      return false;
    }
    return true;
  }
  rehydrateFinance();
  renderFood();
  renderProject();
  renderFinance();
  return {
    readFoodRecord,
    populateFood,
    previewFood,
    renderFood,
    openCheckin,
    checkinTags,
    renderDay,
    renderProject,
    openFinance,
    readFinanceRecord,
    renderFinance,
    canRemoveFinance,
    canRestoreFinance(item) {
      const error = ledgerError(accounts(), [...state.financeLogs, item]);
      if (error) {
        ctx.notify(error);
        return false;
      }
      return true;
    },
    financeRows: () =>
      state.financeLogs.filter(
        (row) =>
          !row.legacyFinance &&
          (!selectedAccount ||
            row.accountKey === selectedAccount ||
            row.toAccountKey === selectedAccount),
      ),
    legacyRows: () =>
      selectedAccount
        ? []
        : state.financeLogs.filter(
            (row) =>
              row.legacyFinance &&
              row.currency === state.financeCurrency &&
              inFinancePeriod(ctx.financePeriod(), row.date),
          ),
    preferredCurrency: () =>
      accounts().find((row) => row.key === selectedAccount)?.currency,
    balances: () =>
      accountBalances(accounts(), state.financeLogs, null, today()),
    rehydrate() {
      rehydrateFinance();
      ctx.renderFinances();
    },
    openSeries,
    seriesTargets,
    renameCategory(from, to) {
      for (const item of prefs().financeTemplates || [])
        if (item.category === from) item.category = to;
      for (const item of prefs().financeBudgets || [])
        if (item.category === from) item.category = to;
      prefs().financeBudgets = (prefs().financeBudgets || []).filter(
        (item, index, list) =>
          list.findIndex(
            (other) =>
              other.category === item.category &&
              other.currency === item.currency,
          ) === index,
      );
    },
    deleteCategory(name) {
      const budgets = structuredClone(
        (prefs().financeBudgets || []).filter((item) => item.category === name),
      );
      const templates = (prefs().financeTemplates || []).filter(
        (item) => item.category === name,
      );
      prefs().financeBudgets = (prefs().financeBudgets || []).filter(
        (item) => item.category !== name,
      );
      for (const item of templates) item.category = "Другое";
      return () => {
        for (const budget of budgets)
          if (
            !(prefs().financeBudgets || []).some(
              (item) =>
                item.category === budget.category &&
                item.currency === budget.currency,
            )
          )
            (prefs().financeBudgets ||= []).push(budget);
        for (const item of templates)
          if (
            (prefs().financeTemplates || []).includes(item) &&
            item.category === "Другое"
          )
            item.category = name;
      };
    },
  };
}
