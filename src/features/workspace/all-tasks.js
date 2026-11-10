export function installAllTasks(ctx, ui) {
  const { make, action } = ctx,
    form = ui.dialog("all-tasks-dialog", "Все задачи"),
    search = make("input"),
    list = make("div", "all-tasks-list"),
    filters = make("div", "all-tasks-filters"),
    scope = make("select"),
    project = make("select"),
    more = action(
      "Показать ещё",
      () => {
        limit += 200;
        render();
      },
      "button",
    );
  let limit = 200;
  scope.setAttribute("aria-label", "Фильтр задач");
  project.setAttribute("aria-label", "Проект задач");
  for (const [value, title] of [
    ["all", "Все"],
    ["today", "Сегодня"],
    ["undated", "Без даты"],
    ["done", "Завершённые"],
    ["active", "В работе"],
  ]) {
    const option = make("option", "", title);
    option.value = value;
    scope.append(option);
  }
  search.type = "search";
  search.placeholder = "Поиск по задачам и проектам";
  search.setAttribute("aria-label", "Поиск всех задач");
  filters.append(scope, project);
  form.append(search, filters, list, more);
  form.onsubmit = (e) => e.preventDefault();
  function render() {
    list.replaceChildren();
    const query = search.value.trim().toLowerCase(),
      items = [
        ...ctx.tasks.map((item) => ({ kind: "task", item })),
        ...ctx.events.map((item) => ({ kind: "event", item })),
      ]
        .filter(
          ({ item }) =>
            (!project.value || item.context === project.value) &&
            (scope.value === "all" ||
              (scope.value === "today" && item.date === ctx.todayKey) ||
              (scope.value === "undated" && !item.date) ||
              (scope.value === "done" && item.done) ||
              (scope.value === "active" && !item.done)) &&
            [item.title, item.context, item.description]
              .join(" ")
              .toLowerCase()
              .includes(query),
        )
        .sort(
          (a, b) =>
            Boolean(a.item.done) - Boolean(b.item.done) ||
            String(a.item.date || "9999").localeCompare(
              String(b.item.date || "9999"),
            ),
        );
    for (const { kind, item } of items.slice(0, limit)) {
      const row = make("div", "all-task-row"),
        open = action(
          item.title,
          (event) => {
            ctx.closeDialog();
            ctx.editEntity(kind, item, event.currentTarget);
          },
          "text-button",
        );
      open.dataset.userContent = "true";
      row.append(
        open,
        make(
          "small",
          "",
          [
            item.context,
            item.date || "Без даты",
            item.start || item.time || "Без времени",
            item.done ? "Готово" : "",
          ]
            .filter(Boolean)
            .join(" · "),
        ),
      );
      list.append(row);
    }
    if (!items.length) list.append(make("p", "aux-note", "Задач нет."));
    more.hidden = items.length <= limit;
    if (items.length > limit)
      list.append(
        make("p", "aux-note", "Показано " + limit + " из " + items.length),
      );
    ctx.fitDialog();
  }
  const reset = () => {
    limit = 200;
    render();
  };
  search.oninput = reset;
  scope.onchange = project.onchange = reset;
  const button = action(
    "Все задачи",
    () => {
      search.value = "";
      limit = 200;
      scope.value = "all";
      project.replaceChildren();
      for (const name of [
        "",
        ...new Set(
          [...ctx.tasks, ...ctx.events]
            .map((item) => item.context)
            .filter(Boolean),
        ),
      ]) {
        const option = make("option", "", name || "Все проекты");
        option.value = name;
        project.append(option);
      }
      render();
      ctx.openDialog("all-tasks-dialog");
    },
    "text-button",
  );
  button.id = "all-tasks-open";
  const templates = ctx.$("#templates-open");
  if (templates) templates.before(button);
  else ctx.$(".tasks").append(button);
  return {
    dispose() {
      search.oninput = null;
      scope.onchange = project.onchange = null;
    },
  };
}
