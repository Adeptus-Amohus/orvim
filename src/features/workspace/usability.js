// Shared interaction rules. Preferences live in the existing local document.
import {
  foodPortion,
  foodNumbers,
  searchFragment,
} from "./experience-model.js";
import { highlightText } from "./search-highlight.js";
import { revealInDialog, isTextEntry } from "./interactions.js";
import { lifeSettings, stampLifeRecord } from "./life-tracking-model.js";
export function installUsability(ctx) {
  const { root, $, all, make, listen, action, extraState: state } = ctx;
  if (!Array.isArray(state.uiPreferences.lifeOrder))
    state.uiPreferences.lifeOrder = ["sleep", "food", "finances", "training"];
  if (!Array.isArray(state.uiPreferences.lifeHidden))
    state.uiPreferences.lifeHidden = [];
  let noticeTimer,
    pendingUndo = null;
  const t = (ru, en) => ctx.translate(ru, en);
  const homeActions = make("div", "home-task-actions");
  for (const id of ["all-tasks-open", "templates-open"]) {
    const button = $("#" + id);
    if (button) homeActions.append(button);
  }
  $(".tasks").append(homeActions);
  const notice = make("div", "global-notice");
  notice.hidden = true;
  notice.setAttribute("role", "status");
  const noticeText = make("span"),
    undo = action(
      "Отменить",
      () => {
        const callback = pendingUndo;
        pendingUndo = null;
        notice.hidden = true;
        ctx.clearTimeout(noticeTimer);
        callback?.();
        ctx.persistState();
      },
      "text-button",
    );
  notice.append(noticeText, undo);
  root.append(notice);
  function notify(message, callback) {
    if (!callback && /^(Сохранено|Saved|Сақталды)/.test(message)) {
      ctx.persistState();
      void ctx.services.flush().then(
        () => {
          if (!pendingUndo || notice.hidden) showNotice(message);
        },
        (error) => showNotice(String(error)),
      );
      return;
    }
    showNotice(message, callback);
  }
  function showNotice(message, callback) {
    ctx.clearTimeout(noticeTimer);
    noticeText.textContent = message;
    undo.textContent = t("Отменить", "Undo");
    undo.hidden = !callback;
    pendingUndo = callback;
    notice.dataset.undoable = String(Boolean(callback));
    const quiet =
      !callback &&
      /^(Сохранено|Saved|Сақталды|Записано|Еда добавлена|Food added|Добавлено|Updated|Обновлено)/i.test(
        message,
      );
    notice.dataset.quiet = String(quiet);
    notice.hidden = false;
    noticeTimer = ctx.setTimeout(
      () => {
        if (notice.contains(document.activeElement)) return;
        pendingUndo = null;
        notice.hidden = true;
      },
      callback ? 8000 : quiet ? 2200 : 5000,
    );
  }
  function dialog(id, title) {
    const overlay = make("div", "overlay");
    overlay.id = id;
    overlay.hidden = true;
    const body = make("div", "dialog");
    body.setAttribute("role", "dialog");
    body.setAttribute("aria-modal", "true");
    body.setAttribute("aria-labelledby", id + "-title");
    const head = make("div", "dialog-head"),
      heading = make("h2", "", title);
    heading.id = id + "-title";
    const close = action("×", ctx.closeDialog, "close");
    close.setAttribute("aria-label", "Закрыть");
    head.append(heading, close);
    body.append(head);
    overlay.append(body);
    root.append(overlay);
    listen(overlay, "click", (event) => {
      if (event.target === overlay) ctx.closeDialog();
    });
    return body;
  }
  function iconButton(glyph, label, callback) {
    const button = action("", callback, "button icon-button");
    button.setAttribute("aria-label", label);
    button.dataset.tooltip = label;
    const icon = make("i");
    icon.dataset.lucide = glyph;
    icon.setAttribute("aria-hidden", "true");
    button.append(icon);
    return button;
  }

  // Progressive forms retain visible date/time and an explicit save destination.
  const formSummaries = new Map();
  for (const prefix of ["capture", "task", "event"]) {
    const form = $("#" + prefix + "-form"),
      details = make("details", "form-extra simple-details");
    details.append(make("summary", "cursor-interaction", "Подробнее"));
    const old = form.querySelector("details.form-extra");
    if (old) {
      for (const child of [...old.children])
        if (child.tagName !== "SUMMARY") details.append(child);
      old.remove();
    }
    const context = $(
      "#" + (prefix === "capture" ? "project-field" : prefix + "-context"),
    );
    if (prefix === "capture") {
      details.prepend($(".dest-label"), $(".destinations"), context);
      details.append($("#capture-save-template").closest("label"));
    } else details.prepend(context.closest("label"));
    const repeat = form.querySelector(".repeat-fields");
    if (repeat) details.append(repeat);
    if (prefix === "event") details.append(form.querySelector(".tone-field"));
    // Keep summary first after moving controls above.
    details.prepend(details.querySelector("summary"));
    form.querySelector(".dialog-actions").before(details);
    const summary = make("p", "save-destination");
    summary.dataset.userContent = "";
    form.querySelector(".dialog-actions").before(summary);
    formSummaries.set(prefix, summary);
    listen(form, "input", () => updateDestination(prefix));
    listen(form, "change", () => updateDestination(prefix));
  }
  function updateDestination(prefix) {
    const context =
      prefix === "capture"
        ? $('[data-dest="project"]').getAttribute("aria-pressed") === "true"
          ? $("#capture-project").value
          : t("Личное", "Personal")
        : $("#" + prefix + "-context").value;
    const day = $("#" + prefix + "-date").value;
    const time = $(
      "#" + prefix + (prefix === "event" ? "-start" : "-time"),
    ).value;
    const where =
      prefix === "event" || time
        ? t("Расписание", "Schedule")
        : t("Задачи", "Tasks");
    formSummaries.get(prefix).textContent = [
      t("Сохранить в: ", "Save to: ") + where,
      context || t("Выберите проект", "Choose a project"),
      day ? ctx.shortDate(day) : "",
      time,
    ]
      .filter(Boolean)
      .join(" · ");
  }
  listen(root, "click", (event) => {
    if (event.target.closest("[data-dest]")) updateDestination("capture");
  });

  const proposalHost = make("div", "natural-proposal"),
    proposalText = make("span"),
    proposalCancel = action(
      "×",
      () => {
        ignoredText = capture.value;
        if (originalDate !== null) $("#capture-date").value = originalDate;
        if (originalTime !== null) $("#capture-time").value = originalTime;
        proposal = null;
        proposalHost.hidden = true;
        updateDestination("capture");
      },
      "close",
    );
  proposalCancel.setAttribute("aria-label", "Не распознавать дату и время");
  proposalHost.hidden = true;
  proposalHost.append(proposalText, proposalCancel);
  const capture = $("#capture-text");
  capture.placeholder = "Например: тренировка завтра в 19:00";
  capture.closest("label").after(proposalHost);
  let proposal = null,
    ignoredText = "",
    originalDate = null,
    originalTime = null,
    dateManual = false,
    timeManual = false;
  for (const field of ["date", "time"])
    listen($("#capture-" + field), "input", () => {
      if (field === "date") dateManual = true;
      else timeManual = true;
    });
  listen(capture, "input", () => {
    proposal =
      capture.value === ignoredText
        ? null
        : parseTaskInput(capture.value, new Date(), ctx.dateKey);
    if (proposal) {
      if (originalDate === null) originalDate = $("#capture-date").value;
      if (originalTime === null) originalTime = $("#capture-time").value;
      if (!dateManual) $("#capture-date").value = proposal.date || originalDate;
      if (!timeManual) $("#capture-time").value = proposal.time || originalTime;
      proposalText.textContent =
        t("Распознано: ", "Recognized: ") +
        [proposal.date && ctx.shortDate(proposal.date), proposal.time]
          .filter(Boolean)
          .join(" · ");
    } else {
      if (!dateManual && originalDate !== null)
        $("#capture-date").value = originalDate;
      if (!timeManual && originalTime !== null)
        $("#capture-time").value = originalTime;
    }
    proposalHost.hidden = !proposal;
    updateDestination("capture");
  });
  listen(
    $("#capture-form"),
    "submit",
    () => {
      if (proposal?.title) capture.value = proposal.title;
    },
    true,
  );

  // One search works across all local collections. Results are bounded.
  const searchBody = dialog("search-dialog", "Поиск"),
    search = make("input", "global-search-input"),
    results = make("div", "search-results");
  search.type = "search";
  search.placeholder = "Задачи, мысли, проекты и записи";
  search.setAttribute("aria-label", "Поиск по Orvim");
  results.setAttribute("aria-live", "polite");
  searchBody.append(search, results);
  const searchButton = iconButton("search", "Поиск", (event) =>
    openSearch(event.currentTarget),
  );
  $(".header-actions").prepend(searchButton);
  function openSearch(opener) {
    search.value = "";
    renderSearch();
    ctx.openDialog("search-dialog", opener);
    search.focus();
  }
  let searchTimer;
  listen(search, "input", () => {
    ctx.clearTimeout(searchTimer);
    searchTimer = ctx.setTimeout(renderSearch, 140);
  });
  listen(document, "keydown", (event) => {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
      event.preventDefault();
      if (ctx.hasDialog()) ctx.closeDialog();
      openSearch(searchButton);
    }
  });
  listen(search, "keydown", (event) => {
    if (event.key === "ArrowDown" || event.key === "Enter") {
      event.preventDefault();
      if (event.key === "Enter") results.querySelector("button")?.click();
      else results.querySelector("button")?.focus();
    }
  });
  function renderSearch() {
    results.replaceChildren();
    const query = search.value.trim().toLocaleLowerCase(ctx.displayLocale());
    if (!query) {
      results.append(
        make(
          "p",
          "aux-note",
          t(
            "Введите название или часть текста. На ПК: Ctrl+K.",
            "Enter a title or text. Desktop: Ctrl+K.",
          ),
        ),
      );
      return;
    }
    let count = 0;
    const data = ctx.snapshotData();
    for (const [kind, collection, label] of [
      ["task", "tasks", t("Задача", "Task")],
      ["event", "events", t("Событие", "Event")],
      ["thought", "thoughts", t("Мысль", "Thought")],
      ["project", "projects", t("Проект", "Project")],
      ["database", "archiveItems", t("Запись", "Entry")],
    ]) {
      for (const item of data[collection]) {
        if (
          ![
            item.title,
            item.name,
            item.body,
            item.description,
            item.review,
            item.context,
            item.category,
          ]
            .filter(Boolean)
            .join(" ")
            .toLocaleLowerCase(ctx.displayLocale())
            .includes(query)
        )
          continue;
        count++;
        if (count > 60) continue;
        const result = action(
          "",
          (event) => {
            ctx.closeDialog();
            if (kind === "thought")
              ctx.openThought(item, false, search.value.trim());
            else if (kind === "database")
              ctx.openDatabaseView(item, searchButton);
            else if (kind === "project") ctx.openMaterialOwner(kind, item);
            else {
              ctx.editEntity(kind, item, searchButton);
              const description = $("#" + kind + "-description");
              const index =
                description?.value
                  .toLocaleLowerCase()
                  .indexOf(search.value.trim().toLocaleLowerCase()) ?? -1;
              if (index >= 0) {
                description.closest("details").open = true;
                description.focus();
                description.setSelectionRange(
                  index,
                  index + search.value.trim().length,
                );
              }
            }
          },
          "search-result",
        );
        const title = make("strong", "", item.title || item.name),
          meta = make(
            "small",
            "",
            [
              label,
              item.done && t("Завершено", "Completed"),
              item.date && ctx.shortDate(item.date),
            ]
              .filter(Boolean)
              .join(" · "),
          );
        title.dataset.userContent = "";
        result.append(title, meta);
        const body = item.body || item.description || item.review;
        if (body) {
          const snippet = make("span", "search-fragment");
          snippet.dataset.userContent = "";
          highlightText(
            snippet,
            searchFragment(body, search.value.trim()),
            search.value.trim(),
          );
          result.append(snippet);
        }
        results.append(result);
      }
    }
    if (!count)
      results.append(
        make(
          "p",
          "aux-note",
          t(
            "Ничего не найдено. Попробуйте другое слово.",
            "No matches. Try another word.",
          ),
        ),
      );
    if (count > 60)
      results.append(
        make(
          "p",
          "aux-note",
          t(
            "Показаны первые 60 результатов. Уточните поиск.",
            "Showing the first 60 results. Refine your search.",
          ),
        ),
      );
  }

  // A named action list is equally usable with a mouse, keyboard, or touch.
  const actionsBody = dialog("item-actions-dialog", "Действия"),
    actionList = make("div", "entity-actions");
  actionsBody.append(actionList);
  function itemMenu(kind, item, opener) {
    actionList.replaceChildren();
    $("#item-actions-dialog-title").textContent =
      item.title || item.name || t("Запись", "Entry");
    $("#item-actions-dialog-title").dataset.userContent = "";
    for (const [label, callback] of [
      [t("Изменить", "Edit"), () => ctx.editEntity(kind, item, opener)],
      [
        t("Перенести", "Move"),
        () => {
          ctx.editEntity(kind, item, opener);
          ctx.focusEntityDestination(kind);
        },
      ],
      [
        t("Дублировать", "Duplicate"),
        () => ctx.duplicateEntity(kind, item, opener),
      ],
      [t("Удалить", "Delete"), () => ctx.deleteEntity(kind, item)],
    ]) {
      const button = action(
        label,
        () => {
          ctx.closeDialog();
          callback();
        },
        "button",
      );
      if (label === t("Удалить", "Delete"))
        button.classList.add("button-danger");
      actionList.append(button);
    }
    ctx.openDialog("item-actions-dialog", opener);
  }

  // Life overview: editable order and visibility without discarding logs.
  const lifeCustomize = dialog("life-customize-dialog", "Карточки Жизни"),
    lifeOptions = make("div", "life-card-options");
  lifeCustomize.append(
    make(
      "p",
      "aux-note",
      "Скрытые карточки можно вернуть. Записи сохраняются.",
    ),
    lifeOptions,
  );
  const prefsButton = action(
    t("Настроить карточки", "Customize cards"),
    (event) => {
      renderLifeOptions();
      ctx.openDialog("life-customize-dialog", event.currentTarget);
    },
    "text-button life-customize-button",
  );
  $("#life-overview").before(prefsButton);
  const settingsButton = action(
    "Карточки Жизни",
    (event) => {
      ctx.closeDialog();
      renderLifeOptions();
      ctx.openDialog("life-customize-dialog", event.currentTarget);
    },
    "button",
  );
  $("#settings-panel-appearance").append(settingsButton);
  const lifeLabels = {
    sleep: ["Сон", "Sleep"],
    food: ["Питание", "Food"],
    finances: ["Финансы", "Finances"],
    training: ["Тренировки", "Training"],
  };
  function lifeOrder() {
    return [
      ...new Set([
        ...(state.uiPreferences.lifeOrder || []).filter((key) =>
          Object.hasOwn(lifeLabels, key),
        ),
        ...Object.keys(lifeLabels),
      ]),
    ];
  }
  function applyLifeLayout() {
    const orbit = $("#life-overview"),
      order = lifeOrder(),
      hidden = state.uiPreferences.lifeHidden || [];
    let position = 0;
    for (const key of order) {
      const card = orbit.querySelector('[data-life-tab="' + key + '"]');
      card.hidden = hidden.includes(key);
      card.dataset.position = String(card.hidden ? -1 : position++);
      orbit.append(card);
    }
    orbit.append($("#life-checkin-open"));
    orbit.dataset.visibleCards = String(position);
  }
  function renderLifeOptions() {
    lifeOptions.replaceChildren();
    const order = lifeOrder();
    order.forEach((key, index) => {
      const row = make("div", "life-option-row"),
        label = make("label", "inline-choice"),
        input = make("input");
      input.type = "checkbox";
      input.checked = !(state.uiPreferences.lifeHidden || []).includes(key);
      label.append(input, make("span", "", t(...lifeLabels[key])));
      listen(input, "change", () => {
        state.uiPreferences.lifeHidden = order.filter((name) =>
          name === key
            ? !input.checked
            : (state.uiPreferences.lifeHidden || []).includes(name),
        );
        applyLifeLayout();
        ctx.persistState();
      });
      row.append(label);
      for (const [symbol, offset, text] of [
        ["↑", -1, t("Выше", "Move up")],
        ["↓", 1, t("Ниже", "Move down")],
      ]) {
        const move = action(
          symbol,
          () => {
            [order[index], order[index + offset]] = [
              order[index + offset],
              order[index],
            ];
            state.uiPreferences.lifeOrder = order;
            applyLifeLayout();
            renderLifeOptions();
            ctx.persistState();
          },
          "button",
        );
        move.disabled = index + offset < 0 || index + offset >= order.length;
        move.setAttribute("aria-label", text + ": " + t(...lifeLabels[key]));
        row.append(move);
      }
      lifeOptions.append(row);
    });
  }

  // Archive is a database subview, not an extra main navigation destination.
  all(
    '.nav [data-page="completed"],.mobile-nav [data-page="completed"]',
  ).forEach((button) => button.remove());
  const databaseTabs = make("div", "segments database-tabs");
  databaseTabs.hidden = true;
  for (const [page, label] of [
    ["archive", "Коллекции"],
    ["completed", "Архив"],
  ]) {
    const button = action(label, () => ctx.showPage(page));
    button.dataset.databaseView = page;
    databaseTabs.append(button);
  }
  $(".header").after(databaseTabs);
  const categoryEdit = iconButton("pencil", "Изменить коллекцию", (event) =>
      ctx.editCollection(event.currentTarget),
    ),
    categoryDelete = iconButton("trash-2", "Удалить коллекцию", (event) =>
      ctx.deleteCollection(event.currentTarget),
    );
  const collectionMenu = make("details", "collection-menu"),
    collectionMenuSummary = make("summary", "button icon-button"),
    collectionMenuIcon = make("i"),
    collectionMenuBody = make("div", "collection-menu-body");
  collectionMenuSummary.setAttribute("aria-label", "Меню коллекции");
  collectionMenuIcon.dataset.lucide = "ellipsis";
  collectionMenuIcon.setAttribute("aria-hidden", "true");
  collectionMenuSummary.append(collectionMenuIcon);
  for (const [node, label] of [
    [categoryEdit, "Изменить коллекцию"],
    [categoryDelete, "Удалить коллекцию"],
  ]) {
    node.append(make("span", "", label));
    listen(node, "click", () => {
      collectionMenu.open = false;
    });
  }
  collectionMenuBody.append(categoryEdit, categoryDelete);
  collectionMenu.append(collectionMenuSummary, collectionMenuBody);
  $("#archive-item-add").before(collectionMenu);
  const addEntry = $("#archive-item-add");
  addEntry.className = "button button-primary db-add-entry cursor-interaction";
  addEntry.textContent = "+ Добавить запись";
  listen(root, "click", (event) => {
    if (!collectionMenu.contains(event.target)) collectionMenu.open = false;
  });
  listen(collectionMenu, "keydown", (event) => {
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      collectionMenu.open = false;
      collectionMenuSummary.focus();
    }
  });
  const collectionField = ctx.fieldControl(
    "Коллекция",
    "archive-item-collection",
    "text",
    "select",
  );
  $("#archive-item-name").closest("label").after(collectionField.field);
  const collectionConfirmation = dialog(
      "collection-delete-dialog",
      "Удалить коллекцию?",
    ),
    collectionDeleteText = make("p", "collection-delete-copy"),
    collectionDeleteActions = make("div", "dialog-actions");
  collectionDeleteText.dataset.userContent = "";
  let confirmDelete = null;
  collectionDeleteActions.append(
    action("Отмена", ctx.closeDialog),
    action(
      "Удалить",
      () => {
        const callback = confirmDelete;
        confirmDelete = null;
        ctx.closeDialog();
        callback?.();
      },
      "button button-danger",
    ),
  );
  collectionConfirmation.append(collectionDeleteText, collectionDeleteActions);
  function confirmCollection(name, count, opener, callback) {
    confirmDelete = callback;
    collectionDeleteText.textContent =
      t("Коллекция «", "Collection “") +
      name +
      t(
        "» и её записи будут удалены: ",
        "” and its entries will be deleted: ",
      ) +
      count +
      t(". Удаление можно отменить.", ". You can undo deletion.");
    ctx.openDialog("collection-delete-dialog", opener);
  }

  const foodBody = dialog("food-edit-dialog", "Изменить запись"),
    foodForm = make("form"),
    foodFields = {};
  foodForm.id = "food-edit-form";
  for (const [key, label, type] of [
    ["name", "Название", "text"],
    ["date", "Дата", "date"],
    ["calories", "Калории", "number"],
    ["protein", "Белки, г", "number"],
    ["fat", "Жиры, г", "number"],
    ["carbs", "Углеводы, г", "number"],
  ]) {
    const field = ctx.fieldControl(label, "food-edit-" + key, type);
    field.input.required = true;
    if (type === "number") {
      field.input.min = "0";
      field.input.max = key === "calories" ? "10000" : "1000";
      field.input.step = "0.01";
    }
    foodFields[key] = field.input;
    foodForm.append(field.field);
  }
  let editingFood = null;
  const foodBasisField = ctx.fieldControl(
      "Значения",
      "food-edit-basis",
      "",
      "select",
    ),
    foodGramsField = ctx.fieldControl(
      "Вес порции, г",
      "food-edit-grams",
      "number",
    );
  for (const [value, label] of [
    ["portion", "Порция"],
    ["100g", "На 100 г"],
  ]) {
    const option = make("option", "", label);
    option.value = value;
    foodBasisField.input.append(option);
  }
  Object.assign(foodGramsField.input, {
    min: "0.1",
    max: "10000",
    step: "0.1",
    inputMode: "decimal",
  });
  foodFields.calories
    .closest("label")
    .before(foodBasisField.field, foodGramsField.field);
  const foodPreview = make("p", "aux-note portion-preview");
  foodGramsField.field.after(foodPreview);
  function foodPortionPreview() {
    foodGramsField.input.required = foodBasisField.input.value === "100g";
    foodPreview.textContent =
      foodGramsField.input.required && foodGramsField.input.value
        ? foodPortion(
            Object.fromEntries(
              foodNumbers.map((key) => [key, Number(foodFields[key].value)]),
            ),
            Number(foodGramsField.input.value),
            "100g",
          ).calories +
          " " +
          t("ккал в порции", "kcal per portion")
        : "";
  }
  listen(foodForm, "input", foodPortionPreview);
  listen(foodForm, "change", foodPortionPreview);
  const foodActions = make("div", "dialog-actions"),
    foodSave = make("button", "button button-primary", "Сохранить");
  foodSave.type = "submit";
  const foodDelete = action(
    "Удалить запись",
    () => {
      if (!editingFood || !ctx.foodLogs.includes(editingFood)) return;
      const item = editingFood;
      ctx.closeDialog();
      ctx.deleteEntity("food", item);
    },
    "text-button button-danger",
  );
  foodDelete.id = "food-edit-delete";
  foodActions.append(foodDelete, action("Отмена", ctx.closeDialog), foodSave);
  foodForm.append(foodActions);
  foodBody.append(foodForm);
  function editFood(item, opener) {
    editingFood = item;
    for (const [key, input] of Object.entries(foodFields))
      input.value = String(
        foodNumbers.includes(key)
          ? (item.nutritionBase?.[key] ?? item[key] ?? 0)
          : (item[key] ?? ""),
      );
    foodBasisField.input.value = item.nutritionBasis || "portion";
    foodGramsField.input.value = item.grams ?? "";
    const tracking = lifeSettings(ctx.extraState).nutrition;
    for (const key of foodNumbers)
      foodFields[key].closest("label").hidden = !(key === "calories"
        ? tracking.calories
        : tracking.macros);
    foodPortionPreview();
    ctx.openDialog("food-edit-dialog", opener);
    foodFields.name.focus();
  }
  listen(foodForm, "submit", (event) => {
    event.preventDefault();
    if (!editingFood || !ctx.foodLogs.includes(editingFood)) return;
    if (!foodForm.reportValidity() || !foodFields.name.value.trim()) return;
    const base = Object.fromEntries(
      foodNumbers.map((key) => [key, Number(foodFields[key].value)]),
    );
    const portion = foodPortion(
      base,
      Number(foodGramsField.input.value) || 100,
      foodBasisField.input.value,
    );
    if (
      foodNumbers.some(
        (key) => portion[key] > (key === "calories" ? 10000 : 1000),
      )
    ) {
      foodPreview.textContent = t(
        "Слишком большая порция. Проверьте значения.",
        "Portion is too large. Check the values.",
      );
      return;
    }
    if (editingFood.date !== foodFields.date.value)
      delete editingFood.occurredAt;
    Object.assign(editingFood, portion, {
      name: foodFields.name.value.trim(),
      date: foodFields.date.value,
      nutritionBase: base,
      nutritionBasis: foodBasisField.input.value,
    });
    stampLifeRecord(editingFood, ctx.extraState, "foodLogs");
    if (foodGramsField.input.value)
      editingFood.grams = Number(foodGramsField.input.value);
    else delete editingFood.grams;
    $("#food-day").value = editingFood.date;
    ctx.closeDialog();
    ctx.renderFood();
    ctx.persistState();
    notify(t("Сохранено", "Saved"));
  });

  // Returning to today restores the six-hour window around the current time.
  const now = action("Сейчас", ctx.goToNow, "button calendar-now");
  now.setAttribute("aria-label", "Вернуться к текущему времени");
  now.dataset.tooltip = "Вернуться к текущему времени";
  $(".calendar-tools").prepend(now);
  function updateNowButton() {
    const data = ctx.snapshotData(),
      current = new Date(),
      centered = Math.max(
        0,
        Math.min(23.9, current.getHours() + current.getMinutes() / 60 - 3),
      );
    const atCurrentTime =
      data.selectedDate === ctx.dateKey(current) &&
      data.range === "six" &&
      Math.abs(Number($("#window-range").value) - centered) < 0.4;
    // Reserve the same width during native scrolling and slider updates.
    now.hidden = false;
    now.dataset.away = String(!atCurrentTime);
  }
  listen($("#timeline-window"), "scroll", updateNowButton, { passive: true });
  listen(root, "click", (event) => {
    if (event.target.closest(".calendar-tools,.period-nav,.calendar-now"))
      ctx.setTimeout(updateNowButton, 0);
  });
  listen($("#window-range"), "input", updateNowButton);
  function pageChanged(page) {
    databaseTabs.hidden = !["archive", "completed"].includes(page);
    if (page === "completed") {
      $("#page-title").textContent = t("База данных", "Database");
      all('[data-page="archive"]').forEach((button) =>
        button.setAttribute("aria-current", "page"),
      );
    }
    for (const button of databaseTabs.children)
      button.setAttribute(
        "aria-pressed",
        String(button.dataset.databaseView === page),
      );
    prefsButton.hidden = page !== "life" || $("#life-overview").hidden;
    categoryEdit.disabled = categoryDelete.disabled = !ctx.selectedCollection();
    applyLifeLayout();
    updateNowButton();
  }
  const monthlySummary = make("p", "month-observation");
  monthlySummary.dataset.userContent = "";
  $("#life-mood-view").prepend(monthlySummary);
  function renderMonthlySummary() {
    const month = $("#mood-month").value;
    if (!month) return;
    const monthDate = new Date(
      Number(month.slice(0, 4)),
      Number(month.slice(5)) - 1,
      1,
    );
    const previousDate = new Date(
      monthDate.getFullYear(),
      monthDate.getMonth() - 1,
      1,
    );
    const previous = ctx.dateKey(previousDate).slice(0, 7);
    const days = (prefix) => {
      const groups = new Map();
      for (const entry of ctx.checkins) {
        const day = ctx.dateKey(new Date(entry.at));
        if (!day.startsWith(prefix)) continue;
        if (!groups.has(day)) groups.set(day, []);
        groups.get(day).push(entry);
      }
      return [...groups.values()].map((entries) =>
        Object.fromEntries(
          ["mood", "energy", "stress"].map((key) => [
            key,
            entries.reduce((sum, item) => sum + item[key], 0) / entries.length,
          ]),
        ),
      );
    };
    const current = days(month),
      before = days(previous),
      totalDays = new Date(
        monthDate.getFullYear(),
        monthDate.getMonth() + 1,
        0,
      ).getDate();
    const base =
      t("Отмечено дней: ", "Days recorded: ") +
      current.length +
      " / " +
      totalDays;
    if (current.length < 3 || before.length < 3) {
      monthlySummary.textContent = base;
      return;
    }
    const changes = [
      ["mood", t("Настроение", "Mood")],
      ["energy", t("Энергия", "Energy")],
      ["stress", t("Стресс", "Stress")],
    ].map(([key, label]) => {
      const avg = (rows) =>
        rows.reduce((sum, item) => sum + item[key], 0) / rows.length;
      const difference = avg(current) - avg(before);
      return (
        label + " " + (difference > 0.05 ? "+" : "") + difference.toFixed(1)
      );
    });
    monthlySummary.textContent =
      base +
      t(". К прошлому месяцу: ", ". Versus last month: ") +
      changes.join(" · ") +
      t(
        " балла из 5. По записанным дням.",
        " points out of 5. Based on recorded days.",
      );
  }

  // Collapse macro input until needed; existing values always remain available.
  const foodMacros = make("details", "form-extra food-macro-details");
  foodMacros.append(make("summary", "cursor-interaction", "БЖУ · по желанию"));
  const macroRow = $("#food-protein").closest(".field-row");
  if (macroRow) {
    macroRow.before(foodMacros);
    foodMacros.append(macroRow, $("#food-carbs").closest("label"));
  }
  $("#food-day-macros").classList.add("food-macros-summary");
  for (const group of all(".connection-group")) {
    const details = make("details", "connection-details");
    if (group.closest('[data-connection-view="ai"]')) details.open = true;
    const heading = group.querySelector("h3,h4");
    details.append(
      make(
        "summary",
        "cursor-interaction",
        heading?.textContent || "Подробнее",
      ),
    );
    heading?.remove();
    details.append(...group.childNodes);
    group.append(details);
  }

  // VisualViewport follows the soft keyboard without changing desktop layout.
  function fitViewport() {
    const viewport = window.visualViewport;
    const zoom = Number.parseFloat(getComputedStyle(root).zoom) || 1;
    root.style.setProperty(
      "--dialog-viewport-height",
      (viewport?.height || window.innerHeight) / zoom + "px",
    );
    root.style.setProperty(
      "--dialog-viewport-top",
      (viewport?.offsetTop || 0) / zoom + "px",
    );
    if (isTextEntry(document.activeElement))
      window.requestAnimationFrame(() =>
        revealInDialog(document.activeElement),
      );
  }
  if (window.visualViewport) {
    listen(window.visualViewport, "resize", fitViewport);
    listen(window.visualViewport, "scroll", fitViewport);
  }
  // Older WebViews expose keyboard resizing only through the window.
  listen(window, "resize", fitViewport);
  fitViewport();
  listen(root, "focusin", (event) => {
    if (isTextEntry(event.target))
      window.requestAnimationFrame(() => revealInDialog(event.target));
  });
  let previousZoom = getComputedStyle(root).zoom;
  const zoomObserver = new MutationObserver(() => {
    const zoom = getComputedStyle(root).zoom;
    if (zoom !== previousZoom) {
      previousZoom = zoom;
      fitViewport();
    }
    if (!root.isConnected) zoomObserver.disconnect();
  });
  zoomObserver.observe(root, { attributes: true, attributeFilter: ["style"] });
  function dialogOpened(id) {
    fitViewport();
    if (id === "capture-dialog") {
      proposal = null;
      ignoredText = "";
      originalDate = originalTime = null;
      dateManual = timeManual = false;
      proposalHost.hidden = true;
    }
    const prefix = id.replace("-dialog", "");
    if (formSummaries.has(prefix)) updateDestination(prefix);
    ctx.services.refreshIcons(root);
  }
  Object.assign(ctx.translations, {
    Поиск: "Search",
    Подробнее: "Details",
    Дублировать: "Duplicate",
    Перенести: "Move",
    Сейчас: "Now",
    "Вернуться к текущему времени": "Return to the current time",
    "Задачи, мысли, проекты и записи": "Tasks, thoughts, projects and entries",
    "Карточки Жизни": "Life cards",
    "Настроить карточки": "Customize cards",
    "Скрытые карточки можно вернуть. Записи сохраняются.":
      "Hidden cards can be restored. Your records are kept.",
    "Изменить коллекцию": "Edit collection",
    "Удалить коллекцию": "Delete collection",
    "БЖУ · по желанию": "Macros · optional",
    "Например: тренировка завтра в 19:00":
      "For example: workout tomorrow at 19:00",
    "Не распознавать дату и время": "Ignore recognized date and time",
  });
  applyLifeLayout();
  ctx.services.refreshIcons(root);
  return {
    dispose: () => zoomObserver.disconnect(),
    notify,
    itemMenu,
    dialogOpened,
    pageChanged,
    confirmCollection,
    editFood,
    renderMonthlySummary,
    rehydrate() {
      pendingUndo = null;
      notice.hidden = true;
      ctx.clearTimeout(noticeTimer);
      applyLifeLayout();
    },
  };
}

// Conservative local parsing: unknown phrases stay in the title.
export function parseTaskInput(value, now, dateKey) {
  let title = value,
    date = null,
    time = null;
  const candidate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const relative =
    /(?:^|\s)(послезавтра|завтра|сегодня|tomorrow|today)(?=\s|$|[,.;])/iu.exec(
      title,
    );
  if (relative) {
    const word = relative[1].toLowerCase();
    candidate.setDate(
      candidate.getDate() +
        (word === "послезавтра"
          ? 2
          : ["завтра", "tomorrow"].includes(word)
            ? 1
            : 0),
    );
    date = dateKey(candidate);
    title = title.replace(relative[0], " ");
  } else {
    const explicit =
      /(?:^|\s)(\d{1,2})[.\/](\d{1,2})(?:[.\/](\d{4}))?(?=\s|$)/u.exec(title);
    if (explicit) {
      const year = Number(explicit[3] || now.getFullYear()),
        month = Number(explicit[2]) - 1,
        day = Number(explicit[1]);
      const parsed = new Date(year, month, day);
      if (
        parsed.getFullYear() === year &&
        parsed.getMonth() === month &&
        parsed.getDate() === day
      ) {
        date = dateKey(parsed);
        title = title.replace(explicit[0], " ");
      }
    }
  }
  const clock =
    /(?:^|\s)(?:в|at)\s+([01]?\d|2[0-3])(?::([0-5]\d))?(?=\s|$|[,.;])/iu.exec(
      title,
    );
  if (clock) {
    time = clock[1].padStart(2, "0") + ":" + (clock[2] || "00");
    title = title.replace(clock[0], " ");
  }
  title = title.replace(/\s+/g, " ").trim();
  return (date || time) && title ? { title, date, time } : null;
}
