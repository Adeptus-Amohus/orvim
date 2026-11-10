import { numberFormat } from "./formatters.js";
import {
  financialSummary,
  financeCategoryName,
  importRows,
  mergeImport,
  proposedSnapshot,
  ratingParts,
  signature,
  localDay,
} from "./changes.js";
import { installThoughtFeed } from "./thoughts.js";
import { installLanSettings } from "./lan-ui.js";
import { installFileTransfer } from "./file-transfer-ui.js";
import { installBackupSettings } from "./backup-ui.js";

import { installUpdateSettings } from "./update-ui.js";
import { installAllTasks } from "./all-tasks.js";
import { installLicenseSettings } from "./license-ui.js";
import { installAssistant } from "./assistant.js";
import { revealInDialog } from "./interactions.js";
import { createRatingPicker, createRatingStars } from "./rating.js";
import { financeRange } from "./finance-period.js";

export function installUpgrades(ctx) {
  const {
    root,
    $,
    all,
    make,
    listen,
    action,
    fieldControl,
    openDialog,
    closeDialog,
    persistState,
    extraState: state,
    services,
    tasks,
    events,
    projects,
    createId,
    dateKey,
  } = ctx;
  for (const [ru, en] of [
    ["Период данных", "Data period"],
    ["Из запроса", "From message"],
    ["Выбран вручную", "Selected manually"],
    ["Сравнение периодов из запроса", "Periods compared in the message"],
    [
      "Все выбранные записи · можно ограничить даты",
      "All selected records · dates can be limited",
    ],
    ["Остановить ответ", "Stop response"],
    ["Остановить", "Stop"],
    ["Показать ещё", "Show more"],
    ["Фильтр задач", "Task filter"],
    ["Проект задач", "Task project"],
    ["Период финансов", "Finance period"],
    ["Год финансов", "Finance year"],
    ["Период", "Period"],
    ["Записи года", "Year's entries"],
    ["Записи периода", "Period's entries"],
    ["Доходы и расходы по месяцам", "Income and spending by month"],
    [
      "Зелёный — доходы · красный — расходы. Нажмите на месяц, чтобы открыть операции.",
      "Green: income · red: spending. Select a month to open transactions.",
    ],
    ["Расходов за этот период нет.", "No spending in this period."],
    [
      "Месячные бюджеты доступны в режиме «Месяц».",
      "Monthly budgets are available in Month view.",
    ],
    ["Копии и экспорт", "Backups and export"],
    ["ПК и телефон в одной сети", "PC and phone on the same network"],
    [
      "Копия для восстановления и таблицы для анализа",
      "Restore a backup or export a spreadsheet",
    ],
    ["Очистить только это устройство", "Clear this device only"],
    ["Проверка и установка новых версий", "Check for and install new versions"],
    ["Возможности и версия Orvim", "About Orvim and the installed version"],
    ["Открыть настройки", "Open settings"],
  ]) {
    ctx.translations[ru] = en;
  }
  let disposed = false,
    editingFinance = null,
    selectedFinanceCategory = null,
    pendingImport = null,
    pendingAi = null,
    undoImport = null,
    chatHistory = [];
  const notices = new Set();
  function setStatus(host, message, error = false) {
    host.textContent = message;
    host.dataset.error = String(error);
    if (host.id === "connection-status") {
      const inline = $("#ai-key-status");
      if (
        inline &&
        !$("#ai-provider").closest("section[data-connection-view]")?.hidden
      ) {
        inline.textContent = message;
        inline.dataset.error = String(error);
      }
    }
  }
  function refresh() {
    ctx.renderTasks();
    ctx.renderCalendar();
    ctx.renderProjects();
    ctx.renderLife();
    ctx.showPage(ctx.page());
    persistState();
  }
  function icon(name) {
    const item = make("i");
    item.dataset.lucide = name;
    item.setAttribute("aria-hidden", "true");
    return item;
  }
  function dialog(id, title) {
    const overlay = make("div", "overlay");
    overlay.id = id;
    overlay.hidden = true;
    const form = make("form", "dialog upgrade-dialog");
    form.id = id + "-form";
    form.setAttribute("role", "dialog");
    form.setAttribute("aria-modal", "true");
    form.setAttribute("aria-labelledby", id + "-title");
    const head = make("div", "dialog-head"),
      heading = make("h2", "", title);
    heading.id = id + "-title";
    const close = action("×", closeDialog, "close cursor-interaction");
    close.setAttribute("aria-label", "Закрыть");
    head.append(heading, close);
    form.append(head);
    overlay.append(form);
    root.append(overlay);
    listen(overlay, "click", (event) => {
      if (event.target === overlay) closeDialog();
    });
    return form;
  }
  function saveButtons(form) {
    const row = make("div", "dialog-actions"),
      save = make("button", "button button-primary", "Сохранить");
    save.type = "submit";
    row.append(action("Отмена", closeDialog), save);
    form.append(row);
    return row;
  }
  function field(form, label, id, type = "text", value = "", tag = "input") {
    const control = fieldControl(label, id, type, tag);
    control.input.value = value;
    form.append(control.field);
    return control.input;
  }
  function money(value, currency = state.financeCurrency) {
    return numberFormat(ctx.displayLocale(), {
      style: "currency",
      currency,
      maximumFractionDigits: 2,
    }).format(value);
  }
  function currencyOptions(select) {
    for (const code of ["KZT", "RUB", "USD", "EUR", "GBP", "UAH", "CNY"]) {
      const option = make("option", "", code);
      option.value = code;
      select.append(option);
    }
    select.value = state.financeCurrency;
  }
  Object.assign(ctx.translations, {
    "Добавить задачу или мысль": "Add a task or thought",
    "База данных": "Database",
    База: "Data",
    Мысли: "Thoughts",
    Финансы: "Finances",
    Доход: "Income",
    Расход: "Expense",
    Баланс: "Balance",
    Доходы: "Income",
    Расходы: "Expenses",
    Категория: "Category",
    Сумма: "Amount",
    Валюта: "Currency",
    "Записать мысль": "Capture thought",
    "Новая мысль": "New thought",
    "Изменить мысль": "Edit thought",
    "Все мысли": "All thoughts",
    "Архив проекта": "Project archive",
    Доска: "Board",
    "Завершённые дела": "Completed items",
    "Вернуть в работу": "Restore task",
    "Нет завершённых дел": "No completed items",
    "Без оценки": "No rating",
    "Сохранённые упражнения": "Saved exercises",
    "Сохранить упражнение": "Save exercise",
    Подключения: "Connections",
    Уведомления: "Notifications",
    "За 5 минут до события и раз в 4 часа для самочувствия":
      "5 minutes before events and every 4 hours for wellbeing",
    "ИИ помощник": "AI assistant",
    "Получить данные": "Get data",
    "Применить импорт": "Apply import",
    "Отменить импорт": "Undo import",
    "Получить события": "Get events",
    "Отправить изменения": "Push changes",
    "Сохранить ключ": "Save key",
    "Удалить ключ": "Delete key",
    "Загрузить модели": "Load models",
    "Записи месяца": "Monthly transactions",
    "Добавить операцию": "Add transaction",
    "Новая операция": "New transaction",
    "Изменить операцию": "Edit transaction",
    "Расходы по категориям": "Spending by category",
    "Доходы и расходы месяца": "Monthly income and spending",
    "Все операции": "All transactions",
    "Нет расходов": "No spending",
    "Доля расходов": "Share of spending",
    Еда: "Food",
    Транспорт: "Transport",
    Дом: "Home",
    Здоровье: "Health",
    Покупки: "Shopping",
    Подарки: "Gifts",
    Другое: "Other",
  });

  // Thoughts are independent of projects; context is a legacy storage field.
  for (const item of state.thoughts) item.context = "Личное";
  if (!["board", "list"].includes(state.projectView))
    state.projectView = "board";
  // Thoughts have a dedicated page and a compact view next to Home tasks.
  const thoughtsScreen = make("section", "thoughts-screen");
  thoughtsScreen.id = "thoughts-screen";
  thoughtsScreen.hidden = true;
  $(".main").append(thoughtsScreen);
  for (const nav of all(".nav,.mobile-nav")) {
    const button = action(
      "",
      () => ctx.showPage("thoughts"),
      "cursor-interaction",
    );
    button.dataset.page = "thoughts";
    button.setAttribute("aria-label", "Мысли");
    button.setAttribute("data-tooltip", "Мысли");
    button.append(icon("notebook-pen"));
    if (nav.classList.contains("mobile-nav"))
      button.append(make("span", "", "Мысли"));
    nav.insertBefore(button, nav.querySelector('[data-page="projects"]'));
  }
  function openThought(item, opener, edit = false, query = "") {
    thoughtFeed.open(item, edit, query);
  }
  const homeThoughts = make("div", "home-thoughts");
  homeThoughts.id = "home-thought-list";
  homeThoughts.hidden = true;
  $("#task-list").after(homeThoughts);
  const homeAddThought = action(
    "Мысль",
    () => openHomeThought(),
    "text-button",
  );
  homeAddThought.id = "home-thought-add";
  const addControl = make("div", "home-add-control"),
    quickMenu = make("div", "home-add-menu");
  const taskHeadActions = make("div", "home-task-head-actions");
  $(".tasks .panel-head").append(taskHeadActions);
  taskHeadActions.append(addControl, $("#tasks-date"));
  const homeAdd = action(
    "",
    () => {
      quickMenu.hidden = !quickMenu.hidden;
      $(".tasks").classList.toggle("home-menu-open", !quickMenu.hidden);
      homeAdd.setAttribute("aria-expanded", String(!quickMenu.hidden));
      if (!quickMenu.hidden) {
        const anchor = homeAdd.getBoundingClientRect();
        const nav = $(".mobile-nav")?.getBoundingClientRect();
        const bottom = nav?.height
          ? Math.min(window.innerHeight, nav.top)
          : window.innerHeight;
        quickMenu.classList.toggle(
          "opens-up",
          anchor.bottom + quickMenu.offsetHeight + 16 > bottom,
        );
        quickMenu.querySelector("button")?.focus({ preventScroll: true });
      }
    },
    "button home-add-button",
  );
  homeAdd.id = "home-add";
  homeAdd.setAttribute("aria-label", "Добавить задачу или мысль");
  homeAdd.setAttribute("aria-haspopup", "menu");
  homeAdd.setAttribute("aria-expanded", "false");
  homeAdd.setAttribute("aria-controls", "home-add-menu");
  homeAdd.append(icon("plus"));
  quickMenu.id = "home-add-menu";
  quickMenu.hidden = true;
  quickMenu.setAttribute("role", "menu");
  quickMenu.setAttribute("aria-label", "Добавить");
  $("#task-add").textContent = "Задача";
  for (const button of [$("#task-add"), homeAddThought]) {
    button.setAttribute("role", "menuitem");
    listen(button, "click", () => hideHomeAdd());
    quickMenu.append(button);
  }
  addControl.append(homeAdd, quickMenu);
  function hideHomeAdd(returnFocus = false) {
    quickMenu.hidden = true;
    $(".tasks").classList.remove("home-menu-open");
    homeAdd.setAttribute("aria-expanded", "false");
    if (returnFocus) homeAdd.focus({ preventScroll: true });
  }
  ctx.registerBackLayer(
    () => !quickMenu.hidden,
    () => hideHomeAdd(true),
  );
  listen(root, "click", (event) => {
    if (!addControl.contains(event.target)) hideHomeAdd();
  });
  listen(quickMenu, "keydown", (event) => {
    if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const choices = [...quickMenu.querySelectorAll("button")],
      index = choices.indexOf(document.activeElement);
    choices[
      event.key === "Home"
        ? 0
        : event.key === "End"
          ? choices.length - 1
          : (index + (event.key === "ArrowDown" ? 1 : -1) + choices.length) %
            choices.length
    ].focus();
  });
  const quickThoughtForm = dialog("home-thought-dialog", "Записать мысль");
  const quickThoughtText = field(
    quickThoughtForm,
    "Мысль",
    "home-thought-text",
    "text",
    "",
    "textarea",
  );
  quickThoughtText.maxLength = 10000;
  quickThoughtText.required = true;
  saveButtons(quickThoughtForm);
  function openHomeThought() {
    quickThoughtText.value = "";
    openDialog("home-thought-dialog", homeAdd);
    quickThoughtText.focus();
  }
  listen(quickThoughtForm, "submit", (event) => {
    event.preventDefault();
    if (!quickThoughtText.value.trim()) return;
    thoughtFeed.captureText(quickThoughtText.value);
    closeDialog();
  });
  const homeTabs = make("div", "segments compact-tabs");
  for (const [value, label] of [
    ["tasks", "Задачи"],
    ["thoughts", "Мысли"],
  ]) {
    const button = action(label, () => {
      state.homeView = value;
      renderHomeThoughts();
      persistState();
    });
    button.dataset.homeView = value;
    homeTabs.append(button);
  }
  $("#task-list").before(homeTabs);
  function thoughtCard(item) {
    const card = make("article", "thought-card");
    const copy = action(
      "",
      (event) => openThought(item, event.currentTarget),
      "thought-card-copy",
    );
    card.dataset.userContent = "true";
    copy.append(make("strong", "", item.title));
    const snippet = thoughtFeed.excerpt(item).slice(0, 180);
    if (snippet) copy.append(make("p", "", snippet));
    copy.append(make("small", "", ctx.shortDate(item.date)));
    const more = action(
      "⋯",
      () => ctx.itemMenu("thought", item, more),
      "text-button entity-more",
    );
    more.setAttribute("aria-label", "Действия с мыслью: " + item.title);
    card.append(copy, more);
    return thoughtFeed.wrapCard(card, item);
  }
  function renderThoughts() {
    thoughtFeed.render();
  }
  function renderHomeThoughts() {
    const show = state.homeView === "thoughts";
    homeAdd.hidden = ctx.page() !== "home";
    if (homeAdd.hidden) hideHomeAdd();
    $("#task-list").hidden = show;
    $("#task-add").hidden = false;
    $("#templates-open").hidden = show;
    homeThoughts.hidden = !show;
    homeAddThought.hidden = false;
    for (const button of homeTabs.children)
      button.setAttribute(
        "aria-pressed",
        String(button.dataset.homeView === state.homeView),
      );
    if (show) {
      homeThoughts.replaceChildren();
      for (const item of state.thoughts
        .filter((item) => item.date === ctx.selectedDate())
        .slice(0, 100))
        homeThoughts.append(thoughtCard(item));
      if (!homeThoughts.childElementCount)
        homeThoughts.append(make("p", "aux-note", "Запишите первую мысль."));
      services.refreshIcons(homeThoughts);
    }
  }

  const thoughtFeed = installThoughtFeed({
    ...ctx,
    screen: thoughtsScreen,
    onChange: renderHomeThoughts,
  });

  // Completed work has a separate page; project tabs remain focused on active work.
  const completedScreen = make("section", "completed-screen panel");
  completedScreen.id = "completed-screen";
  completedScreen.hidden = true;
  const completedHead = make("div", "section-toolbar"),
    completedHeading = make("div", "completed-heading"),
    completedCount = make("small", "aux-note"),
    completedProject = make("select"),
    completedSearch = make("input"),
    completedList = make("div", "completed-list"),
    completedMore = action(
      "Показать ещё",
      () => {
        completedLimit += 100;
        renderCompleted();
      },
      "button",
    );
  let completedLimit = 100;
  completedCount.id = "completed-count";
  completedProject.id = "completed-project-filter";
  completedProject.setAttribute("aria-label", "Проект в архиве");
  completedSearch.id = "completed-search";
  completedSearch.type = "search";
  completedSearch.placeholder = "Найти завершённое дело";
  completedSearch.setAttribute("aria-label", "Найти завершённое дело");
  completedList.id = "completed-list";
  const completedUndo = make("div", "undo-note");
  completedUndo.id = "completed-undo";
  completedUndo.hidden = true;
  completedUndo.setAttribute("role", "status");
  completedUndo.append(
    make("span", "", "Запись удалена"),
    action("Отменить", () => ctx.undoDeletion(), "text-button"),
  );
  completedHeading.append(make("h2", "", "Завершённые дела"), completedCount);
  completedHead.append(completedHeading, completedProject, completedSearch);
  completedScreen.append(
    completedHead,
    completedUndo,
    completedList,
    completedMore,
  );
  $(".main").append(completedScreen);
  for (const control of [completedProject, completedSearch])
    listen(control, control === completedSearch ? "input" : "change", () => {
      completedLimit = 100;
      renderCompleted();
    });
  function renderCompleted() {
    const selected = completedProject.value;
    const entries = [
      ...tasks
        .filter((item) => item.done)
        .map((item) => ({ kind: "task", item })),
      ...events
        .filter((item) => item.done)
        .map((item) => ({ kind: "event", item })),
    ];
    const names = new Set([
      "Личное",
      ...projects.map((project) => project.name),
      ...entries.map(({ item }) => item.context || "Личное"),
    ]);
    completedProject.replaceChildren(make("option", "", "Все проекты"));
    completedProject.firstElementChild.value = "";
    for (const name of names) {
      const option = make("option", "", name);
      option.value = name;
      if (name !== "Личное") option.dataset.userContent = "";
      completedProject.append(option);
    }
    completedProject.value = names.has(selected) ? selected : "";
    const query = completedSearch.value
      .trim()
      .toLocaleLowerCase(ctx.displayLocale());
    const visible = entries
      .filter(
        ({ item }) =>
          (!completedProject.value ||
            (item.context || "Личное") === completedProject.value) &&
          (!query ||
            [item.title, item.context, item.description]
              .join(" ")
              .toLocaleLowerCase(ctx.displayLocale())
              .includes(query)),
      )
      .sort(
        (a, b) =>
          (b.item.date || "").localeCompare(a.item.date || "") ||
          b.item.id - a.item.id,
      );
    completedCount.textContent = String(visible.length);
    completedList.replaceChildren();
    if (!visible.length)
      completedList.append(
        make(
          "p",
          "aux-note completed-empty",
          query || completedProject.value
            ? "Нет подходящих дел"
            : "Завершённые задачи и события появятся здесь.",
        ),
      );
    for (const { kind, item } of visible.slice(0, completedLimit)) {
      const row = make("div", "completed-row"),
        body = make("div", "completed-row-body"),
        title = action(
          item.title,
          (event) =>
            kind === "task"
              ? ctx.openTask(item, event.currentTarget)
              : ctx.openEvent(item, null, event.currentTarget),
          "project-item-name",
        ),
        meta = make("div", "completed-meta"),
        context = make("span", "", item.context || "Личное");
      title.dataset.userContent = "";
      if (item.context && item.context !== "Личное")
        context.dataset.userContent = "";
      meta.append(
        context,
        make("span", "", kind === "task" ? "Задача" : "Событие"),
      );
      if (item.date) meta.append(make("time", "", ctx.shortDate(item.date)));
      body.append(title, meta);
      row.append(
        icon(kind === "task" ? "check" : "archive"),
        body,
        action(
          "Вернуть в работу",
          () => {
            item.done = false;
            item.status = "active";
            refresh();
          },
          "text-button completed-restore",
        ),
      );
      completedList.append(row);
    }
    completedMore.hidden = visible.length <= completedLimit;
    services.refreshIcons(completedScreen);
  }
  if (!["board", "list"].includes(state.projectView))
    state.projectView = "board";
  listen($("#project-name"), "click", (event) => {
    const project = projects.find(
      (p) => p.id === ctx.snapshotData().selectedProjectId,
    );
    if (project) ctx.openProjectDialog(project, event.currentTarget);
  });
  $("#project-name").tabIndex = 0;
  $("#project-name").setAttribute("role", "button");
  $("#project-name").setAttribute("aria-label", "Изменить проект");
  listen($("#project-name"), "keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      $("#project-name").click();
    }
  });
  function renderProjectViews() {
    if (!["board", "list"].includes(state.projectView))
      state.projectView = "board";
    $("#project-task-list").hidden = false;
  }

  // Replace the removed Recovery tile with a compact finance workspace.
  const financeView = $("#life-finances-view");
  financeView.innerHTML =
    '<section class="panel finance-panel"><div class="life-panel-head"><h2>Финансы</h2><div class="finance-period"><input id="finance-month" type="month" aria-label="Месяц финансов"><select id="finance-currency" aria-label="Валюта"></select></div></div><div class="finance-totals" id="finance-totals"></div><div class="finance-columns"><section class="finance-breakdown"><h3>Расходы по категориям</h3><figure class="finance-chart" id="finance-chart"></figure><div id="finance-categories"></div></section><section><div class="section-toolbar"><h3 id="finance-record-title">Записи месяца</h3><button type="button" id="finance-clear-filter" class="text-button" hidden>Все операции</button><button type="button" id="finance-add" class="button button-primary">+ Добавить операцию</button></div><div id="finance-log"></div></section></div></section>';
  const month = $("#finance-month"),
    currency = $("#finance-currency");
  const financeFlow = make("div", "finance-flow");
  financeFlow.id = "finance-flow";
  $(".finance-breakdown").prepend(financeFlow);
  month.value = ctx.todayKey.slice(0, 7);
  const periodMode = make("select"),
    year = make("input"),
    from = make("input"),
    until = make("input"),
    periodError = make("small", "experience-error"),
    yearly = make("section", "finance-yearly");
  periodMode.id = "finance-period-mode";
  periodMode.setAttribute("aria-label", "Период финансов");
  for (const [value, title] of [
    ["month", "Месяц"],
    ["year", "Год"],
    ["range", "Период"],
  ]) {
    const option = make("option", "", title);
    option.value = value;
    periodMode.append(option);
  }
  year.id = "finance-year";
  year.type = "number";
  year.min = "1900";
  year.max = "2200";
  year.step = "1";
  year.value = ctx.todayKey.slice(0, 4);
  year.setAttribute("aria-label", "Год финансов");
  from.id = "finance-from";
  until.id = "finance-until";
  from.type = until.type = "date";
  from.min = until.min = "1900-01-01";
  from.max = until.max = "2200-12-31";
  from.value = month.value + "-01";
  until.value = ctx.todayKey;
  from.setAttribute("aria-label", "Финансы: с даты");
  until.setAttribute("aria-label", "Финансы: по дату");
  month.before(periodMode);
  month.after(year, from, until, periodError);
  const periodControls = $(".finance-period"),
    periodValue = make("div", "finance-period-value"),
    rangeControls = make("div", "finance-range-controls");
  const filterField = (title, input) => {
    const label = make("label", "finance-filter-field");
    label.append(make("span", "", title), input);
    return label;
  };
  periodValue.append(month, year);
  rangeControls.append(
    filterField("С даты", from),
    filterField("По дату", until),
  );
  rangeControls.hidden = true;
  periodControls.replaceChildren(
    filterField("Период", periodMode),
    periodValue,
    filterField("Валюта", currency),
    rangeControls,
    periodError,
  );
  yearly.hidden = true;
  $(".finance-columns").before(yearly);
  function financePeriod() {
    return financeRange(
      periodMode.value,
      periodMode.value === "year" ? year.value : month.value,
      from.value,
      until.value,
    );
  }
  function updatePeriod() {
    periodValue.hidden = periodMode.value === "range";
    rangeControls.hidden = periodMode.value !== "range";
    month.hidden = periodMode.value !== "month";
    year.hidden = periodMode.value !== "year";
    from.hidden = until.hidden = periodMode.value !== "range";
    periodError.hidden = Boolean(financePeriod());
    periodError.textContent = "Укажите корректный период";
    selectedFinanceCategory = null;
    renderFinances();
  }
  for (const input of [periodMode, year, from, until])
    listen(input, "change", updatePeriod);
  year.hidden = from.hidden = until.hidden = periodError.hidden = true;
  currencyOptions(currency);
  const financeForm = dialog("finance-dialog", "Новая операция"),
    financeDate = field(
      financeForm,
      "Дата",
      "finance-date",
      "date",
      ctx.todayKey,
    ),
    financeType = field(
      financeForm,
      "Тип",
      "finance-type",
      "text",
      "expense",
      "select",
    ),
    financeAmount = field(financeForm, "Сумма", "finance-amount", "number"),
    financeCurrency = field(
      financeForm,
      "Валюта",
      "finance-entry-currency",
      "text",
      "",
      "select",
    ),
    financeCategory = field(financeForm, "Категория", "finance-category"),
    financeNote = field(financeForm, "Заметка", "finance-note");
  for (const [value, label] of [
    ["expense", "Расход"],
    ["income", "Доход"],
  ]) {
    const option = make("option", "", label);
    option.value = value;
    financeType.append(option);
  }
  financeType.value = "expense";
  currencyOptions(financeCurrency);
  Object.assign(financeAmount, {
    min: "0.01",
    max: "1000000000000",
    step: "0.01",
    required: true,
  });
  financeAmount.inputMode = "decimal";
  financeDate.required = true;
  financeCategory.required = true;
  financeCategory.maxLength = 100;
  financeNote.maxLength = 1000;
  // Use a bounded in-form picker; native datalists can cover most of a screen.
  const categoryField = make("div", "field finance-category-field"),
    categoryTrigger = action(
      "",
      () => toggleCategoryPicker(),
      "finance-category-trigger",
    ),
    categoryLabel = make("span"),
    categoryPopover = make("div", "finance-category-popover"),
    categorySearch = make("input"),
    categoryOptions = make("div", "finance-category-options");
  financeCategory.closest("label").replaceWith(categoryField);
  financeCategory.type = "hidden";
  financeCategory.required = false;
  categoryLabel.dataset.userContent = "true";
  categoryTrigger.append(categoryLabel, icon("chevron-right"));
  categoryTrigger.setAttribute("aria-haspopup", "listbox");
  categoryTrigger.setAttribute("aria-expanded", "false");
  categoryTrigger.setAttribute("aria-controls", "finance-category-options");
  categoryTrigger.setAttribute("aria-label", "Категория");
  categorySearch.type = "search";
  categorySearch.placeholder = "Найти категорию";
  categorySearch.setAttribute("aria-label", "Найти категорию");
  categoryOptions.id = "finance-category-options";
  categoryOptions.setAttribute("role", "listbox");
  categoryOptions.setAttribute("aria-label", "Категории");
  categoryPopover.hidden = true;
  categoryPopover.append(categorySearch, categoryOptions);
  categoryField.append(
    make("span", "", "Категория"),
    financeCategory,
    categoryTrigger,
    categoryPopover,
  );
  function hideCategoryPicker(returnFocus = false) {
    categoryPopover.hidden = true;
    categoryTrigger.setAttribute("aria-expanded", "false");
    if (returnFocus) categoryTrigger.focus({ preventScroll: true });
  }
  function toggleCategoryPicker() {
    if (!categoryPopover.hidden) return hideCategoryPicker();
    categorySearch.value = "";
    renderCategoryOptions();
    categoryPopover.hidden = false;
    categoryTrigger.setAttribute("aria-expanded", "true");
    // Choosing an existing category needs no typing or soft keyboard.
    if (!ctx.services.mobile && !window.matchMedia("(pointer: coarse)").matches)
      categorySearch.focus({ preventScroll: true });
    window.requestAnimationFrame(() => revealInDialog(categoryPopover));
  }
  ctx.registerBackLayer(
    () => !categoryPopover.hidden && !financeForm.closest(".overlay").hidden,
    () => hideCategoryPicker(true),
  );
  listen(categoryOptions, "pointerdown", (event) => {
    if (
      document.activeElement === categorySearch &&
      event.target.closest("button")
    )
      event.preventDefault();
  });
  if (window.visualViewport)
    listen(window.visualViewport, "resize", () => {
      if (!categoryPopover.hidden)
        window.requestAnimationFrame(() => revealInDialog(categoryPopover));
    });
  listen(categorySearch, "input", renderCategoryOptions);
  listen(categoryField, "keydown", (event) => {
    if (event.isComposing) return;
    if (event.key === "Escape" && !categoryPopover.hidden) {
      event.preventDefault();
      event.stopPropagation();
      hideCategoryPicker(true);
    } else if (
      ["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key) &&
      (event.target !== categorySearch || event.key.startsWith("Arrow"))
    ) {
      event.preventDefault();
      if (categoryPopover.hidden) toggleCategoryPicker();
      const options = [...categoryOptions.querySelectorAll("button")];
      if (!options.length) return;
      const current = options.indexOf(document.activeElement);
      const next =
        event.key === "Home"
          ? 0
          : event.key === "End"
            ? options.length - 1
            : event.key === "ArrowDown"
              ? Math.min(options.length - 1, current + 1)
              : current < 0
                ? options.length - 1
                : Math.max(0, current - 1);
      options[next].focus({ preventScroll: true });
      options[next].scrollIntoView({ block: "nearest" });
    }
  });
  listen(categorySearch, "keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      categoryOptions.querySelector("button")?.click();
    }
  });
  listen(root, "click", (event) => {
    if (!categoryField.contains(event.target)) hideCategoryPicker();
  });
  const financeActions = saveButtons(financeForm),
    financeDelete = action(
      "Удалить",
      () => {
        if (
          editingFinance &&
          ctx.experience() &&
          !ctx.experience().canRemoveFinance(editingFinance)
        )
          return;
        closeDialog();
        if (editingFinance)
          ctx.removeWithUndo(state.financeLogs, editingFinance, () => {
            renderFinances();
            renderFinanceSummary();
          });
      },
      "button button-danger",
    );
  financeActions.prepend(financeDelete);
  function openFinance(item, opener, copy = false) {
    editingFinance = copy ? null : item;
    financeDate.value = item?.date || dateKey(new Date());
    financeType.value = item?.type || "expense";
    financeAmount.value = item?.amount || "";
    financeCurrency.value =
      item?.currency ||
      ctx.experience()?.preferredCurrency() ||
      state.financeCurrency;
    financeCategory.value = financeCategoryName(item?.category || "Еда");
    hideCategoryPicker();
    renderCategoryOptions();
    financeNote.value = item?.note || "";
    financeDelete.hidden = !editingFinance;
    $("#finance-dialog-title").textContent = editingFinance
      ? "Изменить операцию"
      : "Новая операция";
    ctx.experience()?.openFinance(item);
    renderCategoryOptions();
    openDialog("finance-dialog", opener);
    financeAmount.focus();
  }
  listen($("#finance-add"), "click", (event) =>
    openFinance(null, event.currentTarget),
  );
  listen(financeForm, "submit", (event) => {
    event.preventDefault();
    const amount = Math.round(Number(financeAmount.value) * 100) / 100;
    if (!Number.isFinite(amount) || amount <= 0 || amount > 1e12) return;
    let record = {
      date: financeDate.value,
      type: financeType.value,
      amount,
      currency: financeCurrency.value,
      category: financeCategoryName(financeCategory.value),
      note: financeNote.value.trim(),
    };
    record =
      ctx.experience()?.readFinanceRecord(record, editingFinance) ??
      (ctx.experience() ? null : record);
    if (!record) return;
    if (editingFinance) Object.assign(editingFinance, record);
    else state.financeLogs.push({ id: createId(), ...record });
    selectedFinanceCategory = null;
    month.value = record.date.slice(0, 7);
    state.financeCurrency = record.currency;
    currency.value = record.currency;
    closeDialog();
    renderFinances();
    renderFinanceSummary();
    persistState();
  });
  listen(month, "change", () => {
    selectedFinanceCategory = null;
    renderFinances();
  });
  listen($("#finance-clear-filter"), "click", () => {
    selectedFinanceCategory = null;
    renderFinances();
  });
  listen(currency, "change", () => {
    selectedFinanceCategory = null;
    state.financeCurrency = currency.value;
    renderFinances();
    renderFinanceSummary();
    persistState();
  });
  function renderFinanceSummary() {
    const balances = ctx.experience()?.balances();
    if (balances) {
      const grouped = new Map();
      for (const account of balances)
        grouped.set(
          account.currency,
          (grouped.get(account.currency) || 0) +
            Math.round(account.balance * 100),
        );
      $("#life-finance-summary").textContent =
        [...grouped]
          .map(([code, cents]) => money(cents / 100, code))
          .join(" · ") || "—";
      return;
    }
    const summary = financialSummary(
      state.financeLogs,
      dateKey(new Date()).slice(0, 7),
      state.financeCurrency,
    );
    $("#life-finance-summary").textContent = summary.items.length
      ? money(summary.balance)
      : "—";
  }
  const categoryColors = {
    Еда: "#379768",
    Транспорт: "#478fca",
    Дом: "#9980c1",
    Здоровье: "#45a99d",
    Покупки: "#d39955",
    Подарки: "#ce7c9d",
    Другое: "#8696a5",
  };
  if (!state.financeCategories.length)
    state.financeCategories = Object.entries({
      ...categoryColors,
      Зарплата: "#379768",
    }).map(([name, color]) => ({ name, color }));
  function categoryColor(name) {
    const saved = state.financeCategories.find((item) => item.name === name);
    if (saved) return saved.color;
    if (Object.hasOwn(categoryColors, name)) return categoryColors[name];
    const colors = [
      "#68a585",
      "#7d99c4",
      "#ae94bd",
      "#c69674",
      "#70a8aa",
      "#bc8592",
    ];
    let hash = 0;
    for (const letter of name) hash = (hash * 31 + letter.codePointAt(0)) >>> 0;
    return colors[hash % colors.length];
  }
  // Custom categories are explicit, editable, and included in local backups.
  const categoryForm = dialog(
      "finance-categories-dialog",
      "Категории финансов",
    ),
    categoryList = make("div", "finance-category-editor-list"),
    categoryName = field(categoryForm, "Название", "finance-category-name"),
    categoryTint = field(
      categoryForm,
      "Цвет",
      "finance-category-color",
      "color",
      "#478fca",
    );
  categoryForm.querySelector(".dialog-head").after(categoryList);
  categoryName.required = true;
  categoryName.maxLength = 100;
  const categoryError = make("p", "error");
  categoryError.hidden = true;
  categoryError.setAttribute("role", "alert");
  categoryForm.append(categoryError);
  const categoryButtons = saveButtons(categoryForm);
  let editingCategoryName = null,
    returnToFinance = false;
  const categoryCancelEdit = action(
    "Новая категория",
    () => {
      editingCategoryName = null;
      categoryName.value = "";
      categoryTint.value = "#478fca";
      categoryError.hidden = true;
      categoryName.focus();
    },
    "text-button",
  );
  categoryButtons.prepend(categoryCancelEdit);
  function categoryNames() {
    return [
      ...new Set([
        ...state.financeCategories.map((item) => item.name),
        "Другое",
        ...state.financeLogs.map((item) => financeCategoryName(item.category)),
      ]),
    ];
  }
  function renderCategoryOptions() {
    categoryLabel.textContent = financeCategory.value || "Другое";
    categoryOptions.replaceChildren();
    const query = categorySearch.value.trim().toLocaleLowerCase();
    for (const name of categoryNames().filter((name) =>
      name.toLocaleLowerCase().includes(query),
    )) {
      const option = action(
        "",
        () => {
          financeCategory.value = name;
          categoryLabel.textContent = name;
          hideCategoryPicker(true);
        },
        "finance-category-option",
      );
      option.setAttribute("role", "option");
      option.setAttribute(
        "aria-selected",
        String(name === financeCategory.value),
      );
      option.dataset.userContent = "true";
      const dot = make("span", "finance-category-dot");
      dot.style.setProperty("--category-color", categoryColor(name));
      dot.setAttribute("aria-hidden", "true");
      option.append(dot, make("span", "", name));
      categoryOptions.append(option);
    }
    if (!categoryOptions.childElementCount)
      categoryOptions.append(make("p", "aux-note", "Категории не найдены"));
  }
  function openCategoryManager(opener, fromEntry = false) {
    returnToFinance = fromEntry;
    editingCategoryName = null;
    categoryName.value = fromEntry ? financeCategory.value : "";
    categoryTint.value = categoryColor(categoryName.value || "Другое");
    categoryError.hidden = true;
    renderCategoryManager();
    closeDialog();
    openDialog("finance-categories-dialog", opener);
    categoryName.focus();
  }
  const manageCategories = action(
    "Настроить категории",
    (event) => openCategoryManager(event.currentTarget),
    "text-button",
  );
  const categoryToolbar = make(
    "div",
    "section-toolbar finance-category-toolbar",
  );
  const categoryHeading = $(".finance-breakdown > h3");
  categoryHeading.before(categoryToolbar);
  categoryToolbar.append(categoryHeading, manageCategories);
  categoryField.after(
    action(
      "+ Своя категория",
      (event) => openCategoryManager(event.currentTarget, true),
      "text-button finance-custom-category",
    ),
  );
  function renderCategoryManager() {
    categoryList.replaceChildren();
    for (const name of categoryNames()) {
      const row = make("div", "category-editor-row"),
        copy = action(
          "",
          () => {
            editingCategoryName = name;
            categoryName.value = name;
            categoryTint.value = categoryColor(name);
            categoryError.hidden = true;
            categoryName.focus();
          },
          "category-editor-name",
        ),
        dot = make("span", "finance-category-dot");
      copy.dataset.userContent = "";
      dot.style.setProperty("--category-color", categoryColor(name));
      copy.append(dot, make("span", "", name));
      row.append(copy);
      // Default categories remain available; custom category deletion preserves transactions.
      if (
        state.financeCategories.some((item) => item.name === name) &&
        name !== "Другое"
      ) {
        const remove = action(
          "×",
          () => {
            const before = structuredClone(state.financeCategories),
              undoCategoryMetadata = ctx.experience()?.deleteCategory(name),
              affected = state.financeLogs.filter(
                (item) => financeCategoryName(item.category) === name,
              );
            state.financeCategories = state.financeCategories.filter(
              (item) => item.name !== name,
            );
            for (const item of affected) item.category = "Другое";
            if (editingCategoryName === name) {
              editingCategoryName = null;
              categoryName.value = "";
            }
            renderCategoryManager();
            renderCategoryOptions();
            renderFinances();
            persistState();
            ctx.notify(
              ctx.effectiveLanguage() === "en"
                ? "Category removed; transactions moved to Other"
                : "Категория удалена, операции перенесены в «Другое»",
              () => {
                undoCategoryMetadata?.();
                for (const entry of before)
                  if (
                    !state.financeCategories.some(
                      (item) => item.name === entry.name,
                    )
                  )
                    state.financeCategories.push(entry);
                for (const item of affected)
                  if (
                    state.financeLogs.includes(item) &&
                    item.category === "Другое"
                  )
                    item.category = name;
                renderCategoryManager();
                renderCategoryOptions();
                renderFinances();
              },
            );
          },
          "text-button",
        );
        remove.setAttribute("aria-label", "Удалить категорию: " + name);
        row.append(remove);
      }
      categoryList.append(row);
    }
  }
  listen(categoryForm, "submit", (event) => {
    event.preventDefault();
    const name = financeCategoryName(categoryName.value);
    if (
      !categoryName.value.trim() ||
      categoryNames().some(
        (existing) =>
          existing !== editingCategoryName &&
          existing.toLocaleLowerCase("ru") === name.toLocaleLowerCase("ru"),
      )
    ) {
      categoryError.textContent =
        ctx.effectiveLanguage() === "en"
          ? "Choose a unique category name."
          : "Введите новое, неповторяющееся название.";
      categoryError.hidden = false;
      return;
    }
    const index = state.financeCategories.findIndex(
      (item) => item.name === editingCategoryName,
    );
    const record = { name, color: categoryTint.value };
    if (index >= 0) state.financeCategories[index] = record;
    else state.financeCategories.push(record);
    if (editingCategoryName && editingCategoryName !== name)
      ctx.experience()?.renameCategory(editingCategoryName, name);
    if (editingCategoryName && editingCategoryName !== name)
      for (const item of state.financeLogs)
        if (financeCategoryName(item.category) === editingCategoryName)
          item.category = name;
    financeCategory.value = name;
    editingCategoryName = name;
    renderCategoryOptions();
    renderFinances();
    renderFinanceSummary();
    persistState();
    if (returnToFinance) {
      closeDialog();
      openDialog("finance-dialog", $("#finance-add"));
    } else {
      categoryName.value = "";
      editingCategoryName = null;
      renderCategoryManager();
    }
  });
  renderCategoryOptions();
  Object.assign(ctx.translations, {
    "Категории финансов": "Finance categories",
    Категории: "Categories",
    Цвет: "Color",
    "+ Своя категория": "+ Custom category",
    "Новая категория": "New category",
    "Найти категорию": "Find a category",
    "Категории не найдены": "No matching categories",
    "Доли от суммы доходов и расходов": "Shares of total income and expenses",
  });
  function renderFinanceFlow(summary) {
    financeFlow.replaceChildren();
    const total = summary.income + summary.expenses;
    const incomePercent =
      total > 0 ? Math.round((summary.income / total) * 1000) / 10 : 0;
    for (const [type, label, percent] of [
      ["income", "Доходы", incomePercent],
      ["expense", "Расходы", total > 0 ? 100 - incomePercent : 0],
    ]) {
      const item = make("div", "finance-flow-item"),
        ring = make("div", "finance-flow-ring"),
        svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      item.dataset.type = type;
      svg.setAttribute("viewBox", "0 0 72 72");
      svg.setAttribute("aria-hidden", "true");
      for (const color of ["var(--lo-line)", "var(--flow-color)"]) {
        const circle = document.createElementNS(svg.namespaceURI, "circle");
        for (const [key, value] of Object.entries({
          cx: 36,
          cy: 36,
          r: 29,
          fill: "none",
          stroke: color,
          "stroke-width": 6,
        }))
          circle.setAttribute(key, String(value));
        if (color === "var(--flow-color)") {
          const length = 2 * Math.PI * 29;
          circle.setAttribute(
            "stroke-dasharray",
            `${(percent / 100) * length} ${length}`,
          );
          circle.setAttribute("transform", "rotate(-90 36 36)");
        }
        svg.append(circle);
      }
      const formatted =
        numberFormat(ctx.displayLocale(), {
          maximumFractionDigits: 1,
        }).format(percent) + "%";
      ring.append(svg, make("strong", "", formatted));
      item.append(ring, make("span", "", label));
      financeFlow.append(item);
    }
    financeFlow.append(
      make("p", "finance-flow-note", "Доли от суммы доходов и расходов"),
    );
  }
  function renderSpendingChart(summary) {
    const host = $("#finance-chart");
    host.replaceChildren();
    host.hidden = !summary.categories.length;
    if (host.hidden) return;
    const ns = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(ns, "svg");
    svg.setAttribute("viewBox", "0 0 160 160");
    svg.setAttribute("role", "img");
    svg.setAttribute(
      "aria-label",
      (ctx.effectiveLanguage() === "en"
        ? "Spending by category: "
        : "Расходы по категориям: ") + money(summary.expenses),
    );
    const circle = (color) => {
      const node = document.createElementNS(ns, "circle");
      for (const [key, value] of Object.entries({
        cx: 80,
        cy: 80,
        r: 59,
        fill: "none",
        stroke: color,
        "stroke-width": 18,
      }))
        node.setAttribute(key, String(value));
      return node;
    };
    svg.append(circle("var(--lo-line)"));
    const length = 2 * Math.PI * 59;
    let offset = 0;
    for (const [name, cents] of summary.categories) {
      const portion = cents / (summary.expenses * 100);
      const segment = circle(categoryColor(name));
      segment.setAttribute("stroke-dasharray", portion * length + " " + length);
      segment.setAttribute("stroke-dashoffset", String(-offset * length));
      segment.setAttribute("transform", "rotate(-90 80 80)");
      segment.style.opacity =
        selectedFinanceCategory && selectedFinanceCategory !== name
          ? ".25"
          : "1";
      svg.append(segment);
      offset += portion;
    }
    const caption = make("figcaption", "finance-chart-center");
    const selected = summary.categories.find(
      ([name]) => name === selectedFinanceCategory,
    );
    const percent = selected
      ? (selected[1] / (summary.expenses * 100)) * 100
      : 100;
    const amount = make(
      "strong",
      "",
      numberFormat(ctx.displayLocale(), {
        maximumFractionDigits: 1,
      }).format(percent) + "%",
    );
    amount.dataset.userContent = "true";
    caption.append(make("small", "", "Расходы"), amount);
    host.append(svg, caption);
  }
  function renderFinances() {
    renderCategoryOptions();
    currency.value = state.financeCurrency;
    const summary = financialSummary(
        ctx.experience()?.financeRows() || state.financeLogs,
        financePeriod(),
        state.financeCurrency,
      ),
      totals = $("#finance-totals"),
      categories = $("#finance-categories"),
      log = $("#finance-log");
    if (
      selectedFinanceCategory &&
      !summary.categories.some(([name]) => name === selectedFinanceCategory)
    )
      selectedFinanceCategory = null;
    $("#finance-clear-filter").hidden = !selectedFinanceCategory;
    renderFinanceFlow(summary);
    renderSpendingChart(summary);
    totals.replaceChildren();
    for (const [label, value] of [
      ["Доходы минус расходы за период", summary.balance],
      ["Доходы", summary.income],
      ["Расходы", summary.expenses],
    ]) {
      const item = make("div", "finance-total");
      item.dataset.type =
        label === "Доходы"
          ? "income"
          : label === "Расходы"
            ? "expense"
            : "balance";
      item.append(make("small", "", label), make("strong", "", money(value)));
      totals.append(item);
    }
    categories.replaceChildren();
    for (const [name, cents] of summary.categories) {
      const row = action(
          "",
          () => {
            selectedFinanceCategory =
              selectedFinanceCategory === name ? null : name;
            renderFinances();
            [...categories.children]
              .find((item) => item.dataset.category === name)
              ?.focus({ preventScroll: true });
          },
          "finance-category-row",
        ),
        bar = make("span", "finance-category-bar");
      const percent = (cents / (summary.expenses * 100)) * 100;
      row.dataset.category = name;
      row.setAttribute(
        "aria-pressed",
        String(selectedFinanceCategory === name),
      );
      row.style.setProperty("--category-color", categoryColor(name));
      bar.style.setProperty("--category-percent", percent + "%");
      bar.setAttribute("aria-hidden", "true");
      row.dataset.userContent = "true";
      const label = make("span", "finance-category-label"),
        dot = make("span", "finance-category-dot"),
        amount = make("span", "finance-category-amount");
      dot.setAttribute("aria-hidden", "true");
      label.append(dot, make("span", "", name));
      amount.append(
        make("strong", "", money(cents / 100)),
        make(
          "small",
          "",
          numberFormat(ctx.displayLocale(), {
            maximumFractionDigits: 1,
          }).format(percent) + "%",
        ),
      );
      row.append(label, amount, bar);
      categories.append(row);
    }
    if (!summary.categories.length)
      categories.append(make("p", "aux-note", "Расходов за этот период нет."));
    $("#finance-record-title").textContent =
      periodMode.value === "month"
        ? "Записи месяца"
        : periodMode.value === "year"
          ? "Записи года"
          : "Записи периода";
    yearly.hidden = periodMode.value !== "year" || !financePeriod();
    yearly.replaceChildren();
    if (!yearly.hidden) {
      yearly.append(make("h3", "", "Доходы и расходы по месяцам"));
      const grid = make("div", "finance-year-grid");
      const months = Array.from({ length: 12 }, (_, i) => {
        const key = year.value + "-" + String(i + 1).padStart(2, "0");
        return {
          key,
          ...financialSummary(
            ctx.experience()?.financeRows() || state.financeLogs,
            key,
            state.financeCurrency,
          ),
        };
      });
      const max = Math.max(1, ...months.flatMap((m) => [m.income, m.expenses]));
      for (const [index, item] of months.entries()) {
        const button = action(
          "",
          () => {
            month.value = item.key;
            periodMode.value = "month";
            updatePeriod();
          },
          "finance-year-month",
        );
        const label = new Date(
          Number(year.value),
          index,
          1,
          12,
        ).toLocaleDateString(ctx.effectiveLanguage(), { month: "short" });
        button.setAttribute(
          "aria-label",
          label +
            ": доходы " +
            money(item.income) +
            ", расходы " +
            money(item.expenses),
        );
        button.title = button.getAttribute("aria-label");
        const bars = make("span", "finance-year-bars");
        for (const [kind, value] of [
          ["income", item.income],
          ["expense", item.expenses],
        ]) {
          const bar = make("span", "finance-year-bar");
          bar.dataset.type = kind;
          bar.style.height =
            Math.max(value > 0 ? 2 : 0, (value / max) * 90) + "px";
          bars.append(bar);
        }
        button.append(bars, make("small", "", label));
        grid.append(button);
      }
      yearly.append(
        make(
          "small",
          "aux-note",
          "Зелёный — доходы · красный — расходы. Нажмите на месяц, чтобы открыть операции.",
        ),
        grid,
      );
    }
    log.replaceChildren();
    const visibleItems = selectedFinanceCategory
      ? summary.items.filter(
          (item) =>
            item.type === "expense" &&
            financeCategoryName(item.category) === selectedFinanceCategory,
        )
      : [...summary.items, ...(ctx.experience()?.legacyRows() || [])];
    for (const entry of [...visibleItems].sort(
      (a, b) => b.date.localeCompare(a.date) || b.id - a.id,
    )) {
      const row = make("div", "finance-entry");
      row.dataset.type = entry.type;
      row.dataset.legacy = String(Boolean(entry.legacyFinance));
      row.style.setProperty(
        "--category-color",
        categoryColor(financeCategoryName(entry.category)),
      );
      const copy = action(
        "",
        (event) => openFinance(entry, event.currentTarget),
        "finance-entry-copy",
      );
      copy.dataset.userContent = "true";
      const label = make("span", "finance-category-label"),
        dot = make("span", "finance-category-dot");
      dot.setAttribute("aria-hidden", "true");
      label.append(dot, make("span", "", financeCategoryName(entry.category)));
      copy.append(
        label,
        make(
          "strong",
          "",
          (entry.type === "transfer"
            ? "↔ "
            : entry.type === "expense"
              ? "−"
              : "+") + money(entry.amount),
        ),
        make(
          "small",
          "",
          ctx.shortDate(entry.date) +
            (entry.accountKey
              ? " · " +
                ((state.uiPreferences.financeAccounts || []).find(
                  (account) => account.key === entry.accountKey,
                )?.name || "—")
              : "") +
            (entry.type === "transfer"
              ? " → " +
                ((state.uiPreferences.financeAccounts || []).find(
                  (account) => account.key === entry.toAccountKey,
                )?.name || "—")
              : "") +
            (entry.note ? " · " + entry.note : ""),
        ),
      );
      const more = action(
        "⋯",
        () => ctx.itemMenu("finance", entry, more),
        "text-button entity-more",
      );
      more.setAttribute(
        "aria-label",
        "Действия с операцией: " + entry.category,
      );
      const type = make(
        "span",
        "finance-type-badge",
        entry.type === "transfer"
          ? ctx.translate("Перевод", "Transfer")
          : ctx.effectiveLanguage() === "en"
            ? entry.type === "income"
              ? "Income"
              : "Expense"
            : entry.type === "income"
              ? "Доход"
              : "Расход",
      );
      row.append(copy, type, more);
      if (entry.legacyFinance)
        copy.append(make("small", "aux-note", "История · вне остатков счетов"));
      log.append(row);
    }
    if (!summary.items.length)
      log.append(make("p", "aux-note", "Добавьте доход или расход."));
    ctx.experience()?.renderFinance();
    ctx.applyLanguage();
  }

  // One editable exercise name replaces the fixed training direction.
  $("#training-focus").closest("label").hidden = true;
  const exerciseList = make("datalist");
  exerciseList.id = "exercise-options";
  $("#training-form").append(exerciseList);
  $("#training-name").setAttribute("list", "exercise-options");
  const exerciseToolbar = make("div", "exercise-toolbar"),
    exercisePicker = make("select");
  exercisePicker.id = "exercise-picker";
  exercisePicker.setAttribute("aria-label", "Сохранённые упражнения");
  exerciseToolbar.append(
    exercisePicker,
    action("Сохранить упражнение", () =>
      rememberExercise(
        $("#training-name").value.trim(),
        Number($("#training-duration").value) || 30,
      ),
    ),
    action(
      "Удалить",
      () => {
        const exercise = state.exercises.find(
          (row) => String(row.id) === exercisePicker.value,
        );
        if (exercise)
          state.exercises.splice(state.exercises.indexOf(exercise), 1);
        renderExercises();
        persistState();
      },
      "text-button",
    ),
  );
  $("#training-name").closest("label").after(exerciseToolbar);
  listen(exercisePicker, "change", () => {
    const item = state.exercises.find(
      (row) => String(row.id) === exercisePicker.value,
    );
    if (item) {
      $("#training-name").value = item.name;
      $("#training-duration").value = item.duration;
    }
  });
  function renderExercises() {
    const selected = exercisePicker.value;
    exercisePicker.replaceChildren(
      make("option", "", "Сохранённые упражнения"),
    );
    exercisePicker.firstChild.value = "";
    exerciseList.replaceChildren();
    for (const item of state.exercises) {
      const option = make("option", "", item.name);
      option.value = String(item.id);
      exercisePicker.append(option);
      const suggestion = make("option");
      suggestion.value = item.name;
      exerciseList.append(suggestion);
    }
    exercisePicker.value = selected;
  }
  function rememberExercise(name, duration) {
    if (!name || !Number.isFinite(duration) || duration < 1 || duration > 1439)
      return;
    const old = state.exercises.find(
      (item) => item.name.toLocaleLowerCase() === name.toLocaleLowerCase(),
    );
    if (old) old.duration = duration;
    else state.exercises.push({ id: createId(), name, duration });
    renderExercises();
    persistState();
  }

  // Half-star ratings retain the same stored numeric value.
  const oldRating = $("#archive-item-rating"),
    ratingInput = make("input");
  ratingInput.type = "hidden";
  ratingInput.id = oldRating.id;
  oldRating.replaceWith(ratingInput);
  const ratingMaximum = () => ctx.archiveRatingMax?.() || 5;
  const picker = createRatingPicker(ctx, {
    maximum: ratingMaximum(),
    value: Number(ratingInput.value) || 0,
    onChange(value) {
      ratingInput.value = value === null ? "" : String(value);
      ratingInput.dispatchEvent(new Event("change", { bubbles: true }));
    },
  });
  ratingInput.after(picker.element);
  function renderRating() {
    picker.update(Number(ratingInput.value) || 0, ratingMaximum());
  }
  function stars(value, maximum = 5) {
    return createRatingStars(ctx, value, maximum);
  }

  // Connection settings keep tokens in the native credential store, never in state.
  const connectionForm = dialog("connections-dialog", "Подключения");
  connectionForm.classList.add("connections-dialog");
  connectionForm.innerHTML += `<div class="connection-tabs segments"><button type="button" data-connection-tab="ai">ИИ</button><button type="button" data-connection-tab="notion">Notion / API</button><button type="button" data-connection-tab="google">Календарь</button></div>
  <section data-connection-view="ai"><label class="field">Провайдер<select id="ai-provider"><option value="openai">OpenAI</option><option value="deepseek">DeepSeek</option><option value="gemini">Gemini</option></select></label><label class="field">API ключ<input id="ai-key" type="password" autocomplete="off" spellcheck="false"></label><div class="connection-actions"><button type="button" id="ai-key-save" class="button">Сохранить ключ</button><button type="button" id="ai-key-delete" class="text-button">Удалить ключ</button></div><label class="field">Модель<input id="ai-model" list="ai-model-options" placeholder="Название модели из вашего API"></label><datalist id="ai-model-options"></datalist><button type="button" id="ai-models-load" class="text-button">Загрузить модели</button><p class="aux-note">Нужен API ключ провайдера. Ключ остаётся на этом устройстве и не входит в резервную копию.</p></section>
  <section data-connection-view="notion" hidden><label class="field">Источник<select id="import-provider"><option value="notion">Notion</option><option value="json">Другой JSON API</option></select></label><label class="field">API ключ<input id="import-key" type="password" autocomplete="off"></label><button type="button" id="import-key-save" class="button">Сохранить ключ</button><label class="field" id="notion-source-label">ID базы или источника данных Notion<input id="notion-source-id" placeholder="ID или ссылка на базу"></label><label class="field" id="json-endpoint-label" hidden>HTTPS адрес JSON API<input id="json-endpoint" type="url" placeholder="https://…"></label><label class="field">Куда импортировать<select id="import-kind"><option value="tasks">Задачи</option><option value="events">Расписание</option><option value="projects">Проекты</option><option value="archiveItems">База данных</option><option value="thoughts">Мысли</option></select></label><button type="button" id="import-fetch" class="button">Получить данные</button><p class="aux-note">В Notion откройте доступ к базе своей интеграции. Можно вставить ссылку на базу или data source ID. Повторный импорт обновляет записи; ваши изменённые записи сохраняются.</p><button type="button" id="import-key-delete" class="text-button">Удалить ключ</button></section>
  <section data-connection-view="google" hidden><div id="google-desktop"><label class="field">OAuth Client ID Google<input id="google-client-id" autocomplete="off"></label><label class="field">Client secret<input id="google-client-secret" type="password" autocomplete="off"></label><button type="button" id="google-connect" class="button">Войти через Google</button><p class="aux-note">Для ПК нужен OAuth клиент типа Desktop app с включённым Calendar API. Вход откроется в системном браузере.</p></div><div id="google-mobile" hidden><p class="aux-note">Календари Google из аккаунтов телефона синхронизируются через системный календарь Android.</p><button type="button" id="google-device-connect" class="button">Разрешить доступ к календарям</button></div><label class="field">Календарь<select id="google-calendar"><option value="primary">Основной</option></select></label><div class="field-row"><label class="field">С даты<input id="calendar-from" type="date"></label><label class="field">По дату<input id="calendar-until" type="date"></label></div><div class="connection-actions"><button type="button" id="google-pull" class="button">Получить события</button><button type="button" id="google-push" class="button">Отправить изменения</button></div><button type="button" id="google-disconnect" class="text-button">Отключить календарь</button><p class="aux-note">Получение показывает изменения перед импортом. Отправка касается событий Orvim; чужие события не перезаписываются без проверки версии.</p></section><p id="connection-status" class="connection-status" role="status"></p>`;
  // Replacing innerHTML above recreates the close button; bind it explicitly.
  listen(connectionForm.querySelector(".close"), "click", closeDialog);
  const connectionStatus = $("#connection-status"),
    connectionSettings = () => state.connectionSettings;
  $("#json-endpoint-label").append(
    make(
      "small",
      "aux-note",
      "Сначала укажите адрес сервиса, затем сохраните ключ. Ключ привязывается к этому HTTPS серверу.",
    ),
  );
  const settingsBody = $("#settings-dialog .dialog");
  const notificationRow = make("div", "settings-notifications");
  Object.assign(ctx.translations, {
    "Все уведомления": "All notifications",
    "Расписание и самочувствие": "Schedule and wellbeing",
    "Самочувствие · 3 раза в день": "Wellbeing · 3 times a day",
    "Расписание · за 5 минут": "Schedule · 5 minutes before",
    "Compact · 1 сек.": "Compact · 1 sec",
    "Warm · 1,9 сек.": "Warm · 1.9 sec",
    Прослушать: "Listen",
    "Звук уведомлений": "Notification sounds",
    "Выключите для тихих уведомлений": "Turn off for silent notifications",
    "Не удалось прослушать звук.": "Could not play the sound.",
  });
  notificationRow.innerHTML = `
    <label class="settings-card notification-choice"><input type="checkbox" id="notifications-enabled"><span class="settings-card-copy"><strong>Все уведомления</strong><span class="aux-note">Расписание и самочувствие</span></span></label>
    <div class="settings-card notification-choice"><label class="notification-toggle"><input type="checkbox" id="notifications-wellbeing"><span class="settings-card-copy"><strong>Самочувствие · 3 раза в день</strong><span class="aux-note">09:00 · 15:00 · 21:00</span></span></label><button type="button" class="text-button" id="notifications-preview-wellbeing">Прослушать</button></div>
    <div class="settings-card notification-choice"><label class="notification-toggle"><input type="checkbox" id="notifications-schedule"><span class="settings-card-copy"><strong>Расписание · за 5 минут</strong><span class="aux-note">Warm · 1,9 сек.</span></span></label><button type="button" class="text-button" id="notifications-preview-schedule">Прослушать</button></div>
    <label class="settings-card notification-choice"><input type="checkbox" id="notifications-sound"><span class="settings-card-copy"><strong>Звук уведомлений</strong><span class="aux-note">Выключите для тихих уведомлений</span></span></label>
    <button type="button" class="text-button" id="notifications-permission">Разрешить уведомления</button><p id="notification-status" class="aux-note" role="status"></p>`;
  settingsBody.append(notificationRow);
  const notificationControls = [
    ["notifications-enabled", "enabled"],
    ["notifications-wellbeing", "wellbeingEnabled"],
    ["notifications-schedule", "scheduleEnabled"],
    ["notifications-sound", "soundEnabled"],
  ];
  let notificationPreview = null;
  function stopNotificationPreview() {
    notificationPreview?.pause();
    notificationPreview = null;
  }
  function refreshNotificationSettings() {
    const enabled = state.notificationSettings.enabled !== false;
    for (const [id, key] of notificationControls) {
      const control = $("#" + id);
      control.checked = state.notificationSettings[key] !== false;
      control.disabled = key !== "enabled" && !enabled;
    }
    $("#notifications-permission").disabled = !enabled;
  }
  refreshNotificationSettings();
  for (const [id, key] of notificationControls)
    listen($("#" + id), "change", () => {
      state.notificationSettings[key] = $("#" + id).checked;
      stopNotificationPreview();
      refreshNotificationSettings();
      persistState();
    });
  for (const [kind, file] of [
    ["wellbeing", "wellbeing-compact.wav"],
    ["schedule", "schedule-warm.wav"],
  ])
    listen($("#notifications-preview-" + kind), "click", async () => {
      stopNotificationPreview();
      const preview = new Audio("/sounds/notifications/" + file);
      notificationPreview = preview;
      try {
        await preview.play();
      } catch {
        if (!disposed && notificationPreview === preview) {
          setStatus(
            $("#notification-status"),
            "Не удалось прослушать звук.",
            true,
          );
          ctx.applyLanguage();
        }
      }
    });
  listen($("#notifications-permission"), "click", async () => {
    try {
      if (!services.platform)
        throw Error("Уведомления доступны в установленном приложении.");
      const status = await services.platform("notificationPermission", {});
      setStatus(
        $("#notification-status"),
        status?.message || "Разрешение обновлено.",
      );
      persistState();
    } catch (error) {
      setStatus($("#notification-status"), String(error), true);
    }
  });
  const notificationListener = (event) =>
    setStatus(
      $("#notification-status"),
      event.detail.message,
      Boolean(event.detail.error),
    );
  window.addEventListener("life-os:reminder-status", notificationListener);
  const notificationClick = (event) => {
    if (event.detail?.kind === "wellbeing") {
      ctx.showPage("life");
      if (ctx.checkinDue()) ctx.showStateDialog($("#life-checkin-open"));
    } else ctx.showPage("home");
  };
  window.addEventListener("life-os:notification", notificationClick);

  // Keep existing controls and listeners, but give each settings area its own panel.
  const settingsLayout = make("div", "settings-layout"),
    settingsTabs = make("div", "settings-tabs"),
    settingsPanels = make("div", "settings-panels"),
    appearancePanel = make("section", "settings-panel"),
    dataPanel = make("section", "settings-panel"),
    notificationsPanel = make("section", "settings-panel"),
    connectionsPanel = make("section", "settings-panel");
  let settingsSection = "appearance";
  settingsTabs.setAttribute("role", "tablist");
  settingsTabs.setAttribute("aria-label", "Разделы настроек");
  settingsTabs.setAttribute("aria-orientation", "vertical");
  const backup = settingsBody.querySelector(".settings-data");
  for (const node of [...settingsBody.children])
    if (
      !node.classList.contains("dialog-head") &&
      node !== backup &&
      node !== notificationRow
    )
      appearancePanel.append(node);
  appearancePanel.prepend(make("h3", "settings-panel-title", "Оформление"));
  if (services.desktopTray) {
    const row = make("div", "settings-row tray-setting-row"),
      label = make("label", "tray-setting-label"),
      checkbox = make("input"),
      note = make(
        "p",
        "aux-note",
        "При закрытии Orvim остаётся рядом с часами Windows. Для полного выхода выберите «Выйти» в меню значка. Только на этом ПК.",
      );
    checkbox.type = "checkbox";
    checkbox.id = "close-to-tray";
    checkbox.disabled = true;
    label.append(checkbox, make("span", "", "Сворачивать в трей при закрытии"));
    row.append(label, note);
    appearancePanel.append(row);
    const failed = () => {
      note.textContent = ctx.translate(
        "Не удалось изменить настройку трея. Откройте настройки заново.",
        "Could not change the tray setting. Reopen settings to try again.",
      );
    };
    let saved = true;
    const language = () => ctx.translate("ru", "en");
    void services
      .platform("traySettings", { language: language() })
      .then((result) => {
        saved = result.enabled;
        checkbox.checked = saved;
        checkbox.disabled = !result.available;
      })
      .catch(failed);
    listen(appearancePanel.querySelector("#language-select"), "change", () => {
      void services
        .platform("traySettings", { language: language() })
        .catch(failed);
    });
    listen(checkbox, "change", async () => {
      checkbox.disabled = true;
      try {
        const result = await services.platform("traySettings", {
          enabled: checkbox.checked,
        });
        saved = result.enabled;
      } catch {
        checkbox.checked = saved;
        failed();
      } finally {
        checkbox.disabled = false;
      }
    });
  }
  notificationsPanel.append(
    make("h3", "settings-panel-title", "Уведомления"),
    notificationRow,
  );
  dataPanel.append(make("h3", "settings-panel-title", "Данные"));
  backup.querySelector(".settings-label").remove();
  const backupGroups = make("div", "settings-data-groups");
  for (const [id, title, description] of [
    [
      "backup-download",
      "Данные для переноса",
      "Полный JSON с записями и изображениями. Подходит для восстановления; файл открыт.",
    ],
    [
      "export-csv",
      "Таблицы для анализа",
      "CSV для Excel: показатели и записи без обложек и настроек. Не подходит для полного восстановления.",
    ],
  ]) {
    const group = make("section", "settings-card"),
      copy = make("div", "settings-card-copy");
    copy.append(make("h4", "", title), make("p", "aux-note", description));
    const button = $("#" + id);
    button.classList.add("button");
    group.append(copy, button);
    backupGroups.append(group);
  }
  backup.querySelector(".settings-data-actions").remove();
  const restoreCard = make("section", "settings-card settings-restore-card"),
    restoreCopy = make("div", "settings-card-copy");
  restoreCopy.append(
    make("h4", "", "Восстановление"),
    make(
      "p",
      "aux-note",
      "Выберите резервную копию. Перед заменой данных появится предпросмотр.",
    ),
  );
  restoreCard.append(restoreCopy, $("#backup-file").closest(".field"));
  backupGroups.append(restoreCard);
  backup.prepend(backupGroups);
  const lanSettings = installLanSettings(ctx, dataPanel, {
    dialog,
    openDataSettings: () => {
      openDialog("settings-dialog");
      selectSettingsSection("data");
      $("#lan-settings")?.closest("details")?.setAttribute("open", "");
    },
  });
  const backupSettings = installBackupSettings(ctx, dataPanel, {
    dialog,
    exports: backup,
  });
  const fileTransfer = installFileTransfer(ctx, dataPanel, {
    dialog,
    openDataSettings: () => {
      openDialog("settings-dialog");
      selectSettingsSection("data");
    },
  });

  const updateSettings = installUpdateSettings(ctx, dataPanel);
  const allTasks = installAllTasks(ctx, { dialog });
  installLicenseSettings(ctx, dataPanel, { dialog });
  for (const card of [...dataPanel.children].filter((node) =>
    node.matches("section"),
  )) {
    const disclosure = make("details", "settings-disclosure"),
      summary = make("summary"),
      copy = make("span", "settings-disclosure-copy"),
      hint = make("small", "aux-note");
    const heading = card.querySelector("h3");
    const [glyph, description] = card.matches(".lan-card")
      ? ["wifi", "ПК и телефон в одной сети"]
      : card.matches(".file-transfer-card")
        ? ["usb", "Передать файл по кабелю и объединить записи"]
        : card.matches(".backup-card")
          ? [
              "hard-drive-download",
              "Копия для восстановления и таблицы для анализа",
            ]
          : card.matches(".settings-wipe-card")
            ? ["trash-2", "Очистить только это устройство"]
            : card.matches(".update-card")
              ? ["download", "Проверка и установка новых версий"]
              : ["info", "Возможности и версия Orvim"];
    hint.textContent = description;
    copy.append(
      make("strong", "", heading?.textContent || "Копии и экспорт"),
      hint,
    );
    if (heading) heading.hidden = true;
    summary.append(icon(glyph), copy, icon("chevron-down"));
    card.before(disclosure);
    disclosure.append(summary, card);
    listen(disclosure, "toggle", () => ctx.fitDialog());
  }
  dataPanel.prepend(dataPanel.querySelector(".settings-panel-title"));
  for (const id of ["sleep-form", "food-form"]) {
    const panel = $("#" + id).closest("section.panel");
    panel.parentElement.prepend(panel);
    panel.classList.add("life-entry-panel");
  }
  connectionsPanel.append(make("h3", "settings-panel-title", "Подключения"));
  const connectionChoices = make("div", "settings-connection-choices");
  for (const [tab, name, description, glyph] of [
    [
      "ai",
      "ИИ-помощник",
      "OpenAI, DeepSeek или Gemini. API ключ и модель.",
      "sparkles",
    ],
    [
      "notion",
      "Импорт из сервисов",
      "Notion и другие JSON API. Выбор данных и предпросмотр.",
      "database",
    ],
    [
      "google",
      "Календари",
      "Google Calendar на ПК и системные календари Android.",
      "calendar-days",
    ],
  ]) {
    const button = action(
      "",
      (event) => {
        closeDialog();
        openConnections(event.currentTarget, tab);
      },
      "settings-connection-choice cursor-interaction",
    );
    button.dataset.settingsConnection = tab;
    const copy = make("span", "settings-card-copy");
    copy.append(
      make("strong", "", name),
      make("small", "aux-note", description),
    );
    button.append(icon(glyph), copy, icon("chevron-right"));
    connectionChoices.append(button);
  }
  connectionsPanel.append(connectionChoices);
  for (const [id, title, panel, glyph] of [
    ["appearance", "Оформление", appearancePanel, "palette"],
    ["notifications", "Уведомления", notificationsPanel, "bell"],
    ["data", "Данные", dataPanel, "hard-drive"],
    ["connections", "Подключения", connectionsPanel, "plug"],
  ]) {
    const button = action(
      "",
      () => selectSettingsSection(id),
      "cursor-interaction",
    );
    button.id = "settings-tab-" + id;
    button.dataset.settingsTab = id;
    button.setAttribute("role", "tab");
    button.setAttribute("aria-controls", "settings-panel-" + id);
    button.append(icon(glyph), make("span", "", title));
    panel.id = "settings-panel-" + id;
    panel.setAttribute("role", "tabpanel");
    panel.setAttribute("aria-labelledby", button.id);
    panel.tabIndex = 0;
    settingsTabs.append(button);
    settingsPanels.append(panel);
  }
  function selectSettingsSection(id) {
    settingsSection = id;
    for (const button of settingsTabs.children) {
      const selected = button.dataset.settingsTab === id;
      button.setAttribute("aria-selected", String(selected));
      button.tabIndex = selected ? 0 : -1;
    }
    for (const panel of settingsPanels.children)
      panel.hidden = panel.id !== "settings-panel-" + id;
    ctx.fitDialog();
  }
  listen(settingsTabs, "keydown", (event) => {
    const buttons = [...settingsTabs.children];
    const index = buttons.findIndex(
      (button) => button.dataset.settingsTab === settingsSection,
    );
    const offset = ["ArrowDown", "ArrowRight"].includes(event.key)
      ? 1
      : ["ArrowUp", "ArrowLeft"].includes(event.key)
        ? -1
        : 0;
    const next =
      event.key === "Home"
        ? 0
        : event.key === "End"
          ? buttons.length - 1
          : offset
            ? (index + offset + buttons.length) % buttons.length
            : -1;
    if (next < 0) return;
    event.preventDefault();
    selectSettingsSection(buttons[next].dataset.settingsTab);
    buttons[next].focus();
  });
  settingsLayout.append(settingsTabs, settingsPanels);
  settingsBody.append(settingsLayout);
  selectSettingsSection("appearance");

  // Related controls stay together inside each service's details.
  function connectionGroup(view, title, selectors) {
    const group = make("section", "connection-group");
    group.append(make("h3", "", title));
    for (const selector of selectors) {
      const node = view.querySelector(selector);
      if (node)
        group.append(
          node.matches("input,select") ? node.closest("label") : node,
        );
    }
    view.append(group);
    return group;
  }
  const aiView = connectionForm.querySelector('[data-connection-view="ai"]'),
    importView = connectionForm.querySelector(
      '[data-connection-view="notion"]',
    ),
    googleView = connectionForm.querySelector(
      '[data-connection-view="google"]',
    );
  connectionGroup(aiView, "Доступ", ["#ai-provider", "#ai-key"]);
  aiView.lastElementChild.append(
    $("#ai-key-save").closest(".connection-actions"),
  );
  const keyStatus = make("p", "connection-status");
  keyStatus.id = "ai-key-status";
  keyStatus.setAttribute("role", "status");
  aiView.lastElementChild.append(keyStatus);
  const keyHint = make(
    "p",
    "aux-note",
    "После сохранения поле ключа очищается. Это нормально: ключ хранится защищённо на устройстве. Затем загрузите модели и выберите одну.",
  );
  aiView.lastElementChild.append(keyHint);
  connectionGroup(aiView, "Модель", [
    "#ai-model",
    "#ai-model-options",
    "#ai-models-load",
  ]);
  const modelSelect = make("select");
  modelSelect.id = "ai-model-choice";
  modelSelect.hidden = true;
  modelSelect.setAttribute("aria-label", "Модель");
  $("#ai-model").closest("label").append(modelSelect);
  listen(modelSelect, "change", () => {
    $("#ai-model").value = modelSelect.value;
    connectionSettings().aiModel = modelSelect.value;
    persistState();
  });
  const verifyKey = action(
    "Проверить подключение",
    () => $("#ai-models-load").click(),
    "text-button",
  );
  verifyKey.id = "ai-key-test";
  keyStatus.before(verifyKey);
  Object.assign(ctx.translations, {
    "Проверить подключение": "Check connection",
    "Сохраняем ключ…": "Saving key…",
    "Ключ сохранён на устройстве.": "Key saved on this device.",
    "Ключ удалён.": "Key removed.",
    "Добавьте API ключ.": "Add an API key.",
    "Введите API ключ.": "Enter an API key.",
    "Выберите модель": "Choose a model",
    Провайдер: "Provider",
    "API ключ": "API key",
    Модель: "Model",
    "Проверяем подключение…": "Checking connection…",
    "Список моделей загружен. Выберите модель.":
      "Models loaded. Choose a model.",
    "После сохранения поле ключа очищается. Это нормально: ключ хранится защищённо на устройстве. Затем загрузите модели и выберите одну.":
      "The key field clears after saving. Your key is stored securely on this device. Load models and choose one next.",
    "В ключе не должно быть пробелов или переносов строк.":
      "The key must not contain spaces or line breaks.",
    "Не удалось подтвердить сохранение ключа. Повторите попытку.":
      "Could not verify key storage. Try again.",
  });
  aiView.append(aiView.querySelector(":scope > .aux-note"));
  connectionGroup(importView, "Источник и доступ", [
    "#import-provider",
    "#json-endpoint-label",
    "#import-key",
    "#import-key-save",
    "#import-key-delete",
  ]);
  connectionGroup(importView, "Что перенести", [
    "#notion-source-label",
    "#import-kind",
    "#import-fetch",
  ]);
  importView.append(importView.querySelector(":scope > .aux-note"));
  connectionGroup(googleView, "Аккаунт", [
    "#google-desktop",
    "#google-mobile",
    "#google-disconnect",
  ]);
  connectionGroup(googleView, "Обмен событиями", [
    "#google-calendar",
    ".field-row",
    ".connection-actions",
  ]);
  googleView.append(googleView.querySelector(":scope > .aux-note"));
  const connectionsBack = action(
    "← Настройки",
    (event) => {
      closeDialog();
      selectSettingsSection("connections");
      openDialog("settings-dialog", event.currentTarget);
    },
    "text-button connections-back",
  );
  connectionForm.querySelector(".dialog-head").after(connectionsBack);
  for (const view of connectionForm.querySelectorAll("[data-connection-view]"))
    view.classList.add("connection-section");

  Object.assign(ctx.translations, {
    "Завершённые дела": "Completed work",
    "Все проекты": "All projects",
    "Проект в архиве": "Project in archive",
    "Найти завершённое дело": "Find completed work",
    "Нет подходящих дел": "No matching entries",
    "Завершённые задачи и события появятся здесь.":
      "Completed tasks and events will appear here.",
    "Вернуть в работу": "Restore",
    "Показать ещё": "Show more",
    Событие: "Event",
    Задача: "Task",
    Оформление: "Appearance",
    "Разделы настроек": "Settings sections",
    Данные: "Data",
    Уведомления: "Notifications",
    Подключения: "Connections",
    "Экспорт статистики": "Export statistics",
    "Все записи и изображения в одном файле JSON.":
      "All entries and images in a single JSON file.",
    "Таблицы CSV для просмотра и анализа.":
      "CSV tables for viewing and analysis.",
    Восстановление: "Restore",
    "Выберите резервную копию. Перед заменой данных появится предпросмотр.":
      "Choose a backup. Preview the data before replacing it.",
    "ИИ-помощник": "AI assistant",
    "OpenAI, DeepSeek или Gemini. API ключ и модель.":
      "OpenAI, DeepSeek or Gemini. API key and model.",
    "Импорт из сервисов": "Import from services",
    "Notion и другие JSON API. Выбор данных и предпросмотр.":
      "Notion and other JSON APIs. Choose data and preview it.",
    Календари: "Calendars",
    "Google Calendar на ПК и системные календари Android.":
      "Google Calendar on desktop and Android device calendars.",
    Доступ: "Access",
    "Источник и доступ": "Source and access",
    "Что перенести": "Data to import",
    Аккаунт: "Account",
    "Обмен событиями": "Event sync",
    "← Настройки": "← Settings",
  });
  services.refreshIcons(settingsBody);

  function selectConnectionTab(selected) {
    for (const tab of connectionForm.querySelectorAll("[data-connection-tab]"))
      tab.setAttribute(
        "aria-pressed",
        String(tab.dataset.connectionTab === selected),
      );
    for (const view of connectionForm.querySelectorAll(
      "[data-connection-view]",
    ))
      view.hidden = view.dataset.connectionView !== selected;
    connectionStatus.textContent = "";
    if (selected === "ai") loadCredentialStatus();
    ctx.fitDialog();
  }
  function openConnections(opener, selected = "ai") {
    $("#ai-provider").value = connectionSettings().aiProvider || "openai";
    $("#ai-model").value = connectionSettings().aiModel || "";
    modelSelect.value = $("#ai-model").value;
    $("#notion-source-id").value = connectionSettings().notionSourceId || "";
    $("#json-endpoint").value = connectionSettings().jsonEndpoint || "";
    $("#google-desktop").hidden = services.mobile === true;
    $("#google-mobile").hidden = services.mobile !== true;
    const start = new Date();
    start.setDate(start.getDate() - 90);
    const until = new Date();
    until.setDate(until.getDate() + 365);
    $("#calendar-from").value = dateKey(start);
    $("#calendar-until").value = dateKey(until);
    selectConnectionTab(selected);
    openDialog("connections-dialog", opener);
  }
  for (const tab of connectionForm.querySelectorAll("[data-connection-tab]"))
    listen(tab, "click", () => {
      selectConnectionTab(tab.dataset.connectionTab);
    });
  function requireService() {
    if (!services.request || !services.credential)
      throw Error(
        "Подключения доступны в установленном приложении Windows / Android.",
      );
  }
  let credentialStatusRequest = 0;
  async function loadCredentialStatus() {
    const request = ++credentialStatusRequest,
      provider = $("#ai-provider").value;
    try {
      requireService();
      const result = await services.credential("status", provider);
      if (
        request !== credentialStatusRequest ||
        provider !== $("#ai-provider").value ||
        disposed
      )
        return;
      setStatus(
        connectionStatus,
        result.configured
          ? "Ключ сохранён на устройстве."
          : "Добавьте API ключ.",
      );
    } catch (error) {
      setStatus(connectionStatus, String(error), true);
    }
  }
  async function saveKey(provider, input) {
    requireService();
    if (!input.value.trim()) throw Error("Введите API ключ.");
    ++credentialStatusRequest;
    const value = input.value.trim();
    if (/\s/.test(value))
      throw Error("В ключе не должно быть пробелов или переносов строк.");
    setStatus(connectionStatus, "Сохраняем ключ…");
    await services.credential(
      "set",
      provider,
      value,
      provider === "json" ? $("#json-endpoint").value.trim() : undefined,
    );
    const result = await services.credential("status", provider);
    if (!result.configured)
      throw Error(
        "Не удалось подтвердить сохранение ключа. Повторите попытку.",
      );
    input.value = "";
    setStatus(connectionStatus, "Ключ сохранён на устройстве.");
  }
  function bindAsync(button, fn) {
    listen(button, "click", async () => {
      button.disabled = true;
      try {
        requireService();
        await fn();
      } catch (error) {
        setStatus(connectionStatus, String(error), true);
      } finally {
        if (!disposed) {
          button.disabled = false;
          ctx.fitDialog();
        }
      }
    });
  }
  bindAsync($("#ai-key-save"), () =>
    saveKey($("#ai-provider").value, $("#ai-key")),
  );
  bindAsync($("#ai-key-delete"), async () => {
    await services.credential("delete", $("#ai-provider").value);
    $("#ai-key").value = "";
    setStatus(connectionStatus, "Ключ удалён.");
  });
  listen($("#ai-provider"), "change", () => {
    connectionSettings().aiProvider = $("#ai-provider").value;
    connectionSettings().aiModel = "";
    $("#ai-model").value = "";
    $("#ai-key").value = "";
    modelSelect.replaceChildren();
    modelSelect.hidden = true;
    persistState();
    loadCredentialStatus();
  });
  listen($("#ai-model"), "change", () => {
    connectionSettings().aiModel = $("#ai-model").value.trim();
    persistState();
  });
  bindAsync($("#ai-models-load"), async () => {
    if ($("#ai-key").value.trim())
      await saveKey($("#ai-provider").value, $("#ai-key"));
    setStatus(connectionStatus, "Проверяем подключение…");
    const provider = $("#ai-provider").value;
    const result = await services.request({
      operation: "models",
      provider,
    });
    if (disposed || provider !== $("#ai-provider").value) return;
    $("#ai-model-options").replaceChildren();
    modelSelect.replaceChildren(make("option", "", "Выберите модель"));
    modelSelect.firstElementChild.value = "";
    const models = (result.models || []).filter(
      (model) =>
        provider !== "openai" ||
        (/^(gpt-|chatgpt-|o[1-9])/.test(model) &&
          !/audio|realtime|transcri|image|tts|search|codex/i.test(model)),
    );
    for (const model of models) {
      const option = make("option");
      option.value = model;
      $("#ai-model-options").append(option);
      const choice = make("option", "", model);
      choice.value = model;
      modelSelect.append(choice);
    }
    modelSelect.hidden = false;
    modelSelect.value = $("#ai-model").value;
    setStatus(connectionStatus, "Список моделей загружен. Выберите модель.");
  });
  listen($("#import-provider"), "change", () => {
    const json = $("#import-provider").value === "json";
    $("#notion-source-label").hidden = json;
    $("#json-endpoint-label").hidden = !json;
    $("#import-key").value = "";
    ctx.fitDialog();
  });
  bindAsync($("#import-key-save"), () =>
    saveKey($("#import-provider").value, $("#import-key")),
  );
  bindAsync($("#import-key-delete"), async () => {
    await services.credential("delete", $("#import-provider").value);
    setStatus(connectionStatus, "Ключ удалён.");
  });
  bindAsync($("#import-fetch"), async () => {
    const provider = $("#import-provider").value,
      settings = connectionSettings();
    settings.notionSourceId = $("#notion-source-id").value.trim();
    settings.jsonEndpoint = $("#json-endpoint").value.trim();
    persistState();
    setStatus(connectionStatus, "Получаем данные…");
    const source =
        provider === "notion" ? settings.notionSourceId : settings.jsonEndpoint,
      payload = await services.request({
        operation: "import",
        provider,
        source,
      });
    showImport(importRows(payload, $("#import-kind").value, provider, source));
  });
  async function listCalendars() {
    const result = await (services.mobile
      ? services.platform("calendarList", {})
      : services.request({ operation: "calendarList", provider: "google" }));
    const select = $("#google-calendar");
    select.replaceChildren();
    for (const calendar of result.items || []) {
      const option = make(
        "option",
        "",
        calendar.summary || calendar.name || calendar.id,
      );
      option.value = String(calendar.id);
      select.append(option);
    }
    if (
      [...select.options].some(
        (option) => option.value === connectionSettings().googleCalendarId,
      )
    )
      select.value = connectionSettings().googleCalendarId;
    setStatus(connectionStatus, "Календарь подключён.");
  }
  bindAsync($("#google-connect"), async () => {
    await services.googleLogin(
      $("#google-client-id").value.trim(),
      $("#google-client-secret").value.trim(),
    );
    $("#google-client-secret").value = "";
    await listCalendars();
  });
  bindAsync($("#google-device-connect"), async () => {
    await services.platform("calendarPermission", {});
    await listCalendars();
  });
  listen($("#google-calendar"), "change", () => {
    connectionSettings().googleCalendarId = $("#google-calendar").value;
    persistState();
  });
  function calendarRequest() {
    const calendarId = $("#google-calendar").value || "primary",
      from = $("#calendar-from").value,
      until = $("#calendar-until").value;
    if (!from || !until || until < from)
      throw Error("Укажите период календаря.");
    connectionSettings().googleCalendarId = calendarId;
    persistState();
    return { calendarId, from, until };
  }
  bindAsync($("#google-pull"), async () => {
    const args = calendarRequest();
    setStatus(connectionStatus, "Получаем события…");
    const result = await (services.mobile
      ? services.platform("calendarRead", args)
      : services.request({
          operation: "calendarRead",
          provider: "google",
          ...args,
        }));
    showImport(
      importRows(
        result,
        "events",
        services.mobile ? "android-calendar" : "google",
        args.calendarId,
      ),
    );
  });
  bindAsync($("#google-push"), async () => {
    const args = calendarRequest(),
      provider = services.mobile ? "android-calendar" : "google",
      items = [
        ...events,
        ...tasks.filter(
          (item) =>
            item.source &&
            ["google", "android-calendar"].includes(item.source.provider),
        ),
      ]
        .filter(
          (item) =>
            item.date >= args.from &&
            item.date <= args.until &&
            (!item.source ||
              (item.source.provider === provider &&
                item.source.connection === args.calendarId)),
        )
        .filter((item) => !item.source?.multiDay)
        .filter(
          (item) =>
            !item.source?.signature ||
            signature(item) !== item.source.signature,
        );
    const deletions = state.calendarDeleted.filter(
      (item) =>
        item.source.provider === provider &&
        item.source.connection === args.calendarId,
    );
    if (!items.length && !deletions.length) {
      setStatus(
        connectionStatus,
        "Изменений для отправки нет. Многодневные и повторяющиеся серии редактируйте в Google Calendar.",
      );
      return;
    }
    const result = await (services.mobile
      ? services.platform("calendarWrite", { ...args, items, deletions })
      : services.request({
          operation: "calendarWrite",
          provider: "google",
          ...args,
          items,
          deletions,
        }));
    for (const saved of result.saved || []) {
      const item = [...events, ...tasks].find(
        (row) => row.id === saved.localId,
      );
      if (item) {
        item.source = {
          provider,
          connection: args.calendarId,
          id: String(saved.id),
          etag: saved.etag || null,
        };
        item.source.signature = signature(item);
      }
    }
    for (const removed of result.deleted || []) {
      const index = state.calendarDeleted.findIndex(
        (item) =>
          item.source.id === String(removed) &&
          item.source.connection === args.calendarId,
      );
      if (index >= 0) state.calendarDeleted.splice(index, 1);
    }
    persistState();
    setStatus(
      connectionStatus,
      `Сохранено событий: ${(result.saved || []).length}. ${result.errors?.length ? "Не отправлено: " + result.errors.length + ". " + result.errors.join("; ") : ""}`,
      Boolean(result.errors?.length),
    );
  });
  bindAsync($("#google-disconnect"), async () => {
    await services.credential("delete", "google");
    await services.credential("delete", "google-refresh");
    setStatus(
      connectionStatus,
      "Подключение отключено. Импортированные события остаются в Orvim.",
    );
  });

  const importForm = dialog("import-preview-dialog", "Предпросмотр импорта"),
    importCount = make("p", "aux-note"),
    importList = make("div", "import-preview-list"),
    importApply = action(
      "Применить импорт",
      () => {
        if (!pendingImport) return;
        try {
          const before = ctx.snapshotData(),
            snapshot = {
              data: before,
              covers: ctx.backupCovers?.() || ctx.documentSnapshot().covers,
            };
          const merged = mergeImport(snapshot, pendingImport);
          ctx.validateBackup({
            format: "life-os-backup",
            schemaVersion: 1,
            ...merged.snapshot,
          });
          undoImport = structuredClone(snapshot);
          ctx.applyBackup({
            data: merged.snapshot.data,
            covers: merged.snapshot.covers,
          });
          pendingImport = null;
          closeDialog();
          setStatus(
            connectionStatus,
            `Добавлено: ${merged.counts.added}, обновлено: ${merged.counts.updated}, сохранены ваши изменения: ${merged.counts.conflicts}.`,
          );
          $("#import-undo").hidden = false;
        } catch (error) {
          importCount.textContent = String(error);
        }
      },
      "button button-primary",
    );
  importForm.append(
    importCount,
    importList,
    importApply,
    action("Отмена", closeDialog),
  );
  const importUndo = action(
    "Отменить импорт",
    () => {
      if (undoImport) {
        ctx.applyBackup(undoImport);
        undoImport = null;
        importUndo.hidden = true;
        setStatus(connectionStatus, "Импорт отменён.");
      }
    },
    "text-button",
  );
  importUndo.id = "import-undo";
  importUndo.hidden = true;
  connectionForm.append(importUndo);
  function showImport(rows) {
    pendingImport = rows;
    importList.replaceChildren();
    importCount.textContent = `Записей: ${rows.length}. События без времени сохраняются как задачи.`;
    for (const row of rows.slice(0, 300)) {
      const item = make("div", "import-preview-row");
      item.dataset.userContent = "true";
      item.append(
        make("strong", "", row.title),
        make(
          "small",
          "",
          row.skip
            ? row.reason
            : row.remove
              ? "Удалено в источнике"
              : row.record.date || row.kind,
        ),
      );
      importList.append(item);
    }
    if (rows.length > 300)
      importList.append(
        make(
          "p",
          "aux-note",
          "Показаны первые 300 записей; импортируется весь список.",
        ),
      );
    closeDialog();
    openDialog("import-preview-dialog", $("#import-fetch"));
  }

  const assistant = installAssistant(ctx, {
    dialog,
    icon,
    setStatus,
    openConnections,
    requireService,
  });
  for (const node of all('[data-page="archive"]')) {
    node.setAttribute("aria-label", "База данных");
    node.setAttribute("data-tooltip", "База данных");
  }
  renderExercises();
  renderRating();
  renderFinanceSummary();
  renderThoughts();
  renderHomeThoughts();
  function rehydrate() {
    if (!["board", "list"].includes(state.projectView))
      state.projectView = "board";
    for (const item of state.thoughts) item.context = "Личное";
    thoughtFeed.rehydrate();
    renderExercises();
    renderRating();
    renderFinanceSummary();
    renderThoughts();
    renderHomeThoughts();
    stopNotificationPreview();
    refreshNotificationSettings();
  }
  return {
    rehydrate,
    resetToday() {
      const day = ctx.dateKey(new Date());
      month.value = day.slice(0, 7);
      year.value = day.slice(0, 4);
      from.value = day.slice(0, 7) + "-01";
      until.value = day;
      selectedFinanceCategory = null;
    },
    renderThoughts,
    renderHomeThoughts,
    renderProjectViews,
    renderCompleted,
    renderFinances,
    financePeriod,
    renderFinanceSummary,
    categoryNames,
    rememberExercise,
    renderRating,
    stars,
    openThought,
    flushThoughts: thoughtFeed.flush,
    thoughtMetadata: thoughtFeed.metadata,
    openFinance,
    dispose() {
      assistant.dispose();
      lanSettings.dispose();
      fileTransfer.dispose();
      backupSettings.dispose();

      updateSettings.dispose();
      allTasks.dispose();
      stopNotificationPreview();
      thoughtFeed.dispose();
      disposed = true;
      for (const timer of notices) clearTimeout(timer);
      window.removeEventListener(
        "life-os:reminder-status",
        notificationListener,
      );
      window.removeEventListener("life-os:notification", notificationClick);
      pendingAi = null;
      pendingImport = null;
      chatHistory = [];
    },
  };
}
