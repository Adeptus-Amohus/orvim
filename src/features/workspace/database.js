import { numberFormat } from "./formatters.js";
import {
  installCollectionSettings,
  collectionRating,
  collectionStatus,
  validateCollectionSettings,
} from "./collection-settings.js";
import { createRatingPicker } from "./rating.js";
// Optional fields extend existing database records; IDs and covers stay intact.
export function installDatabase(ctx) {
  const {
    root,
    $,
    make,
    listen,
    archiveItems: items,
    archiveCategories: categories,
    extraState: state,
  } = ctx;
  const t = (ru, en) => {
    ctx.translations[ru] = en;
    return ctx.translate(ru, en);
  };
  const text = (tag, cls, value) => {
    const node = make(tag, cls, value);
    node.dataset.userContent = "";
    return node;
  };
  const button = (label, callback, cls = "button") => {
    const node = make("button", cls, label);
    node.type = "button";
    listen(node, "click", callback);
    return node;
  };
  const icon = (name) => {
    const node = make("i");
    node.dataset.lucide = name;
    node.setAttribute("aria-hidden", "true");
    return node;
  };
  const iconButton = (name, label, callback) => {
    const node = button("", callback, "db-icon");
    node.append(icon(name));
    node.setAttribute("aria-label", label);
    node.title = label;
    return node;
  };
  const safeUrl = (value) => {
    try {
      const url = new URL(value);
      return ["https:", "http:"].includes(url.protocol) &&
        !url.username &&
        !url.password
        ? url.href
        : "";
    } catch {
      return "";
    }
  };
  const collections = installCollectionSettings(ctx);
  const configOf = (item) => collections.config(item.category);
  const kindOf = (item) =>
    ["book", "film", "anime", "game", "material"].includes(item.kind)
      ? item.kind
      : /книг|book/i.test(item.category)
        ? "book"
        : /аниме|anime/i.test(item.category)
          ? "anime"
          : /фильм|movie|film/i.test(item.category)
            ? "film"
            : configOf(item).kind;
  const statusOf = (item) => collectionStatus(item, configOf(item));
  const phaseOf = (item) =>
    configOf(item).statuses.find((status) => status.id === statusOf(item))
      .phase;
  const ratingOf = (item) => collectionRating(item, configOf(item));
  function statusLabel(status, kind) {
    if (kind === "game")
      return status === "active"
        ? t("Играю", "Playing")
        : status === "done"
          ? t("Пройдено", "Completed")
          : t("Не пройдено", "Not played");
    if (status === "active")
      return kind === "book"
        ? t("Читаю", "Reading")
        : ["film", "anime"].includes(kind)
          ? t("Смотрю", "Watching")
          : t("В работе", "In progress");
    if (status === "done")
      return kind === "book"
        ? t("Прочитано", "Read")
        : ["film", "anime"].includes(kind)
          ? t("Просмотрено", "Watched")
          : t("Готово", "Done");
    return kind === "material" ? t("Сохранено", "Saved") : t("Хочу", "Want to");
  }
  function statusName(status, config, kind = config.kind) {
    return Array.isArray(state.uiPreferences.databaseCollections) &&
      state.uiPreferences.databaseCollections.some(
        (row) => row.name === config.name,
      )
      ? status.label
      : statusLabel(status.phase, kind);
  }
  let query = "",
    filter = "",
    genreFilter = "",
    sort = "recent",
    limit = 40,
    selecting = false,
    layout = state.uiPreferences.databaseLayout || "catalog";
  const selected = new Set();
  let editor = undefined,
    draftTimer = 0,
    duplicateAllowed = false,
    pendingFile = false,
    kindTouched = false,
    fileToken = 0,
    attachments = [],
    entryGenres = [],
    editorRatingMax = 5,
    editorProject = null,
    requestedProject = null,
    currentProject = null;
  let pickerOwner = null,
    pickerKind = "",
    pickerIds = new Set(),
    pickerQuery = "",
    pickerLimit = 40;
  if (!state.uiPreferences.databaseInitialized) {
    if (!categories.some((name) => /материал|material/i.test(name)))
      categories.push("Материалы");
    state.uiPreferences.databaseInitialized = true;
  }
  const form = $("#archive-item-form");
  const fields = {};
  function field(label, key, type = "text", tag) {
    const control = ctx.fieldControl(label, "db-item-" + key, type, tag);
    fields[key] =
      control.input ||
      control.control ||
      control.field.querySelector("input,select,textarea");
    return control.field;
  }
  const metadata = make("div", "db-editor-fields");
  metadata.append(
    field(t("Автор · необязательно", "Creator · optional"), "creator"),
    field(t("Тип записи", "Entry type"), "kind", "text", "select"),
  );
  const genreChoices = make("div", "db-genre-choices");
  genreChoices.id = "db-item-genres";
  const genreField = make("div", "field");
  genreField.append(make("span", "", t("Жанры", "Genres")), genreChoices);
  metadata.append(genreField);
  fields.creator.maxLength = 140;
  for (const [value, label] of [
    ["film", t("Фильм", "Film")],
    ["book", t("Книга", "Book")],
    ["anime", t("Аниме", "Anime")],
    ["game", t("Игра", "Game")],
    ["material", t("Материал", "Material")],
  ]) {
    const option = make("option", "", label);
    option.value = value;
    fields.kind.append(option);
  }
  const statusField = field(t("Статус", "Status"), "status", "text", "select");
  const progressBox = make("div", "db-progress-fields");
  const currentField = field(t("Прогресс", "Progress"), "current", "number");
  const totalField = field(
    t("Всего · необязательно", "Total · optional"),
    "total",
    "number",
  );
  for (const key of ["current", "total"]) {
    fields[key].min = key === "current" ? "0" : "1";
    fields[key].max = "100000";
    fields[key].step = "1";
  }
  progressBox.append(currentField, totalField);
  const resources = make("details", "db-resources");
  resources.append(
    make("summary", "", t("Ссылка и файлы", "Link and files")),
    field(t("Ссылка · необязательно", "Link · optional"), "url", "url"),
  );
  fields.url.placeholder = "https://…";
  fields.url.maxLength = 2000;
  const fileList = make("div", "db-file-list");
  fileList.id = "db-editor-files";
  const fileError = make("p", "cover-error");
  fileError.id = "db-file-error";
  fileError.hidden = true;
  fileError.setAttribute("role", "alert");
  const fileAdd = button(t("Прикрепить файл", "Attach file"), addFile);
  fileAdd.id = "db-file-add";
  resources.append(
    fileList,
    fileAdd,
    make(
      "small",
      "subtle",
      t(
        "PDF, DOCX, DOC, TXT, MD · до 5 МБ на файл",
        "PDF, DOCX, DOC, TXT, MD · up to 5 MB each",
      ),
    ),
    fileError,
  );
  $("#archive-item-name")
    .closest("label")
    .after(metadata, statusField, progressBox);
  $("#archive-item-review").closest("label").after(resources);
  const notice = make("div", "db-draft-notice");
  notice.id = "db-draft-notice";
  notice.hidden = true;
  const duplicate = make("div", "db-duplicate");
  duplicate.id = "db-duplicate";
  duplicate.hidden = true;
  duplicate.setAttribute("role", "alert");
  $("#archive-item-name").closest("label").before(notice);
  form.querySelector(".dialog-actions").before(duplicate);
  // Keep capture short; detailed notes, creators and files are optional.
  const detailFields = make("details", "db-editor-details");
  detailFields.append(
    make("summary", "", t("Подробности · необязательно", "Details · optional")),
    metadata,
    $("#archive-item-date").closest("label"),
    $("#archive-item-review").closest("label"),
    resources,
  );
  form.querySelector(".dialog-actions").before(detailFields);
  const statusRow = make("div", "db-editor-fields");
  statusField.before(statusRow);
  statusRow.append($("#archive-item-collection").closest("label"), statusField);
  $("#archive-item-date").required = false;
  $("#archive-item-review").placeholder = t(
    "Короткая заметка для себя",
    "A short note for yourself",
  );

  const toolbar = make("div", "db-toolbar");
  const searchWrap = make("label", "db-search");
  searchWrap.append(icon("search"));
  const search = make("input");
  search.type = "search";
  search.id = "db-search";
  search.placeholder = t("Найти в коллекции", "Search collection");
  search.setAttribute("aria-label", search.placeholder);
  searchWrap.append(search);
  const statusFilter = make("select");
  const genresFilter = make("select");
  genresFilter.id = "db-genre-filter";
  genresFilter.setAttribute("aria-label", t("Фильтр по жанру", "Genre filter"));
  statusFilter.id = "db-status-filter";
  statusFilter.setAttribute(
    "aria-label",
    t("Фильтр по статусу", "Status filter"),
  );
  const sorter = make("select");
  sorter.id = "db-sort";
  sorter.setAttribute("aria-label", t("Порядок записей", "Sort entries"));
  for (const [value, label] of [
    ["recent", t("Недавние", "Recent")],
    ["title", t("По названию", "Title")],
    ["rating", t("По оценке", "Rating")],
    ["genre", t("По жанру", "Genre")],
  ]) {
    const option = make("option", "", label);
    option.value = value;
    sorter.append(option);
  }
  const viewButtons = make("div", "db-view-buttons");
  for (const [value, name, label] of [
    ["catalog", "image", t("Каталог", "Catalog")],
    ["list", "list", t("Список", "List")],
  ]) {
    const node = iconButton(name, label, () => {
      layout = value;
      state.uiPreferences.databaseLayout = value;
      render();
      ctx.persistState();
    });
    node.dataset.dbLayout = value;
    viewButtons.append(node);
  }
  const selectToggle = button(
    t("Выбрать", "Select"),
    () => {
      selecting = !selecting;
      selected.clear();
      render();
    },
    "text-button",
  );
  selectToggle.id = "db-select-toggle";
  toolbar.append(
    searchWrap,
    statusFilter,
    genresFilter,
    sorter,
    viewButtons,
    selectToggle,
  );
  const batch = make("div", "db-batch");
  batch.id = "db-batch";
  batch.hidden = true;
  const batchCount = make("span");
  batchCount.id = "db-batch-count";
  const selectVisible = button(
    t("Все показанные", "All displayed"),
    () => {
      for (const item of filtered().slice(0, limit)) selected.add(item.id);
      render();
    },
    "text-button",
  );
  const moveSelect = make("select");
  moveSelect.id = "db-move-collection";
  moveSelect.setAttribute(
    "aria-label",
    t("Переместить в коллекцию", "Move to collection"),
  );
  const moveButton = button(t("Перенести", "Move"), moveBatch);
  moveButton.id = "db-batch-move";
  const deleteButton = button(
    t("Удалить", "Delete"),
    deleteBatch,
    "button button-danger",
  );
  deleteButton.id = "db-batch-delete";
  batch.append(batchCount, selectVisible, moveSelect, moveButton, deleteButton);
  const more = button(t("Показать ещё", "Show more"), () => {
    limit += 40;
    render();
  });
  more.id = "db-more";
  $("#archive-items").before(toolbar, batch);
  $("#archive-items").after(more);
  listen(search, "input", () => {
    query = search.value;
    limit = 40;
    renderItems();
  });
  listen(statusFilter, "change", () => {
    filter = statusFilter.value;
    limit = 40;
    renderItems();
  });
  listen(genresFilter, "change", () => {
    genreFilter = genresFilter.value;
    limit = 40;
    renderItems();
  });
  listen(sorter, "change", () => {
    sort = sorter.value;
    limit = 40;
    renderItems();
  });

  function dialog(id, title) {
    const overlay = make("div", "overlay");
    overlay.id = id;
    overlay.hidden = true;
    const content = make("section", "dialog db-dialog");
    content.setAttribute("role", "dialog");
    content.setAttribute("aria-modal", "true");
    content.setAttribute("aria-labelledby", id + "-title");
    const head = make("div", "dialog-head"),
      heading = make("h2", "", title);
    heading.id = id + "-title";
    head.append(
      heading,
      iconButton("x", t("Закрыть", "Close"), ctx.closeDialog),
    );
    content.append(head);
    overlay.append(content);
    root.append(overlay);
    listen(overlay, "click", (event) => {
      if (event.target === overlay) ctx.closeDialog();
    });
    return content;
  }
  const quick = dialog("db-quick-dialog", t("Оценка", "Rating"));
  const quickBody = make("div");
  quickBody.id = "db-quick-body";
  quick.append(quickBody);
  const picker = dialog(
    "db-reference-dialog",
    t("Ссылки на материалы", "Material references"),
  );
  const pickerSearch = make("input");
  pickerSearch.id = "db-reference-search";
  pickerSearch.type = "search";
  pickerSearch.placeholder = t("Название или коллекция", "Title or collection");
  pickerSearch.setAttribute("aria-label", pickerSearch.placeholder);
  const pickerList = make("div", "db-reference-list");
  pickerList.id = "db-reference-list";
  const pickerMore = button(t("Показать ещё", "Show more"), () => {
    pickerLimit += 40;
    renderPicker();
  });
  pickerMore.id = "db-reference-more";
  const pickerActions = make("div", "dialog-actions");
  pickerActions.append(
    button(t("Отмена", "Cancel"), ctx.closeDialog),
    button(
      t("Сохранить ссылки", "Save references"),
      saveReferences,
      "button button-primary",
    ),
  );
  picker.append(pickerSearch, pickerList, pickerMore, pickerActions);
  listen(pickerSearch, "input", () => {
    pickerQuery = pickerSearch.value;
    pickerLimit = 40;
    renderPicker();
  });
  const viewExtra = make("div", "db-view-extra");
  $("#archive-view-review").after(viewExtra);
  const projectActions = dialog(
    "project-actions-dialog",
    t("Действия проекта", "Project actions"),
  );
  const projectEdit = $("#project-edit"),
    projectDelete = $("#project-remove");
  projectEdit.hidden = projectDelete.hidden = true;
  const actionsOpen = iconButton(
    "ellipsis",
    t("Действия проекта", "Project actions"),
    (event) => ctx.openDialog("project-actions-dialog", event.currentTarget),
  );
  actionsOpen.id = "project-actions-open";
  $(".project-header-actions").append(actionsOpen);
  projectActions.append(
    button(t("Изменить проект", "Edit project"), () => {
      const owner = currentProject;
      ctx.closeDialog();
      if (owner) ctx.openProjectDialog(owner, actionsOpen);
    }),
    button(
      t("Удалить проект…", "Delete project…"),
      () => {
        ctx.closeDialog();
        projectDelete.click();
      },
      "text-button project-delete-action",
    ),
  );
  const createTask = $("#project-task-add");
  createTask.classList.remove("text-button");
  createTask.classList.add("button", "button-primary", "project-create-task");
  $(".project-section-head h3").after(createTask);

  function changed() {
    ctx.persistState();
  }
  function normalize(value) {
    return value
      .trim()
      .toLocaleLowerCase(ctx.displayLocale())
      .replace(/\s+/g, " ");
  }
  function filtered() {
    const needle = normalize(query);
    return items
      .filter(
        (item) =>
          item.category === ctx.selectedCollection() &&
          (!filter || statusOf(item) === filter) &&
          (!genreFilter || item.genres?.includes(genreFilter)) &&
          (!needle ||
            normalize(
              [item.name, item.creator, item.review, ...(item.genres || [])]
                .filter(Boolean)
                .join(" "),
            ).includes(needle)),
      )
      .sort((a, b) =>
        sort === "title"
          ? a.name.localeCompare(b.name, ctx.displayLocale())
          : sort === "rating"
            ? (ratingOf(b) || 0) - (ratingOf(a) || 0) || b.id - a.id
            : sort === "genre"
              ? (a.genres?.[0] || "").localeCompare(
                  b.genres?.[0] || "",
                  ctx.displayLocale(),
                ) || a.name.localeCompare(b.name, ctx.displayLocale())
              : (b.date || "").localeCompare(a.date || "") || b.id - a.id,
      );
  }
  function render() {
    if (!categories.includes(ctx.selectedCollection()))
      ctx.selectCollection(categories[0] || "");
    const host = $("#archive-categories");
    host.replaceChildren();
    for (const name of categories) {
      const node = button(
        "",
        () => {
          ctx.selectCollection(name);
          limit = 40;
          selected.clear();
          filter = "";
          genreFilter = "";
          render();
          changed();
        },
        "archive-category",
      );
      node.append(
        text("span", "", name),
        make(
          "small",
          "",
          String(items.filter((item) => item.category === name).length),
        ),
      );
      node.setAttribute(
        "aria-current",
        String(name === ctx.selectedCollection()),
      );
      host.append(node);
    }
    $("#archive-category-title").textContent =
      ctx.selectedCollection() || t("Коллекции", "Collections");
    $("#archive-item-add").disabled = !ctx.selectedCollection();
    const config = collections.config(ctx.selectedCollection());
    if (!config.statuses.some((status) => status.id === filter)) filter = "";
    statusFilter.replaceChildren();
    for (const [value, label] of [
      ["", t("Все статусы", "All statuses")],
      ...config.statuses.map((status) => [
        status.id,
        statusName(status, config),
      ]),
    ]) {
      const option = value
        ? text("option", "", label)
        : make("option", "", label);
      option.value = value;
      statusFilter.append(option);
    }
    statusFilter.value = filter;
    genresFilter.replaceChildren();
    const allGenreOption = make("option", "", t("Все жанры", "All genres"));
    allGenreOption.value = "";
    genresFilter.append(allGenreOption);
    const genreList = [
      ...new Set([
        ...config.genres,
        ...items
          .filter((item) => item.category === config.name)
          .flatMap((item) => item.genres || []),
      ]),
    ].sort();
    for (const genre of genreList) {
      const option = text("option", "", genre);
      option.value = genre;
      genresFilter.append(option);
    }
    if (!genreList.includes(genreFilter)) genreFilter = "";
    genresFilter.hidden = !genreList.length;
    genresFilter.value = genreFilter;
    sorter.querySelector('[value="rating"]').disabled = !config.ratingEnabled;
    if (!config.ratingEnabled && sort === "rating") sort = "recent";
    sorter.value = sort;
    for (const node of viewButtons.children)
      node.setAttribute(
        "aria-pressed",
        String(node.dataset.dbLayout === layout),
      );
    selectToggle.textContent = selecting
      ? t("Готово", "Done")
      : t("Выбрать", "Select");
    moveSelect.replaceChildren();
    for (const name of categories) {
      const option = text("option", "", name);
      option.value = name;
      moveSelect.append(option);
    }
    renderItems();
    ctx.services.refreshIcons($("#archive-screen"));
  }
  function renderItems() {
    const host = $("#archive-items"),
      rows = filtered();
    host.replaceChildren();
    host.dataset.layout = layout;
    for (const id of selected)
      if (!items.some((item) => item.id === id)) selected.delete(id);
    batch.hidden = !selecting;
    batchCount.textContent = t("Выбрано: ", "Selected: ") + selected.size;
    moveButton.disabled = deleteButton.disabled = selected.size === 0;
    for (const item of rows.slice(0, limit)) {
      const card = make("article", "archive-card db-card");
      card.dataset.dbId = String(item.id);
      card.dataset.selected = String(selected.has(item.id));
      const cover = button(
        "",
        (event) => ctx.openDatabaseView(item, event.currentTarget),
        "archive-cover",
      );
      cover.setAttribute("aria-label", t("Открыть: ", "Open: ") + item.name);
      const source = ctx.databaseCover(item.id);
      if (source) {
        const img = make("img");
        img.src = source;
        img.alt = item.name;
        cover.append(img);
      } else {
        const placeholder = make("span", "db-cover-placeholder");
        placeholder.append(
          icon(
            kindOf(item) === "book"
              ? "book-open"
              : kindOf(item) === "material"
                ? "file-text"
                : "image",
          ),
          text("span", "", item.name),
        );
        cover.append(placeholder);
      }
      const info = make("div", "db-card-info");
      const title = button(
        item.name,
        (event) => ctx.openDatabaseView(item, event.currentTarget),
        "archive-card-title",
      );
      title.dataset.userContent = "";
      info.append(title);
      if (item.creator) info.append(text("small", "db-creator", item.creator));
      const quickRow = make("div", "db-card-controls"),
        status = make("select", "db-status");
      status.setAttribute("aria-label", t("Статус: ", "Status: ") + item.name);
      const config = configOf(item);
      for (const row of config.statuses) {
        const option = text(
          "option",
          "",
          statusName(row, config, kindOf(item)),
        );
        option.value = row.id;
        status.append(option);
      }
      status.value = statusOf(item);
      listen(status, "change", () => {
        item.status = status.value;
        item.statusPhase = config.statuses.find(
          (row) => row.id === status.value,
        ).phase;
        renderItems();
        changed();
      });
      const rating = button(
        "",
        (event) => openRating(item, event.currentTarget),
        "db-card-rating",
      );
      rating.setAttribute("aria-label", t("Оценить: ", "Rate: ") + item.name);
      rating.append(
        icon("star"),
        make(
          "strong",
          "db-rating-number",
          item.rating
            ? numberFormat(ctx.displayLocale(), {
                maximumFractionDigits: 1,
              }).format(ratingOf(item))
            : "—",
        ),
        make("small", "db-rating-maximum", "/" + config.ratingMax),
      );
      rating.dataset.rated = String(Boolean(item.rating));
      quickRow.append(status);
      if (config.ratingEnabled) quickRow.append(rating);
      info.append(quickRow);
      if (item.genres?.length)
        info.append(text("small", "db-genre-caption", item.genres.join(" · ")));
      if (phaseOf(item) === "active" && item.progress?.current)
        info.append(make("small", "db-progress-caption", progressText(item)));
      const actions = make("div", "db-card-actions");
      actions.append(
        iconButton("pencil", t("Изменить: ", "Edit: ") + item.name, (event) =>
          ctx.openDatabaseItem(item, event.currentTarget),
        ),
        iconButton(
          "ellipsis",
          t("Действия: ", "Actions: ") + item.name,
          (event) => ctx.itemMenu("database", item, event.currentTarget),
        ),
      );
      if (selecting) {
        const label = make("label", "db-card-check"),
          checkbox = make("input");
        checkbox.type = "checkbox";
        checkbox.checked = selected.has(item.id);
        checkbox.setAttribute(
          "aria-label",
          t("Выбрать: ", "Select: ") + item.name,
        );
        listen(checkbox, "change", () => {
          if (checkbox.checked) selected.add(item.id);
          else selected.delete(item.id);
          renderItems();
        });
        label.append(checkbox);
        card.append(label);
      }
      card.append(cover, info, actions);
      host.append(card);
    }
    if (!rows.length)
      host.append(
        make(
          "p",
          "aux-note aux-empty",
          query || filter
            ? t("Ничего не найдено.", "No matching entries.")
            : t(
                "Сохраните сюда то, к чему хочется вернуться.",
                "Save something you would like to return to.",
              ),
        ),
      );
    more.hidden = rows.length <= limit;
    ctx.services.refreshIcons(host);
  }
  function openRating(item, opener) {
    const maximum = configOf(item).ratingMax;
    let draftRating = ratingOf(item) || null;
    const picker = createRatingPicker(ctx, {
      maximum,
      value: draftRating,
      onChange(value) {
        draftRating = value;
      },
    });
    const actions = make("div", "dialog-actions");
    actions.append(
      button(t("Отмена", "Cancel"), ctx.closeDialog),
      button(
        t("Сохранить", "Save"),
        () => {
          const current = items.find((entry) => entry.id === item.id);
          if (!current) {
            ctx.closeDialog();
            return;
          }
          current.rating = draftRating;
          current.ratingMax = maximum;
          ctx.closeDialog();
          renderItems();
          changed();
        },
        "button button-primary",
      ),
    );
    quickBody.replaceChildren(
      text("p", "", item.name),
      picker.element,
      actions,
    );
    ctx.openDialog("db-quick-dialog", opener);
  }
  function moveBatch() {
    const destination = moveSelect.value;
    if (!categories.includes(destination)) return;
    const moved = items
      .filter((item) => selected.has(item.id))
      .map((item) => ({ item, category: item.category }));
    for (const { item } of moved) item.category = destination;
    selected.clear();
    selecting = false;
    render();
    changed();
    ctx.notify(t("Записи перенесены", "Entries moved"), () => {
      for (const { item, category } of moved)
        if (items.includes(item))
          item.category = categories.includes(category)
            ? category
            : ctx.selectedCollection();
      render();
      ctx.refreshMaterialOwners();
    });
    ctx.refreshMaterialOwners();
  }
  function deleteBatch() {
    const saved = items
      .filter((item) => selected.has(item.id))
      .map((item) => ({
        item,
        index: items.indexOf(item),
        cover: ctx.databaseCover(item.id),
      }));
    for (const { item } of saved) {
      items.splice(items.indexOf(item), 1);
      ctx.setDatabaseCover(item.id, null);
    }
    selected.clear();
    selecting = false;
    render();
    changed();
    ctx.refreshMaterialOwners();
    ctx.notify(t("Записи удалены", "Entries deleted"), () => {
      for (const { item, index, cover } of saved) {
        if (!categories.includes(item.category))
          item.category = ctx.selectedCollection() || categories[0];
        if (!item.category) {
          categories.push("Материалы");
          item.category = "Материалы";
        }
        if (!items.some((row) => row.id === item.id))
          items.splice(Math.min(index, items.length), 0, item);
        if (cover) ctx.setDatabaseCover(item.id, cover);
      }
      render();
      ctx.refreshMaterialOwners();
    });
  }
  function progressText(item) {
    const unit =
      kindOf(item) === "book" ? t("стр.", "pages") : t("эп.", "episodes");
    return (
      item.progress.current +
      (item.progress.total ? " / " + item.progress.total : "") +
      " " +
      unit
    );
  }
  function editorOptions(preferred) {
    const category =
      $("#archive-item-collection").value || ctx.selectedCollection();
    const config = collections.config(category);
    const value =
      typeof preferred === "string"
        ? preferred
        : fields.status.value || "planned";
    fields.status.replaceChildren();
    for (const status of config.statuses) {
      const option = text("option", "", statusName(status, config));
      option.value = status.id;
      fields.status.append(option);
    }
    fields.status.value = config.statuses.some((status) => status.id === value)
      ? value
      : config.statuses[0].id;
    progressBox.hidden =
      config.statuses.find((status) => status.id === fields.status.value)
        .phase !== "active" || !["book", "anime"].includes(fields.kind.value);
    currentField.firstChild.textContent =
      fields.kind.value === "book"
        ? t("Прочитано страниц", "Pages read")
        : t("Просмотрено эпизодов", "Episodes watched");
    const ratingInput = $("#archive-item-rating");
    if (
      editorRatingMax !== config.ratingMax &&
      config.ratingEnabled &&
      ratingInput.value
    )
      ratingInput.value = String(
        Math.min(
          config.ratingMax,
          Math.round(
            (Number(ratingInput.value) / editorRatingMax) *
              config.ratingMax *
              2,
          ) / 2,
        ),
      );
    editorRatingMax = config.ratingMax;
    ratingInput.closest("label").hidden =
      !config.ratingEnabled || Boolean(editorProject && !editor);
    ctx.renderDatabaseRating();
    renderGenreChoices();
  }
  function renderGenreChoices() {
    const config = collections.config($("#archive-item-collection").value);
    genreChoices.replaceChildren();
    for (const genre of [...new Set([...config.genres, ...entryGenres])]) {
      const label = make("label", "db-genre-choice"),
        checkbox = make("input");
      checkbox.type = "checkbox";
      checkbox.checked = entryGenres.includes(genre);
      listen(checkbox, "change", () => {
        if (checkbox.checked) entryGenres.push(genre);
        else entryGenres = entryGenres.filter((value) => value !== genre);
      });
      label.append(checkbox, text("span", "", genre));
      genreChoices.append(label);
    }
    genreField.hidden = !genreChoices.childElementCount;
  }
  function drafts() {
    const prefs = state.uiPreferences;
    if (
      !prefs.databaseDrafts ||
      typeof prefs.databaseDrafts !== "object" ||
      Array.isArray(prefs.databaseDrafts)
    )
      prefs.databaseDrafts = {};
    return prefs.databaseDrafts;
  }
  function draftKey() {
    return editor?.id
      ? String(editor.id)
      : editorProject
        ? "project-" + editorProject.id
        : "new";
  }
  function readFields() {
    const config = collections.config($("#archive-item-collection").value);
    return {
      creator: fields.creator.value.trim(),
      kind: editorProject && !editor ? "material" : fields.kind.value,
      status: fields.status.value,
      statusPhase:
        config.statuses.find((status) => status.id === fields.status.value)
          ?.phase || "planned",
      rating:
        config.ratingEnabled && (!editorProject || editor)
          ? Number($("#archive-item-rating").value) || null
          : editor?.rating || null,
      ratingMax:
        config.ratingEnabled && (!editorProject || editor)
          ? config.ratingMax
          : editor?.ratingMax || 5,
      genres: [...new Set(entryGenres)],
      ...(editorProject && !editor
        ? { originProjectId: editorProject.id }
        : {}),
      url: fields.url.value.trim(),
      progress: {
        current: Number(fields.current.value) || 0,
        total: Number(fields.total.value) || null,
      },
      attachments: structuredClone(attachments),
    };
  }
  function draftValue() {
    return {
      ...readFields(),
      name: $("#archive-item-name").value,
      date: $("#archive-item-date").value,
      rating: Number($("#archive-item-rating").value) || null,
      review: $("#archive-item-review").value,
      category: $("#archive-item-collection").value,
      cover: ctx.databaseDraftCover(),
      updatedAt: Date.now(),
    };
  }
  function trimDrafts() {
    const keys = Object.keys(drafts()).sort(
      (a, b) => (drafts()[b].updatedAt || 0) - (drafts()[a].updatedAt || 0),
    );
    for (const key of keys.slice(10)) delete drafts()[key];
  }
  function saveDraft() {
    if (editor === undefined) return;
    if (draftTimer) {
      ctx.clearTimeout(draftTimer);
      draftTimer = 0;
    }
    const value = draftValue();
    if (
      !value.name.trim() &&
      !value.review.trim() &&
      !value.creator &&
      !value.url &&
      !value.cover &&
      !value.attachments.length &&
      !editor
    )
      delete drafts()[draftKey()];
    else drafts()[draftKey()] = value;
    // A bounded set of editor drafts prevents abandoned file copies growing forever.
    trimDrafts();
    changed();
  }
  function queueDraft() {
    if (editor === undefined) return;
    if (draftTimer) ctx.clearTimeout(draftTimer);
    draftTimer = ctx.setTimeout(saveDraft, 400);
  }
  listen(form, "input", queueDraft);
  listen(form, "change", queueDraft);
  listen(fields.kind, "change", () => {
    kindTouched = true;
    editorOptions();
  });
  listen(fields.status, "change", editorOptions);
  listen($("#archive-item-collection"), "change", () => {
    if (!editor?.id && !kindTouched) {
      fields.kind.value = kindOf({
        category: $("#archive-item-collection").value,
      });
    }
    editorOptions();
  });
  listen(form, "input", () => {
    duplicate.hidden = true;
    duplicateAllowed = false;
  });
  function opened(item) {
    editor = item || null;
    editorProject = requestedProject;
    requestedProject = null;
    kindTouched = Boolean(item?.kind);
    fileToken++;
    pendingFile = false;
    attachments = structuredClone(item?.attachments || []);
    fileError.hidden = true;
    duplicateAllowed = false;
    duplicate.hidden = true;
    const draft = drafts()[draftKey()];
    const value = draft || item || { category: ctx.selectedCollection() };
    entryGenres = [...(value.genres || [])];
    fields.creator.value = value.creator || "";
    fields.kind.value = kindOf(value);
    fields.status.value = statusOf(value);
    fields.url.value = value.url || "";
    fields.current.setCustomValidity("");
    fields.url.setCustomValidity("");
    fileAdd.disabled = false;
    fields.current.value = value.progress?.current ?? "";
    fields.total.value = value.progress?.total ?? "";
    resources.open = Boolean(value.url || value.attachments?.length);
    detailFields.open = Boolean(
      value.creator || value.review || value.url || value.attachments?.length,
    );
    if (draft) {
      for (const key of ["name", "date", "review", "rating"])
        $("#archive-item-" + key).value = value[key] ?? "";
      if (categories.includes(value.category))
        $("#archive-item-collection").value = value.category;
      attachments = structuredClone(value.attachments || []);
      ctx.restoreDatabaseDraftCover(value.cover || null);
      ctx.renderDatabaseRating();
    }
    if (editorProject && !item)
      $("#archive-item-collection").value = materialCollection();
    editorRatingMax = collections.config(
      $("#archive-item-collection").value,
    ).ratingMax;
    if (!draft && item)
      $("#archive-item-rating").value = configOf(item).ratingEnabled
        ? ratingOf(item) || ""
        : item.rating || "";
    notice.replaceChildren();
    notice.hidden = !draft;
    if (draft)
      notice.append(
        make("span", "", t("Черновик восстановлен", "Draft restored")),
        button(
          t("Сбросить", "Discard"),
          () => {
            delete drafts()[draftKey()];
            editor = undefined;
            if (editorProject)
              openProjectMaterial(editorProject, item, $("#project-materials"));
            else ctx.openDatabaseItem(item, $("#archive-item-add"));
            changed();
          },
          "text-button",
        ),
      );
    editorOptions(statusOf(value));
    const capture = Boolean(editorProject && !item);
    form.dataset.projectMaterial = String(capture);
    const materialContent = Boolean(
      editorProject && (!item || kindOf(item) === "material"),
    );
    form.dataset.projectMaterialContent = String(materialContent);
    $("#archive-item-review").closest("label").firstChild.textContent =
      materialContent
        ? t("Заметка", "Note")
        : t("Краткая рецензия", "Short review");
    const hasCover = Boolean(ctx.databaseDraftCover());
    const chooseLabel = materialContent
      ? hasCover
        ? t("Заменить изображение", "Replace image")
        : t("Добавить скриншот", "Add screenshot")
      : hasCover
        ? t("Заменить обложку", "Replace cover")
        : t("Добавить обложку", "Add cover");
    $("#archive-cover-choose-label").textContent = chooseLabel;
    statusRow.hidden = capture;
    if (capture) {
      $("#archive-item-dialog-title").textContent = t(
        "Материал проекта",
        "Project material",
      );
      fields.kind.value = "material";
      fields.url.closest("label").hidden = false;
      $("#archive-item-name")
        .closest("label")
        .after(fields.url.closest("label"));
      resources.open = true;
      detailFields.open = true;
    } else {
      resources.querySelector("summary").after(fields.url.closest("label"));
    }
    metadata.hidden = capture;
    fields.kind.closest("label").hidden = capture;
    progressBox.hidden = capture || progressBox.hidden;
    renderFiles();
  }
  function beforeSave() {
    if (pendingFile) return false;
    const current = Number(fields.current.value) || 0,
      total = Number(fields.total.value) || null;
    fields.current.setCustomValidity(
      total && current > total
        ? t(
            "Прогресс не может превышать общее количество.",
            "Progress cannot exceed the total.",
          )
        : "",
    );
    fields.url.setCustomValidity(
      fields.url.value && !safeUrl(fields.url.value)
        ? t("Укажите ссылку HTTP или HTTPS.", "Use an HTTP or HTTPS link.")
        : "",
    );
    if (!form.reportValidity()) return false;
    const name = normalize($("#archive-item-name").value),
      category = $("#archive-item-collection").value;
    const existing = items.find(
      (item) =>
        item.id !== editor?.id &&
        item.category === category &&
        (!editorProject ||
          !item.originProjectId ||
          item.originProjectId === editorProject.id) &&
        normalize(item.name) === name,
    );
    if (existing && !duplicateAllowed) {
      duplicate.replaceChildren(
        make(
          "p",
          "",
          t(
            "В этой коллекции уже есть такая запись.",
            "This collection already contains this entry.",
          ),
        ),
        button(
          editorProject
            ? t("Прикрепить существующую", "Attach existing")
            : t("Открыть существующую", "Open existing"),
          () => {
            const owner = editorProject;
            if (owner && ctx.projects.includes(owner)) {
              owner.materialIds = [
                ...new Set([...(owner.materialIds || []), existing.id]),
              ];
              delete drafts()[draftKey()];
              editor = undefined;
              ctx.closeDialog();
              ctx.refreshMaterialOwners();
              changed();
              return;
            }
            saveDraft();
            ctx.closeDialog();
            ctx.openDatabaseView(existing, $("#archive-item-add"));
          },
        ),
        button(
          t("Сохранить отдельной записью", "Save another entry"),
          () => {
            duplicateAllowed = true;
            form.dispatchEvent(
              new Event("submit", { bubbles: true, cancelable: true }),
            );
          },
          "text-button",
        ),
      );
      duplicate.hidden = false;
      return false;
    }
    return true;
  }
  function saved(item) {
    if (editorProject && ctx.projects.includes(editorProject))
      editorProject.materialIds = [
        ...new Set([...(editorProject.materialIds || []), item.id]),
      ];
    delete drafts()[draftKey()];
    editor = undefined;
    editorProject = null;
    duplicate.hidden = true;
    ctx.refreshMaterialOwners();
  }
  function closing(id) {
    if (id === "archive-item-dialog") {
      saveDraft();
      editor = undefined;
      editorProject = null;
      fileToken++;
      pendingFile = false;
    }
  }
  function renderFiles() {
    fileList.replaceChildren();
    for (const [index, file] of attachments.entries()) {
      const row = make("div", "db-file-row");
      row.append(
        text("span", "", file.name),
        make("small", "subtle", Math.ceil(file.size / 1024) + " KB"),
        iconButton("x", t("Убрать файл: ", "Remove file: ") + file.name, () => {
          attachments.splice(index, 1);
          renderFiles();
          saveDraft();
        }),
      );
      fileList.append(row);
    }
  }
  async function addFile() {
    const token = ++fileToken;
    fileError.hidden = true;
    try {
      const file = await ctx.services.openFile("document");
      if (!file || token !== fileToken || editor === undefined) return;
      if (
        !/\.(pdf|docx?|txt|md)$/i.test(file.name) ||
        file.size > 5 * 1024 * 1024 ||
        !file.size
      )
        throw Error(
          t(
            "Выберите PDF, DOCX, DOC, TXT или MD до 5 МБ.",
            "Choose a PDF, DOCX, DOC, TXT or MD up to 5 MB.",
          ),
        );
      if (attachments.length >= 6)
        throw Error(
          t("До 6 файлов в одной записи.", "Up to 6 files per entry."),
        );
      if (
        attachments.some(
          (row) => row.name === file.name && row.size === file.size,
        )
      )
        throw Error(
          t("Этот файл уже прикреплён.", "This file is already attached."),
        );
      pendingFile = true;
      fileAdd.disabled = true;
      form.querySelector('[type="submit"]').disabled = true;
      const data = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () =>
          reject(
            Error(t("Не удалось прочитать файл.", "Could not read file.")),
          );
        reader.readAsDataURL(file);
      });
      if (token !== fileToken || editor === undefined) return;
      const bytes =
        items.reduce(
          (sum, item) =>
            sum + (item.attachments || []).reduce((n, row) => n + row.size, 0),
          0,
        ) + attachments.reduce((sum, row) => sum + row.size, 0);
      if (bytes + file.size > 20 * 1024 * 1024)
        throw Error(
          t(
            "Лимит файлов — 20 МБ. Удалите ненужные файлы или сохраните ссылку.",
            "File limit is 20 MB. Remove unused files or save a link.",
          ),
        );
      if (
        new TextEncoder().encode(JSON.stringify(ctx.documentSnapshot()))
          .length +
          data.length >
        90 * 1024 * 1024
      )
        throw Error(
          t(
            "Недостаточно места в рабочем пространстве. Сохраните ссылку на файл.",
            "Workspace is too large. Save a link to the file instead.",
          ),
        );
      attachments.push({
        name: file.name.slice(0, 180),
        size: file.size,
        data,
      });
      renderFiles();
      saveDraft();
    } catch (error) {
      if (token === fileToken) {
        fileError.textContent = error.message;
        fileError.hidden = false;
      }
    } finally {
      if (token === fileToken) {
        pendingFile = false;
        fileAdd.disabled = false;
        form.querySelector('[type="submit"]').disabled = false;
      }
    }
  }
  listen(fields.current, "input", () => fields.current.setCustomValidity(""));
  listen(fields.total, "input", () => fields.current.setCustomValidity(""));
  listen(fields.url, "input", () => fields.url.setCustomValidity(""));
  function viewed(item) {
    viewExtra.replaceChildren();
    const summary = make("div", "db-view-summary");
    if (item.creator) summary.append(text("span", "subtle", item.creator));
    summary.append(
      text(
        "span",
        "db-status-label",
        statusName(
          configOf(item).statuses.find(
            (status) => status.id === statusOf(item),
          ),
          configOf(item),
          kindOf(item),
        ),
      ),
    );
    if (item.progress?.current)
      summary.append(make("span", "subtle", progressText(item)));
    viewExtra.append(summary);
    $("#archive-view-meta").textContent =
      ctx.shortDate(item.date) +
      (configOf(item).ratingEnabled && item.rating
        ? " · " + ratingOf(item) + " / " + configOf(item).ratingMax
        : "");
    if (item.genres?.length)
      summary.append(text("span", "subtle", item.genres.join(" · ")));
    const url = safeUrl(item.url);
    if (url)
      viewExtra.append(
        button(t("Открыть ссылку", "Open link"), async () => {
          try {
            await ctx.services.openExternal(url);
          } catch (error) {
            ctx.notify(String(error.message || error));
          }
        }),
      );
    for (const file of item.attachments || [])
      viewExtra.append(
        button(
          t("Сохранить файл: ", "Save file: ") + file.name,
          async () => {
            try {
              await ctx.services.saveAttachment(file.name, file.data);
            } catch (error) {
              ctx.notify(String(error.message || error));
            }
          },
          "db-file-download",
        ),
      );
    const owners = [
      ...state.thoughts.map((owner) => ({ owner, kind: "thought" })),
      ...ctx.projects.map((owner) => ({ owner, kind: "project" })),
    ].filter(
      ({ owner }) =>
        Array.isArray(owner.materialIds) && owner.materialIds.includes(item.id),
    );
    if (owners.length) {
      const backlinks = make("div", "db-backlinks");
      backlinks.append(
        make("small", "subtle", t("Используется в", "Referenced by")),
      );
      for (const { owner, kind } of owners)
        backlinks.append(
          button(
            owner.title || owner.name,
            () => {
              ctx.closeDialog();
              ctx.openMaterialOwner(kind, owner);
            },
            "text-button",
          ),
        );
      viewExtra.append(backlinks);
    }
  }
  function renderLinks(host, owner, kind) {
    if (!owner) return;
    const block = make("section", "db-material-links");
    block.dataset.ownerKind = kind;
    block.dataset.ownerId = String(owner.id);
    const heading = make("div", "db-material-heading");
    heading.append(make("h3", "", t("Материалы", "Materials")));
    if (kind === "project")
      heading.append(
        button(
          t("+ Материал", "+ Material"),
          (event) => openProjectMaterial(owner, null, event.currentTarget),
          "button project-material-add",
        ),
      );
    heading.append(
      button(
        kind === "project"
          ? t("Из базы данных", "From database")
          : t("+ Ссылка на материал", "+ Material reference"),
        (event) => openPicker(owner, kind, event.currentTarget),
        "text-button",
      ),
    );
    block.append(heading);
    for (const id of Array.isArray(owner.materialIds)
      ? owner.materialIds
      : []) {
      const item = items.find((item) => item.id === id),
        row = make("div", "db-material-row");
      const open = button(
        "",
        (event) =>
          kind === "project" && safeUrl(item?.url)
            ? openExternal(item.url)
            : ctx.openDatabaseView(item, event.currentTarget),
        "db-material-open",
      );
      open.disabled = !item;
      const source = item && ctx.databaseCover(item.id);
      if (source && kind === "project") {
        const image = make("img", "project-material-thumbnail");
        image.src = source;
        image.alt = "";
        open.append(image);
      } else
        open.append(
          icon(
            item?.url
              ? "link"
              : item?.attachments?.length
                ? "file-text"
                : "image",
          ),
        );
      open.append(
        text(
          "span",
          "",
          item?.name || t("Материал удалён", "Material deleted"),
        ),
      );
      if (item)
        open.append(
          text(
            "small",
            "subtle",
            kind === "project" && safeUrl(item.url)
              ? new URL(item.url).hostname
              : item.category,
          ),
        );
      if (item && kind === "project") {
        row.append(
          open,
          iconButton(
            "file-text",
            t("Подробнее о материале", "Material details"),
            (event) => ctx.openDatabaseView(item, event.currentTarget),
          ),
          iconButton(
            "pencil",
            t("Изменить материал", "Edit material"),
            (event) => openProjectMaterial(owner, item, event.currentTarget),
          ),
        );
      } else if (item && safeUrl(item.url))
        row.append(
          open,
          iconButton("external-link", t("Открыть ссылку", "Open link"), () =>
            openExternal(item.url),
          ),
        );
      row.append(
        ...(row.contains(open) ? [] : [open]),
        iconButton("x", t("Убрать ссылку", "Remove reference"), () => {
          owner.materialIds = owner.materialIds.filter((value) => value !== id);
          ctx.refreshMaterialOwners();
          changed();
          ctx.notify(t("Ссылка убрана", "Reference removed"), () => {
            owner.materialIds = [
              ...new Set([...(owner.materialIds || []), id]),
            ];
            ctx.refreshMaterialOwners();
          });
        }),
      );
      block.append(row);
    }
    host.append(block);
    ctx.services.refreshIcons(block);
  }
  async function openExternal(url) {
    try {
      await ctx.services.openExternal(safeUrl(url));
    } catch (error) {
      ctx.notify(error.message || String(error));
    }
  }
  function materialCollection() {
    const name =
      categories.find((name) => /материал|material/i.test(name)) || "Материалы";
    if (!categories.includes(name)) categories.push(name);
    return name;
  }
  function openProjectMaterial(owner, item, opener) {
    if (!ctx.projects.includes(owner)) return;
    ctx.closeDialog();
    requestedProject = owner;
    ctx.selectCollection(item?.category || materialCollection());
    ctx.openDatabaseItem(item, opener);
  }
  function openPicker(owner, kind, opener) {
    ctx.flushThoughts();
    pickerOwner = owner;
    pickerKind = kind;
    pickerIds = new Set(owner.materialIds || []);
    pickerQuery = "";
    pickerSearch.value = "";
    pickerLimit = 40;
    renderPicker();
    ctx.openDialog("db-reference-dialog", opener);
    if (!ctx.services.mobile && !window.matchMedia("(pointer: coarse)").matches)
      pickerSearch.focus({ preventScroll: true });
  }
  function renderPicker() {
    pickerList.replaceChildren();
    const needle = normalize(pickerQuery),
      rows = items
        .filter(
          (item) =>
            !needle ||
            normalize(item.name + " " + item.category).includes(needle),
        )
        .sort(
          (a, b) =>
            Number(pickerIds.has(b.id)) - Number(pickerIds.has(a.id)) ||
            a.name.localeCompare(b.name, ctx.displayLocale()),
        );
    for (const item of rows.slice(0, pickerLimit)) {
      const label = make("label", "db-reference-option"),
        checkbox = make("input");
      checkbox.type = "checkbox";
      checkbox.checked = pickerIds.has(item.id);
      listen(checkbox, "change", () => {
        if (checkbox.checked) pickerIds.add(item.id);
        else pickerIds.delete(item.id);
      });
      const caption = make("span");
      caption.append(
        text("strong", "", item.name),
        text("small", "subtle", item.category),
      );
      label.append(checkbox, caption);
      pickerList.append(label);
    }
    if (!rows.length)
      pickerList.append(
        make(
          "p",
          "aux-note",
          needle
            ? t("Ничего не найдено.", "No matching entries.")
            : t(
                "Сначала добавьте запись в базу данных. Здесь можно ссылаться на книги, фильмы и любые материалы.",
                "Add an entry to the database first. You can reference books, films and any materials here.",
              ),
        ),
      );
    pickerMore.hidden = rows.length <= pickerLimit;
  }
  function saveReferences() {
    const collection = pickerKind === "thought" ? state.thoughts : ctx.projects;
    if (!collection.includes(pickerOwner)) {
      ctx.closeDialog();
      return;
    }
    pickerOwner.materialIds = [...pickerIds].filter((id) =>
      items.some((item) => item.id === id),
    );
    ctx.closeDialog();
    ctx.refreshMaterialOwners();
    changed();
  }
  function renderProject(project) {
    currentProject = project;
    let host = $("#project-materials");
    if (!host) {
      host = make("div");
      host.id = "project-materials";
      $("#project-description").after(host);
    }
    host.replaceChildren();
    host.hidden = !project;
    renderLinks(host, project, "project");
    $("#project-actions-open").disabled = !project;
  }
  listen(window, "pagehide", saveDraft);
  listen(window, "life-os:pause", saveDraft);
  return {
    render,
    opened,
    viewed,
    beforeSave,
    readFields,
    saved,
    closing,
    coverTarget: () =>
      editor === undefined ? null : { key: draftKey(), value: draftValue() },
    coverChanged(cover, target) {
      if (editor !== undefined) saveDraft();
      else if (target?.key) {
        drafts()[target.key] = {
          ...target.value,
          ...drafts()[target.key],
          cover,
          updatedAt: Date.now(),
        };
        trimDrafts();
        changed();
      }
    },
    renderLinks,
    renderProject,
    collectionOpened: collections.opened,
    beforeCollectionSave: collections.save,
    removeCollection: collections.remove,
    restoreCollection: collections.restore,
    rehydrate() {
      editor = undefined;
      editorProject = null;
      requestedProject = null;
      genreFilter = "";
      selected.clear();
      selecting = false;
      fileToken++;
      render();
    },
    flush: saveDraft,
    canDuplicate(item) {
      const fileBytes =
        items.reduce(
          (sum, row) =>
            sum +
            (row.attachments || []).reduce(
              (total, file) => total + file.size,
              0,
            ),
          0,
        ) + (item.attachments || []).reduce((sum, file) => sum + file.size, 0);
      if (
        fileBytes > 20 * 1024 * 1024 ||
        new TextEncoder().encode(JSON.stringify(ctx.documentSnapshot()))
          .length +
          new TextEncoder().encode(JSON.stringify(item)).length +
          (ctx.databaseCover(item.id)?.length || 0) >
          90 * 1024 * 1024
      ) {
        ctx.notify(
          t(
            "Для копии недостаточно места. Можно сослаться на эту запись из мысли или проекта.",
            "There is not enough space for a copy. You can reference this entry from a thought or project.",
          ),
        );
        return false;
      }
      return true;
    },
  };
}

// Backups keep the optional fields and reject unsafe/malformed references or files.
export function validateDatabaseExtras(data) {
  validateCollectionSettings(data);
  const string = (value, max) =>
    value === undefined || (typeof value === "string" && value.length <= max);
  const refs = (value) =>
    value === undefined ||
    (Array.isArray(value) &&
      value.length <= 10000 &&
      value.every((id) => Number.isSafeInteger(id) && id > 0) &&
      new Set(value).size === value.length);
  const attachments = (value) =>
    value === undefined ||
    (Array.isArray(value) &&
      value.length <= 6 &&
      value.every((file) => {
        if (
          !file ||
          typeof file.name !== "string" ||
          file.name.length > 180 ||
          !/\.(pdf|docx?|txt|md)$/i.test(file.name) ||
          !Number.isInteger(file.size) ||
          file.size < 1 ||
          file.size > 5 * 1024 * 1024 ||
          typeof file.data !== "string"
        )
          return false;
        const payload = /^data:[\w.+/-]*;base64,([A-Za-z0-9+/]*={0,2})$/.exec(
          file.data,
        )?.[1];
        return Boolean(
          payload &&
          payload.length % 4 === 0 &&
          (payload.length / 4) * 3 -
            (payload.endsWith("==") ? 2 : payload.endsWith("=") ? 1 : 0) ===
            file.size,
        );
      }));
  const extra = (item, draft = false) => {
    if (
      !string(item.creator, 140) ||
      !string(item.url, 2000) ||
      (item.kind !== undefined &&
        !["book", "film", "anime", "game", "material"].includes(item.kind)) ||
      (item.status !== undefined &&
        (typeof item.status !== "string" ||
          !/^(planned|active|done|status-\d+)$/.test(item.status))) ||
      (item.statusPhase !== undefined &&
        !["planned", "active", "done"].includes(item.statusPhase)) ||
      (item.ratingMax !== undefined && ![5, 10].includes(item.ratingMax)) ||
      (item.originProjectId !== undefined &&
        (!Number.isSafeInteger(item.originProjectId) ||
          item.originProjectId <= 0)) ||
      (item.genres !== undefined &&
        (!Array.isArray(item.genres) ||
          item.genres.length > 50 ||
          new Set(item.genres).size !== item.genres.length ||
          item.genres.some(
            (genre) =>
              typeof genre !== "string" || !genre.trim() || genre.length > 60,
          ))) ||
      !attachments(item.attachments)
    )
      return false;
    if (item.url && !draft) {
      try {
        const url = new URL(item.url);
        if (
          !["http:", "https:"].includes(url.protocol) ||
          url.username ||
          url.password
        )
          return false;
      } catch {
        return false;
      }
    }
    if (item.progress !== undefined) {
      const { current, total } = item.progress || {};
      if (
        !(draft ? Number.isFinite(current) : Number.isInteger(current)) ||
        current < 0 ||
        current > 100000 ||
        (total !== null &&
          (!(draft ? Number.isFinite(total) : Number.isInteger(total)) ||
            total < 1 ||
            total > 100000 ||
            (!draft && current > total)))
      )
        return false;
    }
    return true;
  };
  if (
    (data.archiveItems || []).some((item) => !extra(item)) ||
    [...(data.thoughts || []), ...(data.projects || [])].some(
      (item) => !refs(item.materialIds),
    )
  )
    throw Error("Некорректные материалы или ссылки на материалы.");
  const drafts = data.uiPreferences?.databaseDrafts;
  if (
    drafts !== undefined &&
    (!drafts ||
      typeof drafts !== "object" ||
      Array.isArray(drafts) ||
      Object.keys(drafts).length > 10 ||
      Object.entries(drafts).some(
        ([key, value]) =>
          !/^(new|[1-9]\d*|project-[1-9]\d*)$/.test(key) ||
          !value ||
          !extra(value, true) ||
          !string(value.name, 100000) ||
          !string(value.review, 100000) ||
          (value.cover &&
            !/^data:image\/(jpeg|png);base64,[A-Za-z0-9+/=]+$/.test(
              value.cover,
            )),
      ))
  )
    throw Error("Некорректные черновики базы данных.");
}
