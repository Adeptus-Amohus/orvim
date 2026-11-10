export function defaultCollection(name, preset) {
  const kind =
    preset ||
    (/книг|book/i.test(name)
      ? "book"
      : /аниме|anime/i.test(name)
        ? "anime"
        : /фильм|film|movie/i.test(name)
          ? "film"
          : /игр|game/i.test(name)
            ? "game"
            : "material");
  const labels =
    kind === "book"
      ? ["Хочу", "Читаю", "Прочитано"]
      : ["film", "anime"].includes(kind)
        ? ["Хочу", "Смотрю", "Просмотрено"]
        : kind === "game"
          ? ["Не пройдено", "Играю", "Пройдено"]
          : ["Сохранено", "В работе", "Готово"];
  return {
    name,
    kind,
    ratingEnabled: kind !== "material",
    ratingMax: 5,
    statuses: ["planned", "active", "done"].map((id, index) => ({
      id,
      label: labels[index],
      phase: id,
    })),
    genres: [],
  };
}
export function collectionSettings(state, name) {
  const configs = state.uiPreferences?.databaseCollections;
  return (
    (Array.isArray(configs) &&
      configs.find((config) => config.name === name)) ||
    defaultCollection(name)
  );
}
export function collectionRating(item, config) {
  if (!item.rating) return null;
  return Math.min(
    config.ratingMax,
    Math.max(
      0.5,
      Math.round((item.rating / (item.ratingMax || 5)) * config.ratingMax * 2) /
        2,
    ),
  );
}
export function collectionStatus(item, config) {
  if (config.statuses.some((status) => status.id === item.status))
    return item.status;
  const phase =
    item.statusPhase ||
    (["planned", "active", "done"].includes(item.status)
      ? item.status
      : item.rating || item.review
        ? "done"
        : "planned");
  return (
    config.statuses.find((status) => status.phase === phase) ||
    config.statuses[0]
  ).id;
}
export function installCollectionSettings(ctx) {
  const { $, make, listen, extraState: state } = ctx;
  const t = (ru, en) => {
    ctx.translations[ru] = en;
    return ctx.translate(ru, en);
  };
  const button = (label, callback, cls = "button") => {
    const node = make("button", cls, label);
    node.type = "button";
    listen(node, "click", callback);
    return node;
  };
  const option = (control, value, label) => {
    const node = make("option", "", label);
    node.value = value;
    control.append(node);
  };
  const form = $("#archive-category-form"),
    settings = make("section", "collection-settings");
  const preset = ctx.fieldControl(
    t("Основа коллекции", "Collection template"),
    "collection-preset",
    "text",
    "select",
  );
  for (const [value, label] of [
    ["custom", t("Своя коллекция", "Custom collection")],
    ["game", t("Игры", "Games")],
    ["film", t("Фильмы", "Films")],
    ["book", t("Книги", "Books")],
    ["anime", t("Аниме", "Anime")],
    ["material", t("Материалы", "Materials")],
  ])
    option(preset.input, value, label);
  const heading = make("div", "collection-status-heading");
  heading.append(
    make("h3", "", t("Статусы", "Statuses")),
    button(
      t("+ Статус", "+ Status"),
      () => {
        if (draft.statuses.length >= 20) return;
        draft.statuses.push({
          id: "status-" + ctx.createId(),
          label: "",
          phase: "planned",
        });
        renderStatuses();
        rows.lastElementChild.querySelector("input").focus();
      },
      "text-button",
    ),
  );
  const rows = make("div", "collection-status-rows");
  rows.id = "collection-status-rows";
  const ratingRow = make("div", "collection-rating-settings"),
    ratingLabel = make("label", "inline-choice"),
    ratingToggle = make("input");
  ratingToggle.type = "checkbox";
  ratingToggle.id = "collection-rating-enabled";
  ratingLabel.append(ratingToggle, make("span", "", t("Оценка", "Rating")));
  const maximum = ctx.fieldControl(
    t("Шкала", "Scale"),
    "collection-rating-max",
    "text",
    "select",
  );
  option(maximum.input, "5", t("До 5", "Out of 5"));
  option(maximum.input, "10", t("До 10", "Out of 10"));
  ratingRow.append(ratingLabel, maximum.field);
  const genres = ctx.fieldControl(
    t("Жанры · через запятую", "Genres · comma separated"),
    "collection-genres",
  );
  genres.input.maxLength = 2000;
  genres.input.placeholder = t(
    "Например: RPG, стратегия, приключения",
    "For example: RPG, strategy, adventure",
  );
  const error = make("p", "error");
  error.id = "collection-settings-error";
  error.hidden = true;
  error.setAttribute("role", "alert");
  settings.append(
    preset.field,
    heading,
    rows,
    make(
      "p",
      "aux-note",
      t(
        "Тип статуса помогает отслеживать прогресс. При удалении статуса записи перейдут в первый статус того же типа.",
        "Status type controls progress. Removing a status moves its entries to the first status of the same type.",
      ),
    ),
    ratingRow,
    genres.field,
    error,
  );
  form.querySelector(".dialog-actions").before(settings);
  let draft = defaultCollection("", "material");
  function configs() {
    if (!Array.isArray(state.uiPreferences.databaseCollections))
      state.uiPreferences.databaseCollections = [];
    return state.uiPreferences.databaseCollections;
  }
  function renderStatuses() {
    rows.replaceChildren();
    for (const [index, status] of draft.statuses.entries()) {
      const row = make("div", "collection-status-row"),
        label = make("input"),
        phase = make("select");
      label.value = status.label;
      label.maxLength = 60;
      label.required = true;
      label.setAttribute("aria-label", t("Название статуса", "Status name"));
      label.placeholder = t("Название статуса", "Status name");
      phase.setAttribute("aria-label", t("Тип статуса", "Status type"));
      for (const [value, caption] of [
        ["planned", t("Не начато", "Not started")],
        ["active", t("В процессе", "In progress")],
        ["done", t("Завершено", "Completed")],
      ])
        option(phase, value, caption);
      phase.value = status.phase;
      listen(label, "input", () => {
        status.label = label.value;
        error.hidden = true;
      });
      listen(phase, "change", () => (status.phase = phase.value));
      const move = button(
        "↑",
        () => {
          [draft.statuses[index - 1], draft.statuses[index]] = [
            draft.statuses[index],
            draft.statuses[index - 1],
          ];
          renderStatuses();
        },
        "db-icon",
      );
      move.disabled = index === 0;
      move.setAttribute("aria-label", t("Поднять статус", "Move status up"));
      const remove = button(
        "×",
        () => {
          draft.statuses.splice(index, 1);
          renderStatuses();
        },
        "db-icon",
      );
      remove.disabled = draft.statuses.length === 1;
      remove.setAttribute("aria-label", t("Удалить статус", "Remove status"));
      const nameField = make("label", "collection-status-field"),
        typeField = make("label", "collection-status-field");
      nameField.append(make("span", "aux-note", t("Название", "Name")), label);
      typeField.append(
        make("span", "aux-note", t("Этап прогресса", "Progress phase")),
        phase,
      );
      const tools = make("div", "collection-status-tools");
      tools.append(move, remove);
      row.append(nameField, typeField, tools);
      rows.append(row);
    }
  }
  function populate() {
    renderStatuses();
    ratingToggle.checked = draft.ratingEnabled;
    maximum.input.value = String(draft.ratingMax);
    maximum.field.hidden = !draft.ratingEnabled;
    genres.input.value = draft.genres.join(", ");
    error.hidden = true;
  }
  listen(preset.input, "change", () => {
    const kind =
      preset.input.value === "custom" ? "material" : preset.input.value;
    draft = defaultCollection($("#archive-category-name").value, kind);
    if (preset.input.value === "custom") draft.ratingEnabled = true;
    populate();
  });
  listen(ratingToggle, "change", () => {
    draft.ratingEnabled = ratingToggle.checked;
    maximum.field.hidden = !draft.ratingEnabled;
  });
  function opened(name) {
    draft = structuredClone(
      name
        ? collectionSettings(state, name)
        : { ...defaultCollection("", "material"), ratingEnabled: true },
    );
    preset.input.value = name ? draft.kind : "custom";
    populate();
  }
  function save(name, oldName) {
    const labels = draft.statuses.map((status) => status.label.trim());
    const genreList = [
      ...new Set(
        genres.input.value
          .split(",")
          .map((genre) => genre.trim())
          .filter(Boolean),
      ),
    ];
    if (
      !labels.length ||
      labels.some((label) => !label) ||
      new Set(labels.map((label) => label.toLocaleLowerCase())).size !==
        labels.length ||
      genreList.length > 50 ||
      genreList.some((genre) => genre.length > 60)
    ) {
      error.textContent = t(
        "Названия статусов должны быть разными. До 50 жанров, до 60 символов в названии.",
        "Status names must be unique. Up to 50 genres with 60 characters each.",
      );
      error.hidden = false;
      return false;
    }
    const saved = {
      ...draft,
      name,
      ratingEnabled: ratingToggle.checked,
      ratingMax: Number(maximum.input.value),
      statuses: draft.statuses.map((status) => ({
        ...status,
        label: status.label.trim(),
      })),
      genres: genreList,
    };
    const previous = collectionSettings(state, oldName || name);
    const index = configs().findIndex(
      (config) => config.name === (oldName || name),
    );
    if (index >= 0) configs().splice(index, 1, saved);
    else configs().push(saved);
    for (const item of ctx.archiveItems.filter(
      (item) => item.category === oldName,
    )) {
      const oldStatus = previous.statuses.find(
        (status) => status.id === collectionStatus(item, previous),
      );
      if (!saved.statuses.some((status) => status.id === item.status))
        item.status = (
          saved.statuses.find((status) => status.phase === oldStatus.phase) ||
          saved.statuses[0]
        ).id;
      item.statusPhase = saved.statuses.find(
        (status) => status.id === item.status,
      ).phase;
    }
    return true;
  }
  return {
    opened,
    save,
    config: (name) => collectionSettings(state, name),
    remove(name) {
      const config = configs().find((row) => row.name === name);
      state.uiPreferences.databaseCollections = configs().filter(
        (row) => row.name !== name,
      );
      return config;
    },
    restore(name, config) {
      if (config) configs().push({ ...config, name });
    },
  };
}
export function validateCollectionSettings(data) {
  const configs = data.uiPreferences?.databaseCollections;
  if (configs === undefined) return;
  if (
    !Array.isArray(configs) ||
    configs.length > 1000 ||
    new Set(configs.map((config) => config?.name)).size !== configs.length ||
    configs.some(
      (config) =>
        !config ||
        typeof config.name !== "string" ||
        !config.name.trim() ||
        config.name.length > 500 ||
        !["book", "film", "anime", "game", "material"].includes(config.kind) ||
        typeof config.ratingEnabled !== "boolean" ||
        ![5, 10].includes(config.ratingMax) ||
        !Array.isArray(config.statuses) ||
        !config.statuses.length ||
        config.statuses.length > 20 ||
        new Set(config.statuses.map((status) => status?.id)).size !==
          config.statuses.length ||
        new Set(
          config.statuses.map((status) =>
            typeof status?.label === "string"
              ? status.label.toLocaleLowerCase()
              : null,
          ),
        ).size !== config.statuses.length ||
        config.statuses.some(
          (status) =>
            !status ||
            typeof status.id !== "string" ||
            !/^(planned|active|done|status-\d+)$/.test(status.id) ||
            typeof status.label !== "string" ||
            !status.label.trim() ||
            status.label.length > 60 ||
            !["planned", "active", "done"].includes(status.phase),
        ) ||
        !Array.isArray(config.genres) ||
        config.genres.length > 50 ||
        config.genres.some(
          (genre) =>
            typeof genre !== "string" || !genre.trim() || genre.length > 60,
        ),
    )
  )
    throw Error("Некорректные настройки коллекций.");
}
