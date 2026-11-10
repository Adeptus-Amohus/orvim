// Thoughts keep their existing IDs and storage fields; new metadata is optional.
import { searchFragment } from "./experience-model.js";
import { highlightText, highlightTree } from "./search-highlight.js";
import { personalProject } from "./changes.js";
export function installThoughtFeed(ctx) {
  const { screen, root, make, listen, services, extraState: state } = ctx;
  let selected = null,
    editing = false,
    menuOpen = false,
    panel = null;
  let timer = 0,
    draftTimer = 0,
    limit = 60,
    query = "",
    topic = "",
    pinnedOnly = false;
  let swipe = null,
    suppressOpenUntil = 0,
    editOriginal = null,
    lastEditorBody = "",
    listFilter = "";
  const t = (ru, en) => ctx.translate(ru, en);
  const items = () => state.thoughts;
  const current = () => items().find((item) => item.id === selected);
  const $ = (selector) => screen.querySelector(selector);
  const icon = (name) => {
    const node = make("i");
    node.dataset.lucide = name;
    node.setAttribute("aria-hidden", "true");
    return node;
  };
  const button = (text, action, className = "thought-feed-button") => {
    const node = make("button", className + " cursor-interaction", text);
    node.type = "button";
    if (action) node.dataset.thoughtAction = action;
    return node;
  };
  const iconButton = (name, label, action) => {
    const node = button("", action, "thought-feed-icon");
    node.setAttribute("aria-label", label);
    node.append(icon(name));
    return node;
  };
  const userText = (tag, className, text) => {
    const node = make(tag, className, text);
    node.dataset.userContent = "";
    return node;
  };
  Object.assign(ctx.translations, {
    "Найти мысль": "Find a thought",
    "Что хочется сохранить?": "What would you like to keep?",
    Записать: "Capture",
    Закреплённые: "Pinned",
    "Все темы": "All topics",
    "Поиск в мыслях": "Search thoughts",
    "Тема мысли": "Thought topic",
    "Открытая мысль": "Open thought",
    "Показать ещё": "Show more",
  });
  function autoTitle(body) {
    const first =
      body
        .split("\n")
        .find((line) => line.trim())
        ?.replace(/^#+\s*|\*\*/g, "") || t("Без названия", "Untitled");
    return (first.match(/^.*?[.!?](?:\s|$)/)?.[0] || first)
      .trim()
      .slice(0, 200);
  }
  function excerpt(item) {
    const plain = (item.body || "")
      .replace(/^#+\s*/gm, "")
      .replace(/\*\*/g, "");
    return (
      plain.startsWith(item.title) ? plain.slice(item.title.length) : plain
    )
      .trim()
      .replace(/^[-*]\s/gm, "")
      .replace(/\n+/g, " ");
  }
  screen.classList.add("thought-feed");
  screen.innerHTML = `<div class="thought-feed-toolbar"><label class="thought-feed-search"><i data-lucide="search" aria-hidden="true"></i><input type="search" id="thought-feed-search" maxlength="200" aria-label="Поиск в мыслях" placeholder="Найти мысль"></label></div>
    <section class="thought-feed-capture" aria-label="Новая мысль"><textarea id="thought-feed-capture" maxlength="10000" rows="2" aria-label="Записать мысль" placeholder="Что хочется сохранить?"></textarea><div class="thought-feed-capture-footer"><small>Ctrl ↵</small><button type="button" class="thought-feed-button thought-feed-primary cursor-interaction" data-thought-action="capture"><i data-lucide="plus" aria-hidden="true"></i>Записать</button></div></section>
    <div class="thought-feed-filters"><button type="button" class="thought-feed-filter cursor-interaction" data-thought-action="all" aria-pressed="true">Все</button><button type="button" class="thought-feed-filter cursor-interaction" data-thought-action="pinned" aria-pressed="false">Закреплённые</button><select id="thought-feed-topic" aria-label="Тема мысли"></select></div>
    <div class="thought-feed-workspace"><div class="thought-feed-scroll" tabindex="0" role="region" aria-label="Список мыслей"><div id="thoughts-list" class="thought-feed-list"></div><button type="button" class="thought-feed-button cursor-interaction" data-thought-action="more" hidden>Показать ещё</button></div><section class="thought-feed-detail" aria-label="Открытая мысль" hidden></section></div>`;
  const listScroll = $(".thought-feed-scroll");
  listen(listScroll, "scroll", () => {
    if (
      !$("[data-thought-action='more']").hidden &&
      listScroll.scrollHeight - listScroll.scrollTop - listScroll.clientHeight <
        240
    ) {
      limit += 60;
      renderList();
    }
  });
  const capture = $("#thought-feed-capture");
  capture.value = state.uiPreferences.thoughtDraft || "";
  const draftStatus = make("small", "thought-draft-status");
  draftStatus.setAttribute("role", "status");
  $(".thought-feed-capture-footer").prepend(draftStatus);
  let draftRevision = 0;
  function changed() {
    ctx.onChange?.();
    ctx.persistState();
  }
  function formatInline(host, text) {
    for (const part of text.split(/(\*\*[^*]+\*\*)/g)) {
      if (part.startsWith("**") && part.endsWith("**"))
        host.append(userText("strong", "", part.slice(2, -2)));
      else host.append(document.createTextNode(part));
    }
  }
  function renderBody(host, text) {
    host.dataset.userContent = "";
    host.replaceChildren();
    let list;
    for (const line of text.split("\n")) {
      if (!line.trim()) {
        list = null;
        continue;
      }
      if (/^[-*]\s/.test(line)) {
        if (!list) {
          list = make("ul");
          host.append(list);
        }
        const row = make("li");
        formatInline(row, line.replace(/^[-*]\s/, ""));
        list.append(row);
      } else {
        list = null;
        const row = make(/^#{1,3}\s/.test(line) ? "h3" : "p");
        formatInline(row, line.replace(/^#{1,3}\s/, ""));
        host.append(row);
      }
    }
  }
  function targets(item) {
    return (Array.isArray(item.links) ? item.links : [])
      .filter(
        (link) =>
          link &&
          ["task", "event", "project"].includes(link.kind) &&
          Number.isSafeInteger(link.id),
      )
      .flatMap((link) => {
        const collection = {
          task: ctx.tasks,
          event: ctx.events,
          project: ctx.projects,
        }[link.kind];
        const target = collection?.find((row) => row.id === link.id);
        return target ? [{ ...link, target }] : [];
      });
  }
  function renderList() {
    if (swipe?.moved) suppressOpenUntil = Date.now() + 500;
    if (swipe?.node.hasPointerCapture(swipe.id))
      swipe.node.releasePointerCapture(swipe.id);
    swipe = null;
    const host = $("#thoughts-list");
    host.replaceChildren();
    const filterKey = JSON.stringify([query, topic, pinnedOnly]);
    if (filterKey !== listFilter) {
      listFilter = filterKey;
      listScroll.scrollTop = 0;
    }
    if (topic && !items().some((item) => item.topic === topic)) topic = "";
    const normalized = query.trim().toLocaleLowerCase(ctx.displayLocale());
    const rows = items()
      .filter(
        (item) =>
          (!pinnedOnly || item.pinned === true) &&
          (!topic || item.topic === topic) &&
          (!normalized ||
            [item.title, item.body, item.topic]
              .filter(Boolean)
              .join(" ")
              .toLocaleLowerCase(ctx.displayLocale())
              .includes(normalized)),
      )
      .sort(
        (a, b) =>
          Number(b.pinned === true) - Number(a.pinned === true) ||
          (b.date || "").localeCompare(a.date || "") ||
          b.id - a.id,
      );
    for (const item of rows.slice(0, limit)) {
      const node = button("", "open", "thought-feed-note");
      node.dataset.thoughtId = String(item.id);
      node.setAttribute("aria-pressed", String(item.id === selected));
      node.setAttribute("data-tooltip", item.title);
      const heading = userText(
        "span",
        "thought-feed-note-title",
        item.title || autoTitle(item.body),
      );
      if (item.pinned === true) heading.prepend(icon("pin"));
      node.append(heading);
      const preview = normalized
        ? searchFragment(item.body, query)
        : excerpt(item);
      if (preview) {
        const snippet = userText("span", "thought-feed-excerpt", "");
        highlightText(snippet, preview, query);
        node.append(snippet);
      }
      const meta = make("span", "thought-feed-meta");
      meta.append(make("time", "", ctx.shortDate(item.date)));
      if (item.topic)
        meta.append(userText("span", "thought-feed-tag", item.topic));
      if (targets(item).length || item.materialIds?.length)
        meta.append(icon("link"));
      node.append(meta);
      host.append(wrapCard(node, item));
    }
    if (!rows.length)
      host.append(
        make(
          "p",
          "thought-feed-empty",
          normalized || topic || pinnedOnly
            ? t("Ничего не найдено.", "No matching thoughts.")
            : t(
                "Записанные мысли появятся здесь.",
                "Your thoughts will appear here.",
              ),
        ),
      );
    $("[data-thought-action='more']").hidden = rows.length <= limit;
    $("[data-thought-action='all']").setAttribute(
      "aria-pressed",
      String(!pinnedOnly),
    );
    $("[data-thought-action='pinned']").setAttribute(
      "aria-pressed",
      String(pinnedOnly),
    );
    const picker = $("#thought-feed-topic");
    const focused = document.activeElement === picker;
    if (!focused) {
      picker.replaceChildren();
      const all = make("option", "", t("Все темы", "All topics"));
      all.value = "";
      picker.append(all);
      for (const name of [
        ...new Set(
          items()
            .map((item) => item.topic)
            .filter(Boolean),
        ),
      ].sort()) {
        const option = userText("option", "", name);
        option.value = name;
        picker.append(option);
      }
      if (![...picker.options].some((option) => option.value === topic))
        topic = "";
      picker.value = topic;
    }
    services.refreshIcons(host);
  }
  function renderDetail() {
    const item = current(),
      host = $(".thought-feed-detail");
    host.hidden = !item;
    screen.dataset.reading = String(Boolean(item));
    if (!item) {
      editOriginal = null;
      host.replaceChildren();
      return;
    }
    if (!editing) editOriginal = null;
    host.replaceChildren();
    const head = make("div", "thought-feed-detail-head"),
      mode = make("div", "thought-feed-mode"),
      actions = make("div", "thought-feed-head-actions");
    for (const [key, text] of [
      ["read", t("Читать", "Read")],
      ["edit", t("Править", "Edit")],
    ]) {
      const node = button(text, key);
      node.setAttribute("aria-pressed", String((key === "edit") === editing));
      mode.append(node);
    }
    const pin = iconButton(
      "pin",
      item.pinned
        ? t("Открепить мысль", "Unpin thought")
        : t("Закрепить мысль", "Pin thought"),
      "pin",
    );
    pin.setAttribute("aria-pressed", String(item.pinned === true));
    const more = iconButton(
      "ellipsis",
      t("Действия с мыслью", "Thought actions"),
      "menu",
    );
    more.setAttribute("aria-expanded", String(menuOpen));
    actions.append(
      pin,
      more,
      iconButton("x", t("Закрыть мысль", "Close thought"), "close"),
    );
    head.append(mode, actions);
    host.append(head);
    if (menuOpen) {
      const menu = make("div", "thought-feed-menu");
      for (const [name, text, key] of [
        ["tag", t("Тема и дата", "Topic and date"), "metadata"],
        ["copy", t("Копировать текст", "Copy text"), "copy"],
        ["trash-2", t("Удалить", "Delete"), "delete"],
      ]) {
        const node = button(text, key);
        node.prepend(icon(name));
        if (key === "delete") node.classList.add("thought-feed-danger");
        menu.append(node);
      }
      host.append(menu);
    }
    if (editing) {
      if (editOriginal?.id !== item.id)
        editOriginal = {
          id: item.id,
          body: item.body,
          title: item.title,
          titleAuto: item.titleAuto,
        };
      const format = make("div", "thought-feed-format");
      format.setAttribute("aria-label", t("Форматирование", "Formatting"));
      for (const [name, text, key] of [
        ["bold", t("Жирный текст", "Bold"), "bold"],
        ["heading-2", t("Заголовок", "Heading"), "heading"],
        ["list", t("Список", "List"), "list"],
      ]) {
        const node = iconButton(name, text, "format");
        node.dataset.format = key;
        format.append(node);
      }
      const plain = button(t("Обычный текст", "Plain text"), "format");
      plain.dataset.format = "plain";
      format.append(plain);
      const textarea = make("textarea", "thought-feed-editor");
      textarea.id = "thought-feed-editor";
      textarea.maxLength = 10000;
      textarea.value = item.body;
      lastEditorBody = item.body;
      textarea.setAttribute("aria-label", t("Текст мысли", "Thought text"));
      host.append(format, textarea);
    } else {
      const text = make("div", "thought-feed-reading");
      text.tabIndex = 0;
      text.setAttribute("role", "textbox");
      text.setAttribute("aria-readonly", "true");
      text.setAttribute(
        "aria-label",
        t(
          "Текст мысли · нажмите, чтобы править",
          "Thought text · click to edit",
        ),
      );
      renderBody(text, item.body);
      highlightTree(text, query);
      listen(text, "click", () => {
        const selection = window.getSelection();
        if (!selection?.isCollapsed && text.contains(selection?.anchorNode))
          return;
        beginEditing();
      });
      listen(text, "keydown", (event) => {
        if (!["Enter", " "].includes(event.key)) return;
        event.preventDefault();
        beginEditing();
      });
      host.append(text);
    }
    const footer = make("div", "thought-feed-detail-footer"),
      status = make(
        "small",
        "",
        editing
          ? t("Сохраняется автоматически", "Autosaves as you type")
          : ctx.shortDate(item.date),
      );
    status.id = "thought-feed-status";
    status.dataset.userContent = "";
    status.setAttribute("role", "status");
    footer.append(status);
    if (editing) {
      const restore = button(
        t("Вернуть текст до правок", "Restore text before editing"),
        "restore-text",
        "thought-feed-button thought-feed-restore",
      );
      restore.id = "thought-feed-restore";
      restore.hidden = item.body === editOriginal.body;
      footer.append(restore);
    }
    if (item.topic)
      footer.append(userText("span", "thought-feed-tag", item.topic));
    host.append(footer);
    const links = targets(item),
      linked = make("div", "thought-feed-linked");
    for (const link of links) {
      const node = button("", "target", "thought-feed-target");
      node.dataset.targetId = String(link.id);
      node.dataset.targetKind = link.kind;
      node.append(
        icon(link.kind === "project" ? "folder" : "circle-plus"),
        userText(
          "span",
          "",
          (link.kind === "project"
            ? t("Проект: ", "Project: ")
            : t("Задача: ", "Task: ")) +
            (link.target.name || link.target.title),
        ),
      );
      linked.append(node);
    }
    if (links.length) host.append(linked);
    const convert = make("details", "thought-feed-actions thought-convert");
    convert.append(
      make("summary", "text-button", t("Преобразовать", "Convert")),
    );
    if (!links.some((link) => ["task", "event"].includes(link.kind))) {
      const node = button(t("В задачу", "Create task"), "task");
      node.prepend(icon("circle-plus"));
      convert.append(node);
    }
    if (!links.some((link) => link.kind === "project")) {
      const node = button(t("В проект", "Create project"), "project");
      node.prepend(icon("folder-plus"));
      convert.append(node);
    }
    host.append(convert);
    ctx.renderMaterialLinks?.(host, item, "thought");
    if (panel) renderPanel(host, item);
    services.refreshIcons(host);
  }
  function beginEditing() {
    if (!current()) return;
    editing = true;
    menuOpen = false;
    panel = null;
    renderDetail();
    const editor = $("#thought-feed-editor");
    editor.focus({ preventScroll: true });
    editor.setSelectionRange(editor.value.length, editor.value.length);
  }
  function field(host, label, id, type, value) {
    const wrap = make("label", "thought-feed-field", label),
      input = make(type === "select" ? "select" : "input");
    if (type !== "select") input.type = type;
    input.id = id;
    if (value !== undefined) input.value = value;
    wrap.append(input);
    host.append(wrap);
    return input;
  }
  function renderPanel(host, item) {
    const form = make("form", "thought-feed-panel");
    form.id = "thought-feed-panel";
    if (panel === "metadata") {
      const topicInput = field(
        form,
        t("Тема · необязательно", "Topic · optional"),
        "thought-feed-edit-topic",
        "text",
        item.topic || "",
      );
      topicInput.maxLength = 40;
      const date = field(
        form,
        t("Дата записи", "Entry date"),
        "thought-feed-edit-date",
        "date",
        item.date,
      );
      date.required = true;
    } else {
      form.append(
        make(
          "h3",
          "",
          panel === "task"
            ? t("Создать задачу", "Create task")
            : t("Создать проект", "Create project"),
        ),
      );
      const title = field(
        form,
        t("Название", "Title"),
        "thought-feed-target-title",
        "text",
        item.title.slice(0, panel === "project" ? 80 : 180),
      );
      title.required = true;
      title.maxLength = panel === "project" ? 80 : 180;
      if (panel === "task") {
        const select = field(
          form,
          t("Проект", "Project"),
          "thought-feed-target-project",
          "select",
        );
        const personal = make("option", "", t("Без проекта", "No project"));
        personal.value = "";
        select.append(personal);
        for (const project of ctx.projects.filter(
          (project) => project.system !== "unassigned",
        )) {
          const option = userText("option", "", project.name);
          option.value = String(project.id);
          select.append(option);
        }
        const details = make("details", "thought-feed-optional");
        details.append(
          make(
            "summary",
            "cursor-interaction",
            t("Дата и время", "Date and time"),
          ),
        );
        const row = make("div", "thought-feed-field-row");
        const date = field(
          row,
          t("Дата", "Date"),
          "thought-feed-target-date",
          "date",
          "",
        );
        date.required = false;
        field(
          row,
          t("Время · по желанию", "Time · optional"),
          "thought-feed-target-time",
          "time",
          "",
        );
        details.append(row);
        form.append(details);
      }
      form.append(
        make(
          "small",
          "thought-feed-hint",
          t(
            panel === "project"
              ? "Мысль перейдёт в проект вместе с текстом и материалами."
              : "Текст станет описанием задачи. Мысль останется в ленте.",
            panel === "project"
              ? "The thought, text and materials move into the project."
              : "The text becomes the task description. Your thought stays in the feed.",
          ),
        ),
      );
    }
    const error = make("p", "thought-feed-danger");
    error.id = "thought-feed-error";
    error.hidden = true;
    error.setAttribute("role", "alert");
    form.append(error);
    const actions = make("div", "thought-feed-actions");
    actions.append(button(t("Отмена", "Cancel"), "cancel-panel"));
    const save = button(
      panel === "metadata" ? t("Сохранить", "Save") : t("Создать", "Create"),
      "submit-panel",
      "thought-feed-button thought-feed-primary",
    );
    actions.append(save);
    form.append(actions);
    host.append(form);
  }
  function flush() {
    clearTimeout(timer);
    const item = current(),
      editor = $("#thought-feed-editor");
    if (!item || !editor) return;
    const status = $("#thought-feed-status"),
      body = editor.value;
    if (!body.trim()) {
      status.textContent = t(
        "Пустую мысль можно удалить через меню.",
        "Use the menu to delete an empty thought.",
      );
      return;
    }
    if (item.body !== body) {
      if (
        !item.title ||
        item.titleAuto === true ||
        item.title === autoTitle(item.body)
      ) {
        item.title = autoTitle(body);
        item.titleAuto = true;
      }
      item.body = body;
      item.updatedAt = Date.now();
      renderList();
      changed();
    }
    status.textContent = t("Сохраняем…", "Saving…");
    ctx.persistState();
    Promise.resolve(services.flush())
      .then(() => {
        if (
          status.isConnected &&
          current()?.id === item.id &&
          editor.value === body
        )
          status.textContent = t("Сохранено", "Saved");
      })
      .catch((error) => {
        if (status.isConnected)
          status.textContent =
            t("Не сохранено: ", "Not saved: ") + String(error);
      });
  }
  function saveDraft() {
    clearTimeout(draftTimer);
    const revision = ++draftRevision;
    state.uiPreferences.thoughtDraft = capture.value;
    ctx.persistState();
    draftStatus.textContent = capture.value ? t("Сохраняем…", "Saving…") : "";
    Promise.resolve(services.flush())
      .then(() => {
        if (revision === draftRevision)
          draftStatus.textContent = capture.value
            ? t("Черновик сохранён", "Draft saved")
            : "";
      })
      .catch(() => {
        if (revision === draftRevision)
          draftStatus.textContent = t(
            "Не сохранено. Текст остаётся здесь.",
            "Not saved. Your text stays here.",
          );
      });
  }
  function closeSelection() {
    flush();
    selected = null;
    editing = false;
    menuOpen = false;
    panel = null;
    renderList();
    renderDetail();
  }
  function create(value = capture.value, keepDraft = false) {
    const body = String(value).trim();
    if (!body) {
      capture.focus();
      return;
    }
    flush();
    const item = {
      id: ctx.createId(),
      title: autoTitle(body),
      body,
      context: "Личное",
      date: ctx.dateKey(new Date()),
      titleAuto: true,
      pinned: false,
      topic: "",
      createdAt: Date.now(),
    };
    items().unshift(item);
    if (!keepDraft) {
      capture.value = "";
      saveDraft();
    }
    selected = null;
    editing = false;
    menuOpen = false;
    panel = null;
    query = topic = "";
    pinnedOnly = false;
    limit = 60;
    $("#thought-feed-search").value = "";
    renderList();
    renderDetail();
    changed();
    Promise.resolve(services.flush())
      .then(() => ctx.notify(t("Мысль сохранена", "Thought saved")))
      .catch((error) =>
        ctx.notify(t("Не сохранено: ", "Not saved: ") + String(error)),
      );
  }
  function submitPanel() {
    flush();
    const item = current(),
      form = $("#thought-feed-panel");
    if (!item || !form) return;
    if (!form.checkValidity()) {
      const details = form.querySelector("details");
      if (details) details.open = true;
      form.reportValidity();
      return;
    }
    const error = $("#thought-feed-error"),
      fail = (text) => {
        error.textContent = text;
        error.hidden = false;
      };
    if (panel === "metadata") {
      item.topic = $("#thought-feed-edit-topic").value.trim();
      item.date = $("#thought-feed-edit-date").value;
    } else {
      const name = $("#thought-feed-target-title").value.trim();
      if (!name) {
        $("#thought-feed-target-title").focus();
        return;
      }
      const kind = panel;
      if (
        targets(item).some((link) =>
          kind === "project"
            ? link.kind === "project"
            : ["task", "event"].includes(link.kind),
        )
      )
        return;
      let target, targetKind;
      if (kind === "project") {
        if (
          ctx.projects.some(
            (project) =>
              project.name.toLocaleLowerCase(ctx.displayLocale()) ===
              name.toLocaleLowerCase(ctx.displayLocale()),
          )
        ) {
          fail(
            t(
              "Проект с таким названием уже есть.",
              "A project with this name already exists.",
            ),
          );
          return;
        }
        target = {
          id: ctx.createId(),
          name,
          description: item.body,
          tone:
            ctx.snapshotData().palette === "custom"
              ? "neutral"
              : ctx.snapshotData().palette,
          sourceThoughtId: item.id,
          materialIds: [...(item.materialIds || [])],
        };
        ctx.projects.push(target);
        targetKind = "project";
      } else {
        const projectId = Number($("#thought-feed-target-project").value),
          project = ctx.projects.find((row) => row.id === projectId),
          time = $("#thought-feed-target-time").value,
          date = $("#thought-feed-target-date").value;
        if (projectId && !project) {
          fail(
            t("Выберите существующий проект.", "Choose an existing project."),
          );
          return;
        }
        const base = {
          title: name,
          context: project?.name || personalProject,
          description: item.body,
          date,
          createdDate: ctx.dateKey(new Date()),
          done: false,
          status: "planned",
          sourceThoughtId: item.id,
        };
        if (time) {
          if (!date) {
            fail(t("Для времени укажите дату.", "Choose a date for the time."));
            return;
          }
          const [hours, minutes] = time.split(":").map(Number),
            start = hours * 60 + minutes;
          if (start >= 1439) {
            fail(
              t(
                "Укажите время раньше 23:59.",
                "Choose a time earlier than 23:59.",
              ),
            );
            return;
          }
          const end = Math.min(1439, start + 30);
          target = {
            id: ctx.createId(),
            ...base,
            start: time,
            end:
              String(Math.floor(end / 60)).padStart(2, "0") +
              ":" +
              String(end % 60).padStart(2, "0"),
            tone: project?.tone || "neutral",
            duration: end - start,
          };
          ctx.events.push(target);
          targetKind = "event";
        } else {
          target = { id: ctx.createId(), ...base, duration: 30 };
          ctx.tasks.push(target);
          targetKind = "task";
        }
      }
      const previousLinks = [...(item.links || [])];
      const thoughtIndex = items().indexOf(item);
      item.links = [
        ...targets(item).map(({ kind, id }) => ({ kind, id })),
        { kind: targetKind, id: target.id },
      ];
      if (kind === "project") {
        items().splice(thoughtIndex, 1);
        selected = null;
        editing = false;
      }
      ctx.refreshDestinations?.();
      ctx.renderTasks();
      ctx.renderCalendar();
      ctx.renderProjects();
      ctx.notify(
        kind === "project"
          ? t("Проект создан", "Project created")
          : t("Задача создана", "Task created"),
        () => {
          const collection = {
              project: ctx.projects,
              task: ctx.tasks,
              event: ctx.events,
            }[targetKind],
            index = collection.indexOf(target);
          const referenced =
            targetKind === "project" &&
            [...ctx.tasks, ...ctx.events].some(
              (row) => row.context === target.name,
            );
          if (index >= 0 && !referenced) {
            collection.splice(index, 1);
            item.links = previousLinks;
            if (
              kind === "project" &&
              !items().some((row) => row.id === item.id)
            )
              items().splice(Math.min(thoughtIndex, items().length), 0, item);
            ctx.refreshDestinations?.();
            ctx.renderTasks();
            ctx.renderCalendar();
            ctx.renderProjects();
            render();
            changed();
          } else if (referenced)
            ctx.notify(
              t(
                "В проекте уже есть задачи. Удалить его можно в Проектах.",
                "This project already has tasks. You can delete it in Projects.",
              ),
            );
        },
      );
    }
    panel = null;
    renderList();
    renderDetail();
    changed();
  }
  function render() {
    if (ctx.page() !== "thoughts") flush();
    if (selected !== null && !current()) {
      selected = null;
      editing = false;
      panel = null;
      menuOpen = false;
    }
    renderList();
    if (!editing || !$("#thought-feed-editor")) renderDetail();
    $("#thought-feed-search").placeholder = t("Найти мысль", "Find a thought");
    services.refreshIcons(screen);
  }
  function open(item, edit = false, searchQuery = "") {
    flush();
    ctx.closeDialog();
    selected = item?.id ?? null;
    editing = Boolean(item && edit);
    menuOpen = false;
    panel = null;
    if (searchQuery) {
      query = searchQuery;
      topic = "";
      pinnedOnly = false;
      limit = 60;
      $("#thought-feed-search").value = searchQuery;
    }
    if (ctx.page() !== "thoughts") ctx.showPage("thoughts");
    renderList();
    renderDetail();
    if (!item) capture.focus();
    else if (editing) $("#thought-feed-editor")?.focus();
    else $("[data-thought-action='edit']")?.focus();
    if (searchQuery && !editing)
      $(".thought-feed-reading mark")?.scrollIntoView({ block: "nearest" });
  }
  listen(screen, "input", (event) => {
    if (event.target.id === "thought-feed-capture") {
      clearTimeout(draftTimer);
      draftStatus.textContent = t("Сохраняем…", "Saving…");
      draftTimer = setTimeout(saveDraft, 350);
    }
    if (event.target.id === "thought-feed-editor") {
      if (!event.target.value.trim() && lastEditorBody.trim()) {
        event.target.value = lastEditorBody;
        $("#thought-feed-status").textContent = t(
          "Текст оставлен. Удалить мысль можно через меню.",
          "Text kept. Use the menu to delete the thought.",
        );
        return;
      }
      lastEditorBody = event.target.value;
      const restore = $("#thought-feed-restore");
      if (restore) restore.hidden = event.target.value === editOriginal?.body;
      clearTimeout(timer);
      $("#thought-feed-status").textContent = t("Сохраняем…", "Saving…");
      timer = setTimeout(flush, 650);
    }
    if (event.target.id === "thought-feed-search") {
      query = event.target.value;
      limit = 60;
      closeSelection();
    }
  });
  listen(screen, "beforeinput", (event) => {
    const editor = event.target;
    if (
      editor.id !== "thought-feed-editor" ||
      !event.inputType?.startsWith("delete") ||
      editor.selectionStart !== 0 ||
      editor.selectionEnd !== editor.value.length ||
      !editor.value.trim()
    )
      return;
    if (event.cancelable) event.preventDefault();
    $("#thought-feed-status").textContent = t(
      "Текст оставлен. Удалить мысль можно через меню.",
      "Text kept. Use the menu to delete the thought.",
    );
  });
  listen(screen, "focusout", (event) => {
    if (event.target.id === "thought-feed-editor") flush();
    if (event.target.id === "thought-feed-capture") saveDraft();
  });
  listen(screen, "change", (event) => {
    if (event.target.id === "thought-feed-topic") {
      topic = event.target.value;
      limit = 60;
      closeSelection();
    }
  });
  function wrapCard(node, item) {
    const row = make("div", "thought-swipe-row");
    const remove = iconButton(
      "trash-2",
      t("Удалить мысль", "Delete thought") + ": " + item.title,
      "delete-row",
    );
    remove.classList.add("thought-swipe-delete");
    remove.dataset.thoughtId = String(item.id);
    remove.tabIndex = -1;
    remove.setAttribute("aria-hidden", "true");
    row.append(remove, node);
    return row;
  }
  function removeThought(item) {
    if (!item) return;
    flush();
    if (selected === item.id) {
      selected = null;
      editing = false;
      menuOpen = false;
      panel = null;
    }
    ctx.removeWithUndo(items(), item, () => {
      render();
      ctx.onChange?.();
    });
  }
  listen(root, "pointerdown", (event) => {
    if (event.target.closest("[data-format]")) event.preventDefault();
    const node = event.target.closest(
      ".thought-feed-note,.thought-swipe-row > .thought-card",
    );
    if (event.target.closest(".thought-swipe-delete")) return;
    if (!node || event.target.closest(".entity-more")) {
      for (const row of root.querySelectorAll(
        '.thought-swipe-row[data-open="true"]',
      ))
        setSwipe(row, false);
      return;
    }
    if (!node || event.button !== 0 || event.isPrimary === false) return;
    const row = node.closest(".thought-swipe-row");
    for (const opened of root.querySelectorAll(
      '.thought-swipe-row[data-open="true"]',
    ))
      if (opened !== row) setSwipe(opened, false);
    swipe = {
      node,
      row,
      id: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      offset: row.dataset.open === "true" ? -64 : 0,
      moved: false,
    };
  });
  function setSwipe(row, open) {
    row.dataset.open = String(open);
    row.style.setProperty("--thought-swipe-offset", open ? "-64px" : "0px");
    const remove = row.querySelector(".thought-swipe-delete");
    remove.tabIndex = open ? 0 : -1;
    remove.setAttribute("aria-hidden", String(!open));
  }
  listen(root, "pointermove", (event) => {
    if (!swipe || event.pointerId !== swipe.id) return;
    if (!swipe.node.isConnected) {
      swipe = null;
      return;
    }
    const dx = event.clientX - swipe.x,
      dy = event.clientY - swipe.y;
    if (!swipe.moved && Math.abs(dy) > 12 && Math.abs(dy) > Math.abs(dx)) {
      swipe = null;
      return;
    }
    if (
      !swipe.moved &&
      Math.abs(dx) > 12 &&
      Math.abs(dx) > Math.abs(dy) * 1.5
    ) {
      swipe.moved = true;
      swipe.node.setPointerCapture(event.pointerId);
      swipe.row.dataset.swiping = "true";
    }
    if (!swipe.moved) return;
    if (event.cancelable) event.preventDefault();
    swipe.position = Math.max(-64, Math.min(0, swipe.offset + dx));
    swipe.row.style.setProperty(
      "--thought-swipe-offset",
      swipe.position + "px",
    );
  });
  function finishSwipe(event, cancelled = false) {
    if (!swipe || event.pointerId !== swipe.id) return;
    const current = swipe;
    swipe = null;
    delete current.row.dataset.swiping;
    if (current.moved) {
      suppressOpenUntil = Date.now() + 500;
      setSwipe(
        current.row,
        cancelled ? current.offset < 0 : current.position <= -32,
      );
      if (current.node.hasPointerCapture(event.pointerId))
        current.node.releasePointerCapture(event.pointerId);
    }
  }
  listen(root, "pointerup", (event) => finishSwipe(event));
  listen(root, "pointercancel", (event) => finishSwipe(event, true));
  listen(
    root,
    "click",
    (event) => {
      if (
        Date.now() < suppressOpenUntil &&
        event.target.closest(".thought-swipe-row") &&
        !event.target.closest(".thought-swipe-delete")
      ) {
        event.preventDefault();
        event.stopImmediatePropagation();
      }
    },
    true,
  );
  listen(root, "click", (event) => {
    const remove = event.target.closest(".thought-swipe-delete");
    if (remove && !screen.contains(remove))
      removeThought(
        items().find((item) => item.id === Number(remove.dataset.thoughtId)),
      );
  });
  listen(screen, "keydown", (event) => {
    if (
      (event.ctrlKey || event.metaKey) &&
      event.key === "Enter" &&
      event.target.id === "thought-feed-capture"
    ) {
      event.preventDefault();
      create();
    }
    if (event.key === "Escape" && selected !== null && !ctx.hasDialog()) {
      event.preventDefault();
      closeSelection();
    }
  });
  listen(screen, "submit", (event) => {
    if (event.target.id === "thought-feed-panel") {
      event.preventDefault();
      submitPanel();
    }
  });
  listen(screen, "click", async (event) => {
    const node = event.target.closest("[data-thought-action]");
    if (!node) return;
    const key = node.dataset.thoughtAction;
    if (key === "format") {
      const editor = $("#thought-feed-editor");
      if (!editor) return;
      const start = editor.selectionStart,
        end = editor.selectionEnd,
        value = editor.value;
      let a = start,
        b = end,
        replacement = value.slice(start, end);
      if (node.dataset.format === "bold")
        replacement =
          replacement.startsWith("**") && replacement.endsWith("**")
            ? replacement.slice(2, -2)
            : "**" + (replacement || t("текст", "text")) + "**";
      else {
        a = value.lastIndexOf("\n", start - 1) + 1;
        b = value.indexOf("\n", end);
        if (b < 0) b = value.length;
        replacement = value
          .slice(a, b)
          .split("\n")
          .map((line) =>
            node.dataset.format === "heading"
              ? "# " + line.replace(/^#+\s*/, "")
              : node.dataset.format === "list"
                ? "- " + line.replace(/^[-*]\s*/, "")
                : line.replace(/^#+\s*|^[-*]\s*/, "").replace(/\*\*/g, ""),
          )
          .join("\n");
      }
      if (value.length - (b - a) + replacement.length > 10000) return;
      editor.setRangeText(replacement, a, b, "select");
      editor.focus();
      flush();
      return;
    }
    if (key === "capture") {
      create();
      return;
    }
    if (key === "open") {
      if (Date.now() < suppressOpenUntil) {
        event.preventDefault();
        return;
      }
      open(items().find((item) => item.id === Number(node.dataset.thoughtId)));
      return;
    }
    if (key === "all" || key === "pinned") {
      pinnedOnly = key === "pinned";
      limit = 60;
      closeSelection();
      return;
    }
    if (key === "more") {
      limit += 60;
      renderList();
      return;
    }
    if (key === "close") {
      closeSelection();
      return;
    }
    if (key === "delete-row") {
      const item = items().find(
        (item) => item.id === Number(node.dataset.thoughtId),
      );
      removeThought(item);
      return;
    }
    flush();
    const item = current();
    if (!item) return;
    if (key === "edit" || key === "read") {
      editing = key === "edit";
      menuOpen = false;
      panel = null;
      renderDetail();
      if (editing) $("#thought-feed-editor").focus();
    }
    if (key === "restore-text" && editOriginal?.id === item.id) {
      const editor = $("#thought-feed-editor");
      editor.value = editOriginal.body;
      lastEditorBody = editOriginal.body;
      item.title = editOriginal.title;
      item.titleAuto = editOriginal.titleAuto;
      flush();
      $("#thought-feed-restore").hidden = true;
      editor.focus({ preventScroll: true });
      editor.setSelectionRange(editor.value.length, editor.value.length);
    }
    if (key === "pin") {
      item.pinned = item.pinned !== true;
      renderList();
      renderDetail();
      changed();
    }
    if (key === "menu") {
      menuOpen = !menuOpen;
      renderDetail();
    }
    if (["metadata", "task", "project"].includes(key)) {
      panel = key;
      menuOpen = false;
      editing = false;
      renderDetail();
      $("#thought-feed-panel input")?.focus();
    }
    if (key === "cancel-panel") {
      panel = null;
      renderDetail();
    }
    if (key === "submit-panel") submitPanel();
    if (key === "delete") {
      selected = null;
      editing = false;
      menuOpen = false;
      panel = null;
      ctx.removeWithUndo(items(), item, () => {
        render();
        ctx.onChange?.();
      });
    }
    if (key === "copy") {
      try {
        await navigator.clipboard.writeText(item.body);
        ctx.notify(t("Текст скопирован", "Text copied"));
      } catch {
        editing = true;
        menuOpen = false;
        renderDetail();
        const editor = $("#thought-feed-editor");
        editor.focus();
        editor.select();
        ctx.notify(
          t("Текст выделен — скопируйте его.", "Text selected — copy it."),
        );
      }
    }
    if (key === "target") {
      const collection = {
          task: ctx.tasks,
          event: ctx.events,
          project: ctx.projects,
        }[node.dataset.targetKind],
        target = collection?.find(
          (row) => row.id === Number(node.dataset.targetId),
        );
      if (target) ctx.editEntity(node.dataset.targetKind, target, node);
    }
  });
  const flushAll = () => {
    flush();
    saveDraft();
  };
  listen(window, "pagehide", flushAll);
  listen(window, "life-os:pause", flushAll);
  render();
  return {
    render,
    open,
    wrapCard,
    captureText: (text) => create(text, true),
    flush: flushAll,
    metadata() {
      panel = "metadata";
      editing = false;
      menuOpen = false;
      renderDetail();
      $("#thought-feed-edit-topic")?.focus();
    },
    rehydrate() {
      clearTimeout(timer);
      clearTimeout(draftTimer);
      selected = null;
      editing = false;
      menuOpen = false;
      panel = null;
      query = topic = "";
      pinnedOnly = false;
      capture.value = state.uiPreferences.thoughtDraft || "";
      $("#thought-feed-search").value = "";
      render();
    },
    dispose() {
      clearTimeout(timer);
      clearTimeout(draftTimer);
    },
    excerpt,
  };
}
